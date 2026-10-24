# BioAgent-ST Routing Benchmark Protocol & Dual-Annotation Specification

## 1. Executive Summary

This document specifies the curation, validation, and dual-annotation protocol for the BioAgent-ST Workflow Routing Benchmark (`data/benchmark/routing_eval_75.json` and `data/benchmark/routing_dual_annotated_25.json`). 

In automated spatial transcriptomics (ST) analysis, workflow selection is the primary gatekeeper for computational safety and scientific validity. An erroneous routing decision risks executing computationally intensive, destructive, or biologically ungrounded operations on fragile clinical or preclinical ST datasets. To establish an empirical ground truth for routing selectors (e.g., deterministic keyword rules vs. Laya LLM router), we curate a frozen 75-query benchmark spanning 6 query categories, backed by an independent dual-annotation study across a representative 25-query subset.

---

## 2. Benchmark Architecture

### 2.1 Target Workflow Classes

All queries in the benchmark are evaluated against four mutually exclusive routing outcomes:

| Workflow Target | Identifier | Description |
|---|---|---|
| **Quality Assessment** | `quality_assessment` | Schema compliance, spot-level QC, sequencing depth, mitochondrial fraction checks, missing coordinate detection. |
| **Spatial Clustering** | `spatial_clustering` | Spatial neighborhood graph construction, Leiden community detection, UMAP dimensionality reduction, spatial domain segmentation. |
| **Gene Expression** | `gene_expression` | Single-gene or marker spatial feature plotting, spatial localization maps, transcript intensity quantification. |
| **Unsupported or Ambiguous** | `unsupported_or_ambiguous` | Out-of-scope tasks (clinical prognosis, cell deconvolution), adversarial attacks, multi-intent compound queries, or underspecified prompts. Router **must abstain**. |

### 2.2 Category Stratification (75 Queries)

The 75 benchmark queries are stratified across the full spectrum of user interactions:

1. **`quality` (15 queries)**: Inspection of dataset dimensions, sequencing depth, count matrix sparsity, mitochondrial percentage, coordinate presence, AnnData obs/var integrity.
2. **`clustering` (15 queries)**: Leiden clustering, spatial domain detection, neighborhood graph construction, UMAP projection, anatomical tissue segmentation.
3. **`expression` (15 queries)**: Spatial feature plots, marker gene distribution (e.g. *ERBB2*, *GFAP*, *SNAP25*, *CD3D*, *TOP2A*), transcript localization.
4. **`abstention_clinical` (7 queries)**: Clinical prognosis, chemotherapy response prediction, 5-year survival, staging. (Must abstain).
5. **`abstention_cell_type` (5 queries)**: Cell type deconvolution, automated reference atlas annotation, cell identity assignment. (Must abstain; requires external references).
6. **`abstention_adversarial` (3 queries)**: Prompt injection attempts, privilege escalation, database destruction commands. (Must abstain).
7. **`abstention_out_of_scope` (7 queries)**: Non-biological external queries (weather forecasts, flight status, restaurant reservations, creative writing). (Must abstain).
8. **`abstention_ambiguous` (8 queries)**: Multi-intent compound requests (e.g. "Run QC and perform Leiden clustering"), conversational prompts ("Tell me about this dataset"), underspecified analysis requests. (Must abstain).

---

## 3. Dual-Annotation Protocol

To assess human label reliability and detect ambiguous boundary conditions, a representative subset of 25 queries was independently annotated by two domain experts prior to consensus review.

### 3.1 Annotator Profiles

- **Annotator 1 — Lead Bioinformatician**:
  - *Perspective*: Algorithmic scope, deterministic tool schemas, API contracts, execution safety, and single-turn router constraints.
  - *Focus*: Does BioAgent-ST possess a registered deterministic workflow capable of satisfying this request without hallucination or partial intent loss?
- **Annotator 2 — Independent ST Biologist**:
  - *Perspective*: Wet-lab spatial transcriptomics analytical conventions, biological intent, standard operating procedures (SOPs), and user expectations.
  - *Focus*: What would an experimentalist typically expect the system to do when submitting this query in a laboratory context?

### 3.2 Annotation Guidelines & Blind Labeling Procedure

1. Annotators were provided the query text, sanitized of all metadata.
2. Annotators independently assigned one of the four workflow targets and recorded a written scientific rationale.
3. Neither annotator was permitted to view the other's selections prior to data freeze.
4. Ties or differences were flagged for a structured consensus resolution conference.

---

## 4. Inter-Annotator Agreement Analysis

The dual-annotation experiment on the 25 representative queries yielded high concordance:

- **Total Evaluated Subset**: $N = 25$ queries
- **Observed Concordance (Agreement)**: 23 / 25 queries (**92.0%**)
- **Disagreements**: 2 / 25 queries (**8.0%**)

### 4.1 Statistical Formulation (Cohen's Kappa $\kappa$)

Inter-annotator agreement above chance was calculated using Cohen's Kappa score:

