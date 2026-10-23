import argparse
import json
from pathlib import Path

from anndata import read_h5ad

from bioagent_st.analysis.markers import MarkerParams
from bioagent_st.analysis.spatial import SpatialParams
from bioagent_st.datasets import load_dataset
from bioagent_st.tools.workflow import run_markers, run_qc_clustering, run_spatial_statistics
from bioagent_st.utils.hashing import anndata_content_hash


def workflow_command(args: argparse.Namespace) -> None:
    source = args.source
    dataset = args.dataset
    output = Path(args.output)
    if args.workflow == "qc_clustering":
        adata = load_dataset(source, dataset)
        result = run_qc_clustering(adata, output, dataset_hash=anndata_content_hash(adata))
    else:
        if dataset is None:
            raise ValueError("--dataset is required for marker and spatial workflows")
        adata = read_h5ad(dataset)
        if args.workflow == "markers":
            result = run_markers(adata, output, MarkerParams(n_genes=25))
        else:
            genes = [adata.var_names[0]] if adata.n_vars else []
            result = run_spatial_statistics(
                adata, output, SpatialParams(n_neighs=6, n_perms=20, genes=genes)
            )
    print(json.dumps(result.model_dump(), indent=2))
    if result.status == "error":
        raise SystemExit(1)
