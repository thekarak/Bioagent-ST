from __future__ import annotations

from datetime import datetime

from pydantic import Field, model_validator

from bioagent_st.schemas.base import FrozenRecord
from bioagent_st.schemas.workflows import SelectorDecision


class AnalysisStep(FrozenRecord):
    step_id: str
    tool_name: str
    purpose: str
    parameters: dict[str, object]
    input_artifact_ids: list[str] = Field(default_factory=list)
    expected_outputs: list[str] = Field(default_factory=list)
    prerequisites: list[str] = Field(default_factory=list)


class AnalysisPlan(FrozenRecord):
    plan_id: str
    research_question: str
    dataset_id: str
    steps: list[AnalysisStep]
    constraints: list[str] = Field(default_factory=list)
    created_by_model: str
    created_at: datetime
    # The SelectorDecision that produced this plan — used by the policy gate.
    # Optional so that existing serialised plans (without this field) still load.
    selector_decision: SelectorDecision | None = Field(default=None)

    @model_validator(mode="after")
    def reject_duplicate_step_ids(self) -> AnalysisPlan:
        step_ids = [step.step_id for step in self.steps]
        duplicates = sorted({step_id for step_id in step_ids if step_ids.count(step_id) > 1})
        if duplicates:
            raise ValueError(f"Duplicate step_id values: {', '.join(duplicates)}")
        return self
