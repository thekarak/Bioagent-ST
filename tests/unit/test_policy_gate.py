"""Unit tests for verification/policy_gate.py."""

from __future__ import annotations

import pytest

from bioagent_st.schemas.evidence import CheckResult
from bioagent_st.schemas.workflows import SelectorDecision
from bioagent_st.verification.policy_gate import (
    GateConfig,
    evidence_band_from_checks,
    gate_request,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _rules_decision(workflow: str, confidence: float | None = None) -> SelectorDecision:
    return SelectorDecision(
        kind="rules",
        name="Deterministic rules",
        version="rules-v1",
        decision=workflow,  # type: ignore[arg-type]
        confidence=confidence,
    )


def _laya_decision(workflow: str, confidence: float | None = None) -> SelectorDecision:
    return SelectorDecision(
        kind="laya",
        name="Laya typed-decisions",
        version="laya-adapter-v1",
        decision=workflow,  # type: ignore[arg-type]
        confidence=confidence,
    )


def _check(
    check_id: str,
    status: str,
    severity: str = "hard",
) -> CheckResult:
    return CheckResult(
        check_id=check_id,
        status=status,  # type: ignore[arg-type]
        severity=severity,  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# gate_request — ALLOW / REVIEW / BLOCK
# ---------------------------------------------------------------------------


class TestGateRequestAllow:
    def test_rules_supported_workflow_is_allowed(self) -> None:
        dec = _rules_decision("spatial_clustering")
        result = gate_request(dec)
        assert result.decision == "ALLOW"
        assert not result.requires_human_review

    def test_rules_quality_assessment_is_allowed(self) -> None:
        dec = _rules_decision("quality_assessment")
        result = gate_request(dec)
        assert result.decision == "ALLOW"

    def test_rules_gene_expression_is_allowed(self) -> None:
        dec = _rules_decision("gene_expression")
        result = gate_request(dec)
        assert result.decision == "ALLOW"

    def test_laya_high_confidence_is_allowed(self) -> None:
        dec = _laya_decision("spatial_clustering", confidence=0.92)
        result = gate_request(dec)
        assert result.decision == "ALLOW"
        assert result.confidence == pytest.approx(0.92)

    def test_evidence_band_high_stays_allowed(self) -> None:
        dec = _rules_decision("quality_assessment")
        result = gate_request(dec, evidence_band="high")
        assert result.decision == "ALLOW"


class TestGateRequestBlock:
    def test_unsupported_workflow_is_blocked(self) -> None:
        dec = _rules_decision("unsupported_or_ambiguous")
        result = gate_request(dec)
        assert result.decision == "BLOCK"
        assert not result.requires_human_review

    def test_laya_very_low_confidence_blocked_by_default(self) -> None:
        # With laya_review_on_low_confidence=False → BLOCK
        dec = _laya_decision("spatial_clustering", confidence=0.30)
        cfg = GateConfig(laya_review_on_low_confidence=False)
        result = gate_request(dec, config=cfg)
        assert result.decision == "BLOCK"

    def test_low_evidence_band_blocks_execution(self) -> None:
        dec = _rules_decision("spatial_clustering")
        cfg = GateConfig(block_on_low_evidence=True)
        result = gate_request(dec, evidence_band="low", config=cfg)
        assert result.decision == "BLOCK"
        assert result.requires_human_review

    def test_block_has_non_empty_reasons(self) -> None:
        dec = _rules_decision("unsupported_or_ambiguous")
        result = gate_request(dec)
        assert result.reasons


class TestGateRequestReview:
    def test_laya_low_confidence_escalates_to_review(self) -> None:
        # Default: laya_review_on_low_confidence=True
        dec = _laya_decision("spatial_clustering", confidence=0.30)
        result = gate_request(dec)
        assert result.decision == "REVIEW"
        assert result.requires_human_review

    def test_laya_medium_confidence_escalates_to_review(self) -> None:
        dec = _laya_decision("quality_assessment", confidence=0.55)
        # 0.55 < default laya_allow_threshold=0.70, >= laya_block_threshold=0.40
        result = gate_request(dec)
        assert result.decision == "REVIEW"
        assert result.requires_human_review


class TestGateDisabledAblation:
    def test_disabled_gate_always_allows(self) -> None:
        dec = _rules_decision("unsupported_or_ambiguous")
        cfg = GateConfig(disabled=True)
        result = gate_request(dec, config=cfg)
        # Even unsupported passes when gate is disabled
        assert result.decision == "ALLOW"
        assert "disabled" in result.reasons[0].lower()

    def test_disabled_preserves_workflow_field(self) -> None:
        dec = _laya_decision("gene_expression", confidence=0.10)
        cfg = GateConfig(disabled=True)
        result = gate_request(dec, config=cfg)
        assert result.workflow == "gene_expression"
        assert result.decision == "ALLOW"


# ---------------------------------------------------------------------------
# evidence_band_from_checks
# ---------------------------------------------------------------------------


class TestEvidenceBandFromChecks:
    def test_no_checks_returns_unknown(self) -> None:
        assert evidence_band_from_checks([]) == "unknown"

    def test_all_pass_returns_high(self) -> None:
        checks = [_check("c1", "pass"), _check("c2", "pass", "soft")]
        assert evidence_band_from_checks(checks) == "high"

    def test_hard_fail_returns_low(self) -> None:
        checks = [_check("c1", "pass"), _check("c2", "fail", "hard")]
        assert evidence_band_from_checks(checks) == "low"

    def test_error_returns_low(self) -> None:
        checks = [_check("c1", "error")]
        assert evidence_band_from_checks(checks) == "low"

    def test_soft_fail_returns_medium(self) -> None:
        checks = [_check("c1", "pass", "hard"), _check("c2", "fail", "soft")]
        assert evidence_band_from_checks(checks) == "medium"

    def test_warn_returns_medium(self) -> None:
        checks = [_check("c1", "pass"), _check("c2", "warn", "soft")]
        assert evidence_band_from_checks(checks) == "medium"

    def test_hard_fail_dominates_soft_warn(self) -> None:
        checks = [_check("c1", "warn", "soft"), _check("c2", "fail", "hard")]
        assert evidence_band_from_checks(checks) == "low"

    def test_error_dominates_everything(self) -> None:
        checks = [_check("c1", "pass"), _check("c2", "fail", "soft"), _check("c3", "error")]
        assert evidence_band_from_checks(checks) == "low"

    def test_not_applicable_counts_as_pass(self) -> None:
        checks = [_check("c1", "pass"), _check("c2", "not_applicable")]
        assert evidence_band_from_checks(checks) == "high"


# ---------------------------------------------------------------------------
# GateResult immutability (FrozenRecord)
# ---------------------------------------------------------------------------


class TestGateResultImmutability:
    def test_gate_result_is_frozen(self) -> None:
        dec = _rules_decision("quality_assessment")
        result = gate_request(dec)
        with pytest.raises((AttributeError, TypeError, ValueError)):
            result.decision = "BLOCK"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Frozen Thresholds & GateConfig loading
# ---------------------------------------------------------------------------


class TestGateConfigFrozenThresholds:
    def test_gate_config_defaults_match_frozen_thresholds(self) -> None:
        cfg = GateConfig()
        assert cfg.laya_allow_threshold == 0.70
        assert cfg.laya_block_threshold == 0.40
        assert cfg.laya_review_on_low_confidence is True
        assert cfg.allow_on_medium_evidence is True
        assert cfg.block_on_low_evidence is True
        assert cfg.disabled is False

    def test_gate_config_from_thresholds_default(self) -> None:
        cfg = GateConfig.from_thresholds()
        assert cfg.laya_allow_threshold == 0.70
        assert cfg.laya_block_threshold == 0.40
        assert cfg.laya_review_on_low_confidence is True
        assert cfg.allow_on_medium_evidence is True
        assert cfg.block_on_low_evidence is True

    def test_gate_config_from_threshold_config_object(self) -> None:
        from bioagent_st.verification.config import load_thresholds

        threshold_cfg = load_thresholds()
        assert threshold_cfg.provisional is False
        assert threshold_cfg.science_reviewer == "BioAgent-ST Scientific Review Board"
        assert threshold_cfg.last_reviewed == "2026-10-24"

        cfg = threshold_cfg.to_gate_config()
        assert cfg.laya_allow_threshold == 0.70
        assert cfg.laya_block_threshold == 0.40
        assert cfg.laya_review_on_low_confidence is True

    def test_gate_config_from_custom_dict(self) -> None:
        custom = {
            "policy_gate": {
                "laya_allow_threshold": 0.85,
                "laya_block_threshold": 0.50,
                "laya_review_on_low_confidence": False,
                "allow_on_medium_evidence": False,
                "block_on_low_evidence": True,
            }
        }
        cfg = GateConfig.from_thresholds(custom)
        assert cfg.laya_allow_threshold == 0.85
        assert cfg.laya_block_threshold == 0.50
        assert cfg.laya_review_on_low_confidence is False
        assert cfg.allow_on_medium_evidence is False

    def test_threshold_contract_validation(self) -> None:
        from bioagent_st.schemas.contracts import load_threshold_contract

        contract = load_threshold_contract()
        assert contract.provisional is False
        assert contract.science_reviewer == "BioAgent-ST Scientific Review Board"
        assert contract.last_reviewed == "2026-10-24"
        assert contract.qc.min_genes == 200
        assert contract.cluster.stability_ari_min == 0.60
        assert contract.marker.max_padj == 0.05
        assert contract.marker.circularity_flag == "always"
        assert contract.spatial.min_mean_degree == 6.0
        assert contract.spatial.max_moran_padj == 0.05
        assert contract.power.min_spots_per_group == 10
        assert contract.policy_gate.laya_allow_threshold == 0.70
        assert contract.policy_gate.laya_block_threshold == 0.40

    def test_exact_boundary_conditions_with_frozen_thresholds(self) -> None:
        cfg = GateConfig.from_thresholds()

        # At exactly 0.70 -> ALLOW
        dec_at_allow = _laya_decision("spatial_clustering", confidence=0.70)
        assert gate_request(dec_at_allow, config=cfg).decision == "ALLOW"

        # Just below 0.70 (0.699) -> REVIEW
        dec_sub_allow = _laya_decision("spatial_clustering", confidence=0.699)
        assert gate_request(dec_sub_allow, config=cfg).decision == "REVIEW"

        # At exactly 0.40 -> REVIEW (since < 0.70 and >= 0.40)
        dec_at_block = _laya_decision("spatial_clustering", confidence=0.40)
        assert gate_request(dec_at_block, config=cfg).decision == "REVIEW"

        # Below 0.40 with review enabled -> REVIEW
        dec_sub_block = _laya_decision("spatial_clustering", confidence=0.399)
        assert gate_request(dec_sub_block, config=cfg).decision == "REVIEW"

        # Below 0.40 with review disabled -> BLOCK
        cfg_strict = GateConfig.from_thresholds(
            {"policy_gate": {"laya_review_on_low_confidence": False}}
        )
        assert gate_request(dec_sub_block, config=cfg_strict).decision == "BLOCK"
