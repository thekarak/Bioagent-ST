import sqlite3
from pathlib import Path

from bioagent_st.ledger.db import Database
from bioagent_st.schemas.provenance import ProvenanceRecord


class ProvenanceStore:
    def __init__(self, path: str | Path) -> None:
        self.database = Database(path)

    def close(self) -> None:
        self.database.close()

    def insert(self, record: ProvenanceRecord) -> None:
        try:
            self.database.connection.execute(
                """
                INSERT INTO artifacts (
                    artifact_id, experiment_id, artifact_type, output_uri,
                    output_hash, provenance_json, created_at
                ) VALUES (?, '', ?, ?, ?, ?, ?)
                """,
                (
                    record.artifact_id,
                    record.artifact_type,
                    record.output_uri,
                    record.output_hash,
                    record.model_dump_json(),
                    record.created_at.isoformat(),
                ),
            )
        except sqlite3.IntegrityError as error:
            raise ValueError(f"artifact {record.artifact_id} already exists") from error
        self.database.connection.commit()

    def get(self, artifact_id: str) -> ProvenanceRecord | None:
        row = self.database.connection.execute(
            "SELECT provenance_json FROM artifacts WHERE artifact_id = ?", (artifact_id,)
        ).fetchone()
        return ProvenanceRecord.model_validate_json(row[0]) if row else None

    def list(
        self,
        *,
        experiment_id: str | None = None,
        artifact_type: str | None = None,
    ) -> list[ProvenanceRecord]:
        clauses: list[str] = []
        values: list[str] = []
        if experiment_id is not None:
            clauses.append("experiment_id = ?")
            values.append(experiment_id)
        if artifact_type is not None:
            clauses.append("artifact_type = ?")
            values.append(artifact_type)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        rows = self.database.connection.execute(
            f"SELECT provenance_json FROM artifacts{where} ORDER BY created_at, artifact_id",
            values,
        ).fetchall()
        return [ProvenanceRecord.model_validate_json(row[0]) for row in rows]
