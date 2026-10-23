from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from bioagent_st.schemas.evidence import EvidenceRecord, EvidenceState
from bioagent_st.schemas.plans import AnalysisPlan, AnalysisStep
from bioagent_st.schemas.provenance import ProvenanceRecord
from bioagent_st.schemas.tools import ToolResult


def sample_provenance() -> ProvenanceRecord:
    return ProvenanceRecord(
        artifact_id="art_qc_001",
        artifact_type="qc_result",
        dataset_hash="sha256:abc123",
        code_commit="uncommitted",
        tool_name="run_qc",
        tool_version="0.1.0",
        library_versions={"scanpy": "1.11.5"},
        parameters={"min_genes": 200},
        random_seed=0,
        upstream_artifact_ids=[],
        output_uri="artifacts/exp_001/qc.json",
        output_hash="sha256:def456",
        created_at=datetime.now(UTC),
    )


def sample_evidence(state: EvidenceState = "supported") -> EvidenceRecord:
    return EvidenceRecord(
        evidence_id="ev_001",
        experiment_id="exp_001",
        claim_id="clm_001",
        state=state,
        state_source="rule_engine",
        rule_state=state,
        claim="Clustering found a stable group.",
        supporting_artifacts=["art_qc_001"],
        checks=[],
        provenance_ids=["art_qc_001"],
        created_at=datetime.now(UTC),
    )


def test_records_are_frozen_and_reject_extra_fields() -> None:
    record = sample_provenance()

    with pytest.raises(ValidationError):
        record.output_hash = "sha256:changed"  # type: ignore[misc]

    with pytest.raises(ValidationError):
        ProvenanceRecord.model_validate({**record.model_dump(), "unknown": True})


@pytest.mark.parametrize(
    "state",
    ["supported", "plausible", "hypothesis", "unsupported", "indeterminate"],
)
def test_all_five_evidence_states_are_valid(state: EvidenceState) -> None:
    assert sample_evidence(state).state == state


def test_confidence_defaults_to_none() -> None:
    assert sample_evidence().confidence is None


def test_analysis_plan_rejects_duplicate_step_ids() -> None:
    step = AnalysisStep(
        step_id="step_1",
        tool_name="run_qc",
        purpose="Filter low-quality observations",
        parameters={"min_genes": 200},
    )

    with pytest.raises(ValidationError, match="Duplicate step_id"):
        AnalysisPlan(
            plan_id="plan_001",
            research_question="What spatial domains exist?",
            dataset_id="fixture_001",
            steps=[step, step.model_copy()],
            created_by_model="mock",
            created_at=datetime.now(UTC),
        )


def test_tool_result_metrics_reject_nested_values() -> None:
    with pytest.raises(ValidationError):
        ToolResult(status="ok", artifact_ids=[], metrics={"nested": {"value": 1}})
