from pydantic import BaseModel, ConfigDict, Field


class ToolSpec(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    name: str
    version: str
    params_model: type[BaseModel]
    prerequisites: list[str] = Field(default_factory=list)
    supported_modalities: list[str] = Field(default_factory=list)
    output_artifact_types: list[str] = Field(default_factory=list)
