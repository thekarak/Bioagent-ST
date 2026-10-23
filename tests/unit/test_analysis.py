import numpy as np
import pytest

from bioagent_st.analysis.clustering import ClusteringParams, cluster_expression
from bioagent_st.analysis.markers import MarkerParams, find_markers
from bioagent_st.analysis.qc import QCParams, run_qc
from bioagent_st.fixtures import create_spatial_fixture


def test_qc_rejects_invalid_params() -> None:
    with pytest.raises(ValueError):
        QCParams(min_genes=-1)
    with pytest.raises(ValueError):
        QCParams(max_mito_pct=101)


def test_qc_does_not_mutate_input() -> None:
    adata = create_spatial_fixture()
    before = adata.shape

    result = run_qc(adata, QCParams(min_genes=1, max_mito_pct=100))

    assert adata.shape == before
    assert result.n_obs > 0
    assert "n_genes_by_counts" in result.obs.columns
    assert "pct_counts_mito" in result.obs.columns


def test_clustering_is_deterministic_and_adds_expected_keys() -> None:
    adata = run_qc(create_spatial_fixture(), QCParams(min_genes=1, max_mito_pct=100))
    params = ClusteringParams(n_top_genes=30, n_pcs=10, n_neighbors=10, resolution=0.5)

    first = cluster_expression(adata, params)
    second = cluster_expression(adata.copy(), params)

    assert "leiden" in first.obs
    assert "X_pca" in first.obsm
    assert "X_umap" in first.obsm
    np.testing.assert_array_equal(first.obs["leiden"].to_numpy(), second.obs["leiden"].to_numpy())


def test_markers_include_group_fdr_and_effect_size() -> None:
    adata = cluster_expression(
        run_qc(create_spatial_fixture(), QCParams(min_genes=1, max_mito_pct=100)),
        ClusteringParams(n_top_genes=30, n_pcs=10, n_neighbors=10, resolution=0.5),
    )
    result = find_markers(adata, MarkerParams(n_genes=5))

    assert {"group", "gene", "pvals_adj", "logfoldchanges", "scores"} <= set(result.columns)
    assert len(result) > 0
