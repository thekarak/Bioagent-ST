from typing import Literal

from pydantic import Field

from bioagent_st.schemas.base import FrozenRecord


class DatasetManifest(FrozenRecord):
    dataset_id: str
    source: str
    source_url: str | None = None
    version: str
    license: str
    sha256: str
    modality: Literal["generic_spatial", "visium", "single_cell", "other"]
    platform: str
    preprocessing_state: str
    known_limitations: list[str] = Field(default_factory=list)
    parent_dataset_id: str | None = None
    perturbation: dict[str, str | float | int] | None = None
    seed: int | None = None
    notes: str = ""
    tissue: str | None = None
    organism: str | None = None
    label_columns: list[str] = Field(default_factory=list)
    citation: str | None = None


class DatasetInspection(FrozenRecord):
    dataset_id: str
    path: str
    n_obs: int
    n_vars: int
    spatial_key: str
    counts_like: bool
    unique_obs_names: bool
    unique_var_names: bool
    finite_spatial_coordinates: bool
    label_columns: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
