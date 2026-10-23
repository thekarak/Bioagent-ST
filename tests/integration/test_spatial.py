import pytest

from bioagent_st.analysis.qc import QCParams, run_qc
from bioagent_st.fixtures import create_spatial_fixture


@pytest.fixture
def clustered_adata():
    from bioagent_st.analysis.clustering import ClusteringParams, cluster_expression

    qc = run_qc(create_spatial_fixture(), QCParams(min_genes=1, max_mito_pct=100))
    return cluster_expression(qc, ClusteringParams(n_top_genes=30, n_pcs=10, n_neighbors=10))


def test_spatial_graph_has_valid_coordinates(clustered_adata) -> None:
    from bioagent_st.analysis.spatial import SpatialParams, build_spatial_graph

    result, report = build_spatial_graph(clustered_adata, SpatialParams(n_neighs=6))

    assert "spatial_connectivities" in result.obsp
    assert report.mean_degree > 0
    assert report.isolated_nodes >= 0


def test_spatial_statistics_return_dataframe(clustered_adata) -> None:
    from bioagent_st.analysis.spatial import SpatialParams, spatial_statistics

    neighbors, _ = spatial_statistics(
        clustered_adata,
        SpatialParams(n_neighs=6, n_perms=10, genes=[clustered_adata.var_names[0]]),
    )

    assert "moranI" in neighbors.uns
    assert "leiden_nhood_enrichment" in neighbors.uns
