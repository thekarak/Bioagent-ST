from bioagent_st.analysis.clustering import ClusteringParams
from bioagent_st.analysis.expression import GeneExpressionParams
from bioagent_st.analysis.qc import QCParams
from bioagent_st.fixtures import create_spatial_fixture
from bioagent_st.tools.workflow import (
    run_gene_expression,
    run_quality_assessment,
    run_spatial_clustering,
)


def test_quality_assessment_writes_contract_artifacts(tmp_path) -> None:
    result = run_quality_assessment(
        create_spatial_fixture(),
        tmp_path,
        QCParams(min_genes=200, min_counts=500),
    )

    assert result.status == "ok"
    assert (tmp_path / "qc.h5ad").exists()
    assert (tmp_path / "qc_table.csv").exists()
    assert (tmp_path / "schema_report.json").exists()
    assert (tmp_path / "manifest.json").exists()


def test_spatial_clustering_writes_contract_artifacts(tmp_path) -> None:
    result = run_spatial_clustering(
        create_spatial_fixture(),
        tmp_path,
        qc_params=QCParams(min_genes=1, min_counts=0, max_mito_pct=100),
        clustering_params=ClusteringParams(
            n_top_genes=30, n_pcs=10, n_neighbors=10, resolution=0.5
        ),
    )

    assert result.status == "ok"
    assert (tmp_path / "clustered.h5ad").exists()
    assert (tmp_path / "cluster_table.csv").exists()
    assert (tmp_path / "umap_coords.csv").exists()
    assert (tmp_path / "spatial_clusters.png").exists()
    assert (tmp_path / "manifest.json").exists()
    assert result.metrics["n_clusters"] >= 1


def test_gene_expression_reports_unresolved_genes_without_substitution(tmp_path) -> None:
    result = run_gene_expression(
        create_spatial_fixture(),
        tmp_path,
        GeneExpressionParams(genes=["GENE_0000", "NOT_A_GENE"], layer="X"),
    )

    assert result.status == "partial"
    assert len(result.warnings) == 1
    assert "NOT_A_GENE" in result.warnings[0]
    assert (tmp_path / "gene_match_report.csv").exists()
    assert (tmp_path / "expression_summary.csv").exists()
    assert (tmp_path / "expression_values.csv").exists()
    assert (tmp_path / "spatial_autocorr.csv").exists()
