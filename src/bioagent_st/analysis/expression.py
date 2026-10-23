from dataclasses import dataclass
from typing import Any, Literal

import anndata as ad
import numpy as np
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field

GeneMatch = Literal["exact", "not_found", "ambiguous"]


class GeneExpressionParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    genes: list[str] = Field(min_length=1, max_length=5)
    layer: str = Field("X", min_length=1)


@dataclass(frozen=True)
class GeneResolution:
    requested: str
    resolved: str | None
    match: GeneMatch
    candidates: tuple[str, ...]


@dataclass(frozen=True)
class GeneSummary:
    requested: str
    resolved: str | None
    match: GeneMatch
    candidates: tuple[str, ...]
    n_obs: int
    minimum: float | None
    maximum: float | None
    mean: float | None
    median: float | None
    zero_fraction: float | None


def _var_names(adata: ad.AnnData) -> list[str]:
    return [str(name) for name in adata.var_names]


def resolve_gene(adata: ad.AnnData, requested: str) -> GeneResolution:
    names = _var_names(adata)
    if requested in names:
        return GeneResolution(requested, requested, "exact", ())

    folded = requested.casefold()
    candidates = tuple(sorted(name for name in names if name.casefold() == folded))
    if len(candidates) > 1:
        return GeneResolution(requested, None, "ambiguous", candidates)

    contains = tuple(sorted(name for name in names if folded in name.casefold()))[:10]
    if contains:
        return GeneResolution(requested, None, "ambiguous", contains)
    return GeneResolution(requested, None, "not_found", ())


def _expression_matrix(adata: ad.AnnData, layer: str) -> Any:
    if layer == "X":
        return adata.X
    if layer not in adata.layers:
        available = ["X", *sorted(str(name) for name in adata.layers)]
        raise ValueError(f"layer not found: {layer}; available layers: {', '.join(available)}")
    return adata.layers[layer]


def extract_expression(adata: ad.AnnData, gene: str, layer: str = "X") -> np.ndarray:
    if gene not in _var_names(adata):
        raise ValueError(f"gene is not an exact var_names match: {gene}")
    index = _var_names(adata).index(gene)
    matrix = _expression_matrix(adata, layer)
    values = matrix[:, index]
    values = values.toarray() if hasattr(values, "toarray") else values
    array = np.asarray(values).ravel().astype(float)
    if array.shape[0] != adata.n_obs:
        raise ValueError("expression vector length does not match observation count")
    if not np.isfinite(array).all():
        raise ValueError(f"expression values for {gene} contain non-finite values")
    return array


def summarize_expression(
    adata: ad.AnnData, params: GeneExpressionParams
) -> tuple[list[GeneSummary], dict[str, np.ndarray]]:
    summaries: list[GeneSummary] = []
    vectors: dict[str, np.ndarray] = {}
    for requested in params.genes:
        resolution = resolve_gene(adata, requested)
        if resolution.match != "exact" or resolution.resolved is None:
            summaries.append(
                GeneSummary(
                    requested=requested,
                    resolved=None,
                    match=resolution.match,
                    candidates=resolution.candidates,
                    n_obs=adata.n_obs,
                    minimum=None,
                    maximum=None,
                    mean=None,
                    median=None,
                    zero_fraction=None,
                )
            )
            continue
        values = extract_expression(adata, resolution.resolved, params.layer)
        vectors[resolution.resolved] = values
        nonzero = int(np.count_nonzero(values))
        summaries.append(
            GeneSummary(
                requested=requested,
                resolved=resolution.resolved,
                match="exact",
                candidates=(),
                n_obs=int(values.size),
                minimum=float(values.min()),
                maximum=float(values.max()),
                mean=float(values.mean()),
                median=float(np.median(values)),
                zero_fraction=float(1.0 - nonzero / values.size),
            )
        )
    return summaries, vectors


def match_report(summaries: list[GeneSummary], layer: str) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "requested": item.requested,
                "resolved": item.resolved or "",
                "match": item.match,
                "candidates": ";".join(item.candidates),
                "layer": layer,
            }
            for item in summaries
        ]
    )


def summary_table(summaries: list[GeneSummary]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "requested": item.requested,
                "resolved": item.resolved or "",
                "match": item.match,
                "n_obs": item.n_obs,
                "min": item.minimum,
                "max": item.maximum,
                "mean": item.mean,
                "median": item.median,
                "zero_fraction": item.zero_fraction,
            }
            for item in summaries
        ]
    )


def values_table(adata: ad.AnnData, vectors: dict[str, np.ndarray]) -> pd.DataFrame:
    table = pd.DataFrame({"obs_id": [str(name) for name in adata.obs_names]})
    for gene, values in vectors.items():
        table[gene] = values
    return table
