from pathlib import Path

import numpy as np
import pandas as pd
from anndata import AnnData
from scipy import sparse

from bioagent_st.utils.hashing import anndata_content_hash, sha256_file
from bioagent_st.utils.seeding import set_all_seeds


def create_spatial_fixture(seed: int = 0) -> AnnData:
    set_all_seeds(seed)
    rng = np.random.default_rng(seed)
    n_obs = 300
    n_genes = 500

    grid_y, grid_x = np.divmod(np.arange(n_obs), 30)
    spatial = np.column_stack(
        (grid_x * 10.0 + rng.uniform(0, 4, n_obs), grid_y * 10.0 + rng.uniform(0, 4, n_obs))
    ).astype(np.float32)
    domains = np.array(["left", "middle", "right"])[np.minimum(grid_x // 10, 2)]
    domain_effects = rng.normal(0.0, 0.2, (3, n_genes))
    domain_effects[np.arange(3), np.arange(3) * 20] += 7.0
    base = rng.gamma(shape=1.5, scale=2.0, size=n_genes)
    domain_index = np.searchsorted(np.array(["left", "middle", "right"]), domains)
    rates = np.exp(base + domain_effects[domain_index])
    counts = rng.poisson(rates).astype(np.float32)

    marker_mask = np.zeros(n_genes, dtype=bool)
    for domain in range(3):
        marker_mask[domain * 20 : domain * 20 + 5] = True

    obs = {
        "domain_truth": domains,
        "total_counts": np.asarray(counts.sum(axis=1)).ravel(),
    }
    var = pd.DataFrame(
        {
            "gene_symbol": [f"GENE_{index:04d}" for index in range(n_genes)],
            "is_synthetic_marker": marker_mask,
        },
        index=[f"GENE_{index:04d}" for index in range(n_genes)],
    )
    adata = AnnData(
        X=sparse.csr_matrix(counts),
        obs=obs,
        var=var,
        obsm={"spatial": spatial},
        layers={"counts": sparse.csr_matrix(counts)},
    )
    adata.uns["fixture"] = {
        "seed": seed,
        "truth_column": "domain_truth",
        "content_hash": anndata_content_hash(adata),
        "warning": "Synthetic data for software testing only; not biological evidence.",
    }
    return adata


def write_fixture(path: str | Path, seed: int = 0) -> str:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    adata = create_spatial_fixture(seed)
    adata.write_h5ad(output, compression="gzip")
    return sha256_file(output)
