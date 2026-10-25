from pathlib import Path

import numpy as np
from anndata import AnnData, read_h5ad

from bioagent_st.fixtures import create_spatial_fixture
from bioagent_st.schemas.datasets import DatasetInspection
from bioagent_st.utils.hashing import sha256_file

REAL_DLPFC_PATH = Path("data/raw/real/dlpfc/151507.h5ad")
REAL_DLPFC_151673_PATH = Path("data/raw/real/dlpfc/151673.h5ad")
SYNTHETIC_PATH = Path("data/fixtures/synthetic_spatial_300x500.h5ad")

COMMON_SPATIAL_OBS_PAIRS: list[tuple[str, str]] = [
    ("x", "y"),
    ("spatial_x", "spatial_y"),
    ("array_row", "array_col"),
    ("imagecol", "imagerow"),
    ("pxl_col_in_fullres", "pxl_row_in_fullres"),
]


def detect_and_assign_spatial_coordinates(adata: AnnData) -> bool:
    """
    If obsm['spatial'] is missing, attempt to auto-detect spatial coordinates from obs columns.
    Returns True if obsm['spatial'] is present (or successfully created), False otherwise.
    """
    if "spatial" in adata.obsm:
        return True
    for c1, c2 in COMMON_SPATIAL_OBS_PAIRS:
        if c1 in adata.obs.columns and c2 in adata.obs.columns:
            try:
                coords = adata.obs[[c1, c2]].to_numpy().astype(float)
                if coords.ndim == 2 and coords.shape[1] >= 2 and coords.shape[0] == adata.n_obs:
                    adata.obsm["spatial"] = coords
                    return True
            except (ValueError, TypeError):
                continue
    return False


def _detect_counts_like(adata: AnnData) -> bool:
    matrix = adata[: min(100, adata.n_obs), : min(200, adata.n_vars)].X
    values = matrix.toarray() if hasattr(matrix, "toarray") else matrix
    if values.size == 0:
        return False
    return bool(((values >= 0) & (values == values.round())).all())


def inspect_h5ad(path: str | Path, dataset_id: str | None = None) -> DatasetInspection:
    source = Path(path)
    errors: list[str] = []
    warnings: list[str] = []
    if not source.is_file():
        raise FileNotFoundError(f"dataset does not exist: {source}")
    if source.suffix.lower() != ".h5ad":
        raise ValueError("only .h5ad inputs are supported in the initial ingest interface")

    adata = read_h5ad(source)
    unique_obs = bool(adata.obs_names.is_unique)
    unique_var = bool(adata.var_names.is_unique)
    if not unique_obs:
        warnings.append("observation names not unique; will be deduplicated on load")
    if not unique_var:
        warnings.append("gene names not unique; will be deduplicated on load")
    if adata.n_obs < 3:
        errors.append("fewer than 3 observations")
    if adata.n_vars < 1:
        errors.append("no genes")

    has_spatial = detect_and_assign_spatial_coordinates(adata)
    if not has_spatial:
        warnings.append(
            "obsm['spatial'] missing; required for spatial clustering and spatial autocorrelation"
        )

    finite_coords = False
    if "spatial" in adata.obsm:
        coordinates = adata.obsm["spatial"]
        try:
            finite_coords = coordinates.ndim == 2 and coordinates.shape[1] >= 2
            finite_coords = finite_coords and bool(coordinates.shape[0] == adata.n_obs)
            finite_coords = finite_coords and bool(coordinates[:, :2].dtype.kind in "fiu")
            finite_coords = finite_coords and bool(np.isfinite(coordinates[:, :2]).all())
        except (AttributeError, IndexError, TypeError):
            finite_coords = False
        if not finite_coords:
            errors.append("spatial coordinates must be a finite numeric n_obs x >=2 array")

    counts_like = _detect_counts_like(adata)
    if not counts_like:
        warnings.append("X is not detected as non-negative integer-like data")

    label_columns = [
        column
        for column in adata.obs.columns
        if str(adata.obs[column].dtype) in {"category", "object", "string", "bool"}
    ]
    return DatasetInspection(
        dataset_id=dataset_id or source.stem,
        path=str(source),
        n_obs=adata.n_obs,
        n_vars=adata.n_vars,
        spatial_key="spatial",
        counts_like=counts_like,
        unique_obs_names=unique_obs,
        unique_var_names=unique_var,
        finite_spatial_coordinates=finite_coords,
        label_columns=label_columns,
        warnings=warnings,
        errors=errors,
    )


def load_dataset(source: str, user_path: str | Path | None = None) -> AnnData:
    if source == "synthetic":
        return create_spatial_fixture()
    if source == "real_dlpfc":
        return read_h5ad(REAL_DLPFC_PATH)
    if source == "real_dlpfc_151673":
        return read_h5ad(REAL_DLPFC_151673_PATH)
    if source == "user":
        if user_path is None:
            raise ValueError("user_path is required when source='user'")
        inspection = inspect_h5ad(user_path, dataset_id="user_input")
        if inspection.errors:
            raise ValueError("; ".join(inspection.errors))
        adata = read_h5ad(user_path)
        if not adata.obs_names.is_unique:
            adata.obs_names_make_unique()
        if not adata.var_names.is_unique:
            adata.var_names_make_unique()
        detect_and_assign_spatial_coordinates(adata)
        return adata
    raise ValueError(f"unsupported dataset source: {source}")


def user_dataset_manifest(path: str | Path) -> dict[str, object]:
    source = Path(path).expanduser().resolve()
    return {
        "dataset_id": source.stem,
        "source": "user input",
        "path": str(source),
        "sha256": sha256_file(source),
        "license": "user-provided; not assumed by BioAgent-ST",
    }
