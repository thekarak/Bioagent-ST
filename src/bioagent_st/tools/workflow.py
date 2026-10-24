import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import anndata as ad
import pandas as pd
from anndata import read_h5ad

from bioagent_st.analysis.clustering import ClusteringParams, cluster_expression
from bioagent_st.analysis.expression import (
    GeneExpressionParams,
    match_report,
    summarize_expression,
    summary_table,
    values_table,
)
from bioagent_st.analysis.markers import MarkerParams, find_markers
from bioagent_st.analysis.qc import QCParams, assess_quality, counts_like, run_qc
from bioagent_st.analysis.spatial import (
    SpatialParams,
    autocorrelation_table,
    spatial_statistics,
)
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.schemas.evidence import CheckResult
from bioagent_st.schemas.provenance import ProvenanceRecord
from bioagent_st.schemas.registry import REGISTRY
from bioagent_st.schemas.tools import ToolResult
from bioagent_st.utils.hashing import anndata_content_hash, sha256_file
from bioagent_st.utils.ids import new_id
from bioagent_st.utils.versions import git_commit, library_versions
from bioagent_st.verification.checks import (
    counts_available_check,
    duplicate_id_check,
    min_observation_check,
    no_nans_check,
    qc_pass_check,
    spatial_coordinate_check,
)


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
        code_commit=git_commit(),
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


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def _layer_names(adata: ad.AnnData) -> list[str]:
    return ["X", *sorted(str(name) for name in adata.layers)]


def run_quality_assessment(
    adata: ad.AnnData,
    output_dir: str | Path,
    params: QCParams | None = None,
    dataset_hash: str | None = None,
    store: ProvenanceStore | None = None,
) -> ToolResult:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    qc_params = params or QCParams()
    source_hash = dataset_hash or anndata_content_hash(adata)
    owns_store = store is None
    store = store or ProvenanceStore(output / "ledger.db")
    # 1. Run intrinsic contract & data validation checks
    checks: list[CheckResult] = [
        min_observation_check(adata, minimum=max(qc_params.min_cells, 1)),
        duplicate_id_check(adata),
        no_nans_check(adata),
        counts_available_check(adata),
        spatial_coordinate_check(adata, required=False),
    ]
    failing_hard = [c for c in checks if c.severity == "hard" and c.status == "fail"]
    if failing_hard:
        reasons = [c.detail or c.check_id for c in failing_hard]
        if owns_store:
            store.close()
        return ToolResult(
            status="error",
            artifact_ids=[],
            metrics={"n_obs": int(adata.n_obs), "n_vars": int(adata.n_vars)},
            checks=checks,
            warnings=reasons,
            error=f"Quality assessment rejected schema: {'; '.join(reasons)}",
        )

    try:
        assessed = assess_quality(adata, qc_params)
        checks.append(qc_pass_check(assessed))
        qc_path = output / "qc.h5ad"
        assessed.write_h5ad(qc_path, compression="gzip")
        qc_artifact_id = _write_provenance(
            store,
            qc_path,
            "qc_result",
            source_hash,
            "assess_quality",
            qc_params.model_dump(),
            0,
            [],
        )

        table_path = output / "qc_table.csv"
        assessed.obs.reset_index().to_csv(table_path, index=False)
        table_artifact_id = _write_provenance(
            store,
            table_path,
            "qc_table",
            source_hash,
            "assess_quality",
            qc_params.model_dump(),
            0,
            [qc_artifact_id],
        )

        missing_fields = []
        if "spatial" not in assessed.obsm:
            missing_fields.append("obsm['spatial'] - missing (spatial workflows unavailable)")
        if not any(str(name).startswith(qc_params.mito_prefix) for name in assessed.var_names):
            missing_fields.append(
                f"mitochondrial genes with prefix {qc_params.mito_prefix!r} - not found; "
                "mitochondrial fraction is not assessed"
            )
        schema = {
            "n_obs": int(assessed.n_obs),
            "n_vars": int(assessed.n_vars),
            "obs_names_unique": bool(assessed.obs_names.is_unique),
            "var_names_unique": bool(assessed.var_names.is_unique),
            "counts_like": counts_like(assessed),
            "layers": _layer_names(assessed),
            "spatial_present": "spatial" in assessed.obsm,
            "spatial_shape": (
                list(assessed.obsm["spatial"].shape) if "spatial" in assessed.obsm else None
            ),
            "missing_fields": missing_fields,
            "thresholds": qc_params.model_dump(),
            "observations_below_thresholds": int((~assessed.obs["passes_qc"]).sum()),
        }
        schema_path = output / "schema_report.json"
        _write_json(schema_path, schema)
        schema_artifact_id = _write_provenance(
            store,
            schema_path,
            "schema_report",
            source_hash,
            "assess_quality",
            qc_params.model_dump(),
            0,
            [qc_artifact_id],
        )

        manifest_path = output / "manifest.json"
        _write_json(
            manifest_path,
            {
                "tool_name": "quality_assessment",
                "tool_version": "0.1.0",
                "dataset_hash": source_hash,
                "parameters": qc_params.model_dump(),
                "artifact_ids": [
                    qc_artifact_id,
                    table_artifact_id,
                    schema_artifact_id,
                ],
            },
        )
        manifest_artifact_id = _write_provenance(
            store,
            manifest_path,
            "run_manifest",
            source_hash,
            "quality_assessment",
            qc_params.model_dump(),
            0,
            [qc_artifact_id, table_artifact_id, schema_artifact_id],
        )
        return ToolResult(
            status="ok",
            artifact_ids=[
                qc_artifact_id,
                table_artifact_id,
                schema_artifact_id,
                manifest_artifact_id,
            ],
            metrics={
                "n_obs": int(assessed.n_obs),
                "n_vars": int(assessed.n_vars),
                "observations_below_thresholds": int((~assessed.obs["passes_qc"]).sum()),
                "spatial_present": str("spatial" in assessed.obsm),
            },
            warnings=missing_fields,
            checks=checks,
        )
    except Exception as error:
        return ToolResult(status="error", artifact_ids=[], metrics={}, error=str(error))
    finally:
        if owns_store:
            store.close()


