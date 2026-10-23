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
