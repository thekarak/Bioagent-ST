from typing import Any, Literal

from pydantic import ConfigDict, Field, StrictFloat, StrictInt, model_validator

from bioagent_st.schemas.base import FrozenRecord
from bioagent_st.schemas.evidence import CheckResult


class CheckCollection(list[CheckResult]):
    """List of CheckResult that supports dictionary lookup by check_id string or integer index."""

    def __getitem__(self, item: Any) -> Any:
        if isinstance(item, str):
            for c in self:
                if getattr(c, "check_id", None) == item:
                    return c
            raise KeyError(f"Check {item!r} not found")
        return super().__getitem__(item)

    def __contains__(self, item: Any) -> bool:
        if isinstance(item, str):
            return any(getattr(c, "check_id", None) == item for c in self)
        return super().__contains__(item)

    def get(self, item: str, default: Any = None) -> Any:
        try:
            return self[item]
        except KeyError:
            return default


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

    @property
    def passed(self) -> bool:
        if self.status == "error":
            return False
        return not any(c.severity == "hard" and c.status == "fail" for c in self.checks)


class QualityAssessmentResult(ToolResult):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    checks: Any = Field(default_factory=CheckCollection)
    explicit_passed: bool | None = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def _coerce_params(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if (
                "checks" in data
                and isinstance(data["checks"], list)
                and not isinstance(data["checks"], CheckCollection)
            ):
                data["checks"] = CheckCollection(data["checks"])
            if "passed" in data and "explicit_passed" not in data:
                data["explicit_passed"] = data.pop("passed")
        return data

    @property
    def passed(self) -> bool:
        if self.explicit_passed is not None:
            return self.explicit_passed
        return super().passed

    @classmethod
    def from_tool_result(
        cls, tr: ToolResult, passed: bool | None = None
    ) -> "QualityAssessmentResult":
        chk = tr.checks
        if isinstance(chk, list) and not isinstance(chk, CheckCollection):
            chk = CheckCollection(chk)
        p = passed if passed is not None else tr.passed
        return cls(
            status=tr.status,
            artifact_ids=tr.artifact_ids,
            metrics=tr.metrics,
            checks=chk,
            warnings=tr.warnings,
            error=tr.error,
            explicit_passed=p,
        )
