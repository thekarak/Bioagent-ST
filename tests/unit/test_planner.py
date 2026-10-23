import pytest

from bioagent_st.agents.planner import Planner, PlanValidationError
from bioagent_st.llm.client import MockLLMClient
from bioagent_st.schemas.plans import AnalysisPlan


def test_mock_planner_returns_valid_typed_plan() -> None:
    plan = Planner(MockLLMClient()).create_plan("What spatial domains exist?", "fixture_001")

    assert isinstance(plan, AnalysisPlan)
    assert [step.tool_name for step in plan.steps] == ["spatial_clustering"]


def test_mock_planner_quality_path() -> None:
    plan = Planner(MockLLMClient()).create_plan(
        "Assess the quality and inspect schema for this dataset", "fixture_001"
    )

    assert isinstance(plan, AnalysisPlan)
    assert len(plan.steps) == 1
    assert plan.steps[0].tool_name == "quality_assessment"
    assert "min_genes" in plan.steps[0].parameters


def test_mock_planner_gene_path_with_explicit_params() -> None:
    plan = Planner(MockLLMClient()).create_plan(
        "Show spatial expression of GENE_0000",
        "fixture_001",
        parameters={"genes": ["GENE_0000"], "layer": "X"},
    )

    assert isinstance(plan, AnalysisPlan)
    assert len(plan.steps) == 1
    assert plan.steps[0].tool_name == "gene_expression"
    assert plan.steps[0].parameters["genes"] == ["GENE_0000"]


def test_mock_planner_gene_path_defaults() -> None:
    plan = Planner(MockLLMClient()).create_plan(
        "Show spatial expression of GENE_0000",
        "fixture_001",
    )

    assert isinstance(plan, AnalysisPlan)
    assert len(plan.steps) == 1
    assert plan.steps[0].tool_name == "gene_expression"
    assert len(plan.steps[0].parameters["genes"]) >= 1


def test_planner_rejects_invalid_model_output() -> None:
    class InvalidClient:
        def generate_plan(self, question: str, context: dict[str, object]) -> dict[str, object]:
            return {"plan_id": "bad"}

    with pytest.raises(PlanValidationError):
        Planner(InvalidClient(), max_retries=0).create_plan("question", "dataset")
