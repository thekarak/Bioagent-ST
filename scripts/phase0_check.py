from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory

from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.schemas.provenance import ProvenanceRecord


def main() -> None:
    with TemporaryDirectory() as directory:
        path = Path(directory) / "ledger.db"
        record = ProvenanceRecord(
            artifact_id="art_qc_roundtrip",
            artifact_type="qc_result",
            dataset_hash="sha256:test",
            code_commit="uncommitted",
            tool_name="phase0_check",
            tool_version="0.1.0",
            library_versions={},
            parameters={"seed": 0},
            random_seed=0,
            upstream_artifact_ids=[],
            output_uri="artifacts/phase0/check.json",
            output_hash="sha256:output",
            created_at=datetime.now(UTC),
        )
        store = ProvenanceStore(path)
        store.insert(record)
        loaded = store.get(record.artifact_id)
        if loaded != record:
            raise RuntimeError("provenance round-trip mismatch")
        print(f"Provenance round-trip passed: {loaded.artifact_id}")
        store.close()


if __name__ == "__main__":
    main()
