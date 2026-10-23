from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from bioagent_st.llm.client import LLMClient
from bioagent_st.schemas.plans import AnalysisPlan

REGISTERED_TOOLS = frozenset({"qc_clustering", "markers", "spatial_statistics"})


class PlanValidationError(ValueError):
    pass


def validate_plan(plan: AnalysisPlan) -> AnalysisPlan:
    unknown = sorted({step.tool_name for step in plan.steps} - REGISTERED_TOOLS)
    if unknown:
        raise PlanValidationError("plan references unregistered tools: " + ", ".join(unknown))
    if not plan.steps:
        raise PlanValidationError("plan must contain at least one step")
    for step in plan.steps:
        if step.tool_name == "markers" and "clustering_result" not in step.prerequisites:
            raise PlanValidationError("markers requires clustering_result")
        if step.tool_name == "spatial_statistics" and "clustering_result" not in step.prerequisites:
            raise PlanValidationError("spatial_statistics requires clustering_result")
    return plan


class Planner:
    def __init__(self, client: LLMClient, max_retries: int = 2) -> None:
        self.client = client
        self.max_retries = max_retries

    def create_plan(self, question: str, dataset_id: str) -> AnalysisPlan:
        context: dict[str, Any] = {
            "dataset_id": dataset_id,
            "registered_tools": sorted(REGISTERED_TOOLS),
        }
        last_error: Exception | None = None
        for _ in range(self.max_retries + 1):
            try:
                payload = self.client.generate_plan(question, context)
                payload["created_at"] = datetime.now(UTC)
                plan = validate_plan(AnalysisPlan.model_validate(payload))
                return plan
            except (ValidationError, PlanValidationError, ValueError) as error:
                last_error = error
                context["validation_error"] = str(error)
        raise PlanValidationError("planner failed after retries") from last_error
