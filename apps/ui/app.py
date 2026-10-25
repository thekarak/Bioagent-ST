"""
apps/ui/app.py — BioAgent-ST Streamlit Interface.

Verification-first spatial transcriptomics analysis UI.
Enforces deterministic science, typed tools, provenance tracing,
policy safety gating, 5-state evidence verification, and validated reports.

Zero-emoji clean typography and status badges.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import streamlit as st
from anndata import read_h5ad

from bioagent_st.agents.executor import ExecutionError, execute_plan
from bioagent_st.agents.planner import Planner, PlanValidationError
from bioagent_st.analysis.clustering import ClusteringParams
from bioagent_st.analysis.expression import GeneExpressionParams
from bioagent_st.analysis.qc import QCParams
from bioagent_st.datasets import (
    REAL_DLPFC_151673_PATH,
    REAL_DLPFC_PATH,
    inspect_h5ad,
    load_dataset,
)
from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.llm.client import MockLLMClient
from bioagent_st.reporting.generator import (
    ReportValidationError,
    build_report,
    validate_report,
    write_report,
)
from bioagent_st.routing import (
    FixedSelector,
    LayaSelector,
    ManualSelector,
    RuleSelector,
    WorkflowSelector,
)
from bioagent_st.schemas.workflows import (
    SUPPORTED_WORKFLOWS,
    SelectorDecision,
    SelectorKind,
    WorkflowId,
    is_supported,
)
from bioagent_st.utils.hashing import anndata_content_hash, sha256_file
from bioagent_st.utils.ids import new_id
from bioagent_st.verification.policy_gate import GateConfig, GateResult, gate_request

# ---------------------------------------------------------------------------
# Constants and Directory Setup
# ---------------------------------------------------------------------------

UI_RUNS_DIR = Path("artifacts/ui_runs")
API_RUNS_DIR = Path("artifacts/api")
UPLOADS_DIR = Path("artifacts/uploads")

UI_RUNS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_SIZE_MB = 500
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024


def validate_upload_size(size_bytes: int) -> tuple[bool, str]:
    """Validate that uploaded file does not exceed maximum allowed size."""
    if size_bytes > MAX_UPLOAD_SIZE_BYTES:
        size_mb = size_bytes / (1024 * 1024)
        return (
            False,
            f"File size ({size_mb:.1f} MB) exceeds maximum supported limit of {MAX_UPLOAD_SIZE_MB} MB.",
        )
    return True, "OK"


def save_uploaded_stream(uploaded_file: Any, target_path: Path) -> int:
    """Save uploaded file stream in 8 MB chunks to minimize memory consumption."""
    bytes_written = 0
    with open(target_path, "wb") as f:
        while chunk := uploaded_file.read(8 * 1024 * 1024):
            f.write(chunk)
            bytes_written += len(chunk)
    return bytes_written


def get_dataset_gene_names(dataset_key: str, custom_file_path: Path | None = None) -> list[str]:
    """Extract available gene names from the selected dataset's var_names."""
    try:
        if dataset_key == "synthetic":
            adata = load_dataset("synthetic")
            return [str(g) for g in adata.var_names]
        if dataset_key == "upload" and custom_file_path and custom_file_path.is_file():
            adata = read_h5ad(custom_file_path, backed="r")
            genes = [str(g) for g in adata.var_names]
            if hasattr(adata, "file") and adata.file is not None:
                adata.file.close()
            return genes
        if dataset_key == "real_dlpfc" and REAL_DLPFC_PATH.is_file():
            adata = read_h5ad(REAL_DLPFC_PATH, backed="r")
            genes = [str(g) for g in adata.var_names]
            if hasattr(adata, "file") and adata.file is not None:
                adata.file.close()
            return genes
        if dataset_key == "real_dlpfc_151673" and REAL_DLPFC_151673_PATH.is_file():
            adata = read_h5ad(REAL_DLPFC_151673_PATH, backed="r")
            genes = [str(g) for g in adata.var_names]
            if hasattr(adata, "file") and adata.file is not None:
                adata.file.close()
            return genes
    except Exception:
        pass
    return []


def get_dataset_metadata(dataset_key: str, custom_file_path: Path | None = None) -> dict[str, Any]:
    """Retrieve structured summary metadata for the chosen dataset."""
    if dataset_key == "synthetic":
        return {
            "name": "Synthetic Spatial Fixture",
            "spots": "300",
            "genes": "500",
            "spatial": "Detected (obsm['spatial'])",
            "status": "Available (Built-in)",
            "is_valid": True,
        }
    if dataset_key == "real_dlpfc":
        available = REAL_DLPFC_PATH.is_file()
        return {
            "name": "DLPFC Visium 151507",
            "spots": "4,226" if available else "N/A",
            "genes": "33,538" if available else "N/A",
            "spatial": "Visium Spatial Array" if available else "N/A",
            "status": "Available on Disk" if available else "Not Found on Disk",
            "is_valid": available,
        }
    if dataset_key == "real_dlpfc_151673":
        available = REAL_DLPFC_151673_PATH.is_file()
        return {
            "name": "DLPFC Visium 151673",
            "spots": "3,639" if available else "N/A",
            "genes": "33,538" if available else "N/A",
            "spatial": "Visium Spatial Array" if available else "N/A",
            "status": "Available on Disk" if available else "Not Found on Disk",
            "is_valid": available,
        }
    if dataset_key == "upload":
        if custom_file_path and custom_file_path.is_file():
            try:
                inspection = inspect_h5ad(custom_file_path)
                return {
                    "name": custom_file_path.name,
                    "spots": f"{inspection.n_obs:,}",
                    "genes": f"{inspection.n_vars:,}",
                    "spatial": (
                        "Detected (finite coordinates)"
                        if inspection.finite_spatial_coordinates
                        else "Missing / Non-finite"
                    ),
                    "status": "Uploaded & Validated"
                    if not inspection.errors
                    else "Validation Failed",
                    "is_valid": not inspection.errors,
                }
            except Exception:
                return {
                    "name": custom_file_path.name,
                    "spots": "Unknown",
                    "genes": "Unknown",
                    "spatial": "Unknown",
                    "status": "Read Error",
                    "is_valid": False,
                }
        return {
            "name": "Custom AnnData (.h5ad)",
            "spots": "Awaiting Upload",
            "genes": "Awaiting Upload",
            "spatial": "Awaiting Upload",
            "status": "No file selected",
            "is_valid": False,
        }
    return {
        "name": dataset_key,
        "spots": "Unknown",
        "genes": "Unknown",
        "spatial": "Unknown",
        "status": "Unknown",
        "is_valid": False,
    }