def _write_spatial_cluster_plot(adata: ad.AnnData, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    coordinates = adata.obsm["spatial"]
    labels = adata.obs["leiden"].astype(str).to_numpy()
    figure, axis = plt.subplots(figsize=(6, 5))
    for label in sorted(set(labels)):
        mask = labels == label
        axis.scatter(
            coordinates[mask, 0],
            coordinates[mask, 1],
            s=9,
            label=f"Cluster {label}",
            linewidths=0,
        )
    axis.set_xlabel("spatial x")
    axis.set_ylabel("spatial y")
    axis.set_title("Expression clusters (neutral numeric labels)")
    axis.legend(markerscale=2, fontsize=7, frameon=False)
    figure.tight_layout()
    figure.savefig(path, dpi=150)
    plt.close(figure)


def _effective_clustering_params(
    adata: ad.AnnData, params: ClusteringParams | None
) -> ClusteringParams:
    effective = params or ClusteringParams()
    if "n_top_genes" not in effective.model_fields_set:
        effective = effective.model_copy(
            update={"n_top_genes": min(effective.n_top_genes, adata.n_vars)}
        )
    return effective


def run_spatial_clustering(
    adata: ad.AnnData,
    output_dir: str | Path,
    *,
    qc_params: QCParams | None = None,
    clustering_params: ClusteringParams | None = None,
    dataset_hash: str | None = None,
    store: ProvenanceStore | None = None,
) -> ToolResult:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    source_hash = dataset_hash or anndata_content_hash(adata)
    owns_store = store is None
    store = store or ProvenanceStore(output / "ledger.db")
    effective_clustering = _effective_clustering_params(adata, clustering_params)

    # 1. Run intrinsic spatial & data validation checks before allocating outputs
    spatial_check = spatial_coordinate_check(adata, required=True)
    dup_check = duplicate_id_check(adata)
    nan_check = no_nans_check(adata)
    counts_check = counts_available_check(adata)
    min_obs_check = min_observation_check(adata, minimum=3)
    checks: list[CheckResult] = [spatial_check, dup_check, nan_check, counts_check, min_obs_check]
    failing_hard = [c for c in checks if c.severity == "hard" and c.status == "fail"]
    if failing_hard:
        reasons = [c.detail or c.check_id for c in failing_hard]
        if owns_store:
            store.close()
        return ToolResult(
            status="error",
            artifact_ids=[],
            metrics={},
            checks=checks,
            warnings=reasons,
            error=f"Spatial clustering blocked: {'; '.join(reasons)}",
        )

    try:
        base = run_qc_clustering(
            adata,
            output,
            dataset_hash=source_hash,
            qc_params=qc_params,
            clustering_params=effective_clustering,
            store=store,
        )
        if base.status == "error":
            return base
        clustered = read_h5ad(output / "clustered.h5ad")
        labels = clustered.obs["leiden"].astype(str)
        cluster_table = (
            labels.value_counts()
            .rename_axis("cluster")
            .reset_index(name="count")
            .sort_values("cluster", key=lambda values: values.astype(int))
        )
        cluster_table["fraction"] = cluster_table["count"] / clustered.n_obs
        table_path = output / "cluster_table.csv"
        cluster_table.to_csv(table_path, index=False)
        table_artifact_id = _write_provenance(
            store,
            table_path,
            "cluster_table",
            source_hash,
            "spatial_clustering",
            effective_clustering.model_dump(),
            effective_clustering.seed,
            base.artifact_ids,
        )

        umap_path = output / "umap_coords.csv"
        umap = pd.DataFrame(
            {
                "obs_id": [str(name) for name in clustered.obs_names],
                "umap_1": clustered.obsm["X_umap"][:, 0],
                "umap_2": clustered.obsm["X_umap"][:, 1],
                "cluster": labels.to_numpy(),
            }
        )
        umap.to_csv(umap_path, index=False)
        umap_artifact_id = _write_provenance(
            store,
            umap_path,
            "umap_coords",
            source_hash,
            "spatial_clustering",
            effective_clustering.model_dump(),
            effective_clustering.seed,
            base.artifact_ids,
        )

        plot_path = output / "spatial_clusters.png"
        _write_spatial_cluster_plot(clustered, plot_path)
        plot_artifact_id = _write_provenance(
            store,
            plot_path,
            "spatial_plot",
            source_hash,
            "spatial_clustering",
            effective_clustering.model_dump(),
            effective_clustering.seed,
            base.artifact_ids,
        )

        manifest_path = output / "manifest.json"
        _write_json(
            manifest_path,
            {
                "tool_name": "spatial_clustering",
                "tool_version": "0.1.0",
                "dataset_hash": source_hash,
                "qc_parameters": (qc_params or QCParams()).model_dump(),
                "clustering_parameters": effective_clustering.model_dump(),
                "artifact_ids": [
                    *base.artifact_ids,
                    table_artifact_id,
                    umap_artifact_id,
                    plot_artifact_id,
                ],
            },
        )
        manifest_artifact_id = _write_provenance(
            store,
            manifest_path,
            "run_manifest",
            source_hash,
            "spatial_clustering",
            effective_clustering.model_dump(),
            effective_clustering.seed,
            [*base.artifact_ids, table_artifact_id, umap_artifact_id, plot_artifact_id],
        )
        all_ids = [
            *base.artifact_ids,
            table_artifact_id,
            umap_artifact_id,
            plot_artifact_id,
            manifest_artifact_id,
        ]
        return ToolResult(
            status="ok",
            artifact_ids=all_ids,
            metrics={
                **base.metrics,
                "n_clusters": int(labels.nunique()),
                "largest_cluster": int(cluster_table["count"].max()),
            },
        )
    except Exception as error:
        return ToolResult(status="error", artifact_ids=[], metrics={}, error=str(error))
    finally:
        if owns_store:
            store.close()


def _write_expression_plot(
    adata: ad.AnnData,
    vectors: dict[str, Any],
    path: Path,
) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    coordinates = adata.obsm["spatial"]
    figure, axes = plt.subplots(1, len(vectors), figsize=(4.2 * len(vectors), 4), squeeze=False)
    for axis, (gene, values) in zip(axes[0], vectors.items(), strict=True):
        scatter = axis.scatter(
            coordinates[:, 0],
            coordinates[:, 1],
            c=values,
            s=10,
            cmap="viridis",
            linewidths=0,
        )
        axis.set_title(gene, fontsize=9)
        axis.set_xlabel("spatial x")
        axis.set_ylabel("spatial y")
        figure.colorbar(scatter, ax=axis, fraction=0.046, pad=0.04)
    figure.tight_layout()
    figure.savefig(path, dpi=150)
    plt.close(figure)


def run_gene_expression(
    adata: ad.AnnData,
    output_dir: str | Path,
    params: GeneExpressionParams | None = None,
    store: ProvenanceStore | None = None,
) -> ToolResult:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    source_hash = anndata_content_hash(adata)
    owns_store = store is None
    store = store or ProvenanceStore(output / "ledger.db")

    spatial_check = spatial_coordinate_check(adata, required=True)
    dup_check = duplicate_id_check(adata)
    nan_check = no_nans_check(adata)
    counts_check = counts_available_check(adata)
    checks: list[CheckResult] = [spatial_check, dup_check, nan_check, counts_check]
    failing_hard = [c for c in checks if c.severity == "hard" and c.status == "fail"]
    if failing_hard:
        reasons = [c.detail or c.check_id for c in failing_hard]
        if owns_store:
            store.close()
        return ToolResult(
            status="error",
            artifact_ids=[],
            metrics={},
            checks=checks,
            warnings=reasons,
            error=f"Gene expression blocked: {'; '.join(reasons)}",
        )

    if params is None:
        if owns_store:
            store.close()
        return ToolResult(
            status="error",
            artifact_ids=[],
            metrics={},
            checks=checks,
            error="gene expression parameters are required",
        )

    selected = params
    if selected.layer != "X" and selected.layer not in adata.layers:
        if owns_store:
            store.close()
        return ToolResult(
            status="error",
            artifact_ids=[],
            metrics={},
            checks=checks,
            error=(
                f"layer not found: {selected.layer}; available layers: "
                f"{', '.join(['X', *adata.layers.keys()])}"
            ),
        )

    try:
        summaries, vectors = summarize_expression(adata, selected)
        unresolved = [item for item in summaries if item.match != "exact"]

        match_path = output / "gene_match_report.csv"
        match_report(summaries, selected.layer).to_csv(match_path, index=False)
        match_artifact_id = _write_provenance(
            store,
            match_path,
            "gene_match_report",
            source_hash,
            "gene_expression",
            selected.model_dump(),
            0,
            [],
        )

        summary_path = output / "expression_summary.csv"
        summary_table(summaries).to_csv(summary_path, index=False)
        summary_artifact_id = _write_provenance(
            store,
            summary_path,
            "expression_summary",
            source_hash,
            "gene_expression",
            selected.model_dump(),
            0,
            [match_artifact_id],
        )

        values_path = output / "expression_values.csv"
        values_table(adata, vectors).to_csv(values_path, index=False)
        values_artifact_id = _write_provenance(
            store,
            values_path,
            "expression_values",
            source_hash,
            "gene_expression",
            selected.model_dump(),
            0,
            [match_artifact_id],
        )

        artifact_ids = [match_artifact_id, summary_artifact_id, values_artifact_id]
        warnings = [
            f"{item.requested}: {item.match}"
            + (f" (candidates: {', '.join(item.candidates)})" if item.candidates else "")
            for item in unresolved
        ]

        if vectors:
            plot_path = output / "spatial_expression.png"
            _write_expression_plot(adata, vectors, plot_path)
            plot_artifact_id = _write_provenance(
                store,
                plot_path,
                "spatial_plot",
                source_hash,
                "gene_expression",
                selected.model_dump(),
                0,
                [values_artifact_id],
            )
            artifact_ids.append(plot_artifact_id)

            autocorr = autocorrelation_table(
                adata,
                list(vectors),
                SpatialParams(n_perms=100, genes=list(vectors), seed=0, layer=selected.layer),
            )
            autocorr_path = output / "spatial_autocorr.csv"
            autocorr.to_csv(autocorr_path, index=False)
            autocorr_artifact_id = _write_provenance(
                store,
                autocorr_path,
                "spatial_autocorrelation",
                source_hash,
                "gene_expression",
                selected.model_dump(),
                0,
                [values_artifact_id],
            )
            artifact_ids.append(autocorr_artifact_id)

        manifest_path = output / "manifest.json"
        _write_json(
            manifest_path,
            {
                "tool_name": "gene_expression",
                "tool_version": "0.1.0",
                "dataset_hash": source_hash,
                "parameters": selected.model_dump(),
                "resolved_genes": list(vectors),
                "artifact_ids": artifact_ids,
            },
        )
        manifest_artifact_id = _write_provenance(
            store,
            manifest_path,
            "run_manifest",
            source_hash,
            "gene_expression",
            selected.model_dump(),
            0,
            artifact_ids,
        )
        artifact_ids.append(manifest_artifact_id)
        status = "ok" if not unresolved else "partial"
        return ToolResult(
            status=status,
            artifact_ids=artifact_ids,
            metrics={
                "requested_genes": len(summaries),
                "resolved_genes": len(vectors),
                "unresolved_genes": len(unresolved),
            },
            warnings=warnings,
            checks=[
                *checks,
                CheckResult(
                    check_id="gene.resolved",
                    status="pass" if not unresolved else "warn",
                    severity="soft",
                    detail=(
                        "All requested genes resolved exactly"
                        if not unresolved
                        else f"{len(unresolved)} genes unresolved"
                    ),
                ),
            ],
        )
    except Exception as error:
        return ToolResult(status="error", artifact_ids=[], metrics={}, error=str(error))
    finally:
        if owns_store:
            store.close()


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


REGISTRY.register_executor("quality_assessment", run_quality_assessment)
REGISTRY.register_executor("spatial_clustering", run_spatial_clustering)
REGISTRY.register_executor("gene_expression", run_gene_expression)
