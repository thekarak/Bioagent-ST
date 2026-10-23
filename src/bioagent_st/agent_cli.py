import argparse
import json
from pathlib import Path

from bioagent_st.agents.executor import execute_plan
from bioagent_st.agents.planner import Planner
from bioagent_st.datasets import load_dataset
from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.llm.client import MockLLMClient
from bioagent_st.reporting.generator import build_report, validate_report, write_report
from bioagent_st.utils.hashing import anndata_content_hash


def run_agent(args: argparse.Namespace) -> None:
    output = Path(args.output)
    adata = load_dataset(args.source, args.dataset)
    dataset_id = args.dataset_id or args.source
    plan = Planner(MockLLMClient()).create_plan(args.question, dataset_id)
    result = execute_plan(
        plan,
        adata,
        output,
        experiment_id=args.experiment_id,
        dataset_hash=anndata_content_hash(adata),
    )
    provenance_store = ProvenanceStore(output / "ledger.db")
    evidence_store = EvidenceStore(output / "ledger.db")
    try:
        report = build_report(
            question=args.question,
            dataset_id=dataset_id,
            plan=plan,
            evidence=result.evidence,
            provenance=provenance_store.list(),
            artifact_ids_by_step=result.step_artifact_ids,
        )
        validate_report(report, evidence_store, provenance_store)
        write_report(report, output / "report.md")
    finally:
        evidence_store.close()
        provenance_store.close()
    print(
        json.dumps(
            {
                "status": "ok",
                "plan_id": plan.plan_id,
                "artifact_ids": result.artifact_ids,
                "evidence_ids": [record.evidence_id for record in result.evidence],
                "report": str(output / "report.md"),
            },
            indent=2,
        )
    )
