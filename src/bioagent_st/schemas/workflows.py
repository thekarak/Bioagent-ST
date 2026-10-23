from typing import Literal

from pydantic import Field

from bioagent_st.schemas.base import FrozenRecord

WorkflowId = Literal[
    "quality_assessment",
    "spatial_clustering",
    "gene_expression",
    "unsupported_or_ambiguous",
]
SupportedWorkflowId = Literal[
    "quality_assessment",
    "spatial_clustering",
    "gene_expression",
]
SelectorKind = Literal["rules", "laya", "manual"]

SUPPORTED_WORKFLOWS: tuple[SupportedWorkflowId, ...] = (
    "quality_assessment",
    "spatial_clustering",
    "gene_expression",
)


class ContractInput(FrozenRecord):
    label: str
    requirement: str


class ContractParameter(FrozenRecord):
    label: str
    range: str


class EvidenceContract(FrozenRecord):
    workflow: SupportedWorkflowId
    version: str
    required_inputs: list[ContractInput]
    allowed_parameters: list[ContractParameter]
    expected_artifacts: list[str]
    validation_checks: list[str]
    failure_policy: str


WORKFLOW_CONTRACTS: dict[SupportedWorkflowId, EvidenceContract] = {
    "quality_assessment": EvidenceContract(
        workflow="quality_assessment",
        version="v1",
        required_inputs=[
            ContractInput(
                label="X (or named layer)", requirement="expression matrix with known semantics"
            ),
            ContractInput(
                label="obs / var IDs", requirement="unique identifiers (or documented resolution)"
            ),
            ContractInput(
                label="obsm['spatial']",
                requirement="not required; absence is reported, not assumed",
            ),
        ],
        allowed_parameters=[
            ContractParameter(label="min_counts", range="0 - 100,000"),
            ContractParameter(label="min_genes", range="0 - 5,000"),
        ],
        expected_artifacts=[
            "schema_report.json",
            "qc_table.csv",
            "qc.h5ad",
            "manifest.json",
        ],
        validation_checks=[
            "artifacts_present - expected outputs exist and are readable",
            "metrics_finite - one finite value per observation",
            "missing_fields_reported - unsupported metrics listed, never invented",
        ],
        failure_policy=(
            "Reject or clarify on invalid schema; record failed checks; never silently repair."
        ),
    ),
    "spatial_clustering": EvidenceContract(
        workflow="spatial_clustering",
        version="v1",
        required_inputs=[
            ContractInput(
                label="X (or named layer)", requirement="expression matrix with known semantics"
            ),
            ContractInput(
                label="obsm['spatial']",
                requirement="shape (n_obs, 2); required for spatial plots",
            ),
            ContractInput(label="obs / var IDs", requirement="unique identifiers"),
        ],
        allowed_parameters=[
            ContractParameter(label="n_pcs", range="5 - 100"),
            ContractParameter(label="n_neighbors", range="3 - 50"),
            ContractParameter(label="resolution", range="0.1 - 3.0"),
            ContractParameter(label="seed", range="0 - 2^31-1"),
        ],
        expected_artifacts=[
            "clustered.h5ad",
            "cluster_table.csv",
            "umap_coords.csv",
            "spatial_clusters.png",
            "manifest.json",
        ],
        validation_checks=[
            "labels_aligned - one label per observation",
            "labels_range - integer labels within [0, k-1]",
            "embedding_valid - finite, complete 2-D coordinates",
            "coords_valid - finite spatial coordinates",
        ],
        failure_policy=(
            "Block when spatial coordinates are missing; mark failed runs; "
            "no success report from a failed check."
        ),
    ),
    "gene_expression": EvidenceContract(
        workflow="gene_expression",
        version="v1",
        required_inputs=[
            ContractInput(
                label="X (or named layer)", requirement="expression matrix with known semantics"
            ),
            ContractInput(label="var_names", requirement="gene identifiers to resolve against"),
            ContractInput(
                label="obsm['spatial']",
                requirement="shape (n_obs, 2); required for spatial plots",
            ),
        ],
        allowed_parameters=[
            ContractParameter(label="genes", range="1 - 5 identifiers"),
            ContractParameter(label="layer", range="layer recorded in the dataset schema"),
        ],
        expected_artifacts=[
            "gene_match_report.csv",
            "expression_summary.csv",
            "expression_values.csv",
            "spatial_expression.png",
            "spatial_autocorr.csv",
            "manifest.json",
        ],
        validation_checks=[
            "genes_resolved - exact match required; ambiguous or missing reported, "
            "never substituted",
            "values_finite - all extracted expression values are finite",
        ],
        failure_policy=(
            "Report unresolved genes explicitly; no silent substitution; "
            "ambiguous identifiers route to review."
        ),
    ),
}


class SelectorDecision(FrozenRecord):
    kind: SelectorKind
    name: str
    version: str
    decision: WorkflowId
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    probabilities: dict[str, float] = Field(default_factory=dict)
    matched_signals: list[str] = Field(default_factory=list)
    normalized_intent: str | None = None
    notes: str = ""
    latency_ms: float | None = None


def is_supported(decision: WorkflowId) -> bool:
    return decision in SUPPORTED_WORKFLOWS
