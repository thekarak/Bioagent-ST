import anndata as ad
import scanpy as sc
from pydantic import BaseModel, ConfigDict, Field

from bioagent_st.utils.seeding import set_all_seeds


class ClusteringParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    n_top_genes: int = Field(2000, ge=10, le=20_000)
    n_pcs: int = Field(30, ge=2, le=200)
    n_neighbors: int = Field(15, ge=2, le=200)
    resolution: float = Field(0.5, ge=0.01, le=10.0)
    seed: int = Field(0, ge=0, le=2**32 - 1)
    n_umap_neighbors: int = Field(15, ge=2, le=200)


def cluster_expression(adata: ad.AnnData, params: ClusteringParams) -> ad.AnnData:
    if adata.n_obs < 3 or adata.n_vars < params.n_top_genes:
        raise ValueError("dataset is too small for requested clustering parameters")
    set_all_seeds(params.seed)
    result = adata.copy()
    sc.pp.normalize_total(result, target_sum=1e4)
    sc.pp.log1p(result)
    sc.pp.highly_variable_genes(result, n_top_genes=params.n_top_genes, flavor="seurat")
    result = result[:, result.var["highly_variable"]].copy()
    n_comps = min(params.n_pcs, result.n_obs - 1, result.n_vars - 1)
    sc.pp.pca(result, n_comps=n_comps, random_state=params.seed)
    sc.pp.neighbors(result, n_neighbors=params.n_neighbors, n_pcs=n_comps, random_state=params.seed)
    sc.tl.umap(result, random_state=params.seed, neighbors_key="neighbors")
    sc.tl.leiden(
        result,
        resolution=params.resolution,
        random_state=params.seed,
        key_added="leiden",
        flavor="igraph",
    )
    return result
