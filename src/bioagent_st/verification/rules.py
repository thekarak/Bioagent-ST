from dataclasses import dataclass
from datetime import UTC, datetime

from bioagent_st.schemas.claims import ClaimType
from bioagent_st.schemas.evidence import CheckResult, EvidenceRecord, EvidenceState
from bioagent_st.verification.claim_types import check_index, required_checks
from bioagent_st.verification.config import ThresholdConfig

CONTRADICTING_CHECKS = frozenset(
    {
        "marker.effect_size",
        "marker.fdr",
        "spatial.enrichment_vs_null",
        "spatial.moran_fdr",
    }
)
INTEGRITY_CHECKS = frozenset(
    {"prov.artifacts_exist", "prov.hashes_match", "prov.upstream_complete"}
)


@dataclass(frozen=True)
class RuleDecision:
    state: EvidenceState
    reasons: list[str]


def decide_state(
    claim_type: ClaimType,
    checks: list[CheckResult],
    *,
    origin: str = "observation",
    thresholds: ThresholdConfig | None = None,
) -> RuleDecision:
    del thresholds
    required = set(required_checks(claim_type))
    by_id = check_index(checks)
    reasons: list[str] = []
    missing = sorted(required - by_id.keys())
    if missing:
        reasons.append("required checks missing: " + ", ".join(missing))
    if any(check.status == "error" for check in checks):
        reasons.append("a verification check could not run")
    if any(check.check_id in INTEGRITY_CHECKS and check.status == "fail" for check in checks):
        reasons.append("provenance integrity failed")
    if reasons:
        return RuleDecision("indeterminate", reasons)

    hard_failures = [
        check for check in checks if check.severity == "hard" and check.status == "fail"
    ]
    if hard_failures:
        contradictory = [
            check.check_id for check in hard_failures if check.check_id in CONTRADICTING_CHECKS
        ]
        if contradictory:
            return RuleDecision(
                "unsupported", ["contradicting check failed: " + ", ".join(contradictory)]
            )
        return RuleDecision("indeterminate", ["a required hard check failed"])

    if origin == "extrapolation":
        return RuleDecision("hypothesis", ["claim is explicitly marked as extrapolation"])

    hard_checks = [by_id[check_id] for check_id in required if by_id[check_id].severity == "hard"]
    soft_failures = [
        check for check in checks if check.severity == "soft" and check.status == "fail"
    ]
    soft_warnings = [
        check for check in checks if check.severity == "soft" and check.status == "warn"
    ]
    if not hard_checks or any(check.status != "pass" for check in hard_checks):
        return RuleDecision("indeterminate", ["required hard evidence is incomplete"])
    if soft_failures:
        return RuleDecision("plausible", ["soft evidence failures remain"])
    if len(soft_warnings) <= 1:
        return RuleDecision("supported", ["required checks passed"])
    return RuleDecision("plausible", ["multiple soft warnings remain"])


def evidence_from_checks(
    *,
    experiment_id: str,
    claim_id: str,
    claim: str,
    claim_type: ClaimType,
    checks: list[CheckResult],
    supporting_artifacts: list[str],
    provenance_ids: list[str],
    origin: str = "observation",
    limitations: list[str] | None = None,
) -> EvidenceRecord:
    decision = decide_state(claim_type, checks, origin=origin)
    return EvidenceRecord(
        evidence_id=f"ev_{claim_id}",
        experiment_id=experiment_id,
        claim_id=claim_id,
        state=decision.state,
        state_source="rule_engine",
        rule_state=decision.state,
        claim=claim,
        supporting_artifacts=supporting_artifacts,
        checks=checks,
        limitations=limitations or [],
        uncertainty_reasons=decision.reasons if decision.state == "indeterminate" else [],
        provenance_ids=provenance_ids,
        created_at=datetime.now(UTC),
    )
