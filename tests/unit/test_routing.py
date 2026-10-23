from typing import Any

from bioagent_st.routing import LayaSelector, select_by_rules, select_workflow
from bioagent_st.schemas.workflows import SUPPORTED_WORKFLOWS


def test_rules_select_all_three_workflows() -> None:
    assert select_by_rules("Assess the quality and schema of this dataset").decision == (
        "quality_assessment"
    )
    assert select_by_rules("Show spatial clusters based on expression patterns").decision == (
        "spatial_clustering"
    )
    assert select_by_rules("Show spatial expression of GENE_0000").decision == "gene_expression"


def test_rules_abstain_on_conflicting_or_unknown_requests() -> None:
    assert select_by_rules("Tell me about this dataset").decision == "unsupported_or_ambiguous"
    assert select_by_rules("Cluster quality").decision == "unsupported_or_ambiguous"


def test_manual_selection_does_not_run_a_selector() -> None:
    decision = select_workflow("quality assessment", "manual", manual_workflow="gene_expression")
    assert decision.kind == "manual"
    assert decision.decision == "gene_expression"


class FakePredictor:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload

    def predict(
        self, state: str, questions: dict[str, Any], *, model: str | None = None
    ) -> dict[str, Any]:
        del state, questions, model
        return self.payload


def test_laya_adapter_parses_typed_decision() -> None:
    predictor = FakePredictor(
        {
            "answers": {
                "workflow": {
                    "choice": "spatial_clustering",
                    "confidence": 0.91,
                    "probabilities": {
                        "quality_assessment": 0.02,
                        "spatial_clustering": 0.91,
                        "gene_expression": 0.05,
                        "unsupported_or_ambiguous": 0.02,
                    },
                }
            }
        }
    )
    decision = LayaSelector(predictor=predictor).select("Find spatial domains")

    assert decision.kind == "laya"
    assert decision.decision in SUPPORTED_WORKFLOWS
    assert decision.decision == "spatial_clustering"
    assert decision.confidence == 0.91
    assert decision.latency_ms is not None


def test_laya_adapter_abstains_on_low_confidence() -> None:
    predictor = FakePredictor(
        {"answers": {"workflow": {"choice": "gene_expression", "confidence": 0.2}}}
    )

    decision = LayaSelector(predictor=predictor, confidence_threshold=0.55).select("Show GENE_0000")

    assert decision.decision == "unsupported_or_ambiguous"
    assert "below" in decision.notes


def test_laya_adapter_rejects_malformed_output_and_falls_back() -> None:
    predictor = FakePredictor({"answers": {"workflow": {"choice": "not_a_workflow"}}})
    selector = LayaSelector(predictor=predictor, fallback_to_rules=True)

    decision = selector.select("Show spatial expression of GENE_0000")

    assert decision.kind == "rules"
    assert decision.decision == "gene_expression"
    assert "fallback" in decision.notes


def test_laya_adapter_raises_without_fallback_on_malformed_output() -> None:
    import pytest

    from bioagent_st.routing import SelectorError

    predictor = FakePredictor({"answers": {"workflow": {"choice": "invalid_choice"}}})
    selector = LayaSelector(predictor=predictor, fallback_to_rules=False)

    with pytest.raises(SelectorError, match="unknown workflow label"):
        selector.select("Show spatial expression of GENE_0000")


def test_routing_evaluation_harness_with_fake_predictor() -> None:
    from scripts.evaluate_routing import run_evaluation_harness

    results = run_evaluation_harness(use_real_laya=False)
    assert "rules" in results
    assert "laya" in results

    rules = results["rules"]
    laya = results["laya"]

    assert rules.total_queries >= 10
    assert rules.accuracy >= 0.8
    assert rules.error_count == 0
    assert rules.mean_latency_ms >= 0.0

    assert laya.total_queries == rules.total_queries
    assert laya.accuracy >= 0.85
    assert laya.abstentions >= 1
    assert laya.error_count == 0
    assert laya.mean_latency_ms > 0.0
