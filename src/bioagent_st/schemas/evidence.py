from datetime import datetime
from typing import Literal

from pydantic import Field

from bioagent_st.schemas.base import FrozenRecord

EvidenceState = Literal[
    "supported",
    "plausible",
    "hypothesis",
    "unsupported",
    "indeterminate",
]


class CheckResult(FrozenRecord):
    check_id: str
    status: Literal["pass", "warn", "fail", "error", "not_applicable"]
    severity: Literal["hard", "soft"]
    value: float | None = None
    threshold: float | None = None
    detail: str = ""
    artifact_ids: list[str] = Field(default_factory=list)


class EvidenceRecord(FrozenRecord):
    evidence_id: str
    experiment_id: str
    claim_id: str
    state: EvidenceState
    state_source: Literal["rule_engine", "critic_downgrade"]
    rule_state: EvidenceState
    claim: str
    supporting_artifacts: list[str]
    contradicting_artifacts: list[str] = Field(default_factory=list)
    checks: list[CheckResult] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    alternatives: list[str] = Field(default_factory=list)
    uncertainty_reasons: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    llm_reported_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    provenance_ids: list[str]
    requires_human_review: bool = False
    created_at: datetime
