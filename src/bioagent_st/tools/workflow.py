from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import anndata as ad

from bioagent_st.analysis.clustering import ClusteringParams, cluster_expression
from bioagent_st.analysis.markers import MarkerParams, find_markers
from bioagent_st.analysis.qc import QCParams, run_qc
from bioagent_st.analysis.spatial import SpatialParams, spatial_statistics
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.schemas.provenance import ProvenanceRecord
from bioagent_st.schemas.tools import ToolResult
from bioagent_st.utils.hashing import anndata_content_hash, sha256_file
from bioagent_st.utils.ids import new_id
from bioagent_st.utils.versions import library_versions


def _write_provenance(
    store: ProvenanceStore,
    output_path: Path,
    artifact_type: str,
    dataset_hash: str,
    tool_name: str,
    parameters: dict[str, Any],
    seed: int,
    upstream_artifact_ids: list[str],
) -> str:
    artifact_id = new_id(artifact_type)
    record = ProvenanceRecord(
        artifact_id=artifact_id,
        artifact_type=artifact_type,
        dataset_hash=dataset_hash,
        code_commit="uncommitted",
        tool_name=tool_name,
        tool_version="0.1.0",
        library_versions=library_versions(),
        parameters=parameters,
        random_seed=seed,
        upstream_artifact_ids=upstream_artifact_ids,
        output_uri=str(output_path),
        output_hash=sha256_file(output_path),
        created_at=datetime.now(UTC),
    )
    store.insert(record)
    return artifact_id


def run_qc_clustering(
    adata: ad.AnnData,
    output_dir: str | Path,
    dataset_hash: str | None = None,
    qc_params: QCParams | None = None,
    clustering_params: ClusteringParams | None = None,
    store: ProvenanceStore | None = None,
) -> ToolResult:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    qc_params = qc_params or QCParams()
    clustering_params = clustering_params or ClusteringParams(
        n_top_genes=min(2000, adata.n_vars),
        n_pcs=min(30, adata.n_obs - 1, adata.n_vars - 1),
    )
    source_hash = dataset_hash or anndata_content_hash(adata)
    owns_store = store is None
    store = store or ProvenanceStore(output / "ledger.db")
    try:
        qc_result = run_qc(adata, qc_params)
        qc_path = output / "qc.h5ad"
        qc_result.write_h5ad(qc_path, compression="gzip")
        qc_artifact_id = _write_provenance(
            store,
            qc_path,
            "qc_result",
            source_hash,
            "run_qc",
            qc_params.model_dump(),
            clustering_params.seed,
            [],
        )
        clustered = cluster_expression(qc_result, clustering_params)
        cluster_path = output / "clustered.h5ad"
        clustered.write_h5ad(cluster_path, compression="gzip")
        cluster_artifact_id = _write_provenance(
            store,
            cluster_path,
            "clustering_result",
            source_hash,
            "run_clustering",
            clustering_params.model_dump(),
            clustering_params.seed,
            [qc_artifact_id],
        )
        return ToolResult(
            status="ok",
            artifact_ids=[qc_artifact_id, cluster_artifact_id],
            metrics={
                "n_obs": int(clustered.n_obs),
                "n_vars": int(clustered.n_vars),
                "n_clusters": int(clustered.obs["leiden"].nunique()),
            },
            checks=[],
        )
    except Exception as error:
        return ToolResult(status="error", artifact_ids=[], metrics={}, error=str(error))
    finally:
        if owns_store:
            store.close()


def run_markers(
    adata: ad.AnnData,
    output_dir: str | Path,
    params: MarkerParams | None = None,
    store: ProvenanceStore | None = None,
) -> ToolResult:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    params = params or MarkerParams()
    owns_store = store is None
    store = store or ProvenanceStore(output / "ledger.db")
    try:
        markers = find_markers(adata, params)
        path = output / "markers.csv"
        markers.to_csv(path, index=False)
        artifact_id = _write_provenance(
            store,
            path,
            "marker_table",
            anndata_content_hash(adata),
            "find_markers",
            params.model_dump(),
            0,
            [],
        )
        return ToolResult(
            status="ok",
            artifact_ids=[artifact_id],
            metrics={"marker_rows": len(markers), "n_groups": markers["group"].nunique()},
        )
    except Exception as error:
        return ToolResult(status="error", artifact_ids=[], metrics={}, error=str(error))
    finally:
        if owns_store:
            store.close()


def run_spatial_statistics(
    adata: ad.AnnData,
    output_dir: str | Path,
    params: SpatialParams | None = None,
    store: ProvenanceStore | None = None,
) -> ToolResult:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    params = params or SpatialParams()
    owns_store = store is None
    store = store or ProvenanceStore(output / "ledger.db")
    try:
        result, report = spatial_statistics(adata, params)
        path = output / "spatial_statistics.h5ad"
        result.write_h5ad(path, compression="gzip")
        artifact_id = _write_provenance(
            store,
            path,
            "spatial_statistics",
            anndata_content_hash(adata),
            "run_spatial_statistics",
            params.model_dump(),
            params.seed,
            [],
        )
        return ToolResult(
            status="ok",
            artifact_ids=[artifact_id],
            metrics={
                "mean_degree": report.mean_degree,
                "isolated_nodes": report.isolated_nodes,
                "n_nodes": report.n_nodes,
            },
        )
    except Exception as error:
        return ToolResult(status="error", artifact_ids=[], metrics={}, error=str(error))
    finally:
        if owns_store:
            store.close()
