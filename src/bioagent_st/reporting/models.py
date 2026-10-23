from typing import Literal

from pydantic import Field

from bioagent_st.schemas.base import FrozenRecord


class QuantitativeStatement(FrozenRecord):
    text: str
    artifact_id: str


class WorkflowEntry(FrozenRecord):
    step_id: str
    tool_name: str
    artifact_ids: list[str] = Field(default_factory=list)


class ReportFinding(FrozenRecord):
    section: Literal["supported", "plausible", "hypothesis", "unsupported", "indeterminate"]
    text: str
    evidence_id: str
    claim_id: str


class ScientificReport(FrozenRecord):
    question: str
    dataset_id: str
    findings: list[ReportFinding]
    workflow: list[WorkflowEntry] = Field(default_factory=list)
    quantitative_statements: list[QuantitativeStatement] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    reproducibility: dict[str, str] = Field(default_factory=dict)
