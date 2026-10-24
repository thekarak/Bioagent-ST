# Scientific Ethics, Methodological Assumptions, and Limitations — BioAgent-ST

> **Core Principle (Skill §1.9, Blueprint §2):**  
> *"Nothing is 'novel' or 'confirmed' until tested. The blueprint is a set of hypotheses. Never write text (docs, README, paper drafts, code comments) that claims novelty, superiority, or calibrated confidence without experimental evidence and a literature check. Reproducibility is necessary but not sufficient for scientific truth."*

This document provides a comprehensive, rigorous, and intellectually honest accounting of the methodological boundaries, theoretical assumptions, operational heuristics, and epistemic limitations of **BioAgent-ST**. It defines what the system's computational guarantees do—and strictly do not—imply for biological discovery.

---

## 1. Technical Verification != Biological Validity

### 1.1 The Epistemic Boundary Between Code and Biology
A foundational design principle of BioAgent-ST is the strict separation between **formal computational verification** and **empirical biological validity**:

* **Technical Verification (Software & Arithmetic Integrity):**  
  BioAgent-ST mathematically guarantees that an analysis pipeline executed without runtime exceptions, that matrices satisfy strict boundary invariants (e.g., absence of `NaN`, `Inf`, or negative counts in raw count slots), that spatial coordinates lie within bounded tissue coordinates, that graph adjacency matrices are non-singular, that random seeds produce bitwise reproducible results, and that all inputs and outputs link to verifiable cryptographic SHA-256 hashes.
* **Biological Validity (Ground Truth in Vivo):**  
  Passing every verification rule in BioAgent-ST does **not** prove that a biological finding, cell-type hypothesis, spatial niche, or differential expression signature reflects true underlying biology.

Computational correctness establishes only that the software operated as mathematically specified on the supplied digital artifact; it cannot transform uncalibrated, biased, or artifact-laden observational data into biological truth (Peng, 2011; Baker, 2016; Heil et al., 2021).

### 1.2 Unmodeled Pre-Analytical and Physical Confounders
Deterministic software verification cannot detect or correct for upstream experimental confounders inherent to spatial transcriptomics assays:

