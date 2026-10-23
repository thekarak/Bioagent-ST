from dataclasses import dataclass
from pathlib import Path

import anndata as ad
import pandas as pd
from anndata import read_h5ad

from bioagent_st.analysis.clustering import ClusteringParams
from bioagent_st.analysis.markers import MarkerParams
from bioagent_st.analysis.qc import QCParams
from bioagent_st.analysis.spatial import SpatialParams
from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.schemas.evidence import CheckResult, EvidenceRecord
from bioagent_st.schemas.plans import AnalysisPlan
from bioagent_st.tools.workflow import run_markers, run_qc_clustering, run_spatial_statistics
from bioagent_st.utils.hashing import anndata_content_hash
from bioagent_st.verification.checks import (
    cluster_min_size_check,
    marker_circularity_check,
    marker_effect_size_check,
    marker_fdr_check,
    marker_group_size_check,
    qc_pass_check,
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


def _claim_evidence(
    experiment_id: str,
    clustered: ad.AnnData,
    marker_path: Path,
    provenance_ids: list[str],
) -> list[EvidenceRecord]:
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
    evidence = [cluster_evidence]
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
    try:
        for step in plan.steps:
            if step.tool_name == "qc_clustering":
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
            if result.status != "ok":
                raise ExecutionError(result.error or f"tool failed: {step.tool_name}")
            artifact_ids.extend(result.artifact_ids)
            step_artifact_ids[step.step_id] = result.artifact_ids
        evidence = _claim_evidence(
            experiment_id,
            current,
            output / "markers.csv",
            artifact_ids,
        )
        for record in evidence:
            evidence_store.insert(record)
        return ExecutionResult(plan, artifact_ids, evidence, current, step_artifact_ids)
    finally:
        evidence_store.close()
        provenance_store.close()
