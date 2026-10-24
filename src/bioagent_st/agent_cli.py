import argparse
import json
from pathlib import Path
from typing import Any

from bioagent_st.agents.executor import execute_plan
from bioagent_st.agents.planner import Planner
from bioagent_st.datasets import load_dataset
from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.llm.client import MockLLMClient
from bioagent_st.reporting.generator import build_report, validate_report, write_report
from bioagent_st.routing import (
    LayaSelector,
    ManualSelector,
    RuleSelector,
    WorkflowSelector,
)
from bioagent_st.schemas.agent_config import AgentConfig
from bioagent_st.schemas.workflows import SUPPORTED_WORKFLOWS
from bioagent_st.utils.hashing import anndata_content_hash


def _parameters(args: argparse.Namespace) -> dict[str, Any]:
    if args.params_json:
        payload = json.loads(args.params_json)
        if not isinstance(payload, dict):
            raise ValueError("--params-json must decode to a JSON object")
        return payload
    if args.genes:
        return {"genes": list(args.genes), "layer": args.layer}
    return {}


def build_agent_config(args: argparse.Namespace) -> AgentConfig:
    """Build an AgentConfig instance from parsed CLI arguments."""
    mode = getattr(args, "mode", "full")
    no_ledger = getattr(args, "no_ledger", False)
    no_critic = getattr(args, "no_critic", False)
    no_gating = getattr(args, "no_gating", False)
    no_prov = getattr(args, "no_provenance_constraints", False)

    # Defaults by baseline mode
    if mode in ("tool_baseline", "schema_baseline", "react_baseline"):
        ledger_default = False
        critic_default = False
        gating_default = False
    else:
        ledger_default = True
        critic_default = True
        gating_default = True

    ledger_enabled = ledger_default and not no_ledger
    critic_enabled = critic_default and not no_critic
    gating_enabled = gating_default and not no_gating
    provenance_constraints_enabled = not no_prov

    selector = getattr(args, "selector", "rules")
    workflow = getattr(args, "workflow", None)

    return AgentConfig(
        mode=mode,
        ledger_enabled=ledger_enabled,
        critic_enabled=critic_enabled,
        gating_enabled=gating_enabled,
        provenance_constraints_enabled=provenance_constraints_enabled,
        selector=selector if selector in ("rules", "laya", "manual") else "rules",
        manual_workflow=workflow if selector == "manual" else None,
    )


def run_agent(args: argparse.Namespace, config: AgentConfig | None = None) -> None:
    if config is None:
        config = build_agent_config(args)
    output = Path(args.output)
    adata = load_dataset(args.source, args.dataset)
    dataset_id = args.dataset_id or args.source
    selector: WorkflowSelector
    if args.selector == "manual":
        if args.workflow not in SUPPORTED_WORKFLOWS:
            raise ValueError("--workflow is required for --selector manual")
        selector = ManualSelector(args.workflow)
    elif args.selector == "laya":
        selector = LayaSelector()
    else:
        selector = RuleSelector()
    plan = Planner(MockLLMClient(), selector=selector).create_plan(
        args.question, dataset_id, _parameters(args)
    )
    result = execute_plan(
        plan,
        adata,
        output,
        experiment_id=args.experiment_id,
        dataset_hash=anndata_content_hash(adata),
        config=config,
    )
    provenance_store = ProvenanceStore(output / "ledger.db")
    evidence_store = EvidenceStore(output / "ledger.db") if config.ledger_enabled else None
    try:
        report = build_report(
            question=args.question,
            dataset_id=dataset_id,
            plan=plan,
            evidence=result.evidence,
            provenance=provenance_store.list(),
            artifact_ids_by_step=result.step_artifact_ids,
        )
        if config.provenance_constraints_enabled:
            validate_report(report, evidence_store, provenance_store)
        write_report(report, output / "report.md")
    finally:
        if evidence_store is not None:
            evidence_store.close()
        provenance_store.close()
    print(
        json.dumps(
            {
                "status": "review" if result.needs_review else "ok",
                "plan_id": plan.plan_id,
                "workflow": plan.steps[0].tool_name,
                "warnings": result.warnings,
                "artifact_ids": result.artifact_ids,
                "evidence_ids": [record.evidence_id for record in result.evidence],
                "report": str(output / "report.md"),
            },
            indent=2,
        )
    )
