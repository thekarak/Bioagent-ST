import argparse
import json
from pathlib import Path

from anndata import read_h5ad

from bioagent_st.analysis.clustering import ClusteringParams
from bioagent_st.analysis.expression import GeneExpressionParams
from bioagent_st.analysis.markers import MarkerParams
from bioagent_st.analysis.qc import QCParams
from bioagent_st.analysis.spatial import SpatialParams
from bioagent_st.datasets import load_dataset
from bioagent_st.tools.workflow import (
    run_gene_expression,
    run_markers,
    run_quality_assessment,
    run_spatial_clustering,
    run_spatial_statistics,
)
from bioagent_st.utils.hashing import anndata_content_hash


def workflow_command(args: argparse.Namespace) -> None:
    output = Path(args.output)
    if args.workflow in {"quality_assessment", "spatial_clustering", "gene_expression"}:
        adata = load_dataset(args.source, args.dataset)
        if args.workflow == "quality_assessment":
            qc_params = QCParams(
                min_genes=getattr(args, "min_genes", 200),
                min_counts=getattr(args, "min_counts", 500),
            )
            result = run_quality_assessment(
                adata, output, qc_params, dataset_hash=anndata_content_hash(adata)
            )
        elif args.workflow == "spatial_clustering":
            result = run_spatial_clustering(
                adata,
                output,
                qc_params=QCParams(
                    min_genes=getattr(args, "min_genes", 200),
                    min_counts=getattr(args, "min_counts", 500),
                ),
                clustering_params=ClusteringParams(),
                dataset_hash=anndata_content_hash(adata),
            )
        else:
            genes = list(getattr(args, "genes", None) or [])
            if not genes:
                raise ValueError("--genes is required for gene_expression")
            result = run_gene_expression(
                adata,
                output,
                GeneExpressionParams(genes=genes, layer=getattr(args, "layer", "X")),
            )
    else:
        if args.dataset is None:
            raise ValueError("--dataset is required for marker and spatial statistics workflows")
        adata = read_h5ad(args.dataset)
        if args.workflow == "markers":
            result = run_markers(adata, output, MarkerParams(n_genes=25))
        else:
            genes = [str(adata.var_names[0])] if adata.n_vars else []
            result = run_spatial_statistics(
                adata, output, SpatialParams(n_neighs=6, n_perms=20, genes=genes)
            )
    print(json.dumps(result.model_dump(), indent=2))
    if result.status == "error":
        raise SystemExit(1)
