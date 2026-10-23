from datetime import datetime
from typing import Literal

from pydantic import Field

from bioagent_st.schemas.base import FrozenRecord
from bioagent_st.schemas.evidence import EvidenceState

ClaimType = Literal[
    "cluster_reproducible",
    "marker_specific",
    "spatial_domain_coherent",
    "spatial_pattern_gene",
]


class ClaimRecord(FrozenRecord):
    claim_id: str
    experiment_id: str
    text: str
    claim_type: ClaimType
    origin: Literal["observation", "extrapolation"] = "observation"
    evidence_state: EvidenceState
    evidence_ids: list[str] = Field(default_factory=list)
    provenance_ids: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    requires_human_review: bool = False
    created_at: datetime
