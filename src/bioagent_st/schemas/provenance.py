from datetime import UTC, datetime
from typing import Any

from pydantic import Field

from bioagent_st.schemas.base import FrozenRecord


class ProvenanceRecord(FrozenRecord):
    artifact_id: str
    artifact_type: str
    dataset_hash: str
    input_artifact_hashes: dict[str, str] = Field(default_factory=dict)
    code_commit: str
    tool_name: str
    tool_version: str
    library_versions: dict[str, str]
    parameters: dict[str, Any]
    random_seed: int | None
    upstream_artifact_ids: list[str]
    output_uri: str
    output_hash: str
    created_at: datetime
    llm_model_id: str | None = None


class ArtifactRecord(FrozenRecord):
    artifact_id: str
    artifact_type: str = "qc_result"
    dataset_hash: str = ""
    input_artifact_hashes: dict[str, str] = Field(default_factory=dict)
    code_commit: str = "uncommitted"
    tool_name: str = "quality_assessment"
    tool_version: str = "0.1.0"
    library_versions: dict[str, str] = Field(default_factory=dict)
    parameters: dict[str, Any] = Field(default_factory=dict)
    random_seed: int | None = None
    upstream_artifact_ids: list[str] = Field(default_factory=list)
    output_uri: str = ""
    output_hash: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    llm_model_id: str | None = None
    experiment_id: str = ""
