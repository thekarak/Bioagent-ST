from dataclasses import dataclass

import anndata as ad
import numpy as np
import squidpy as sq
from pydantic import BaseModel, ConfigDict, Field


class SpatialParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    coord_type: str = Field("generic", min_length=1)
    n_neighs: int = Field(6, ge=2, le=200)
    n_perms: int = Field(100, ge=2, le=10_000)
    seed: int = Field(0, ge=0, le=2**32 - 1)
    genes: list[str] = Field(default_factory=list)


@dataclass(frozen=True)
class SpatialGraphReport:
    mean_degree: float
    isolated_nodes: int
    n_nodes: int


def build_spatial_graph(
    adata: ad.AnnData, params: SpatialParams
) -> tuple[ad.AnnData, SpatialGraphReport]:
    if "spatial" not in adata.obsm:
        raise ValueError("obsm['spatial'] is required")
    result = adata.copy()
    sq.gr.spatial_neighbors_knn(result, n_neighs=params.n_neighs, n_jobs=1)
    connectivity = result.obsp["spatial_connectivities"]
    degree = np.asarray(connectivity.sum(axis=1)).ravel()
    report = SpatialGraphReport(
        mean_degree=float(degree.mean()),
        isolated_nodes=int((degree == 0).sum()),
        n_nodes=result.n_obs,
    )
    return result, report


def spatial_statistics(
    adata: ad.AnnData, params: SpatialParams
) -> tuple[ad.AnnData, SpatialGraphReport]:
    result, report = build_spatial_graph(adata, params)
    sq.gr.spatial_autocorr(
        result,
        genes=params.genes or None,
        mode="moran",
        n_perms=params.n_perms,
        seed=params.seed,
        show_progress_bar=False,
        n_jobs=1,
        table_key="spatial_autocorr",
    )
    sq.gr.nhood_enrichment(
        result,
        cluster_key="leiden",
        n_perms=params.n_perms,
        seed=params.seed,
        show_progress_bar=False,
        n_jobs=1,
        table_key="nhood_enrichment",
    )
    return result, report
