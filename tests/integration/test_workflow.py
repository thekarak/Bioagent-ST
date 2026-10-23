from bioagent_st.analysis.clustering import ClusteringParams
from bioagent_st.analysis.qc import QCParams
from bioagent_st.fixtures import create_spatial_fixture
from bioagent_st.tools.workflow import run_qc_clustering


def test_workflow_writes_artifacts_and_provenance(tmp_path) -> None:
    result = run_qc_clustering(
        create_spatial_fixture(),
        tmp_path,
        qc_params=QCParams(min_genes=1, max_mito_pct=100),
        clustering_params=ClusteringParams(n_top_genes=30, n_pcs=10, n_neighbors=10),
    )

    assert result.status == "ok"
    assert len(result.artifact_ids) == 2
    assert (tmp_path / "qc.h5ad").exists()
    assert (tmp_path / "clustered.h5ad").exists()
    assert (tmp_path / "ledger.db").exists()
