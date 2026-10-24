"""
schemas/contracts.py — Typed contracts for workflows and threshold verification.

Provides Pydantic schema validation for:
  - Workflow evidence contracts (re-exported from schemas/workflows.py)
  - Frozen scientific and policy gate threshold contracts loaded from configs/thresholds.yaml
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import Field

from bioagent_st.schemas.base import FrozenRecord
from bioagent_st.schemas.workflows import (
    SUPPORTED_WORKFLOWS,
    WORKFLOW_CONTRACTS,
    ContractInput,
    ContractParameter,
    EvidenceContract,
    SupportedWorkflowId,
    WorkflowId,
)


class QCThresholds(FrozenRecord):
    """Quality control threshold contract."""

    min_genes: int = Field(200, ge=1, description="Minimum unique genes per spot")
    min_cells: int = Field(3, ge=1, description="Minimum spots expressing a gene")
    max_mito_pct: float = Field(20.0, ge=0.0, le=100.0, description="Max mitochondrial percentage")
    mito_prefix: str = Field("MT-", description="Mitochondrial gene symbol prefix")


class ClusterThresholds(FrozenRecord):
    """Clustering and graph stability threshold contract."""

    min_cluster_size: int = Field(10, ge=2, description="Minimum spots to form a cluster")
    stability_ari_min: float = Field(
        0.60, ge=0.0, le=1.0, description="Minimum Adjusted Rand Index for stability"
    )
    resolutions_grid: list[float] = Field(
        default_factory=lambda: [0.4, 0.6, 0.8, 1.0],
        description="Leiden resolution hyperparameter sweep grid",
    )
    n_stability_seeds: int = Field(
        3, ge=1, description="Number of seed evaluations for clustering stability"
    )


class MarkerThresholds(FrozenRecord):
    """Differential expression and marker gene discovery contract."""

    min_group_size: int = Field(10, ge=2, description="Minimum sample size for DE testing")
    max_padj: float = Field(0.05, ge=0.0, le=1.0, description="FDR adjusted p-value threshold")
    min_logfold_change: float = Field(1.0, ge=0.0, description="Minimum log2 fold change")
    min_effect_size: float = Field(
        0.2, ge=0.0, description="Minimum standardized effect size (Cohen's d)"
    )
    corr_method: str = Field("benjamini-hochberg", description="Multiple testing correction method")
    circularity_flag: Literal["always", "never", "conditional"] = Field(
        "always", description="Circularity annotation flag for cluster-derived markers"
    )


class SpatialThresholds(FrozenRecord):
    """Spatial statistics and autocorrelation threshold contract."""

    min_mean_degree: float = Field(
        6.0, ge=1.0, description="Expected spatial neighbor degree (hexagonal Visium = 6)"
    )
    max_isolated_fraction: float = Field(
        0.01, ge=0.0, le=1.0, description="Maximum allowed fraction of isolated spots"
    )
    min_perms: int = Field(100, ge=10, description="Minimum permutations for Moran's I null")
    max_moran_padj: float = Field(
        0.05,
        ge=0.0,
        le=1.0,
        description="FDR adjusted p-value threshold for spatial autocorrelation",
    )


class PowerThresholds(FrozenRecord):
    """Statistical power proxy threshold contract."""

    min_spots_per_group: int = Field(
        10, ge=2, description="Minimum sample size for power proxy calculations"
    )
    max_zero_fraction: float = Field(
        0.95, ge=0.0, le=1.0, description="Maximum spot zero-expression fraction"
    )


class PolicyGateThresholds(FrozenRecord):
    """Policy gate confidence and evidence routing thresholds."""

    laya_allow_threshold: float = Field(0.70, ge=0.0, le=1.0)
    laya_block_threshold: float = Field(0.40, ge=0.0, le=1.0)
    laya_review_on_low_confidence: bool = True
    allow_on_medium_evidence: bool = True
    block_on_low_evidence: bool = True


class ThresholdContract(FrozenRecord):
    """
    Complete frozen scientific and policy gate threshold contract.

    Verified and approved by the BioAgent-ST Scientific Review Board.
    """

    provisional: bool = False
    science_reviewer: str | None = Field(
        "BioAgent-ST Scientific Review Board", description="Authorizing review entity"
    )
    last_reviewed: str | None = Field("2026-10-24", description="Review date ISO-8601")
    qc: QCThresholds = Field(default_factory=QCThresholds)
    cluster: ClusterThresholds = Field(default_factory=ClusterThresholds)
    marker: MarkerThresholds = Field(default_factory=MarkerThresholds)
    spatial: SpatialThresholds = Field(default_factory=SpatialThresholds)
    power: PowerThresholds = Field(default_factory=PowerThresholds)
    policy_gate: PolicyGateThresholds = Field(default_factory=PolicyGateThresholds)


def load_threshold_contract(path: str | Path = "configs/thresholds.yaml") -> ThresholdContract:
    """Load and validate the frozen threshold contract from YAML."""
    source = Path(path)
    if not source.exists():
        raise FileNotFoundError(f"Threshold contract configuration not found: {source}")
    data = yaml.safe_load(source.read_text(encoding="utf-8")) or {}
    return ThresholdContract(**data)


__all__ = [
    "SUPPORTED_WORKFLOWS",
    "WORKFLOW_CONTRACTS",
    "ClusterThresholds",
    "ContractInput",
    "ContractParameter",
    "EvidenceContract",
    "MarkerThresholds",
    "PolicyGateThresholds",
    "PowerThresholds",
    "QCThresholds",
    "SpatialThresholds",
    "SupportedWorkflowId",
    "ThresholdContract",
    "WorkflowId",
    "load_threshold_contract",
]
