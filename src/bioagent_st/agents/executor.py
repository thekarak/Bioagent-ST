from dataclasses import dataclass
from pathlib import Path

import anndata as ad
import pandas as pd
from anndata import read_h5ad

from bioagent_st.analysis.clustering import ClusteringParams
from bioagent_st.analysis.expression import GeneExpressionParams
from bioagent_st.analysis.markers import MarkerParams
from bioagent_st.analysis.qc import QCParams
from bioagent_st.analysis.spatial import SpatialParams, build_spatial_graph
from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.schemas.evidence import CheckResult, EvidenceRecord
from bioagent_st.schemas.plans import AnalysisPlan
from bioagent_st.tools.workflow import (
    run_gene_expression,
    run_markers,
    run_qc_clustering,
    run_quality_assessment,
    run_spatial_clustering,
    run_spatial_statistics,
)
from bioagent_st.utils.hashing import anndata_content_hash
from bioagent_st.verification.checks import (
    cluster_min_size_check,
    expression_sparsity_check,
    marker_circularity_check,
    marker_effect_size_check,
    marker_fdr_check,
    marker_group_size_check,
    moran_fdr_check,
    null_present_check,
    qc_pass_check,
    spatial_graph_check,
)
from bioagent_st.verification.rules import evidence_from_checks


class ExecutionError(RuntimeError):
    pass


@dataclass(frozen=True)
class ExecutionResult:
    plan: AnalysisPlan
    artifact_ids: list[str]
    evidence: list[EvidenceRecord]
    clustered_adata: ad.AnnData
    step_artifact_ids: dict[str, list[str]]
    warnings: list[str]
    needs_review: bool


def _claim_evidence(
    experiment_id: str,
    clustered: ad.AnnData,
    marker_path: Path,
    provenance_ids: list[str],
) -> list[EvidenceRecord]:
    evidence: list[EvidenceRecord] = []
    if "leiden" not in clustered.obs:
        return evidence
    cluster_checks: list[CheckResult] = [
        qc_pass_check(clustered),
        cluster_min_size_check(
            [int(value) for value in clustered.obs["leiden"].value_counts().tolist()], 10.0
        ),
    ]
    cluster_evidence = evidence_from_checks(
        experiment_id=experiment_id,
        claim_id="clm_cluster_reproducible",
        claim="The workflow produced clustering output; stability across seeds was not evaluated.",
        claim_type="cluster_reproducible",
        checks=cluster_checks,
        supporting_artifacts=provenance_ids,
        provenance_ids=provenance_ids,
        limitations=["Cluster stability across seeds and resolutions was not evaluated."],
    )
    evidence.append(cluster_evidence)
    if marker_path.exists():
        markers = pd.read_csv(marker_path)
        if not markers.empty:
            top = markers.iloc[0]
            group = str(top["group"])
            group_size = int((clustered.obs["leiden"].astype(str) == group).sum())
            marker_checks = [
                marker_effect_size_check(float(top["scores"]), 0.2),
                marker_fdr_check(float(top["pvals_adj"]), 0.05),
                marker_group_size_check(float(group_size), 10.0),
                marker_circularity_check(),
            ]
            marker_evidence = evidence_from_checks(
                experiment_id=experiment_id,
                claim_id="clm_marker_specific",
                claim=f"Gene {top['gene']} is a descriptive top marker for group {group}.",
                claim_type="marker_specific",
                checks=marker_checks,
                supporting_artifacts=provenance_ids,
                provenance_ids=provenance_ids,
                limitations=[
                    "Markers and clusters derive from the same expression matrix.",
                    "Consistency across neighboring resolutions was not evaluated.",
                ],
            )
            evidence.append(marker_evidence)
    return evidence