# ---------------------------------------------------------------------------
# Page Configuration and CSS Styling
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="BioAgent-ST | Verification-First Spatial Transcriptomics",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    /* Theme-resilient scientific typography and high-contrast status badges */
    .stApp {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .status-badge {
        display: inline-block;
        padding: 2px 8px;
        font-size: 0.8rem;
        font-weight: 700;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        letter-spacing: 0.04em;
        margin-right: 6px;
        vertical-align: middle;
    }
    .badge-allow, .badge-pass, .badge-supported {
        background-color: #0f5132 !important;
        color: #ffffff !important;
        border: 1px solid #0f5132 !important;
    }
    .badge-review, .badge-warn, .badge-plausible {
        background-color: #9a6700 !important;
        color: #ffffff !important;
        border: 1px solid #9a6700 !important;
    }
    .badge-block, .badge-fail, .badge-unsupported {
        background-color: #b02a37 !important;
        color: #ffffff !important;
        border: 1px solid #b02a37 !important;
    }
    .badge-hypothesis {
        background-color: #6f42c1 !important;
        color: #ffffff !important;
        border: 1px solid #6f42c1 !important;
    }
    .badge-indeterminate {
        background-color: #495057 !important;
        color: #ffffff !important;
        border: 1px solid #495057 !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Helper Functions: Dataset and Selector Management
# ---------------------------------------------------------------------------


def get_available_datasets() -> dict[str, dict[str, Any]]:
    """Enumerate datasets available locally on disk."""
    items: dict[str, dict[str, Any]] = {
        "synthetic": {
            "name": "Synthetic Spatial Fixture (300 spots x 500 genes)",
            "available": True,
            "path": None,
            "has_spatial": True,
            "illustrative": True,
        }
    }
    if REAL_DLPFC_PATH.is_file():
        items["real_dlpfc"] = {
            "name": "DLPFC Visium Sample 151507 (Human Dorsolateral Prefrontal Cortex)",
            "available": True,
            "path": REAL_DLPFC_PATH,
            "has_spatial": True,
            "illustrative": False,
        }
    else:
        items["real_dlpfc"] = {
            "name": "DLPFC Visium Sample 151507 [Not installed on disk]",
            "available": False,
            "path": REAL_DLPFC_PATH,
            "has_spatial": True,
            "illustrative": False,
        }

    if REAL_DLPFC_151673_PATH.is_file():
        items["real_dlpfc_151673"] = {
            "name": "DLPFC Visium Sample 151673 (Human Dorsolateral Prefrontal Cortex)",
            "available": True,
            "path": REAL_DLPFC_151673_PATH,
            "has_spatial": True,
            "illustrative": False,
        }
    else:
        items["real_dlpfc_151673"] = {
            "name": "DLPFC Visium Sample 151673 [Not installed on disk]",
            "available": False,
            "path": REAL_DLPFC_151673_PATH,
            "has_spatial": True,
            "illustrative": False,
        }

    items["upload"] = {
        "name": "Upload Custom .h5ad Dataset",
        "available": True,
        "path": None,
        "has_spatial": None,
        "illustrative": False,
    }
    return items


def instantiate_selector(kind: SelectorKind, workflow: WorkflowId | None) -> WorkflowSelector:
    """Build the workflow router according to user configuration."""
    if kind == "manual":
        if workflow is None:
            raise ValueError("Target workflow must be specified for manual selector.")
        return ManualSelector(workflow)
    if kind == "laya":
        return LayaSelector()
    return RuleSelector()


def evaluate_gate_preview(
    selector_kind: SelectorKind,
    question: str,
    target_workflow: WorkflowId | None,
) -> tuple[SelectorDecision, GateResult]:
    """Run pure deterministic routing and policy gate evaluation without executing tools."""
    selector = instantiate_selector(selector_kind, target_workflow)
    decision = selector.select(question)
    gate = gate_request(decision, evidence_band="unknown", config=GateConfig())
    return decision, gate


def execute_pipeline(
    dataset_key: str,
    custom_file_path: Path | None,
    question: str,
    selector_kind: SelectorKind,
    target_workflow: WorkflowId | None,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    """
    Execute end-to-end verified pipeline:
    Routing -> Policy Gate -> Planning -> Tool Execution -> Ledger -> Report -> Validation.
    """
    # 1. Dataset loading
    if dataset_key == "upload":
        if custom_file_path is None or not custom_file_path.is_file():
            raise ValueError("No uploaded .h5ad dataset file found.")
        adata = load_dataset("user", user_path=custom_file_path)
        dataset_id = custom_file_path.stem
    else:
        adata = load_dataset(dataset_key)
        dataset_id = dataset_key

    dataset_hash = anndata_content_hash(adata)

    # 2. Selector Routing
    selector = instantiate_selector(selector_kind, target_workflow)
    decision = selector.select(question)
    if not is_supported(decision.decision):
        raise ValueError(
            f"Selector routed request to '{decision.decision}', which is not a supported workflow."
        )

    # 3. Parameter Validation
    chosen_workflow = decision.decision
    if (
        isinstance(parameters, dict)
        and chosen_workflow in parameters
        and isinstance(parameters[chosen_workflow], dict)
    ):
        parameters = parameters[chosen_workflow]
    if chosen_workflow == "quality_assessment":
        default_qc = QCParams().model_dump()
        qc_params_input: dict[str, Any] = {}
        for field in ("min_genes", "min_counts", "min_cells", "max_mito_pct", "mito_prefix"):
            if field in parameters and parameters[field] is not None:
                qc_params_input[field] = parameters[field]
            else:
                qc_params_input[field] = default_qc[field]
        validated_params = dict(QCParams.model_validate(qc_params_input).model_dump())
    elif chosen_workflow == "spatial_clustering":
        if "clustering" in parameters and isinstance(parameters["clustering"], dict):
            clustering_payload = dict(
                ClusteringParams.model_validate(parameters["clustering"]).model_dump()
            )
        else:
            try:
                clustering_payload = dict(ClusteringParams.model_validate(parameters).model_dump())
            except Exception:
                clustering_payload = dict(ClusteringParams().model_dump())

        if "n_top_genes" in clustering_payload:
            clustering_payload["n_top_genes"] = max(
                10, min(clustering_payload["n_top_genes"], adata.n_vars)
            )

        if "qc" in parameters and isinstance(parameters["qc"], dict):
            qc_payload = dict(QCParams.model_validate(parameters["qc"]).model_dump())
        else:
            qc_payload = dict(QCParams().model_dump())

        validated_params = {"clustering": clustering_payload, "qc": qc_payload}
    elif chosen_workflow == "gene_expression":
        genes = parameters.get("genes")
        if not genes or not isinstance(genes, list):
            all_genes = [str(g) for g in adata.var_names]
            take_n = min(max(2, min(5, len(all_genes))), len(all_genes))
            genes = all_genes[:take_n]
        else:
            genes = [str(g) for g in genes][:5]

        layer = str(parameters.get("layer") or "X")
        validated_params = dict(
            GeneExpressionParams.model_validate({"genes": genes, "layer": layer}).model_dump()
        )
    else:
        raise ValueError(f"Unsupported workflow: {chosen_workflow}")

    # 4. Planning
    plan = Planner(
        MockLLMClient(),
        selector=FixedSelector(decision),
    ).create_plan(question, dataset_id, validated_params)

    # 5. Output directory & Execution
    run_id = new_id("run_ui")
    run_dir = UI_RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    result = execute_plan(
        plan=plan,
        adata=adata,
        output_dir=run_dir,
        experiment_id=run_id,
        dataset_hash=dataset_hash,
    )

    # 6. Reporting and Verification
    provenance_store = ProvenanceStore(run_dir / "ledger.db")
    evidence_store = EvidenceStore(run_dir / "ledger.db")
    validation_status = "passed"
    validation_detail = "Verified: 0 ungrounded claims, 0 hash mismatches."

    try:
        provenance_list = provenance_store.list()
        evidence_list = evidence_store.list()
        report = build_report(
            question=question,
            dataset_id=dataset_id,
            plan=plan,
            evidence=result.evidence,
            provenance=provenance_list,
            artifact_ids_by_step=result.step_artifact_ids,
        )
        try:
            validate_report(report, evidence_store, provenance_store)
        except ReportValidationError as val_err:
            validation_status = "failed"
            validation_detail = str(val_err)

        write_report(report, run_dir / "report.md")
    finally:
        provenance_store.close()
        evidence_store.close()

    gate_decision = result.gate_results[-1].decision if result.gate_results else "ALLOW"
    gate_reasons = result.gate_results[-1].reasons if result.gate_results else []

    record = {
        "run_id": run_id,
        "run_dir": str(run_dir),
        "timestamp": datetime.now(UTC).isoformat(),
        "question": question,
        "dataset_id": dataset_id,
        "dataset_hash": dataset_hash,
        "workflow": chosen_workflow,
        "selector": decision.model_dump(),
        "policy": {
            "decision": gate_decision,
            "reasons": gate_reasons,
        },
        "plan": plan.model_dump(mode="json"),
        "parameters": validated_params,
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
                "random_seed": item.random_seed,
                "upstream_artifact_ids": item.upstream_artifact_ids,
            }
            for item in provenance_list
        ],
        "evidence": [item.model_dump(mode="json") for item in evidence_list],
        "warnings": result.warnings,
        "needs_review": result.needs_review,
        "validation_status": validation_status,
        "validation_detail": validation_detail,
        "report_markdown": (run_dir / "report.md").read_text(encoding="utf-8")
        if (run_dir / "report.md").is_file()
        else "",
    }

    # Save run record to disk for persistence
    (run_dir / "run_record.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record


def list_prior_runs() -> list[dict[str, Any]]:
    """Enumerate past runs from UI and API directories."""
    records: list[dict[str, Any]] = []
    for directory in [UI_RUNS_DIR, API_RUNS_DIR]:
        if directory.exists():
            for child in directory.iterdir():
                if child.is_dir():
                    rec_file = child / "run_record.json"
                    if rec_file.is_file():
                        try:
                            data = json.loads(rec_file.read_text(encoding="utf-8"))
                            if isinstance(data, dict) and "run_id" in data:
                                records.append(data)
                        except Exception:
                            continue
    records.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return records


# ---------------------------------------------------------------------------
# Sidebar UI: Dataset Selection & Metadata
# ---------------------------------------------------------------------------

st.sidebar.markdown("### [CONFIG] Dataset Selection")
datasets_catalog = get_available_datasets()
dataset_options = list(datasets_catalog.keys())


def dataset_label(k: str) -> str:
    return datasets_catalog[k]["name"]


selected_dataset_key = st.sidebar.selectbox(
    "Select Target Dataset",
    options=dataset_options,
    format_func=dataset_label,
    index=0,
)

custom_uploaded_path: Path | None = None
if selected_dataset_key == "upload":
    uploaded_file = st.sidebar.file_uploader(
        "Upload AnnData File (.h5ad)",
        type=["h5ad"],
        help=f"Upload a valid .h5ad file up to {MAX_UPLOAD_SIZE_MB} MB containing obs, var, and obsm['spatial'].",
    )
    if uploaded_file is not None:
        file_size_bytes = getattr(uploaded_file, "size", 0)
        is_valid_size, size_msg = validate_upload_size(file_size_bytes)
        if not is_valid_size:
            st.sidebar.error(f"[ERROR] {size_msg}")
        else:
            save_path = UPLOADS_DIR / uploaded_file.name
            save_uploaded_stream(uploaded_file, save_path)
            custom_uploaded_path = save_path
            size_mb = file_size_bytes / (1024 * 1024)
            st.sidebar.caption(
                f"Uploaded: `{uploaded_file.name}` ({size_mb:.1f} MB / {MAX_UPLOAD_SIZE_MB} MB limit)"
            )
    else:
        st.sidebar.info("[INFO] Please upload a .h5ad file to proceed.")
else:
    ds_meta = datasets_catalog[selected_dataset_key]
    if not ds_meta["available"]:
        st.sidebar.warning(
            "[WARNING] Selected dataset is not present in local data directory. "
            "Please select Synthetic or upload an .h5ad file."
        )

# Crisp Dataset Information Box
dataset_info = get_dataset_metadata(selected_dataset_key, custom_uploaded_path)
with st.sidebar.container(border=True):
    st.markdown(f"**[DATASET METRICS]** `{dataset_info['name']}`")
    st.markdown(
        f"- **Spots:** `{dataset_info['spots']}`\n"
        f"- **Genes:** `{dataset_info['genes']}`\n"
        f"- **Spatial Coordinates:** `{dataset_info['spatial']}`\n"
        f"- **Status:** `{dataset_info['status']}`"
    )

# ---------------------------------------------------------------------------
# Sidebar UI: Workflow Routing & Research Question
# ---------------------------------------------------------------------------

st.sidebar.markdown("---")
st.sidebar.markdown("### [ROUTING] Workflow Selection")

selector_mode = st.sidebar.radio(
    "Selector Strategy",
    options=["manual", "rules", "laya"],
    format_func=lambda x: {
        "manual": "Manual Workflow Selection",
        "rules": "Rule-based Intent Routing",
        "laya": "Laya Natural Language Classifier",
    }[x],
    index=0,
)

target_workflow_choice: WorkflowId | None = None
predicted_workflow: WorkflowId = "quality_assessment"
pred_confidence: float | None = None
pred_notes: str = ""

if selector_mode == "manual":
    target_workflow_choice = st.sidebar.selectbox(
        "Canonical Workflow",
        options=list(SUPPORTED_WORKFLOWS),
        index=0,
        help="Select one of the three verified canonical workflows.",
    )
    default_questions = {
        "quality_assessment": (
            "Assess data quality, spot count distributions, and mitochondrial fraction."
        ),
        "spatial_clustering": (
            "Identify spatial tissue domains using spatial graph and Leiden clustering."
        ),
        "gene_expression": (
            "Evaluate spatial expression distribution and "
            "spatial autocorrelation of target markers."
        ),
    }
    question_input = st.sidebar.text_area(
        "Analysis Research Question",
        value=default_questions[target_workflow_choice],
        height=70,
    )
    predicted_workflow = target_workflow_choice
else:
    sample_queries = {
        "rules": "Filter low count spots and assess data quality.",
        "laya": "Cluster spots by spatial domain and compute marker genes.",
    }
    question_input = st.sidebar.text_area(
        "Scientific Query / Instruction",
        value=sample_queries.get(selector_mode, "Run spatial transcriptomics analysis"),
        height=80,
    )

    # Dynamic workflow prediction for rules/laya modes
    try:
        active_selector = instantiate_selector(selector_mode, None)
        active_decision = active_selector.select(question_input)
        if is_supported(active_decision.decision):
            predicted_workflow = active_decision.decision
        pred_confidence = active_decision.confidence
        pred_notes = active_decision.notes or ""
    except Exception:
        predicted_workflow = "quality_assessment"

    with st.sidebar.container(border=True):
        st.markdown("**[ROUTING PREDICTION]**")
        st.markdown(f"Predicted Workflow: **`{predicted_workflow}`**")
        conf_label = f"{pred_confidence:.2f}" if pred_confidence is not None else "N/A"
        st.caption(f"Strategy: `{selector_mode}` | Confidence: `{conf_label}`")

# ---------------------------------------------------------------------------
# Sidebar UI: Multi-Workflow Parameter Settings
# ---------------------------------------------------------------------------

st.sidebar.markdown("---")
st.sidebar.markdown("### [PARAMETERS] Workflow Settings")

# 1. Quality Assessment Parameters
with st.sidebar.expander(
    "[Quality Assessment Parameters]",
    expanded=(predicted_workflow == "quality_assessment"),
):
    p_min_genes = st.number_input(
        "Minimum Genes per Spot", min_value=0, max_value=5000, value=200, step=10
    )
    p_min_counts = st.number_input(
        "Minimum Total Counts per Spot", min_value=0, max_value=50000, value=500, step=50
    )
    p_min_cells = st.number_input(
        "Minimum Cells per Gene", min_value=0, max_value=1000, value=3, step=1
    )
    p_max_mito = st.slider(
        "Maximum Mitochondrial Percentage (%)",
        min_value=0.0,
        max_value=100.0,
        value=20.0,
        step=1.0,
    )
    p_mito_prefix = st.text_input("Mitochondrial Gene Prefix", value="MT-")
    qc_params_dict = {
        "min_genes": int(p_min_genes),
        "min_counts": int(p_min_counts),
        "min_cells": int(p_min_cells),
        "max_mito_pct": float(p_max_mito),
        "mito_prefix": str(p_mito_prefix),
    }

# 2. Spatial Clustering Parameters
with st.sidebar.expander(
    "[Spatial Clustering Parameters]",
    expanded=(predicted_workflow == "spatial_clustering"),
):
    p_res = st.slider("Leiden Resolution", min_value=0.05, max_value=2.0, value=0.5, step=0.05)
    p_n_top = st.number_input(
        "Number of Highly Variable Genes", min_value=50, max_value=10000, value=2000, step=100
    )
    p_pcs = st.number_input(
        "Number of Principal Components", min_value=2, max_value=100, value=30, step=5
    )
    p_neighbors = st.number_input(
        "Number of Neighbors (k-NN)", min_value=2, max_value=50, value=15, step=1
    )
    p_seed = st.number_input(
        "Random Seed (Reproducibility)", min_value=0, max_value=100000, value=0, step=1
    )
    clustering_params_dict = {
        "clustering": {
            "normalization": "lognorm",
            "n_top_genes": int(p_n_top),
            "n_pcs": int(p_pcs),
            "n_neighbors": int(p_neighbors),
            "resolution": float(p_res),
            "seed": int(p_seed),
            "n_umap_neighbors": int(p_neighbors),
        }
    }

# 3. Gene Expression Parameters
with st.sidebar.expander(
    "[Gene Expression Parameters]",
    expanded=(predicted_workflow == "gene_expression"),
):
    available_genes = get_dataset_gene_names(selected_dataset_key, custom_uploaded_path)
    if available_genes:
        if "GENE_0000" in available_genes:
            default_genes = [g for g in ["GENE_0000", "GENE_0020"] if g in available_genes]
        elif any(g in available_genes for g in ["SNAP25", "MBP"]):
            default_genes = [g for g in ["SNAP25", "MBP"] if g in available_genes]
        else:
            default_genes = available_genes[: min(2, len(available_genes))]
    else:
        default_genes = (
            ["GENE_0000", "GENE_0020"] if selected_dataset_key == "synthetic" else ["SNAP25", "MBP"]
        )

    default_genes_str = ", ".join(default_genes)

    if available_genes:
        st.caption(
            f"[INFO] Dataset genes ({len(available_genes)} total). "
            f"Sample: {', '.join(available_genes[:5])}"
        )
        sample_pick = st.selectbox(
            "Suggested Valid Genes (Quick-Select)",
            options=["(Use text input below)", *available_genes[:25]],
            index=0,
            help="Select a suggested valid gene or use the text box below for custom input.",
        )
        if sample_pick != "(Use text input below)":
            default_genes_str = sample_pick

    p_genes_str = st.text_input(
        "Target Genes (comma separated, 1-5 genes)",
        value=default_genes_str,
        help="Specify 1 to 5 gene symbols present in adata.var_names.",
    )
    p_layer = st.selectbox("Expression Matrix Layer", options=["X", "counts"], index=0)
    gene_list = [g.strip() for g in p_genes_str.split(",") if g.strip()]
    if not gene_list:
        gene_list = (
            default_genes
            if default_genes
            else (available_genes[:1] if available_genes else ["GENE_0000"])
        )

    if available_genes:
        unrecognized = [g for g in gene_list if g not in available_genes]
        if unrecognized:
            st.warning(
                f"[WARNING] Genes not found in dataset: {', '.join(unrecognized)}. "
                f"Valid examples: {', '.join(available_genes[:4])}"
            )

    expression_params_dict = {
        "genes": gene_list[:5],
        "layer": p_layer,
    }

# Package configured parameters per workflow
all_configured_parameters = {
    "quality_assessment": qc_params_dict,
    "spatial_clustering": clustering_params_dict,
    "gene_expression": expression_params_dict,
}

# ---------------------------------------------------------------------------
# Sidebar Actions: Pre-execution Gate Preview & Run Trigger
# ---------------------------------------------------------------------------

st.sidebar.markdown("---")
btn_preview = st.sidebar.button("[EVALUATE] Policy Safety Gate", use_container_width=True)
btn_run = st.sidebar.button(
    "[EXECUTE] Run BioAgent-ST Analysis", type="primary", use_container_width=True
)

# ---------------------------------------------------------------------------
# Main View: Header and Application Introduction
# ---------------------------------------------------------------------------

st.markdown("# BioAgent-ST: Verification-First Spatial Transcriptomics")
st.markdown(
    "Deterministic scientific analysis with typed tools, auditable evidence ledgers, "
    "5-state claim verification, and formal policy safety gating."
)

# ---------------------------------------------------------------------------
# Pre-execution Gate Preview Logic
# ---------------------------------------------------------------------------

if btn_preview:
    try:
        preview_dec, preview_gate = evaluate_gate_preview(
            selector_kind=selector_mode,  # type: ignore[arg-type]
            question=question_input,
            target_workflow=target_workflow_choice,
        )
        st.session_state["preview_gate_result"] = {
            "decision": preview_gate.decision,
            "workflow": preview_dec.decision,
            "selector": preview_dec.kind,
            "confidence": preview_dec.confidence,
            "probabilities": preview_dec.probabilities,
            "explanation": preview_dec.notes,
            "reasons": preview_gate.reasons,
            "requires_review": preview_gate.requires_human_review,
        }
    except Exception as exc:
        st.error(f"[ERROR] Policy Gate evaluation failed: {exc}")

if "preview_gate_result" in st.session_state:
    p_res = st.session_state["preview_gate_result"]
    gate_color_cls = {
        "ALLOW": "badge-allow",
        "REVIEW": "badge-review",
        "BLOCK": "badge-block",
    }.get(p_res["decision"], "badge-review")

    conf_str = f"{p_res['confidence']:.3f}" if p_res["confidence"] is not None else "N/A"
    explanation_str = p_res.get("explanation") or ""
    probs_dict = p_res.get("probabilities") or {}

    with st.container(border=True):
        st.markdown("#### [POLICY GATE] Pre-Execution Safety Evaluation")

        c_badge, c_wf, c_sel, c_conf, c_rev = st.columns([1.2, 2.0, 1.6, 1.2, 1.5])
        with c_badge:
            st.caption("GATE STATUS")
            st.markdown(
                f'<span class="status-badge {gate_color_cls}">[{p_res["decision"]}]</span>',
                unsafe_allow_html=True,
            )
        with c_wf:
            st.caption("PREDICTED WORKFLOW")
            st.markdown(f"**`{p_res['workflow']}`**")
        with c_sel:
            st.caption("SELECTOR")
            st.markdown(f"**`{p_res['selector']}`**")
        with c_conf:
            st.caption("CONFIDENCE")
            st.markdown(f"**`{conf_str}`**")
        with c_rev:
            st.caption("HUMAN REVIEW")
            rev_badge_cls = "badge-warn" if p_res["requires_review"] else "badge-pass"
            rev_badge_txt = "[REQUIRED]" if p_res["requires_review"] else "[NONE]"
            st.markdown(
                f'<span class="status-badge {rev_badge_cls}">{rev_badge_txt}</span>',
                unsafe_allow_html=True,
            )

        if explanation_str:
            st.markdown(f"**Routing Explanation:** {explanation_str}")

        if probs_dict:
            filtered_probs = {
                k: v
                for k, v in probs_dict.items()
                if k
                in (
                    "quality_assessment",
                    "spatial_clustering",
                    "gene_expression",
                    "unsupported_or_ambiguous",
                )
            }
            if filtered_probs:
                p_items = " &nbsp;|&nbsp; ".join(
                    f"<code>{k}</code>: {v:.3f}" for k, v in filtered_probs.items()
                )
                st.markdown(f"**Probabilities:** {p_items}", unsafe_allow_html=True)

        if p_res.get("reasons"):
            st.markdown("**Policy Evaluation Reasons:**")
            for reason in p_res["reasons"]:
                st.markdown(f"- {reason}")

# ---------------------------------------------------------------------------
# Pipeline Execution Handler
# ---------------------------------------------------------------------------

if btn_run:
    if selected_dataset_key == "upload" and (
        custom_uploaded_path is None or not custom_uploaded_path.is_file()
    ):
        st.error("[ERROR] No uploaded dataset file available. Please upload a .h5ad file.")
    elif not datasets_catalog[selected_dataset_key]["available"]:
        st.error(f"[ERROR] Dataset '{selected_dataset_key}' is not available on disk.")
    else:
        with st.spinner("[STATUS] Executing deterministic analysis workflow..."):
            try:
                run_record = execute_pipeline(
                    dataset_key=selected_dataset_key,
                    custom_file_path=custom_uploaded_path,
                    question=question_input,
                    selector_kind=selector_mode,  # type: ignore[arg-type]
                    target_workflow=target_workflow_choice,
                    parameters=all_configured_parameters,
                )
                st.session_state["active_record"] = run_record
                st.success(
                    f"[PASS] Workflow completed successfully. Run ID: {run_record['run_id']}"
                )
            except (ExecutionError, PlanValidationError, ValueError, RuntimeError) as err:
                st.error(f"[ERROR] Execution aborted: {err}")
            except Exception as err:
                st.error(f"[ERROR] Unexpected failure: {err}")

# Load active record from session
active_record: dict[str, Any] | None = st.session_state.get("active_record")

# ---------------------------------------------------------------------------
# Results Display and Inspector Tabs
# ---------------------------------------------------------------------------

if active_record is not None:
    # Top Metrics Dashboard Overview
    policy_info = active_record.get("policy", {})
    policy_decision = policy_info.get("decision", "ALLOW")
    pol_cls = {
        "ALLOW": "badge-allow",
        "REVIEW": "badge-review",
        "BLOCK": "badge-block",
    }.get(policy_decision, "badge-review")

    val_status = active_record.get("validation_status", "passed")
    val_cls = "badge-pass" if val_status == "passed" else "badge-fail"

    col_m1, col_m2, col_m3, col_m4, col_m5 = st.columns(5)
    with col_m1, st.container(border=True):
        st.caption("RUN IDENTIFIER")
        st.markdown(f"**`{active_record.get('run_id', 'N/A')[:14]}`**")
    with col_m2, st.container(border=True):
        st.caption("TARGET WORKFLOW")
        st.markdown(f"**`{active_record.get('workflow', 'N/A')}`**")
    with col_m3, st.container(border=True):
        st.caption("POLICY SAFETY GATE")
        st.markdown(
            f'<span class="status-badge {pol_cls}">[{policy_decision}]</span>',
            unsafe_allow_html=True,
        )
    with col_m4, st.container(border=True):
        st.caption("GENERATED ARTIFACTS")
        st.markdown(f"**`{len(active_record.get('artifacts', []))}`**")
    with col_m5, st.container(border=True):
        st.caption("REPORT VALIDATOR")
        st.markdown(
            f'<span class="status-badge {val_cls}">[{val_status.upper()}]</span>',
            unsafe_allow_html=True,
        )

    # Main Analysis Tabs
    tab_plots, tab_ledger, tab_provenance, tab_report, tab_history = st.tabs(
        [
            "Visualizations and Tables",
            "Evidence Ledger (5-State)",
            "Provenance and Artifacts",
            "Validated Scientific Report",
            "Run History and Audit",
        ]
    )

    run_dir_path = Path(active_record.get("run_dir", ""))

    # Tab 1: Visualizations and Tables
    with tab_plots:
        st.markdown("### Analysis Outputs and Visualizations")

        plot_clusters = run_dir_path / "spatial_clusters.png"
        plot_expression = run_dir_path / "spatial_expression.png"

        if plot_clusters.is_file():
            with st.container(border=True):
                st.markdown("#### [VISUALIZATION] Spatial Domain Clustering Map (Scanpy / Leiden)")
                st.image(
                    str(plot_clusters),
                    caption="[ARTIFACT: spatial_plot] Spatial Domain Clustering Map",
                    use_container_width=True,
                )

        if plot_expression.is_file():
            with st.container(border=True):
                st.markdown("#### [VISUALIZATION] Spatial Gene Expression Abundance")
                st.image(
                    str(plot_expression),
                    caption="[ARTIFACT: spatial_plot] Spatial Gene Expression Abundance",
                    use_container_width=True,
                )

        # Tabular outputs in bordered containers
        cluster_table_path = run_dir_path / "cluster_table.csv"
        expr_summary_path = run_dir_path / "expression_summary.csv"

        if cluster_table_path.is_file() or expr_summary_path.is_file():
            col_t1, col_t2 = st.columns(2)
            if cluster_table_path.is_file():
                with col_t1, st.container(border=True):
                    st.markdown("#### [TABLE] Cluster Distribution Summary")
                    df_clusters = pd.read_csv(cluster_table_path)
                    st.dataframe(df_clusters, use_container_width=True)

            if expr_summary_path.is_file():
                with col_t2, st.container(border=True):
                    st.markdown("#### [TABLE] Target Gene Expression Summary")
                    df_expr = pd.read_csv(expr_summary_path)
                    st.dataframe(df_expr, use_container_width=True)

        qc_table_path = run_dir_path / "qc_table.csv"
        if qc_table_path.is_file():
            with st.container(border=True):
                st.markdown("#### [TABLE] Quality Assessment Spot Metrics (Preview)")
                df_qc = pd.read_csv(qc_table_path)
                if "passes_qc" in df_qc.columns:
                    n_total = len(df_qc)
                    n_pass = int(df_qc["passes_qc"].sum())
                    pct_pass = (n_pass / n_total) * 100 if n_total > 0 else 0
                    st.markdown(
                        f"**QC Summary:** Total Spots: `{n_total}` | "
                        f"Passed QC: `{n_pass}` ({pct_pass:.1f}%) | "
                        f"Filtered Spots: `{n_total - n_pass}`"
                    )
                st.dataframe(df_qc.head(20), use_container_width=True)

        umap_path = run_dir_path / "umap_coords.csv"
        if umap_path.is_file():
            with st.expander("[DATA] View UMAP 2D Embedding Coordinates"):
                df_umap = pd.read_csv(umap_path)
                st.dataframe(df_umap.head(50), use_container_width=True)

    # Tab 2: Evidence Ledger (5-State Verification)
    with tab_ledger:
        st.markdown("### Evidence Ledger: Five-State Grounded Claims")
        st.markdown(
            "Every statement produced by BioAgent-ST is grounded in deterministic checks. "
            "Claims are assigned one of 5 formal states (`supported`, `plausible`, `hypothesis`, "
            "`unsupported`, `indeterminate`). The critic layer may only downgrade states."
        )

        evidence_records = active_record.get("evidence", [])
        if not evidence_records:
            st.info("[INFO] No evidence claims recorded for this execution.")
        else:
            state_counts: dict[str, int] = {}
            for rec in evidence_records:
                st_name = rec.get("state", "indeterminate")
                state_counts[st_name] = state_counts.get(st_name, 0) + 1

            c_sup = state_counts.get("supported", 0)
            c_pla = state_counts.get("plausible", 0)
            c_hyp = state_counts.get("hypothesis", 0)
            c_uns = state_counts.get("unsupported", 0)
            c_ind = state_counts.get("indeterminate", 0)

            with st.container(border=True):
                st.markdown("#### [LEDGER SUMMARY] Verification State Distribution")
                st.markdown(
                    f'<span class="status-badge badge-supported">[SUPPORTED: {c_sup}]</span> '
                    f'<span class="status-badge badge-plausible">[PLAUSIBLE: {c_pla}]</span> '
                    f'<span class="status-badge badge-hypothesis">[HYPOTHESIS: {c_hyp}]</span> '
                    f'<span class="status-badge badge-unsupported">[UNSUPPORTED: {c_uns}]</span> '
                    f'<span class="status-badge badge-indeterminate">[INDETERMINATE: {c_ind}]</span>',
                    unsafe_allow_html=True,
                )

            for idx, ev in enumerate(evidence_records):
                ev_state = ev.get("state", "indeterminate")
                badge_class = {
                    "supported": "badge-supported",
                    "plausible": "badge-plausible",
                    "hypothesis": "badge-hypothesis",
                    "unsupported": "badge-unsupported",
                    "indeterminate": "badge-indeterminate",
                }.get(ev_state, "badge-indeterminate")

                claim_txt = ev.get("claim", "")
                cid = ev.get("claim_id", "N/A")
                src = ev.get("state_source", "rule_engine")
                r_st = ev.get("rule_state", "N/A")
                rev_bool = ev.get("requires_human_review", False)
                rev_cls = "badge-warn" if rev_bool else "badge-pass"
                rev_txt = "[REQUIRED]" if rev_bool else "[NOT NEEDED]"

                with st.expander(
                    f"[{ev_state.upper()}] Claim {idx + 1}: {claim_txt[:90]}{'...' if len(claim_txt) > 90 else ''}",
                    expanded=(idx == 0),
                ):
                    c_ev1, c_ev2, c_ev3, c_ev4 = st.columns([1.5, 1.5, 1.5, 1.5])
                    with c_ev1:
                        st.caption("VERIFIED STATE")
                        st.markdown(
                            f'<span class="status-badge {badge_class}">[{ev_state.upper()}]</span>',
                            unsafe_allow_html=True,
                        )
                    with c_ev2:
                        st.caption("CLAIM ID")
                        st.markdown(f"**`{cid}`**")
                    with c_ev3:
                        st.caption("STATE SOURCE")
                        st.markdown(f"**`{src}`** (Rule: `{r_st}`)")
                    with c_ev4:
                        st.caption("HUMAN REVIEW")
                        st.markdown(
                            f'<span class="status-badge {rev_cls}">{rev_txt}</span>',
                            unsafe_allow_html=True,
                        )

                    st.markdown(f"**Exact Claim Statement:**\n\n> {claim_txt}")

                    # Contract checks
                    checks = ev.get("checks", [])
                    if checks:
                        st.markdown("**Underlying Contract Checks:**")
                        check_rows = []
                        for chk in checks:
                            status_badge = f"[{chk.get('status', '').upper()}]"
                            check_rows.append(
                                {
                                    "Check ID": chk.get("check_id"),
                                    "Status": status_badge,
                                    "Severity": chk.get("severity"),
                                    "Value": chk.get("value"),
                                    "Threshold": chk.get("threshold"),
                                    "Detail": chk.get("detail", ""),
                                }
                            )
                        st.dataframe(pd.DataFrame(check_rows), use_container_width=True)

                    # Limitations & Caveats
                    limits = ev.get("limitations", [])
                    if limits:
                        st.markdown("**Scientific Limitations and Caveats:**")
                        for lim in limits:
                            st.markdown(f"- {lim}")

                    # Supporting Artifacts
                    artifacts_list = ev.get("supporting_artifacts", [])
                    if artifacts_list:
                        st.markdown(f"**Supporting Artifact IDs:** `{', '.join(artifacts_list)}`")

    # Tab 3: Provenance and Artifacts
    with tab_provenance:
        st.markdown("### Provenance Trace and Cryptographic Byte Hashes")
        st.markdown(
            "Every output generated by BioAgent-ST includes complete provenance metadata: "
            "source dataset hash, tool parameters, library versions, git commit, and byte hash."
        )

        artifacts = active_record.get("artifacts", [])
        if not artifacts:
            st.info("[INFO] No artifacts found in active run record.")
        else:
            with st.container(border=True):
                st.markdown(f"#### [PROVENANCE METRICS] Tracked Artifacts ({len(artifacts)} total)")
                c_p1, c_p2 = st.columns(2)
                with c_p1:
                    st.caption("SOURCE DATASET HASH")
                    st.markdown(f"**`{active_record.get('dataset_hash', 'N/A')[:24]}...`**")
                with c_p2:
                    st.caption("CODE COMMIT")
                    st.markdown(
                        f"**`{artifacts[0].get('code_commit', 'N/A') if artifacts else 'N/A'}`**"
                    )

            prov_rows = []
            for art in artifacts:
                prov_rows.append(
                    {
                        "Artifact ID": art.get("artifact_id"),
                        "Artifact Type": art.get("artifact_type"),
                        "Tool Name": f"{art.get('tool_name')} v{art.get('tool_version', '0.1.0')}",
                        "SHA-256 Output Hash": art.get("output_hash", "")[:16] + "...",
                        "Git Commit": art.get("code_commit", "N/A"),
                        "Random Seed": art.get("random_seed"),
                        "Output Path": art.get("output_uri"),
                    }
                )
            st.dataframe(pd.DataFrame(prov_rows), use_container_width=True)

            with st.expander("[AUDIT] Verify Disk Integrity of Generated Artifacts"):
                verification_rows = []
                for art in artifacts:
                    fpath = Path(art.get("output_uri", ""))
                    exists = fpath.is_file()
                    matches = False
                    actual_hash = "N/A"
                    if exists:
                        actual_hash = sha256_file(fpath)
                        matches = actual_hash == art.get("output_hash")
                    verification_rows.append(
                        {
                            "Artifact ID": art.get("artifact_id"),
                            "File Exists": "[PASS]" if exists else "[FAIL]",
                            "Hash Integrity": "[PASS]" if matches else "[FAIL]",
                            "Recorded Hash": art.get("output_hash", "")[:24],
                            "Actual Hash": actual_hash[:24],
                        }
                    )
                st.dataframe(pd.DataFrame(verification_rows), use_container_width=True)

    # Tab 4: Validated Scientific Report
    with tab_report:
        st.markdown("### Validated Scientific Report")
        v_status = active_record.get("validation_status", "passed")
        v_detail = active_record.get("validation_detail", "")

        val_badge_cls = "badge-pass" if v_status == "passed" else "badge-fail"
        val_badge_txt = "[PASS]" if v_status == "passed" else "[FAIL]"

        with st.container(border=True):
            st.markdown("#### [REPORT INTEGRITY] Validation Status")
            st.markdown(
                f'<span class="status-badge {val_badge_cls}">{val_badge_txt}</span> '
                f"<strong>Result:</strong> {v_detail}",
                unsafe_allow_html=True,
            )

        report_md = active_record.get("report_markdown", "")
        if report_md:
            with st.container(border=True):
                st.markdown(report_md)
            st.download_button(
                label="[DOWNLOAD] Scientific Report (Markdown)",
                data=report_md,
                file_name=f"bioagent_st_report_{active_record.get('run_id')}.md",
                mime="text/markdown",
            )
        else:
            st.info("[INFO] Report file is empty or not yet generated.")

    # Tab 5: Run History and Audit
    with tab_history:
        st.markdown("### Run History and Audit Ledger")
        prior_runs = list_prior_runs()
        if not prior_runs:
            st.info("[INFO] No past runs discovered in artifact directories.")
        else:
            with st.container(border=True):
                st.markdown(f"#### [AUDIT LOG] Historical Executions ({len(prior_runs)} total)")
                history_rows = []
                for r in prior_runs:
                    history_rows.append(
                        {
                            "Run ID": r.get("run_id"),
                            "Timestamp": r.get("timestamp", "N/A"),
                            "Workflow": r.get("workflow", "N/A"),
                            "Policy Decision": r.get("policy", {}).get("decision", "ALLOW"),
                            "Artifacts": len(r.get("artifacts", [])),
                            "Evidence Claims": len(r.get("evidence", [])),
                            "Validation": r.get("validation_status", "passed"),
                        }
                    )
                st.dataframe(pd.DataFrame(history_rows), use_container_width=True)

            with st.container(border=True):
                st.markdown("#### [INSPECT] Load Historical Run")
                col_h1, col_h2 = st.columns([3, 1])
                with col_h1:
                    selected_historic_id = st.selectbox(
                        "Select Run to Inspect",
                        options=[r.get("run_id") for r in prior_runs if r.get("run_id")],
                        label_visibility="collapsed",
                    )
                with col_h2:
                    if st.button("[LOAD] Inspect Selected Run", use_container_width=True):
                        match = next(
                            (r for r in prior_runs if r.get("run_id") == selected_historic_id),
                            None,
                        )
                        if match is not None:
                            st.session_state["active_record"] = match
                            st.rerun()

else:
    # Initial state when no run has been executed yet
    st.info(
        "[READY] Configure dataset, selector, and workflow parameters in the sidebar, "
        "then click '[EVALUATE] Policy Safety Gate' or '[EXECUTE] Run BioAgent-ST Analysis'."
    )

    prior_runs = list_prior_runs()
    if prior_runs:
        with st.container(border=True):
            st.markdown("### Previously Executed Analyses")
            st.markdown(
                "Select a prior run to inspect its evidence ledger, provenance, and validated report:"
            )
            col_init1, col_init2 = st.columns([3, 1])
            with col_init1:
                selected_historic_id = st.selectbox(
                    "Available Historical Runs",
                    options=[r.get("run_id") for r in prior_runs if r.get("run_id")],
                    label_visibility="collapsed",
                )
            with col_init2:
                if st.button("[LOAD] Open Historical Run", use_container_width=True):
                    match = next(
                        (r for r in prior_runs if r.get("run_id") == selected_historic_id), None
                    )
                    if match is not None:
                        st.session_state["active_record"] = match
                        st.rerun()
