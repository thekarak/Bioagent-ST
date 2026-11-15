import json
from pathlib import Path

import pandas as pd

from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.reporting.models import (
    QuantitativeStatement,
    ReportFinding,
    ScientificReport,
    WorkflowEntry,
)
from bioagent_st.schemas.evidence import EvidenceRecord
from bioagent_st.schemas.plans import AnalysisPlan
from bioagent_st.schemas.provenance import ProvenanceRecord
from bioagent_st.utils.hashing import sha256_file, sha256_text


class ReportValidationError(ValueError):
    pass


def validate_report(
    report: ScientificReport,
    evidence_store: EvidenceStore | None,
    provenance_store: ProvenanceStore,
) -> None:
    if evidence_store is not None:
        for finding in report.findings:
            evidence = evidence_store.get(finding.evidence_id)
            if evidence is None:
                raise ReportValidationError(f"unknown evidence ID: {finding.evidence_id}")
            if evidence.state != finding.section:
                raise ReportValidationError(
                    f"finding section '{finding.section}' differs from "
                    f"ledger evidence state '{evidence.state}'"
                )

    checked_artifacts: set[str] = set()

    def _verify_artifact(artifact_id: str) -> None:
        if artifact_id in checked_artifacts:
            return
        record = provenance_store.get(artifact_id)
        if record is None:
            raise ReportValidationError(f"unknown artifact ID: {artifact_id}")
        path = Path(record.output_uri)
        if not path.exists():
            raise ReportValidationError(
                f"artifact file missing on disk: {record.output_uri} (ID: {artifact_id})"
            )
        actual_hash = sha256_file(path)
        if actual_hash != record.output_hash:
            raise ReportValidationError(
                f"artifact file hash mismatch on disk for {artifact_id}: "
                f"expected {record.output_hash}, got {actual_hash}"
            )
        checked_artifacts.add(artifact_id)

    for statement in report.quantitative_statements:
        _verify_artifact(statement.artifact_id)
    for entry in report.workflow:
        for artifact_id in entry.artifact_ids:
            _verify_artifact(artifact_id)


def _extract_quantitative_statements(
    provenance: list[ProvenanceRecord],
    evidence: list[EvidenceRecord],
) -> list[QuantitativeStatement]:
    statements: list[QuantitativeStatement] = []
    seen_keys: set[tuple[str, str]] = set()
    prov_by_id = {rec.artifact_id: rec for rec in provenance}

    # 1. Inspect physical artifact files on disk for deterministic metrics
    for record in provenance:
        file_path = Path(record.output_uri)
        if not file_path.is_file():
            continue

        art_type = record.artifact_type
        art_id = record.artifact_id

        try:
            if art_type in ("qc_table",) or file_path.name == "qc_table.csv":
                df = pd.read_csv(file_path)
                n_spots = len(df)
                if "passes_qc" in df.columns:
                    n_passed = int(df["passes_qc"].sum())
                    text = (
                        f"Quality assessment table records {n_spots} spots "
                        f"({n_passed} passing QC filter criteria)."
                    )
                else:
                    text = f"Quality assessment table records {n_spots} total spatial spots."
                key = (text, art_id)
                if key not in seen_keys:
                    seen_keys.add(key)
                    statements.append(QuantitativeStatement(text=text, artifact_id=art_id))

            elif art_type == "schema_report" or file_path.name == "schema_report.json":
                schema_data = json.loads(file_path.read_text(encoding="utf-8"))
                n_obs = schema_data.get("n_obs")
                n_vars = schema_data.get("n_vars")
                if n_obs is not None and n_vars is not None:
                    text = (
                        f"Dataset schema validation: {n_obs} observations across "
                        f"{n_vars} variables verified."
                    )
                    key = (text, art_id)
                    if key not in seen_keys:
                        seen_keys.add(key)
                        statements.append(QuantitativeStatement(text=text, artifact_id=art_id))

            elif art_type in ("cluster_table",) or file_path.name == "cluster_table.csv":
                df = pd.read_csv(file_path)
                n_clusters = len(df)
                largest = int(df["count"].max()) if "count" in df.columns else None
                if largest is not None:
                    text = (
                        f"Spatial clustering identified {n_clusters} discrete clusters "
                        f"(largest cluster: {largest} spots)."
                    )
                else:
                    text = f"Spatial clustering identified {n_clusters} discrete clusters."
                key = (text, art_id)
                if key not in seen_keys:
                    seen_keys.add(key)
                    statements.append(QuantitativeStatement(text=text, artifact_id=art_id))

            elif art_type in ("umap_coords",) or file_path.name == "umap_coords.csv":
                df = pd.read_csv(file_path)
                text = (
                    f"UMAP dimensionality reduction manifold computed for {len(df)} "
                    f"spots in 2 dimensions."
                )
                key = (text, art_id)
                if key not in seen_keys:
                    seen_keys.add(key)
                    statements.append(QuantitativeStatement(text=text, artifact_id=art_id))

            elif (
                art_type in ("spatial_autocorrelation",) or file_path.name == "spatial_autocorr.csv"
            ):
                df = pd.read_csv(file_path)
                for _, row in df.iterrows():
                    gene = str(row.get("gene", "target"))
                    moran_val = float(row.get("I", 0.0))
                    fdr_val = row.get(
                        "pval_sim_fdr_bh",
                        row.get("pval_norm_fdr_bh", row.get("FDR", 0.0)),
                    )
                    text = (
                        f"Spatial autocorrelation for {gene}: Moran's I = {moran_val:.3f} "
                        f"(FDR = {float(fdr_val):.3g})."
                    )
                    key = (text, art_id)
                    if key not in seen_keys:
                        seen_keys.add(key)
                        statements.append(QuantitativeStatement(text=text, artifact_id=art_id))

            elif art_type in ("expression_summary",) or file_path.name == "expression_summary.csv":
                df = pd.read_csv(file_path)
                for _, row in df.iterrows():
                    gene = str(row.get("resolved", row.get("gene", "target")))
                    mean_val = float(row.get("mean", 0.0))
                    zero_val = float(row.get("zero_fraction", 0.0))
                    text = (
                        f"Expression profile for {gene}: mean = {mean_val:.2f}, "
                        f"zero fraction = {zero_val:.1%}."
                    )
                    key = (text, art_id)
                    if key not in seen_keys:
                        seen_keys.add(key)
                        statements.append(QuantitativeStatement(text=text, artifact_id=art_id))

            elif art_type in ("qc_result",) or file_path.name == "qc.h5ad":
                text = (
                    "Preprocessed AnnData matrix with computed quality metrics and filtering masks."
                )
                key = (text, art_id)
                if key not in seen_keys:
                    seen_keys.add(key)
                    statements.append(QuantitativeStatement(text=text, artifact_id=art_id))

            elif art_type in ("clustering_result",) or file_path.name == "clustered.h5ad":
                text = (
                    "Clustered spatial dataset with neighborhood connectivity "
                    "graph and Leiden partitions."
                )
                key = (text, art_id)
                if key not in seen_keys:
                    seen_keys.add(key)
                    statements.append(QuantitativeStatement(text=text, artifact_id=art_id))

        except Exception:
            continue

    # 2. Extract verified quantitative metrics from evidence check results
    for ev in evidence:
        for chk in ev.checks:
            if chk.value is not None:
                chk_art_id: str | None = next(
                    (a for a in chk.artifact_ids if a in prov_by_id), None
                )
                if not chk_art_id:
                    chk_art_id = next((a for a in ev.supporting_artifacts if a in prov_by_id), None)
                if not chk_art_id:
                    chk_art_id = next((a for a in ev.provenance_ids if a in prov_by_id), None)
                if chk_art_id:
                    thresh_str = f", threshold={chk.threshold}" if chk.threshold is not None else ""
                    text = (
                        f"Check '{chk.check_id}': measured value={chk.value:.3f}"
                        f"{thresh_str} [{chk.status.upper()}]."
                    )
                    key = (text, chk_art_id)
                    if key not in seen_keys:
                        seen_keys.add(key)
                        statements.append(QuantitativeStatement(text=text, artifact_id=chk_art_id))

    return statements


