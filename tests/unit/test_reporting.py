from datetime import UTC, datetime

import pytest

from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.reporting.generator import ReportValidationError, validate_report
from bioagent_st.reporting.models import ReportFinding, ScientificReport
from bioagent_st.schemas.evidence import EvidenceRecord


def test_report_validator_rejects_unknown_evidence(tmp_path) -> None:
    evidence_store = EvidenceStore(tmp_path / "ledger.db")
    provenance_store = ProvenanceStore(tmp_path / "ledger.db")
    try:
        report = ScientificReport(
            question="q",
            dataset_id="d",
            findings=[
                ReportFinding(
                    section="supported",
                    text="claim",
                    evidence_id="missing",
                    claim_id="clm",
                )
            ],
        )
        with pytest.raises(ReportValidationError, match="unknown evidence"):
            validate_report(report, evidence_store, provenance_store)
    finally:
        provenance_store.close()
        evidence_store.close()


def test_report_validator_accepts_matching_evidence_state(tmp_path) -> None:
    evidence_store = EvidenceStore(tmp_path / "ledger.db")
    provenance_store = ProvenanceStore(tmp_path / "ledger.db")
    try:
        evidence = EvidenceRecord(
            evidence_id="ev_001",
            experiment_id="exp",
            claim_id="clm",
            state="indeterminate",
            state_source="rule_engine",
            rule_state="indeterminate",
            claim="claim",
            supporting_artifacts=[],
            checks=[],
            provenance_ids=[],
            created_at=datetime.now(UTC),
        )
        evidence_store.insert(evidence)
        report = ScientificReport(
            question="q",
            dataset_id="d",
            findings=[
                ReportFinding(
                    section="indeterminate",
                    text="claim",
                    evidence_id="ev_001",
                    claim_id="clm",
                )
            ],
        )
        validate_report(report, evidence_store, provenance_store)
    finally:
        provenance_store.close()
        evidence_store.close()


def test_build_and_write_validated_report(tmp_path) -> None:
    from bioagent_st.fixtures import create_spatial_fixture
    from bioagent_st.reporting.generator import build_report, write_report
    from bioagent_st.schemas.plans import AnalysisPlan, AnalysisStep
    from bioagent_st.tools.workflow import run_quality_assessment

    adata = create_spatial_fixture()
    result = run_quality_assessment(adata, tmp_path)
    assert result.status == "ok"

    pstore = ProvenanceStore(tmp_path / "ledger.db")
    estore = EvidenceStore(tmp_path / "ledger.db")

    try:
        plan = AnalysisPlan(
            plan_id="plan_rep_test",
            research_question="Verify QC and spot metrics",
            dataset_id="fixture",
            steps=[
                AnalysisStep(
                    step_id="step_1",
                    tool_name="quality_assessment",
                    purpose="QC filtering",
                    parameters={},
                )
            ],
            created_by_model="test",
            created_at=datetime.now(UTC),
        )
        report = build_report(
            question="Verify QC and spot metrics",
            dataset_id="fixture",
            plan=plan,
            evidence=[],
            provenance=pstore.list(),
            artifact_ids_by_step={"step_1": result.artifact_ids},
        )
        # Verify quantitative statements were extracted
        assert len(report.quantitative_statements) > 0
        assert any("spots" in q.text.lower() for q in report.quantitative_statements)

        # Validate report passes without error
        validate_report(report, estore, pstore)

        # Write report and check rich output
        out_file = tmp_path / "report.md"
        content = write_report(report, out_file)
        assert out_file.is_file()
        assert "# BioAgent-ST Validated Scientific Report" in content
        assert "## Analysis workflow" in content
        assert "## Quantitative measurements and verified artifacts" in content
        assert "## Findings by evidence state" in content
        assert "## Limitations and assumptions" in content
        assert "## Reproducibility appendix" in content
    finally:
        estore.close()
        pstore.close()
