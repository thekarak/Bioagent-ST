from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from bioagent_st.analysis.clustering import ClusteringParams
from bioagent_st.analysis.expression import GeneExpressionParams
from bioagent_st.analysis.qc import QCParams
from bioagent_st.llm.client import LLMClient
from bioagent_st.routing import RuleSelector, WorkflowSelector
from bioagent_st.schemas.plans import AnalysisPlan
from bioagent_st.schemas.workflows import SUPPORTED_WORKFLOWS, is_supported

REGISTERED_TOOLS = frozenset(SUPPORTED_WORKFLOWS)


class PlanValidationError(ValueError):
    pass


def _validate_step_parameters(tool_name: str, parameters: dict[str, object]) -> None:
    if tool_name == "quality_assessment":
        QCParams.model_validate(parameters)
    elif tool_name == "spatial_clustering":
        clustering = parameters.get("clustering", {})
        if not isinstance(clustering, dict):
            raise PlanValidationError("spatial_clustering.clustering must be an object")
        ClusteringParams.model_validate(clustering)
    elif tool_name == "gene_expression":
        GeneExpressionParams.model_validate(parameters)


def validate_plan(plan: AnalysisPlan) -> AnalysisPlan:
    unknown = sorted({step.tool_name for step in plan.steps} - REGISTERED_TOOLS)
    if unknown:
        raise PlanValidationError("plan references unregistered tools: " + ", ".join(unknown))
    if not plan.steps:
        raise PlanValidationError("plan must contain at least one step")
    for step in plan.steps:
        _validate_step_parameters(step.tool_name, step.parameters)
    return plan


class Planner:
    def __init__(
        self,
        client: LLMClient,
        selector: WorkflowSelector | None = None,
        max_retries: int = 2,
    ) -> None:
        self.client = client
        self.selector = selector or RuleSelector()
        self.max_retries = max_retries

    def create_plan(
        self,
        question: str,
        dataset_id: str,
        parameters: dict[str, Any] | None = None,
    ) -> AnalysisPlan:
        decision = self.selector.select(question)
        if not is_supported(decision.decision):
            raise PlanValidationError(
                f"selector did not choose a supported workflow: {decision.decision}"
            )
        context: dict[str, Any] = {
            "dataset_id": dataset_id,
            "registered_tools": sorted(REGISTERED_TOOLS),
            "selector": decision.model_dump(),
            "workflow_id": decision.decision,
            "parameters": parameters or {},
        }
        last_error: Exception | None = None
        for _ in range(self.max_retries + 1):
            try:
                payload = self.client.generate_plan(question, context)
                payload["created_at"] = datetime.now(UTC)
                # Attach the selector decision so the policy gate can use it.
                payload.setdefault("selector_decision", decision.model_dump())
                plan = validate_plan(AnalysisPlan.model_validate(payload))
                return plan
            except (ValidationError, PlanValidationError, ValueError) as error:
                last_error = error
                context["validation_error"] = str(error)
        raise PlanValidationError("planner failed after retries") from last_error
