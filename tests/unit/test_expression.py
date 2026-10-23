import numpy as np
import pytest

from bioagent_st.analysis.expression import (
    GeneExpressionParams,
    extract_expression,
    resolve_gene,
    summarize_expression,
)
from bioagent_st.fixtures import create_spatial_fixture


def test_resolve_gene_requires_exact_match_and_reports_candidates() -> None:
    adata = create_spatial_fixture()

    exact = resolve_gene(adata, "GENE_0000")
    assert exact.match == "exact"
    assert exact.resolved == "GENE_0000"

    missing = resolve_gene(adata, "NOT_A_GENE")
    assert missing.match == "not_found"
    assert missing.resolved is None

    ambiguous = resolve_gene(adata, "GENE")
    assert ambiguous.match == "ambiguous"
    assert ambiguous.resolved is None
    assert len(ambiguous.candidates) > 1


def test_extract_expression_does_not_substitute_unresolved_gene() -> None:
    adata = create_spatial_fixture()

    values = extract_expression(adata, "GENE_0000")
    assert values.shape == (adata.n_obs,)
    assert np.isfinite(values).all()

    with pytest.raises(ValueError, match="exact var_names"):
        extract_expression(adata, "GENE")


def test_gene_summary_marks_unresolved_requests_without_values() -> None:
    adata = create_spatial_fixture()

    summaries, vectors = summarize_expression(
        adata,
        GeneExpressionParams(genes=["GENE_0000", "NOT_A_GENE"]),
    )

    assert list(vectors) == ["GENE_0000"]
    assert summaries[0].match == "exact"
    assert summaries[0].zero_fraction is not None
    assert summaries[1].match == "not_found"
    assert summaries[1].mean is None


def test_gene_expression_params_enforce_requested_ranges() -> None:
    with pytest.raises(ValueError):
        GeneExpressionParams(genes=[])
    with pytest.raises(ValueError):
        GeneExpressionParams(genes=[f"GENE_{index}" for index in range(6)])


def test_extract_expression_raises_on_invalid_layer() -> None:
    adata = create_spatial_fixture()

    with pytest.raises(ValueError, match="layer not found: non_existent_layer; available layers:"):
        extract_expression(adata, "GENE_0000", layer="non_existent_layer")
