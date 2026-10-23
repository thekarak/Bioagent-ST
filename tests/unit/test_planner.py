import pytest

from bioagent_st.agents.planner import Planner, PlanValidationError
from bioagent_st.llm.client import MockLLMClient
from bioagent_st.schemas.plans import AnalysisPlan


def test_mock_planner_returns_valid_typed_plan() -> None:
    plan = Planner(MockLLMClient()).create_plan("What spatial domains exist?", "fixture_001")

    assert isinstance(plan, AnalysisPlan)
    assert [step.tool_name for step in plan.steps] == [
        "qc_clustering",
        "markers",
        "spatial_statistics",
    ]


def test_planner_rejects_invalid_model_output() -> None:
    class InvalidClient:
        def generate_plan(self, question: str, context: dict[str, object]) -> dict[str, object]:
            return {"plan_id": "bad"}

    with pytest.raises(PlanValidationError):
        Planner(InvalidClient(), max_retries=0).create_plan("question", "dataset")
