from dataclasses import dataclass

import anndata as ad
import numpy as np
import pandas as pd
import squidpy as sq
from pydantic import BaseModel, Field


class SpatialParams(BaseModel):
    coord_type: str = "generic"
    n_neighs: int = Field(6, ge=1, le=100)
    n_perms: int = Field(100, ge=0, le=1000)
    seed: int = 0
    genes: list[str] = Field(default_factory=list)
    layer: str | None = None


@dataclass(frozen=True)
class SpatialGraphReport:
    n_obs: int
    n_edges: int
    mean_degree: float
    n_components: int
    n_isolates: int

    @property
    def isolated_nodes(self) -> int:
        return self.n_isolates

    @property
    def n_nodes(self) -> int:
        return self.n_obs


def build_spatial_graph(
    adata: ad.AnnData, params: SpatialParams
) -> tuple[ad.AnnData, SpatialGraphReport]:
    result = adata.copy()
    sq.gr.spatial_neighbors(
        result,
        coord_type=params.coord_type,
        n_neighs=params.n_neighs,
        spatial_key="spatial",
    )
    adj = result.obsp["spatial_connectivities"]
    degrees = np.asarray(adj.sum(axis=1)).ravel()
    isolates = int((degrees == 0).sum())
    from scipy.sparse.csgraph import connected_components

    n_components, _ = connected_components(adj)
    report = SpatialGraphReport(
        n_obs=int(result.n_obs),
        n_edges=int(adj.nnz // 2),
        mean_degree=float(degrees.mean()),
        n_components=int(n_components),
        n_isolates=isolates,
    )
    return result, report


def autocorrelation_table(
    adata: ad.AnnData, genes: list[str], params: SpatialParams
) -> pd.DataFrame:
    result, _ = build_spatial_graph(adata, params)
    sq.gr.spatial_autocorr(
        result,
        genes=genes,
        mode="moran",
        n_perms=params.n_perms,
        seed=params.seed,
        layer=params.layer if params.layer != "X" else None,
        show_progress_bar=False,
        n_jobs=1,
    )
    return result.uns["moranI"].reset_index().rename(columns={"index": "gene"})


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
        layer=params.layer if params.layer != "X" else None,
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
