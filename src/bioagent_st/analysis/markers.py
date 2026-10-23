import anndata as ad
import pandas as pd
import scanpy as sc
from pydantic import BaseModel, ConfigDict, Field


class MarkerParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    groupby: str = "leiden"
    n_genes: int = Field(100, ge=1, le=10_000)
    method: str = "wilcoxon"
    corr_method: str = "benjamini-hochberg"


def find_markers(adata: ad.AnnData, params: MarkerParams) -> pd.DataFrame:
    if params.groupby not in adata.obs:
        raise ValueError(f"group column not found: {params.groupby}")
    sc.tl.rank_genes_groups(
        adata,
        groupby=params.groupby,
        method=params.method,
        corr_method=params.corr_method,
        n_genes=params.n_genes,
        use_raw=False,
    )
    result = sc.get.rank_genes_groups_df(adata, group=None)
    return result.rename(columns={"names": "gene"})
