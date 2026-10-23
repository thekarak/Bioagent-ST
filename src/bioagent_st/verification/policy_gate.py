"""
verification/policy_gate.py — Explicit ALLOW / REVIEW / BLOCK gate.

The gate is a pure function of:
  - The SelectorDecision (kind, confidence, decision)
  - The current AgentConfig flags
  - An optional evidence band from previous checks

Outputs a PolicyDecision that the executor must honour.  The gate never
calls an LLM and never mutates state.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from bioagent_st.schemas.base import FrozenRecord
from bioagent_st.schemas.workflows import SelectorDecision, is_supported

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

PolicyDecision = Literal["ALLOW", "REVIEW", "BLOCK"]

EvidenceBand = Literal["high", "medium", "low", "unknown"]


class GateResult(FrozenRecord):
    """Immutable record of a single gate evaluation."""

    decision: PolicyDecision
    selector_kind: str
    workflow: str
    confidence: float | None = None
    evidence_band: EvidenceBand = "unknown"
    reasons: list[str] = Field(default_factory=list)
    requires_human_review: bool = False


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


class GateConfig(FrozenRecord):
    """
    Thresholds and feature flags for the policy gate.

    All numeric thresholds are PROVISIONAL defaults (skill §8.3).
    TODO(science-review): confirm confidence thresholds.
    """

    # If True, low-confidence Laya decisions escalate to REVIEW instead of BLOCK.
    laya_review_on_low_confidence: bool = True

    # Minimum Laya confidence required to ALLOW without review.
    laya_allow_threshold: float = Field(0.70, ge=0.0, le=1.0)
    # Below this Laya confidence the request is BLOCKed (or REVIEWed if flag set).
    laya_block_threshold: float = Field(0.40, ge=0.0, le=1.0)

    # Evidence band thresholds.
    allow_on_medium_evidence: bool = True  # medium → ALLOW with caveat
    block_on_low_evidence: bool = True  # low   → BLOCK + human-review flag

    # If True the gate is inactive — every supported workflow gets ALLOW.
    # Used for the no-gating ablation (AgentConfig.gating_enabled = False).
    disabled: bool = False


_DEFAULT_CONFIG = GateConfig()


# ---------------------------------------------------------------------------
# Pure gate function
# ---------------------------------------------------------------------------


def gate_request(
    selector_decision: SelectorDecision,
    *,
    evidence_band: EvidenceBand = "unknown",
    config: GateConfig | None = None,
) -> GateResult:
    """
    Evaluate a workflow request against the policy gate.

    Parameters
    ----------
    selector_decision:
        The typed decision produced by RuleSelector or LayaSelector.
    evidence_band:
        The quality band derived from prior check results in the current
        execution.  "unknown" means no checks have run yet (pre-execution).
    config:
        Optional gate configuration.  Defaults to ``GateConfig()``.

    Returns
    -------
    GateResult
        Immutable record with ALLOW / REVIEW / BLOCK + reasons.
    """
    cfg = config or _DEFAULT_CONFIG
    reasons: list[str] = []
    requires_review = False

    # --- Gate disabled (ablation) -------------------------------------------
    if cfg.disabled:
        return GateResult(
            decision="ALLOW",
            selector_kind=selector_decision.kind,
            workflow=selector_decision.decision,
            confidence=selector_decision.confidence,
            evidence_band=evidence_band,
            reasons=["Gate is disabled (gating_enabled=False ablation)."],
        )

    # --- Unsupported or ambiguous workflow -----------------------------------
    if not is_supported(selector_decision.decision):
        reasons.append(
            f"Selector returned '{selector_decision.decision}'; "
            "no approved workflow matched — execution is blocked."
        )
        return GateResult(
            decision="BLOCK",
            selector_kind=selector_decision.kind,
            workflow=selector_decision.decision,
            confidence=selector_decision.confidence,
            evidence_band=evidence_band,
            reasons=reasons,
            requires_human_review=False,
        )

    # --- Laya-specific confidence gating ------------------------------------
    if selector_decision.kind == "laya" and selector_decision.confidence is not None:
        conf = selector_decision.confidence
        if conf < cfg.laya_block_threshold:
            decision: PolicyDecision
            if cfg.laya_review_on_low_confidence:
                decision = "REVIEW"
                requires_review = True
                reasons.append(
                    f"Laya confidence {conf:.3f} is below block threshold "
                    f"{cfg.laya_block_threshold:.2f}; escalating for human review."
                )
            else:
                decision = "BLOCK"
                reasons.append(
                    f"Laya confidence {conf:.3f} is below block threshold "
                    f"{cfg.laya_block_threshold:.2f}; request blocked."
                )
            return GateResult(
                decision=decision,
                selector_kind=selector_decision.kind,
                workflow=selector_decision.decision,
                confidence=conf,
                evidence_band=evidence_band,
                reasons=reasons,
                requires_human_review=requires_review,
            )
        if conf < cfg.laya_allow_threshold:
            reasons.append(
                f"Laya confidence {conf:.3f} is below allow threshold "
                f"{cfg.laya_allow_threshold:.2f}; proceeding under review."
            )
            return GateResult(
                decision="REVIEW",
                selector_kind=selector_decision.kind,
                workflow=selector_decision.decision,
                confidence=conf,
                evidence_band=evidence_band,
                reasons=reasons,
                requires_human_review=True,
            )

    # --- Evidence band gating (post-QC, mid-execution) ----------------------
    if evidence_band == "low" and cfg.block_on_low_evidence:
        reasons.append(
            "Evidence band is LOW (hard check failure or error); "
            "blocking further steps and flagging for human review."
        )
        return GateResult(
            decision="BLOCK",
            selector_kind=selector_decision.kind,
            workflow=selector_decision.decision,
            confidence=selector_decision.confidence,
            evidence_band=evidence_band,
            reasons=reasons,
            requires_human_review=True,
        )

    if evidence_band == "medium" and not cfg.allow_on_medium_evidence:
        reasons.append(
            "Evidence band is MEDIUM (soft warnings); "
            "proceeding under review — downstream claims are Plausible at best."
        )
        return GateResult(
            decision="REVIEW",
            selector_kind=selector_decision.kind,
            workflow=selector_decision.decision,
            confidence=selector_decision.confidence,
            evidence_band=evidence_band,
            reasons=reasons,
            requires_human_review=True,
        )

    # --- All checks passed --------------------------------------------------
    reasons.append(
        f"Workflow '{selector_decision.decision}' passed the policy gate "
        f"(selector={selector_decision.kind}, band={evidence_band})."
    )
    return GateResult(
        decision="ALLOW",
        selector_kind=selector_decision.kind,
        workflow=selector_decision.decision,
        confidence=selector_decision.confidence,
        evidence_band=evidence_band,
        reasons=reasons,
        requires_human_review=False,
    )


# ---------------------------------------------------------------------------
# Evidence band helper (pure — no LLM)
# ---------------------------------------------------------------------------


def evidence_band_from_checks(
    checks: list[object],
) -> EvidenceBand:
    """
    Derive an EvidenceBand from a list of CheckResult objects.

    Rules (deterministic, no LLM):
    - Any check with status == "error"        → low
    - Any hard check with status == "fail"    → low
    - Any soft check with status == "fail"    → medium
    - Any check with status == "warn"         → medium (at most)
    - All checks pass / not_applicable        → high
    - No checks provided                      → unknown
    """
    if not checks:
        return "unknown"

    # Import here to avoid circular imports at module load time.
    from bioagent_st.schemas.evidence import CheckResult

    typed: list[CheckResult] = []
    for item in checks:
        if isinstance(item, CheckResult):
            typed.append(item)

    if not typed:
        return "unknown"

    for check in typed:
        if check.status == "error":
            return "low"

    for check in typed:
        if check.severity == "hard" and check.status == "fail":
            return "low"

    for check in typed:
        if check.severity == "soft" and check.status == "fail":
            return "medium"

    for check in typed:
        if check.status == "warn":
            return "medium"

    return "high"
