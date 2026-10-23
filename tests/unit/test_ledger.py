from datetime import UTC, datetime

from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.schemas.evidence import EvidenceRecord
from bioagent_st.schemas.provenance import ProvenanceRecord


def make_provenance() -> ProvenanceRecord:
    return ProvenanceRecord(
        artifact_id="art_qc_001",
        artifact_type="qc_result",
        dataset_hash="sha256:abc",
        code_commit="uncommitted",
        tool_name="run_qc",
        tool_version="0.1.0",
        library_versions={},
        parameters={},
        random_seed=0,
        upstream_artifact_ids=[],
        output_uri="artifacts/exp_001/qc.json",
        output_hash="sha256:def",
        created_at=datetime.now(UTC),
    )


def make_evidence() -> EvidenceRecord:
    return EvidenceRecord(
        evidence_id="ev_001",
        experiment_id="exp_001",
        claim_id="clm_001",
        state="indeterminate",
        state_source="rule_engine",
        rule_state="indeterminate",
        claim="Evidence was insufficient.",
        supporting_artifacts=[],
        checks=[],
        provenance_ids=[],
        created_at=datetime.now(UTC),
    )


def test_provenance_round_trip(tmp_path) -> None:
    store = ProvenanceStore(tmp_path / "ledger.db")
    expected = make_provenance()

    store.insert(expected)

    assert store.get(expected.artifact_id) == expected
    assert store.list(artifact_type="qc_result") == [expected]


def test_provenance_insert_rejects_duplicate_id(tmp_path) -> None:
    store = ProvenanceStore(tmp_path / "ledger.db")
    record = make_provenance()
    store.insert(record)

    try:
        store.insert(record)
    except ValueError as error:
        assert "already exists" in str(error)
    else:
        raise AssertionError("duplicate insert did not fail")


def test_evidence_round_trip(tmp_path) -> None:
    store = EvidenceStore(tmp_path / "ledger.db")
    expected = make_evidence()

    store.insert(expected)

    assert store.get(expected.evidence_id) == expected
    assert store.list(experiment_id="exp_001", state="indeterminate") == [expected]