def build_report(
    *,
    question: str,
    dataset_id: str,
    plan: AnalysisPlan,
    evidence: list[EvidenceRecord],
    provenance: list[ProvenanceRecord],
    artifact_ids_by_step: dict[str, list[str]] | None = None,
) -> ScientificReport:
    workflow = [
        WorkflowEntry(
            step_id=step.step_id,
            tool_name=step.tool_name,
            artifact_ids=(artifact_ids_by_step or {}).get(step.step_id, []),
        )
        for step in plan.steps
    ]
    findings = [
        ReportFinding(
            section=record.state,
            text=record.claim,
            evidence_id=record.evidence_id,
            claim_id=record.claim_id,
        )
        for record in evidence
    ]
    quantitative_statements = _extract_quantitative_statements(provenance, evidence)
    limitations = sorted({item for record in evidence for item in record.limitations})
    reproducibility = {
        "provenance_count": str(len(provenance)),
        "provenance_manifest_hash": sha256_text(
            "|".join(
                sorted(
                    f"{record.output_hash}:{Path(record.output_uri).name}" for record in provenance
                )
            )
        ),
    }
    return ScientificReport(
        question=question,
        dataset_id=dataset_id,
        findings=findings,
        workflow=workflow,
        quantitative_statements=quantitative_statements,
        limitations=limitations,
        reproducibility=reproducibility,
    )


def write_report(report: ScientificReport, path: str | Path) -> str:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# BioAgent-ST Validated Scientific Report",
        "",
        "## Question and dataset",
        f"Question: {report.question}",
        f"Dataset: {report.dataset_id}",
        "",
        "## Analysis workflow",
    ]
    if report.workflow:
        lines.append("| Step ID | Tool Name | Artifact IDs |")
        lines.append("|:---|:---|:---|")
        for entry in report.workflow:
            art_str = ", ".join(entry.artifact_ids) if entry.artifact_ids else "none"
            lines.append(f"| {entry.step_id} | `{entry.tool_name}` | {art_str} |")
        lines.append("")
    else:
        lines.extend(["Workflow: None.", ""])

    lines.append("## Findings by evidence state")
    for state in ("supported", "plausible", "hypothesis", "unsupported", "indeterminate"):
        lines.append(f"### {state.title()}")
        findings = [finding for finding in report.findings if finding.section == state]
        if not findings:
            lines.append("None.")
        for finding in findings:
            lines.append(f"- {finding.text} [evidence: {finding.evidence_id}]")
        lines.append("")

    if report.quantitative_statements:
        lines.append("## Quantitative measurements and verified artifacts")
        lines.append("| Quantitative Statement | Artifact ID |")
        lines.append("|:---|:---|")
        for q in report.quantitative_statements:
            lines.append(f"| {q.text} | `{q.artifact_id}` |")
        lines.append("")

    lines.extend(["## Limitations and assumptions", *[f"- {item}" for item in report.limitations]])
    lines.extend(
        [
            "",
            "## Reproducibility appendix",
            *[f"- {key}: {value}" for key, value in report.reproducibility.items()],
        ]
    )
    text = "\n".join(lines) + "\n"
    output.write_text(text, encoding="utf-8")
    return text
