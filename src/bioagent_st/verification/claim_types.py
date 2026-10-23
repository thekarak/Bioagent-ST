from typing import Literal

from bioagent_st.schemas.claims import ClaimType
from bioagent_st.schemas.evidence import CheckResult

CheckStatus = Literal["pass", "warn", "fail", "error", "not_applicable"]
CLAIM_REQUIREMENTS: dict[ClaimType, tuple[str, ...]] = {
    "cluster_reproducible": ("cluster.stability.ari", "cluster.min_size", "qc.pass"),
    "marker_specific": (
        "marker.effect_size",
        "marker.fdr",
        "marker.group_size",
        "marker.consistency_resolution",
        "marker.circularity_flag",
    ),
    "spatial_domain_coherent": (
        "spatial.graph_valid",
        "spatial.enrichment_vs_null",
        "spatial.null_stability",
    ),
    "spatial_pattern_gene": (
        "spatial.graph_valid",
        "spatial.moran_fdr",
        "spatial.expression_sparsity",
        "spatial.null_present",
    ),
}


def required_checks(claim_type: ClaimType) -> tuple[str, ...]:
    return CLAIM_REQUIREMENTS[claim_type]


def check_index(checks: list[CheckResult]) -> dict[str, CheckResult]:
    return {check.check_id: check for check in checks}
