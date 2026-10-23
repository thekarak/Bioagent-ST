from typing import Literal

from pydantic import Field, StrictFloat, StrictInt, model_validator

from bioagent_st.schemas.base import FrozenRecord
from bioagent_st.schemas.evidence import CheckResult


class ToolResult(FrozenRecord):
    status: Literal["ok", "partial", "error"]
    artifact_ids: list[str]
    metrics: dict[str, StrictFloat | StrictInt | str]
    checks: list[CheckResult] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None

    @model_validator(mode="after")
    def align_status_and_error(self) -> "ToolResult":
        if self.status == "error" and not self.error:
            raise ValueError("error results require an error message")
        if self.status != "error" and self.error:
            raise ValueError("only error results may include an error message")
        return self