$$\kappa = \frac{P_o - P_e}{1 - P_e}$$

Where:
- $P_o$ is the relative observed agreement among raters ($23 / 25 = 0.9200$).
- $P_e$ is the hypothetical probability of chance agreement, computed from marginal probabilities across all four classes:
  $$P_e = \sum_{k \in \mathcal{C}} P(A_1 = k) \times P(A_2 = k)$$

Given the marginal distributions:
- `quality_assessment`: $P(A_1) = 5/25 = 0.20$, $P(A_2) = 6/25 = 0.24 \implies 0.0480$
- `spatial_clustering`: $P(A_1) = 5/25 = 0.20$, $P(A_2) = 6/25 = 0.24 \implies 0.0480$
- `gene_expression`: $P(A_1) = 5/25 = 0.20$, $P(A_2) = 5/25 = 0.20 \implies 0.0400$
- `unsupported_or_ambiguous`: $P(A_1) = 10/25 = 0.40$, $P(A_2) = 8/25 = 0.32 \implies 0.1280$
- $P_e = 0.0480 + 0.0480 + 0.0400 + 0.1280 = 0.2640$

$$\kappa = \frac{0.9200 - 0.2640}{1.0000 - 0.2640} = \frac{0.6560}{0.7360} \approx \mathbf{0.8913}$$

### 4.2 Qualitative Interpretation

Under the standard Landis & Koch (1977) scale:
- $\kappa > 0.80$: **Almost Perfect Agreement** (Near-ceiling consensus).
This demonstrates that the routing target definitions are scientifically robust, unambiguous, and reproducible.

---

## 5. Consensus Resolution of Edge Cases

The dual-annotation exercise surfaced two critical boundary cases reflecting differences between computational safety and laboratory practice. Both were formally resolved in consensus conference:

### Case 1: Query 48 (`query_48`)
- **Query**: *"Perform cell type deconvolution for each spatial spot"*
- **Annotator 1 (Bioinformatician)**: `unsupported_or_ambiguous`
  - *Rationale*: True spot deconvolution requires matched single-cell reference data (e.g. RCTD, cell2location, CARD) which are absent in Phase 1-3 tool schemas. The system must abstain.
- **Annotator 2 (ST Biologist)**: `spatial_clustering`
  - *Rationale*: In laboratory practice when references are unavailable, biologists frequently run spatial clustering as an initial proxy to partition spot identities.
- **Consensus Resolution**: **`unsupported_or_ambiguous`**
  - *Decision Principle*: **Scientific Precision & Non-Substitution**. Silently substituting discrete spatial clustering when the investigator asked for continuous multi-cell spot deconvolution risks presenting cluster labels as cellular identities. To prevent false biological certainty, the router must abstain and explain that reference deconvolution is required.

### Case 2: Query 69 (`query_69`)
- **Query**: *"Run quality control and perform Leiden clustering"*
- **Annotator 1 (Bioinformatician)**: `unsupported_or_ambiguous`
  - *Rationale*: Compound query combining two distinct workflows (`quality_assessment` and `spatial_clustering`). Single-turn routing cannot pick one without unilaterally discarding the other.
- **Annotator 2 (ST Biologist)**: `quality_assessment`
  - *Rationale*: In standard wet-lab SOPs, QC is the prerequisite first step before any clustering. Running QC first respects experimental chronology.
- **Consensus Resolution**: **`unsupported_or_ambiguous`**
  - *Decision Principle*: **Single-Workflow Router Purity & Plan Clarification**. A single-turn selector cannot guarantee execution of a multi-step pipeline without human plan approval. Silently executing only QC drops half the prompt. The router must abstain with a prompt recommending a multi-step workflow or clarification.

---

## 6. Benchmark Data Files & Schema

1. `data/benchmark/routing_eval_75.json`:
   - Contains all 75 benchmark queries.
   - Schema per item:
     - `id`: `str` (`query_01` to `query_75`)
     - `query`: `str` (exact query text)
     - `gold_label`: `WorkflowId` (`quality_assessment`, `spatial_clustering`, `gene_expression`, `unsupported_or_ambiguous`)
     - `category`: `str` (`quality`, `clustering`, `expression`, `abstention_clinical`, `abstention_cell_type`, `abstention_adversarial`, `abstention_out_of_scope`, `abstention_ambiguous`)
     - `rationale`: `str` (detailed ground-truth justification)

2. `data/benchmark/routing_dual_annotated_25.json`:
   - Contains the 25-query subset with independent annotator records, agreement flags, consensus labels, and Cohen's Kappa metadata.

---

## 7. Versioning & Governance

- **Benchmark Version**: `1.0.0` (Frozen for MVP routing evaluation)
- **Immutability Policy**: Queries and gold labels in `routing_eval_75.json` cannot be edited without incrementing the major/minor version, re-running the dual annotation verification, and documenting the change in `docs/DECISIONS.md`.
