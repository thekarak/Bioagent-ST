from typing import Literal

import anndata as ad
import scanpy as sc
from pydantic import BaseModel, ConfigDict, Field


class QCParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    min_genes: int = Field(200, ge=0, le=10_000)
    min_cells: int = Field(3, ge=0, le=10_000)
    max_mito_pct: float = Field(20.0, ge=0, le=100)
    mito_prefix: str = "MT-"


def run_qc(adata: ad.AnnData, params: QCParams) -> ad.AnnData:
    if adata.n_obs < 1 or adata.n_vars < 1:
        raise ValueError("AnnData must contain observations and genes")
    result = adata.copy()
    result.var["mito"] = result.var_names.str.startswith(params.mito_prefix)
    sc.pp.calculate_qc_metrics(result, qc_vars=["mito"], percent_top=None, inplace=True)
    keep_obs = (result.obs["n_genes_by_counts"] >= params.min_genes) & (
        result.obs["pct_counts_mito"] <= params.max_mito_pct
    )
    result = result[keep_obs].copy()
    if result.n_obs < max(params.min_cells, 1):
        raise ValueError("QC filtering removed all observations")
    sc.pp.filter_genes(result, min_cells=params.min_cells)
    if result.n_vars < 1:
        raise ValueError("QC filtering removed all genes")
    return result


def counts_like(adata: ad.AnnData) -> Literal["counts_like", "not_counts_like", "unknown"]:
    values = adata[: min(100, adata.n_obs), : min(200, adata.n_vars)].X
    values = values.toarray() if hasattr(values, "toarray") else values
    if values.size == 0:
        return "unknown"
    if ((values >= 0) & (values == values.round())).all():
        return "counts_like"
    return "not_counts_like"
