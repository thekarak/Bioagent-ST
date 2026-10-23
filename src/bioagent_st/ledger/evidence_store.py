import sqlite3
from pathlib import Path

from bioagent_st.ledger.db import Database
from bioagent_st.schemas.evidence import EvidenceRecord, EvidenceState


class EvidenceStore:
    def __init__(self, path: str | Path) -> None:
        self.database = Database(path)

    def close(self) -> None:
        self.database.close()

    def insert(self, record: EvidenceRecord) -> None:
        try:
            self.database.connection.execute(
                """
                INSERT INTO evidence (
                    evidence_id, experiment_id, claim_id, state,
                    evidence_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    record.evidence_id,
                    record.experiment_id,
                    record.claim_id,
                    record.state,
                    record.model_dump_json(),
                    record.created_at.isoformat(),
                ),
            )
        except sqlite3.IntegrityError as error:
            raise ValueError(f"evidence {record.evidence_id} already exists") from error
        self.database.connection.commit()

    def get(self, evidence_id: str) -> EvidenceRecord | None:
        row = self.database.connection.execute(
            "SELECT evidence_json FROM evidence WHERE evidence_id = ?", (evidence_id,)
        ).fetchone()
        return EvidenceRecord.model_validate_json(row[0]) if row else None

    def list(
        self,
        *,
        experiment_id: str | None = None,
        state: EvidenceState | None = None,
    ) -> list[EvidenceRecord]:
        clauses: list[str] = []
        values: list[str] = []
        if experiment_id is not None:
            clauses.append("experiment_id = ?")
            values.append(experiment_id)
        if state is not None:
            clauses.append("state = ?")
            values.append(state)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        rows = self.database.connection.execute(
            f"SELECT evidence_json FROM evidence{where} ORDER BY created_at, evidence_id",
            values,
        ).fetchall()
        return [EvidenceRecord.model_validate_json(row[0]) for row in rows]
