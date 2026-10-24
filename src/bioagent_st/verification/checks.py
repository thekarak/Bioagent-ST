from collections.abc import Iterable

import anndata as ad
import numpy as np

from bioagent_st.schemas.evidence import CheckResult


def result(
    check_id: str,
    status: str,
    severity: str,
    value: float | None = None,
    threshold: float | None = None,
    detail: str = "",
    artifact_ids: list[str] | None = None,
) -> CheckResult:
    return CheckResult(
        check_id=check_id,
        status=status,
        severity=severity,
        value=value,
        threshold=threshold,
        detail=detail,
        artifact_ids=artifact_ids or [],
    )


def min_observation_check(adata: ad.AnnData, minimum: int = 3) -> CheckResult:
    value = float(adata.n_obs)
    return result(
        "data.min_obs",
        "pass" if adata.n_obs >= minimum else "fail",
        "hard",
        value,
        float(minimum),
    )


def spatial_coordinate_check(adata: ad.AnnData, required: bool = True) -> CheckResult:
    if "spatial" not in adata.obsm:
        return result(
            "data.spatial_coords_valid",
            "fail" if required else "warn",
            "hard" if required else "soft",
            detail="obsm['spatial'] is missing",
        )
    coordinates = adata.obsm["spatial"]
    valid = bool(
        coordinates.ndim == 2
        and coordinates.shape[0] == adata.n_obs
        and coordinates.shape[1] >= 2
        and np.isfinite(coordinates[:, :2]).all()
    )
    return result(
        "data.spatial_coords_valid",
        "pass" if valid else "fail",
        "hard",
        detail=(
            "obsm['spatial'] present and valid"
            if valid
            else "obsm['spatial'] coordinates have invalid shape or contain NaNs/Infs"
        ),
    )


def duplicate_id_check(adata: ad.AnnData) -> CheckResult:
    obs_dup = not adata.obs_names.is_unique
    var_dup = not adata.var_names.is_unique
    valid = not (obs_dup or var_dup)
    detail_parts: list[str] = []
    if obs_dup:
        detail_parts.append("Duplicate observation (spot) identifiers detected")
    if var_dup:
        detail_parts.append("Duplicate variable (gene) identifiers detected")
    return result(
        "data.duplicate_ids",
        "pass" if valid else "fail",
        "hard",
        detail="; ".join(detail_parts) if detail_parts else "IDs are unique",
    )


def no_nans_check(adata: ad.AnnData) -> CheckResult:
    import scipy.sparse as sp

    values = adata.X
    if sp.issparse(values):
        has_nans = bool(np.isnan(values.data).any())
    else:
        has_nans = bool(np.isnan(values).any())
    return result(
        "data.no_nans",
        "fail" if has_nans else "pass",
        "hard",
        detail="NaN values detected in expression matrix" if has_nans else "No NaNs detected",
    )


def counts_available_check(adata: ad.AnnData) -> CheckResult:
    import scipy.sparse as sp

    values = adata[: min(100, adata.n_obs), : min(200, adata.n_vars)].X
    if sp.issparse(values):
        data = values.data
        available = bool(data.size and np.isfinite(data).all() and (data >= 0).all())
    else:
        available = bool(values.size and np.isfinite(values).all() and (values >= 0).all())
    return result("data.counts_available", "pass" if available else "fail", "hard")


def qc_pass_check(adata: ad.AnnData) -> CheckResult:
    value = float(adata.n_obs)
    minimum = 3.0
    return result("qc.pass", "pass" if adata.n_obs >= 3 else "fail", "hard", value, minimum)


def cluster_stability_check(value: float, threshold: float) -> CheckResult:
    return result(
        "cluster.stability.ari", "pass" if value >= threshold else "fail", "hard", value, threshold
    )


def cluster_min_size_check(group_sizes: Iterable[int], threshold: float) -> CheckResult:
    sizes = list(group_sizes)
    minimum = min(sizes) if sizes else 0.0
    return result(
        "cluster.min_size", "pass" if minimum >= threshold else "fail", "hard", minimum, threshold
    )


def marker_effect_size_check(value: float, threshold: float) -> CheckResult:
    return result(
        "marker.effect_size", "pass" if value >= threshold else "fail", "hard", value, threshold
    )


def marker_fdr_check(value: float, threshold: float) -> CheckResult:
    return result("marker.fdr", "pass" if value <= threshold else "fail", "hard", value, threshold)


def marker_group_size_check(value: float, threshold: float) -> CheckResult:
    return result(
        "marker.group_size", "pass" if value >= threshold else "fail", "hard", value, threshold
    )


def marker_consistency_check(value: float, threshold: float) -> CheckResult:
    return result(
        "marker.consistency_resolution",
        "pass" if value >= threshold else "fail",
        "hard",
        value,
        threshold,
    )


def marker_circularity_check() -> CheckResult:
    return result(
        "marker.circularity_flag",
        "warn",
        "soft",
        detail="Marker selection and clusters derive from the same expression data.",
    )


def spatial_graph_check(
    mean_degree: float,
    isolated_fraction: float,
    min_mean_degree: float,
    max_isolated_fraction: float,
) -> CheckResult:
    valid = mean_degree >= min_mean_degree and isolated_fraction <= max_isolated_fraction
    return result(
        "spatial.graph_valid", "pass" if valid else "fail", "hard", mean_degree, min_mean_degree
    )


def enrichment_vs_null_check(value: float, threshold: float) -> CheckResult:
    return result(
        "spatial.enrichment_vs_null",
        "pass" if value >= threshold else "fail",
        "hard",
        value,
        threshold,
    )


def null_stability_check(value: float, threshold: float) -> CheckResult:
    return result(
        "spatial.null_stability",
        "pass" if value >= threshold else "fail",
        "hard",
        value,
        threshold,
    )


def moran_fdr_check(value: float, threshold: float) -> CheckResult:
    return result(
        "spatial.moran_fdr", "pass" if value <= threshold else "fail", "hard", value, threshold
    )


def expression_sparsity_check(zero_fraction: float, threshold: float) -> CheckResult:
    return result(
        "spatial.expression_sparsity",
        "pass" if zero_fraction <= threshold else "warn",
        "soft",
        zero_fraction,
        threshold,
    )


def null_present_check(present: bool) -> CheckResult:
    return result("spatial.null_present", "pass" if present else "fail", "hard")


def power_proxy_check(
    spots: float, zero_fraction: float, min_spots: float, max_zero: float
) -> CheckResult:
    adequate = spots >= min_spots and zero_fraction <= max_zero
    return result(
        "stat.power_proxy",
        "pass" if adequate else "warn",
        "soft",
        spots,
        min_spots,
        detail=f"zero_fraction={zero_fraction:.4f}",
    )


def integrity_check(check_id: str, passed: bool, detail: str = "") -> CheckResult:
    return result(check_id, "pass" if passed else "fail", "hard", detail=detail)
