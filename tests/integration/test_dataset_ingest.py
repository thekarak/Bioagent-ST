import numpy as np
import pytest
from anndata import AnnData

from bioagent_st.datasets import REAL_DLPFC_PATH, inspect_h5ad, load_dataset
from bioagent_st.fixtures import create_spatial_fixture


def test_user_h5ad_passes_shared_validator(tmp_path) -> None:
    path = tmp_path / "user.h5ad"
    create_spatial_fixture(seed=3).write_h5ad(path)

    inspection = inspect_h5ad(path, dataset_id="user_input")

    assert inspection.errors == []
    assert inspection.n_obs == 300
    assert inspection.n_vars == 500
    assert inspection.counts_like
    assert inspection.finite_spatial_coordinates
    assert "domain_truth" in inspection.label_columns


def test_missing_spatial_coordinates_produces_warning(tmp_path) -> None:
    adata = create_spatial_fixture()
    del adata.obsm["spatial"]
    path = tmp_path / "no_spatial.h5ad"
    adata.write_h5ad(path)

    inspection = inspect_h5ad(path)

    assert (
        "obsm['spatial'] missing; required for spatial clustering and spatial autocorrelation"
        in inspection.warnings
    )
    assert inspection.errors == []
    loaded = load_dataset("user", path)
    assert isinstance(loaded, AnnData)


def test_duplicate_gene_names_are_rejected(tmp_path) -> None:
    adata = create_spatial_fixture()
    adata.var_names = ["duplicate"] * adata.n_vars
    path = tmp_path / "duplicates.h5ad"
    adata.write_h5ad(path)

    inspection = inspect_h5ad(path)

    assert "gene names are not unique" in inspection.errors


def test_nonfinite_coordinates_are_rejected(tmp_path) -> None:
    adata = create_spatial_fixture()
    adata.obsm["spatial"] = np.asarray(adata.obsm["spatial"], dtype=np.float64)
    adata.obsm["spatial"][0, 0] = np.nan
    path = tmp_path / "nan_coordinates.h5ad"
    adata.write_h5ad(path)

    inspection = inspect_h5ad(path)

    assert any("finite numeric" in error for error in inspection.errors)


def test_user_source_requires_path() -> None:
    with pytest.raises(ValueError, match="user_path"):
        load_dataset("user")


def test_real_source_is_available_from_project_layout() -> None:
    if not REAL_DLPFC_PATH.is_file():
        pytest.skip(f"real DLPFC data not present at {REAL_DLPFC_PATH}")

    adata = load_dataset("real_dlpfc")

    assert isinstance(adata, AnnData)
    assert adata.shape == (4226, 33538)
    assert "sce.layer_guess" in adata.obs
