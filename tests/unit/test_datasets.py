"""Unit tests for dataset inspection, loading, and spatial coordinate auto-detection."""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from anndata import AnnData
from scipy import sparse

from bioagent_st.datasets import (
    COMMON_SPATIAL_OBS_PAIRS,
    detect_and_assign_spatial_coordinates,
    inspect_h5ad,
    load_dataset,
)
from bioagent_st.fixtures import create_spatial_fixture


def test_inspect_h5ad_valid_dataset(tmp_path: Path) -> None:
    adata = create_spatial_fixture(seed=42)
    path = tmp_path / "valid.h5ad"
    adata.write_h5ad(path)

    inspection = inspect_h5ad(path, dataset_id="test_valid")
    assert inspection.errors == []
    assert inspection.n_obs == 300
    assert inspection.n_vars == 500
    assert inspection.finite_spatial_coordinates is True
    assert not any("obsm['spatial'] missing" in w for w in inspection.warnings)


def test_inspect_h5ad_missing_spatial_demoted_to_warning(tmp_path: Path) -> None:
    adata = create_spatial_fixture(seed=1)
    del adata.obsm["spatial"]
    path = tmp_path / "no_spatial.h5ad"
    adata.write_h5ad(path)

    inspection = inspect_h5ad(path)
    assert not any("required" in err for err in inspection.errors)
    assert inspection.errors == []
    assert any(
        "obsm['spatial'] missing; required for spatial clustering and spatial autocorrelation" in w
        for w in inspection.warnings
    )
    assert inspection.finite_spatial_coordinates is False

    # Should still load cleanly for quality assessment without spatial coordinates
    loaded = load_dataset("user", path)
    assert loaded.shape == (300, 500)
    assert "spatial" not in loaded.obsm


@pytest.mark.parametrize("col1,col2", COMMON_SPATIAL_OBS_PAIRS)
def test_detect_and_assign_spatial_coordinates_from_obs(
    tmp_path: Path, col1: str, col2: str
) -> None:
    n_obs = 20
    n_vars = 10
    rng = np.random.default_rng(42)
    counts = rng.poisson(3.0, (n_obs, n_vars)).astype(np.float32)

    obs_df = pd.DataFrame(
        {
            col1: np.linspace(0.0, 100.0, n_obs),
            col2: np.linspace(200.0, 300.0, n_obs),
        },
        index=[f"spot_{i}" for i in range(n_obs)],
    )
    var_df = pd.DataFrame(index=[f"GENE_{j}" for j in range(n_vars)])

    adata = AnnData(
        X=sparse.csr_matrix(counts),
        obs=obs_df,
        var=var_df,
    )
    assert "spatial" not in adata.obsm

    # Direct function test
    detected = detect_and_assign_spatial_coordinates(adata)
    assert detected is True
    assert "spatial" in adata.obsm
    assert adata.obsm["spatial"].shape == (n_obs, 2)
    np.testing.assert_allclose(adata.obsm["spatial"][:, 0], obs_df[col1].to_numpy())
    np.testing.assert_allclose(adata.obsm["spatial"][:, 1], obs_df[col2].to_numpy())

    # Ingest and inspect test from file
    del adata.obsm["spatial"]
    file_path = tmp_path / f"test_coords_{col1}_{col2}.h5ad"
    adata.write_h5ad(file_path)

    inspection = inspect_h5ad(file_path)
    assert inspection.errors == []
    assert inspection.finite_spatial_coordinates is True
    assert not any("obsm['spatial'] missing" in w for w in inspection.warnings)

    # Load dataset should also assemble spatial coordinates
    loaded = load_dataset("user", file_path)
    assert "spatial" in loaded.obsm
    assert loaded.obsm["spatial"].shape == (n_obs, 2)


def test_inspect_h5ad_nonfinite_coordinates_flagged(tmp_path: Path) -> None:
    adata = create_spatial_fixture(seed=10)
    coords = adata.obsm["spatial"].astype(float)
    coords[0, 0] = np.nan
    adata.obsm["spatial"] = coords
    path = tmp_path / "nan_spatial.h5ad"
    adata.write_h5ad(path)

    inspection = inspect_h5ad(path)
    assert any("finite numeric" in err for err in inspection.errors)


def test_inspect_h5ad_duplicate_var_names_flagged(tmp_path: Path) -> None:
    adata = create_spatial_fixture(seed=11)
    adata.var_names = ["DUPLICATE_GENE"] * adata.n_vars
    path = tmp_path / "dup_genes.h5ad"
    adata.write_h5ad(path)

    inspection = inspect_h5ad(path)
    assert inspection.errors == []
    assert any(
        "gene names not unique; will be deduplicated on load" in w for w in inspection.warnings
    )

    loaded = load_dataset("user", path)
    assert loaded.var_names.is_unique


def test_inspect_h5ad_duplicate_obs_names_flagged(tmp_path: Path) -> None:
    adata = create_spatial_fixture(seed=12)
    adata.obs_names = ["DUPLICATE_SPOT"] * adata.n_obs
    path = tmp_path / "dup_spots.h5ad"
    adata.write_h5ad(path)

    inspection = inspect_h5ad(path)
    assert inspection.errors == []
    assert any(
        "observation names not unique; will be deduplicated on load" in w
        for w in inspection.warnings
    )

    loaded = load_dataset("user", path)
    assert loaded.obs_names.is_unique