def _gene_expression_evidence(
    experiment_id: str,
    adata: ad.AnnData,
    output: Path,
    provenance_ids: list[str],
) -> list[EvidenceRecord]:
    summary_path = output / "expression_summary.csv"
    autocorr_path = output / "spatial_autocorr.csv"
    if not summary_path.exists() or not autocorr_path.exists() or "spatial" not in adata.obsm:
        return []
    summary = pd.read_csv(summary_path)
    autocorr = pd.read_csv(autocorr_path)
    if summary.empty or autocorr.empty:
        return []
    autocorr = autocorr.set_index("gene")
    _, graph_report = build_spatial_graph(adata, SpatialParams(n_neighs=6))
    isolated_fraction = graph_report.isolated_nodes / max(graph_report.n_nodes, 1)
    graph_check = spatial_graph_check(
        graph_report.mean_degree,
        isolated_fraction,
        min_mean_degree=1.0,
        max_isolated_fraction=0.5,
    )
    evidence: list[EvidenceRecord] = []
    for _, row in summary.iterrows():
        if str(row["match"]) != "exact" or not isinstance(row["resolved"], str):
            continue
        gene = str(row["resolved"])
        if gene not in autocorr.index:
            continue
        stats = autocorr.loc[gene]
        fdr_column = next(
            (name for name in ("pval_sim_fdr_bh", "pval_norm_fdr_bh", "FDR") if name in stats),
            None,
        )
        sim_column = "pval_sim" if "pval_sim" in stats else "pval_norm"
        p_value = float(stats[sim_column]) if sim_column in stats else float("nan")
        fdr = float(stats[fdr_column]) if fdr_column else p_value
        zero_fraction = float(row["zero_fraction"])
        checks = [
            graph_check,
            moran_fdr_check(fdr, 0.05),
            expression_sparsity_check(zero_fraction, 0.9),
            null_present_check(bool(pd.notna(p_value))),
        ]
        evidence.append(
            evidence_from_checks(
                experiment_id=experiment_id,
                claim_id=f"clm_spatial_pattern_{gene}",
                claim=(
                    f"Gene {gene} shows spatial autocorrelation "
                    f"(Moran's I={float(stats['I']):.3f}, FDR={fdr:.3g})."
                ),
                claim_type="spatial_pattern_gene",
                checks=checks,
                supporting_artifacts=provenance_ids,
                provenance_ids=provenance_ids,
                limitations=[
                    "Spatial autocorrelation is descriptive and does not establish "
                    "biological function.",
                    "The permutation null is conditional on the fitted spatial graph.",
                ],
            )
        )
    return evidence


def execute_plan(
    plan: AnalysisPlan,
    adata: ad.AnnData,
    output_dir: str | Path,
    experiment_id: str,
    dataset_hash: str | None = None,
) -> ExecutionResult:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    provenance_store = ProvenanceStore(output / "ledger.db")
    evidence_store = EvidenceStore(output / "ledger.db")
    current = adata
    artifact_ids: list[str] = []
    step_artifact_ids: dict[str, list[str]] = {}
    warnings: list[str] = []
    needs_review = False
    try:
        for step in plan.steps:
            if step.tool_name == "quality_assessment":
                result = run_quality_assessment(
                    current,
                    output,
                    QCParams.model_validate(step.parameters),
                    dataset_hash=dataset_hash or anndata_content_hash(current),
                    store=provenance_store,
                )
                if result.status != "error":
                    current = read_h5ad(output / "qc.h5ad")
            elif step.tool_name == "spatial_clustering":
                qc_parameters = (
                    QCParams.model_validate(step.parameters["qc"])
                    if "qc" in step.parameters
                    else None
                )
                clustering_parameters = (
                    ClusteringParams.model_validate(step.parameters["clustering"])
                    if "clustering" in step.parameters
                    else None
                )
                result = run_spatial_clustering(
                    current,
                    output,
                    dataset_hash=dataset_hash or anndata_content_hash(current),
                    qc_params=qc_parameters,
                    clustering_params=clustering_parameters,
                    store=provenance_store,
                )
                if result.status != "error":
                    current = read_h5ad(output / "clustered.h5ad")
            elif step.tool_name == "gene_expression":
                result = run_gene_expression(
                    current,
                    output,
                    GeneExpressionParams.model_validate(step.parameters),
                    store=provenance_store,
                )
            elif step.tool_name == "qc_clustering":
                qc_parameters = (
                    QCParams.model_validate(step.parameters["qc"])
                    if "qc" in step.parameters
                    else None
                )
                clustering_parameters = (
                    ClusteringParams.model_validate(step.parameters["clustering"])
                    if "clustering" in step.parameters
                    else None
                )
                result = run_qc_clustering(
                    current,
                    output,
                    dataset_hash=dataset_hash or anndata_content_hash(current),
                    qc_params=qc_parameters,
                    clustering_params=clustering_parameters,
                    store=provenance_store,
                )
                current = read_h5ad(output / "clustered.h5ad")
            elif step.tool_name == "markers":
                result = run_markers(
                    current,
                    output,
                    MarkerParams.model_validate(step.parameters) if step.parameters else None,
                    store=provenance_store,
                )
            elif step.tool_name == "spatial_statistics":
                result = run_spatial_statistics(
                    current,
                    output,
                    SpatialParams.model_validate(step.parameters) if step.parameters else None,
                    store=provenance_store,
                )
            else:
                raise ExecutionError(f"unregistered tool: {step.tool_name}")
            if result.status == "error":
                raise ExecutionError(result.error or f"tool failed: {step.tool_name}")
            if result.status == "partial":
                needs_review = True
            warnings.extend(result.warnings)
            artifact_ids.extend(result.artifact_ids)
            step_artifact_ids[step.step_id] = result.artifact_ids
        evidence = _claim_evidence(
            experiment_id,
            current,
            output / "markers.csv",
            artifact_ids,
        )
        evidence.extend(_gene_expression_evidence(experiment_id, current, output, artifact_ids))
        for record in evidence:
            evidence_store.insert(record)
        return ExecutionResult(
            plan,
            artifact_ids,
            evidence,
            current,
            step_artifact_ids,
            warnings,
            needs_review,
        )
    finally:
        evidence_store.close()
        provenance_store.close()
