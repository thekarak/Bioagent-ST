import json
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from bioagent_st.agents.executor import ExecutionError, execute_plan
from bioagent_st.agents.planner import Planner, PlanValidationError
from bioagent_st.analysis.clustering import ClusteringParams
from bioagent_st.analysis.expression import GeneExpressionParams
from bioagent_st.analysis.qc import QCParams
from bioagent_st.datasets import REAL_DLPFC_151673_PATH, REAL_DLPFC_PATH, load_dataset
from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.llm.client import MockLLMClient
from bioagent_st.reporting.generator import build_report, validate_report, write_report
from bioagent_st.routing import (
    FixedSelector,
    LayaSelector,
    ManualSelector,
    RuleSelector,
    WorkflowSelector,
)
from bioagent_st.schemas.workflows import (
    SUPPORTED_WORKFLOWS,
    WORKFLOW_CONTRACTS,
    SelectorKind,
    WorkflowId,
    is_supported,
)
from bioagent_st.utils.hashing import anndata_content_hash
from bioagent_st.utils.ids import new_id

app = FastAPI(title="BioAgent-ST API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RUNS_DIR = Path(os.environ.get("BIOAGENT_RUNS_DIR", "artifacts/api"))


class SelectRequest(BaseModel):
    question: str = Field(min_length=1)
    selector: SelectorKind = "rules"
    workflow: WorkflowId | None = None


class RunRequest(BaseModel):
    question: str = Field(min_length=1)
    dataset_id: str
    selector: SelectorKind = "rules"
    workflow: WorkflowId | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class SelectedWorkflow(BaseModel):
    selector: dict[str, Any]
    workflow: WorkflowId
    supported: bool


def _selector(kind: SelectorKind, workflow: WorkflowId | None) -> WorkflowSelector:
    if kind == "manual":
        if workflow is None:
            raise HTTPException(status_code=422, detail="workflow is required for manual selection")
        return ManualSelector(workflow)
    if kind == "laya":
        return LayaSelector()
    return RuleSelector()


def _dataset_source(dataset_id: str) -> str:
    if dataset_id == "synthetic":
        return "synthetic"
    if dataset_id == "real_dlpfc":
        if not REAL_DLPFC_PATH.is_file():
            raise HTTPException(status_code=409, detail="real_dlpfc is not available locally")
        return "real_dlpfc"
    if dataset_id == "real_dlpfc_151673":
        if not REAL_DLPFC_151673_PATH.is_file():
            raise HTTPException(
                status_code=409, detail="real_dlpfc_151673 is not available locally"
            )
        return "real_dlpfc_151673"
    raise HTTPException(
        status_code=404,
        detail=(
            "unknown dataset_id; available: synthetic"
            + (", real_dlpfc" if REAL_DLPFC_PATH.is_file() else "")
            + (", real_dlpfc_151673" if REAL_DLPFC_151673_PATH.is_file() else "")
        ),
    )


def _workflow_parameters(workflow: str, parameters: dict[str, Any]) -> dict[str, Any]:
    if workflow == "quality_assessment":
        return dict(QCParams.model_validate(parameters).model_dump())
    if workflow == "spatial_clustering":
        clustering_payload = parameters.get("clustering", parameters)
        if not isinstance(clustering_payload, dict):
            raise HTTPException(status_code=422, detail="clustering parameters must be an object")
        ClusteringParams.model_validate(clustering_payload)
        return {"clustering": clustering_payload}
    if workflow == "gene_expression":
        payload = dict(parameters)
        return dict(GeneExpressionParams.model_validate(payload).model_dump())
    raise HTTPException(status_code=422, detail=f"unsupported workflow: {workflow}")


def _run_path(run_id: str) -> Path:
    if not run_id.startswith("run_") or "/" in run_id or "\\" in run_id:
        raise HTTPException(status_code=400, detail="invalid run id")
    return RUNS_DIR / run_id


def _load_record(run_id: str) -> dict[str, Any]:
    path = _run_path(run_id) / "run_record.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="run not found")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise HTTPException(status_code=500, detail="run record is malformed")
    return dict(payload)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/workflows")
def workflows() -> dict[str, Any]:
    return {
        "workflows": [WORKFLOW_CONTRACTS[workflow].model_dump() for workflow in SUPPORTED_WORKFLOWS]
    }


@app.get("/api/datasets")
def datasets() -> dict[str, Any]:
    catalog = [
        {
            "id": "synthetic",
            "name": "Synthetic spatial fixture",
            "available": True,
            "has_spatial_coordinates": True,
            "illustrative": True,
        }
    ]
    if REAL_DLPFC_PATH.is_file():
        catalog.append(
            {
                "id": "real_dlpfc",
                "name": "DLPFC Visium 151507",
                "available": True,
                "has_spatial_coordinates": True,
                "illustrative": False,
            }
        )
    if REAL_DLPFC_151673_PATH.is_file():
        catalog.append(
            {
                "id": "real_dlpfc_151673",
                "name": "DLPFC Visium 151673",
                "available": True,
                "has_spatial_coordinates": True,
                "illustrative": False,
            }
        )
    return {"datasets": catalog}


@app.post("/api/select")
def select(request: SelectRequest) -> dict[str, Any]:
    try:
        decision = _selector(request.selector, request.workflow).select(request.question)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {
        "selector": decision.model_dump(),
        "workflow": decision.decision,
        "supported": is_supported(decision.decision),
    }


@app.post("/api/runs")
def create_run(request: RunRequest) -> dict[str, Any]:
    source = _dataset_source(request.dataset_id)
    try:
        adata = load_dataset(source)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    selector = _selector(request.selector, request.workflow)
    try:
        decision = selector.select(request.question)
        if not is_supported(decision.decision):
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "selector did not choose a supported workflow",
                    "selector": decision.model_dump(),
                },
            )
        parameters = _workflow_parameters(decision.decision, request.parameters)
        plan = Planner(
            MockLLMClient(),
            selector=FixedSelector(decision),
        ).create_plan(request.question, request.dataset_id, parameters)
    except HTTPException:
        raise
    except (PlanValidationError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    run_id = new_id("run")
    output = RUNS_DIR / run_id
    output.mkdir(parents=True, exist_ok=True)
    try:
        result = execute_plan(
            plan,
            adata,
            output,
            experiment_id=run_id,
            dataset_hash=anndata_content_hash(adata),
        )
    except (ExecutionError, ValueError, KeyError) as error:
        record: dict[str, Any] = {
            "run_id": run_id,
            "status": "failed",
            "error": str(error),
            "selector": decision.model_dump(),
            "workflow": decision.decision,
            "plan": plan.model_dump(mode="json"),
            "params": parameters,
            "artifact_ids": [],
            "artifacts": [],
            "evidence": [],
            "warnings": [],
        }
        (output / "run_record.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
        raise HTTPException(status_code=500, detail=record) from error

    provenance_store = ProvenanceStore(output / "ledger.db")
    evidence_store = EvidenceStore(output / "ledger.db")
    try:
        report = build_report(
            question=request.question,
            dataset_id=request.dataset_id,
            plan=plan,
            evidence=result.evidence,
            provenance=provenance_store.list(),
            artifact_ids_by_step=result.step_artifact_ids,
        )
        validate_report(report, evidence_store, provenance_store)
        write_report(report, output / "report.md")
        provenance = provenance_store.list()
        evidence = evidence_store.list()
    finally:
        evidence_store.close()
        provenance_store.close()

    gate_outcome = result.gate_results[-1].decision if result.gate_results else "ALLOW"
    gate_reasons = result.gate_results[-1].reasons if result.gate_results else []
    run_record: dict[str, Any] = {
        "run_id": run_id,
        "request_text": request.question,
        "status": "review" if result.needs_review else "completed",
        "gate_outcome": gate_outcome,
        "policy": {
            "decision": gate_outcome,
            "reasons": gate_reasons,
        },
        "selector": decision.model_dump(),
        "workflow": decision.decision,
        "plan": plan.model_dump(mode="json"),
        "params": parameters,
        "artifact_ids": result.artifact_ids,
        "artifacts": [
            {
                "artifact_id": item.artifact_id,
                "artifact_type": item.artifact_type,
                "output_uri": item.output_uri,
                "output_hash": item.output_hash,
                "dataset_hash": item.dataset_hash,
                "code_commit": item.code_commit,
                "tool_name": item.tool_name,
                "tool_version": item.tool_version,
            }
            for item in provenance
        ],
        "evidence": [item.model_dump(mode="json") for item in evidence],
        "warnings": result.warnings,
        "review_required": result.needs_review,
        "report_path": str(output / "report.md"),
    }
    (output / "run_record.json").write_text(json.dumps(run_record, indent=2), encoding="utf-8")
    return run_record


@app.get("/api/runs")
def list_runs() -> dict[str, Any]:
    if not RUNS_DIR.exists():
        return {"runs": []}
    runs: list[dict[str, Any]] = []
    for entry in sorted(RUNS_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if entry.is_dir() and entry.name.startswith("run_"):
            record_path = entry / "run_record.json"
            if record_path.is_file():
                try:
                    data = json.loads(record_path.read_text(encoding="utf-8"))
                    if isinstance(data, dict):
                        runs.append(data)
                except Exception:
                    continue
    return {"runs": runs}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    return _load_record(run_id)


@app.get("/api/runs/{run_id}/report")
def get_report(run_id: str) -> dict[str, Any]:
    report_path = _run_path(run_id) / "report.md"
    if not report_path.is_file():
        raise HTTPException(status_code=404, detail="report not found")
    return {"report_markdown": report_path.read_text(encoding="utf-8")}


@app.get("/api/runs/{run_id}/artifacts/{artifact_id}")
def get_artifact(run_id: str, artifact_id: str) -> FileResponse:
    record = _load_record(run_id)
    artifacts = record.get("artifacts", [])
    if not isinstance(artifacts, list):
        raise HTTPException(status_code=500, detail="run record is malformed")
    match = next(
        (item for item in artifacts if item.get("artifact_id") == artifact_id),
        None,
    )
    if not isinstance(match, dict):
        raise HTTPException(status_code=404, detail="artifact not found")
    output_uri = match.get("output_uri")
    if not isinstance(output_uri, str):
        raise HTTPException(status_code=500, detail="artifact path is malformed")
    path = Path(output_uri).resolve()
    root = _run_path(run_id).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="artifact file not found")
    return FileResponse(path)