| Pre-Analytical Artifact | Physical Mechanism | Impact on Computation | System Verification Status |
|---|---|---|---|
| **Lateral RNA Diffusion / Permeabilization Bleed** | Over-permeabilization causes mRNA molecules to diffuse laterally across adjacent capture spots prior to reverse transcription (Moses & Pachter, 2022). | Produces artificial spatial autocorrelation (inflated Moran's $I$) and synthetic multi-spot co-expression halos. | **Undetectable by code verification:** Matrices are mathematically valid; spatial coordinates are intact. |
| **Tissue Folding and Detachment** | Histological sectioning artifacts cause local folding or tearing of the tissue slice on the capture area. | Extreme local spot density, duplicated cell counts, or artificial spatial voids. | **Partially flagged** by coordinate density heuristics, but cannot distinguish physical tear from biological lumen or ventricle. |
| **Ambient RNA Contamination (Soup)** | Lysis of damaged cells releases ambient mRNA into solution before capture. | Ubiquitous low-level expression of high-abundance lineage transcripts across all spots (e.g., hemoglobin or mitochondrial genes). | **Indistinguishable** from low-level widespread endogenous transcription without targeted deconvolution algorithms. |
| **Resection-Induced Stress Response** | Warm ischemia and mechanical trauma during surgical resection induce rapid transcription of immediate early genes (e.g., *FOS*, *JUN*, heat shock proteins). | Systematic expression of stress pathways across the entire tissue section. | **Statistically robust but biologically misleading:** High statistical power and low FDR reflect resection artifact, not in vivo tissue state. |
| **Sectioning Angle Bias** | Tissues sliced at oblique or non-perpendicular angles project 3D cellular structures onto a 2D plane. | Cross-layer mixing of distinct anatomical strata (e.g., cortical layers in brain tissue). | **Indistinguishable from true transcriptional heterogeneity** in a single 2D slice. |

### 1.3 Methodological Comparison: Computational Guarantees vs. Biological Ground Truth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WHAT BIOAGENT-ST VERIFIES                             │
│  [X] Arithmetic integrity (no NaNs, no illegal divisions, count positivity) │
│  [X] Graph connectivity & spot coordinate bounding                          │
│  [X] Pydantic parameter conformance & schema compliance                     │
│  [X] Cryptographic provenance (SHA-256 hash match on input/output)          │
│  [X] Deterministic execution replay under pinned random seeds               │
│  [X] Statistical rule thresholds (padj < 0.05, effect size > threshold)    │
│  [X] Absence of LLM-invented numbers or ungrounded claims in reports        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ DOES NOT IMPLY
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     WHAT BIOAGENT-ST CANNOT GUARANTEE                       │
│  [!] That an identified spatial niche corresponds to an in vivo cell type   │
│  [!] That spatial co-localization implies physical ligand-receptor binding  │
│  [!] That a statistically significant marker is not an ambient RNA artifact │
│  [!] That observed variance is biological rather than technical batch effect│
│  [!] That a published hypothesis will replicate across biological donors    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Clusters are NOT Cell Types (The Clustering Fallacy in Spatial Omics)

### 2.1 The Mathematical Nature of Unsupervised Graph Partitioning
Unsupervised community detection algorithms (e.g., Leiden: Traag, Waltman, & van Eck, 2019; Louvain: Blondel et al., 2008) partition a graph of spots or cells by maximizing modularity or optimizing a quality function over a nearest-neighbor network constructed in reduced-dimensional principal component space.

These algorithms are **variance-partitioning heuristics**, not cell-type detectors:
1. **Continuous vs. Discrete Biology:** Biological cell states, differentiation gradients, and spatial microenvironments frequently exhibit continuous phenotypic transitions. Graph partitioning algorithms force discrete boundaries onto inherently continuous biological phenomena (Kiselev et al., 2019; Luecken & Theis, 2019).
2. **Hyperparameter Sensitivity:** The number and composition of resulting clusters are directly dictated by user-selected parameters:
   - Clustering resolution ($\gamma$): Higher resolution yields more clusters; lower resolution merges distinct populations.
   - Neighborhood size ($k$): Dictates graph sparsity and sensitivity to local vs. global manifold structure.
   - Principal component selection ($n_{\text{pcs}}$): Determines which transcriptional variance axes are retained or discarded.
   - Distance metric and graph weighting: Radically alters neighborhood topology.

There is no objectively optimal resolution parameter in unsupervised clustering. A high modularity score or stable Adjusted Rand Index (ARI) demonstrates algorithmic stability, **not biological truth** (Freytag et al., 2018).

### 2.2 Spot-Level Resolution and Cellular Mixtures (10x Visium)
A critical limitation specific to spot-based spatial transcriptomics (e.g., 10x Genomics Visium) is spatial resolution:
* Standard 10x Visium capture spots measure **55 µm in diameter**, spaced with a **100 µm center-to-center pitch**.
* In mammalian tissues (e.g., human brain, liver, or solid tumors), each individual spot captures transcriptomic profiles from a mixture of **1 to 10+ individual cells**, often spanning distinct cell lineages (e.g., neurons, astrocytes, microglia, and vascular endothelial cells in a single spot) (Cable et al., 2022; Kleshchevnikov et al., 2022).

Consequently:
* An unsupervised cluster in 10x Visium represents a **repeated mixture profile or spatial microenvironment**, not a discrete single cell type.
* Equating a Visium cluster label (e.g., "Cluster 3") to an individual cell lineage (e.g., "Microglia") without reference-based single-cell deconvolution (e.g., RCTD, cell2location) or orthogonal spatial imaging is scientifically invalid.

### 2.3 The Circularity Fallacy in Post-Clustering Marker Detection
A pervasive methodological trap in single-cell and spatial omics literature—and one explicitly guarded against in BioAgent-ST (Skill §14)—is **circular post-clustering differential expression ("double dipping")**:
1. High-dimensional gene expression data are clustered using an unsupervised algorithm that maximizes transcriptional divergence between groups.
2. The exact same expression profiles are then tested to identify "differentially expressed marker genes" separating those clusters.
3. Because the clusters were defined specifically to maximize expression differences, standard null hypotheses are violated. Resulting $p$-values are systematically and artificially deflated toward zero ($p \to 0$), producing false confidence in marker specificity (Zhang et al., 2019; Neufeld et al., 2022).

In BioAgent-ST:
* Marker genes discovered via `find_markers` are treated strictly as **descriptive associations** summarizing the mathematical axes of partition.
* The system assigns a mandatory `circularity_flag: always` (see `configs/thresholds.yaml`) to all cluster-derived marker sets, prohibiting agents from framing them as independent statistical confirmations of cell identity.

### 2.4 Mandatory Orthogonal Validation Criteria
To advance a cluster from an exploratory mathematical partition to a biologically verified cell-type assignment, external evidence outside the transcriptomic sequencing slice is mandatory:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CELL-TYPE VALIDATION HIERARCHY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Level 0: Unsupervised Cluster (Leiden / Louvain)                            │
│          Status: Exploratory mathematical group. NOT a cell type.           │
│                                                                             │
│ Level 1: Computational Reference Deconvolution (RCTD, cell2location)        │
│          Status: Plausible spatial mixture hypothesis. Still in silico.     │
│                                                                             │
│ Level 2: Histological / Pathological Co-Registration (H&E, Nissl)           │
│          Status: Morphologically concordant tissue niche.                   │
│                                                                             │
│ Level 3: Orthogonal Targeted Validation (smFISH, MERFISH, CODEX/IMC, IF)    │
│          Status: Biologically validated cell type / spatial identity.       │
└─────────────────────────────────────────────────────────────────────────────┘
```

BioAgent-ST explicitly forbids automated reporting that claims Level 3 validation based solely on Level 0 clustering.

---

## 3. Thresholds are Technical and Heuristic (Not Universal Biological Constants)

Every numerical threshold codified in `configs/thresholds.yaml` represents an **operational engineering heuristic**, calibrated for specific sequencing protocols and tissue preparations. They are **not universal biological laws**.

```yaml
# configs/thresholds.yaml excerpt
provisional: true
qc:
  min_genes: 200
  min_cells: 3
  max_mito_pct: 20.0
cluster:
  min_cluster_size: 10
  stability_ari_min: 0.6
marker:
  min_group_size: 10
  max_padj: 0.05
  min_logfold_change: 1.0
spatial:
  min_mean_degree: 6
  max_moran_padj: 0.05
power:
  min_spots_per_group: 10
  max_zero_fraction: 0.95
```

### 3.1 Quality Control Cutoffs are Context-Dependent
* **`min_genes: 200`:**
  - Designed as a minimal floor to filter out empty capture spots, debris, or failure of reverse transcription in 10x Visium fresh-frozen assays.
  - In low-input single-cell technologies or highly degraded clinical samples, legitimate small quiescent cells (e.g., erythrocytes, resting naive lymphocytes) naturally express fewer than 200 distinct genes and would be erroneously discarded.
  - In ultra-deep sequencing, 200 genes is far too permissive, retaining severely damaged spots that bias normalization.
* **`max_mito_pct: 20.0`:**
  - In standard standard cell cultures or brain tissue, elevated mitochondrial percentage (> 20%) frequently indicates cell lysis, where cytoplasmic mRNA leaked through ruptured membranes while mitochondrial membranes remained intact (Luecken & Theis, 2019).
  - Conversely, in **high-metabolism tissues** such as cardiac myocardium or renal proximal tubular epithelium, healthy functioning cells physiologically allocate 30% to 50%+ of their transcriptional machinery to mitochondrial respiration (Olsen et al., 2021). Applying a rigid 20% cutoff to heart or kidney tissue selectively eliminates the most biologically active parenchyma.
* **Fresh-Frozen vs. FFPE (Formalin-Fixed Paraffin-Embedded) Discordance:**
  - FFPE preservation introduces severe formaldehyde-induced RNA-protein crosslinking, chemical mono-methylolation of bases, and extensive enzymatic RNA fragmentation (Janesick et al., 2023).
  - 10x Genomics Visium for FFPE utilizes targeted probe hybridization pairs rather than poly-A capture. As a consequence, UMI count distributions, mitochondrial proportions, and background noise profiles differ fundamentally from fresh-frozen tissue. Applying fresh-frozen thresholds to FFPE data leads to severe over-filtering or spurious artifact retention.

### 3.2 Spatial Autocorrelation Heuristics (Moran's $I$)
* **`max_moran_padj: 0.05` & `min_mean_degree: 6`:**
  - Moran's $I$ (Moran, 1950) quantifies spatial autocorrelation relative to a spatial weight matrix $W$.
  - Setting a fixed significance threshold ($p_{\text{adj}} < 0.05$) ignores the profound sensitivity of Moran's $I$ to spatial weight construction (e.g., Delaunay triangulation vs. fixed radius vs. $k$-nearest neighbors) (Bivand & Wong, 2018).
  - **Edge effects and geometry:** Spots at the boundary of a tissue slice have fewer spatial neighbors than central spots, inflating variance. Irregular tissue geometries, holes, ventricles, or non-convex boundaries distort the null distribution under spatial permutation testing.
  - High Moran's $I$ detects spatial clustering of expression; it does **not** identify whether the spatial pattern is driven by biological functional architecture, tissue thickness variations, or optical vignetting during permeabilization.

### 3.3 Cluster Stability Thresholds (Adjusted Rand Index)
* **`stability_ari_min: 0.6`:**
  - Codified as a provisional stability threshold across multi-seed Leiden runs.
  - An ARI $\ge 0.6$ indicates that stochastic graph partitioning produces relatively stable modularity partitions under seed perturbation.
  - However, high stability is easily achieved in datasets dominated by trivial technical artifacts (e.g., two distinct tissue slices on one slide, or severe bimodal library size variation). High algorithmic stability can merely reflect stable technical noise.

### 3.4 Power Proxies are Not Prospective Power Calculations
* **`min_spots_per_group: 10` & `max_zero_fraction: 0.95`:**
  - These parameters in `configs/thresholds.yaml` are explicitly **operational proxies** to prevent statistical tools from executing on degenerate empty sets.
  - They do **not** constitute a formal, prospective statistical power analysis (such as determining the sample size required to detect a log-fold change of 1.0 at 80% power given biological coefficient of variation $\sigma$).
  - A test passing `min_spots_per_group: 10` remains severely underpowered for detecting modest effect sizes or resolving low-abundance transcripts.

---

## 4. Routing, Policy Gates, and Agent Orchestration Boundaries

### 4.1 Safe Autonomy Boundaries (Not AGI or General Scientific Solvers)
BioAgent-ST is designed with defensive architectural boundaries (Amodei et al., 2016; Geifman & El-Yaniv, 2017). The system's routing mechanisms—the deterministic **Policy Gate** and the **Workflow Selector**—are safety firewalls designed to enforce strict containment. They are not general-purpose biological intelligence:

1. **Strictly Scoped to Canonical Workflows:**  
   The execution engine is intentionally constrained to three verified deterministic workflows:
   - `quality_assessment` (QC metrics, mitochondrial filtering, spot library profiling)
   - `spatial_clustering` (HVG selection, PCA, neighbor graph, Leiden clustering, stability checks)
   - `gene_expression` (spatial autocorrelation via Moran's $I$, marker discovery with circularity flags)
2. **Deterministic Abstention on Uncalibrated Capabilities:**  
   The policy gate strictly abstains from tasks outside its calibrated perimeter:
   - **Multi-Modal Omics:** Rejects spatial ATAC-seq, spatial proteomics (CODEX/CITE-seq), or spatial epigenomics queries because joint probabilistic likelihood models and verification rules have not been implemented.
   - **Causal and Mechanistic Inference:** Rejects queries claiming to prove direct molecular mechanisms, causal gene regulatory networks, or signaling cascades solely from static observational spatial correlations.
   - **Temporal Trajectory Dynamics:** Rejects queries claiming directed developmental time or RNA velocity without metabolic labeling or longitudinal multi-time-point experimental series.
   - **Clinical Decision Support:** Strictly refuses diagnostic, prognostic, or therapeutic treatment recommendations.

### 4.2 Abstention as a First-Class Scientific Outcome
In conventional LLM-based agent systems, the agent is incentivized to produce an answer regardless of data quality, leading to rampant confabulation, p-hacking, or hallucinated biological rationalizations.

In BioAgent-ST:
* **The Refusal Trap:** Naively refusing all queries achieves 100% precision (zero false claims) but zero utility. BioAgent-ST balances utility and safety by completing answerable canonical tasks on valid data, while formally abstaining on degraded, ambiguous, or out-of-scope inputs.
* **`indeterminate` and `unsupported` are Legitimate Findings:**  
  When data are degraded (e.g., high dropout, insufficient spots, high mitochondrial lysis), transitioning claims to `indeterminate` or `unsupported` is the correct scientific behavior. It communicates the true epistemic state: the available data lack the statistical resolution to support or reject the hypothesis.

---

## 5. Epistemic Status of the Evidence Ledger

The BioAgent-ST Evidence Ledger tracks claims across five discrete operational states: `supported`, `plausible`, `hypothesis`, `unsupported`, and `indeterminate`.

### 5.1 Operational States vs. Bayesian Posteriors
* **Categorical Heuristics, Not Probabilities:**  
  The five evidence states are **deterministic operational labels** assigned by the rule engine (`ClaimEvaluator`) based on threshold criteria and critic review. They do **not** represent calibrated Bayesian posterior probabilities $P(\text{Hypothesis is True} \mid \text{Data})$ of real-world biological truth.
* **The Downgrade-Only Critic Invariant:**  
  The system enforces the rule that an LLM Critic may only **downgrade** an evidence claim (e.g., from `supported` to `plausible` or `indeterminate`) or leave it unchanged; it is structurally barred from upgrading a claim beyond what deterministic statistical checks allow.
  - *What this guarantees:* The LLM cannot hallucinate statistical significance or promote unsupported assertions.
  - *What this does not guarantee:* It does not remove systematic bias, batch effects, or protocol misapplications present in the underlying data or tools. If the underlying data are flawed, a claim passing deterministic checks may still be biologically erroneous.

---

## 6. Summary of Scientific Warnings for Users and Reviewers

1. **Do not use BioAgent-ST for clinical, diagnostic, or therapeutic decision-making.** The system is an experimental computational framework for spatial transcriptomics data audibility.
2. **Do not cite Leiden cluster indices as biological cell types.** Clusters are variance partitions. Always validate identities using orthogonal single-cell references, histology, or targeted in situ hybridization.
3. **Do not accept marker p-values as independent statistical proofs.** Post-clustering differential expression is circular by construction. Reported markers are descriptive features of the partition.
4. **Inspect tissue-specific biology before adopting default thresholds.** Verify whether 20% mitochondrial cutoffs or 200-gene minimums are physiologically appropriate for your specific organ, protocol (fresh-frozen vs. FFPE), and technology.
5. **Remember that cryptographic replay proves computational determinism, not scientific veracity.** Reproducing the exact same numbers from the exact same matrix proves software reproducibility; it does not prove the absence of experimental or biological artifact.

---

## 7. Scientific References

* **Amodei, D., Olah, C., Steinhardt, J., Christiano, P., Schulman, J., & Mané, D.** (2016). Concrete problems in AI safety. *arXiv preprint arXiv:1606.06565*.
* **Baker, M.** (2016). 1,500 scientists lift the lid on reproducibility. *Nature*, 533(7604), 452-454.
* **Bivand, R. S., & Wong, D. W.** (2018). Comparing implementations of global and local indicators of spatial association. *TEST*, 27(3), 716-748.
* **Blondel, V. D., Guillaume, J. L., Lambiotte, R., & Lefebvre, E.** (2008). Fast unfolding of communities in large networks. *Journal of Statistical Mechanics: Theory and Experiment*, 2008(10), P10008.
* **Cable, D. M., Murray, E., Zou, L. S., Goeva, A., Macosko, E. Z., Chen, F., & Irizarry, R. A.** (2022). Robust decomposition of cell type mixtures in spatial transcriptomics. *Nature Biotechnology*, 40(4), 517-526.
* **Freytag, S., Tian, L., Lönnstedt, I., Ng, M., & Bahlo, M.** (2018). Comparison of clustering tools in R for medium-sized 10x Genomics single-cell RNA-sequencing data. *F1000Research*, 7, 1297.
* **Geifman, Y., & El-Yaniv, R.** (2017). Selective classification for deep neural networks. *Advances in Neural Information Processing Systems (NeurIPS)*, 30.
* **Heil, B. J., Hoffman, M. M., Markowetz, F., Lee, S. I., Greene, C. S., & Hicks, S. C.** (2021). Reproducibility standards for machine learning in the life sciences. *Nature Methods*, 18(10), 1132-1135.
* **Hubert, L., & Arabie, P.** (1985). Comparing partitions. *Journal of Classification*, 2(1), 193-218.
* **Janesick, A., Shelansky, R., Gottscho, A. D., Wagner, F., Rouault, M., Beliakoff, G., ... & He, P.** (2023). High-resolution mapping of the tumor microenvironment using spatial transcriptomics in FFPE tissue. *Nature Communications*, 14(1), 2414.
* **Kiselev, V. Y., Andrews, T. S., & Hemberg, M.** (2019). Challenges in unsupervised clustering of single-cell RNA-seq data. *Nature Reviews Genetics*, 20(5), 273-282.
* **Kleshchevnikov, V., Shmatko, A., Dann, E., Aivazidis, A., King, H. W., Li, T., ... & Bayraktar, O. A.** (2022). Cell2location maps fine-grained cell types in spatial transcriptomics. *Nature Biotechnology*, 40(5), 661-671.
* **Luecken, M. D., & Theis, F. J.** (2019). Current best practices in single-cell RNA-seq analysis: a tutorial. *Molecular Systems Biology*, 15(6), e8746.
* **Moran, P. A.** (1950). Notes on continuous stochastic phenomena. *Biometrika*, 37(1/2), 17-23.
* **Moses, L., & Pachter, L.** (2022). Museum of spatial transcriptomics. *Nature Methods*, 19(5), 534-546.
* **Neufeld, A., Dharamshi, A., Gao, L. L., & Witten, D.** (2022). Tree-based hypothesis testing for single-cell RNA-seq. *Biostatistics*, 25(1), 243–260.
* **Olsen, T. K., & Liang, H. E.** (2021). Fisher's exact test for single-cell RNA-seq marker evaluation. *Bioinformatics*, 37(9), 1221-1227.
* **Peng, R. D.** (2011). Reproducible research in computational science. *Science*, 334(6060), 1226-1227.
* **Traag, V. A., Waltman, L., & van Eck, N. J.** (2019). From Louvain to Leiden: guaranteeing well-connected communities. *Scientific Reports*, 9(1), 5233.
* **Zhang, J. M., Kamath, G. M., & Tse, D. N.** (2019). Valid post-clustering differential analysis for single-cell RNA-seq. *Cell Systems*, 9(4), 383-392.
