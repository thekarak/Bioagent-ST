# BioAgent-ST Empirical Multi-Run Reproducibility Report

**Evaluation Timestamp**: 2026-10-25
**Investigators**: Sourasis Karak & Sourav Sarkar
**Scope**: Verification of bitwise invariance across independent workflow executions, deterministic manifests, and fail-closed degradation.

---

## 1. Executive Summary

We conducted independent multi-run execution of all three approved scientific workflows on the frozen spatial transcriptomics fixture (`synthetic_spatial_300x500.h5ad`, SHA-256: `sha256:c47eebaf2c6845e8ae3c75cbe4b23b3e829096655788dd7d24b4140999d074f8`).

- **Bitwise Artifact Invariance**: **100.0% Pass**. Across three independent executions, all analytical tabular data, AnnData matrices, and spatial correlation tables produced identical SHA-256 cryptographic hashes.
- **Run Manifest Invariance (M1 Remediated)**: **100.0% Pass**. By basing `manifest.json` on content hashes and deterministic artifact names rather than random session IDs, `manifest.json` and the scientific report `provenance_manifest_hash` are bitwise identical across runs.
- **Fail-Closed Safety Under Data Corruption**: **100.0% Pass**. Malformed datasets (duplicate spot IDs, NaN values in expression matrices, missing spatial coordinates) are intercepted by hard contract checks, terminating execution cleanly with zero spurious artifacts written to disk.

---

## 2. Multi-Run Analytical Artifact Hash Verification

### 2.1 Quality Assessment Workflow (`quality_assessment`)

Parameters: `min_genes=200`, `min_counts=0`, `max_mito_pct=20.0`.

| Artifact File | Run 1 SHA-256 | Run 2 SHA-256 | Run 3 SHA-256 | Match |
|---|---|---|---|---|
| `qc.h5ad` | `sha256:b8cb990cdd8d0...` | `sha256:b8cb990cdd8d0...` | `sha256:b8cb990cdd8d0...` | [PASS] Identical |
| `qc_table.csv` | `sha256:484451fbf2027...` | `sha256:484451fbf2027...` | `sha256:484451fbf2027...` | [PASS] Identical |
| `schema_report.json` | `sha256:c8403c065bbf9...` | `sha256:c8403c065bbf9...` | `sha256:c8403c065bbf9...` | [PASS] Identical |
| `manifest.json` | `sha256:200aefddc98ed...` | `sha256:200aefddc98ed...` | `sha256:200aefddc98ed...` | [PASS] Identical |

*Report Provenance Manifest Hash across 3 runs*: `sha256:500a46761a2cf132296f2d9a070a50bb76873f803d3cb2158bdcbcbb544a9416` ([PASS] Bitwise Identical)
*Full `qc_table.csv` SHA-256*: `sha256:484451fbf2027361e14ceb63dbb03860da8793c27c3df13004df88f2e3b1d9f8`

### 2.2 Spatial Clustering Workflow (`spatial_clustering`)

Parameters: `n_top_genes=30`, `n_pcs=10`, `n_neighbors=10`, `resolution=0.5`, `seed=42`.

| Artifact File | Run 1 SHA-256 | Run 2 SHA-256 | Run 3 SHA-256 | Match |
|---|---|---|---|---|
| `clustered.h5ad` | `sha256:ee8b3d3a4ce0f...` | `sha256:ee8b3d3a4ce0f...` | `sha256:ee8b3d3a4ce0f...` | [PASS] Identical |
| `cluster_table.csv` | `sha256:9f427468a5c0d...` | `sha256:9f427468a5c0d...` | `sha256:9f427468a5c0d...` | [PASS] Identical |
| `umap_coords.csv` | `sha256:b3aa7d4daa836...` | `sha256:b3aa7d4daa836...` | `sha256:b3aa7d4daa836...` | [PASS] Identical |
| `spatial_clusters.png` | `sha256:2a7b4f3e0ffaf...` | `sha256:2a7b4f3e0ffaf...` | `sha256:2a7b4f3e0ffaf...` | [PASS] Identical |
| `manifest.json` | `sha256:b563a166083b0...` | `sha256:b563a166083b0...` | `sha256:b563a166083b0...` | [PASS] Identical |

*Cluster count across all 3 runs*: `3` clusters.
*Full `cluster_table.csv` SHA-256*: `sha256:9f427468a5c0d7c2a31d7231bfb3b56e89569803512f6e65698d1715407ba62e`

### 2.3 Gene Expression Workflow (`gene_expression`)

Parameters: `genes=["GENE_0000", "GENE_0020"]`, `layer="X"`.

| Artifact File | Run 1 SHA-256 | Run 2 SHA-256 | Run 3 SHA-256 | Match |
|---|---|---|---|---|
| `expression_summary.csv` | `sha256:203a18b531e82...` | `sha256:203a18b531e82...` | `sha256:203a18b531e82...` | [PASS] Identical |
| `expression_values.csv` | `sha256:b92f3ccaaa9ee...` | `sha256:b92f3ccaaa9ee...` | `sha256:b92f3ccaaa9ee...` | [PASS] Identical |
| `spatial_autocorr.csv` | `sha256:fb4cc822a50a6...` | `sha256:fb4cc822a50a6...` | `sha256:fb4cc822a50a6...` | [PASS] Identical |
| `manifest.json` | `sha256:89a67ac5be352...` | `sha256:89a67ac5be352...` | `sha256:89a67ac5be352...` | [PASS] Identical |

*Full `spatial_autocorr.csv` SHA-256*: `sha256:fb4cc822a50a69536d70f3e0c27d8d7b298ff689fb89b9b2e6652d62208668c5`

---

## 3. Fail-Closed Degradation & Fault Interception

We evaluated whether corruptions and contract violations safely halt execution before unvalidated claims or corrupted files can be recorded:

| Perturbation Condition | Severity | Gate & Contract Result | Spurious Artifacts | Safety Status |
|---|---|---|---|---|
| Missing `obsm['spatial']` coordinates | Hard | `data.spatial_coords_valid` FAIL | 0 files written | [PASS] Blocked Cleanly |
| Duplicate spot observation IDs | Hard | `data.duplicate_ids` FAIL | 0 files written | [PASS] Blocked Cleanly |
| NaN values in count matrix `X` | Hard | `data.no_nans` FAIL | 0 files written | [PASS] Blocked Cleanly |

---

## 4. Cryptographic Provenance Architecture

Every run records structured provenance in SQLite `ledger.db` with execution metadata (`tool_name`, `tool_version`, `dataset_hash`, `code_commit`, `parameters`, `random_seed`, `output_hash`).
The file `manifest.json` records the deterministic cryptographic file signatures of all written artifacts. This provides bitwise invariance across repeated runs without sacrificing individual provenance tracking.
