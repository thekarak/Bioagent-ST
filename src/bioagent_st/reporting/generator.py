from pathlib import Path

from bioagent_st.ledger.evidence_store import EvidenceStore
from bioagent_st.ledger.provenance_store import ProvenanceStore
from bioagent_st.reporting.models import ReportFinding, ScientificReport, WorkflowEntry
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
        limitations=limitations,
        reproducibility=reproducibility,
    )


def write_report(report: ScientificReport, path: str | Path) -> str:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# BioAgent-ST report",
        "",
        "## Question and dataset",
        f"Question: {report.question}",
        f"Dataset: {report.dataset_id}",
        "",
        "## Findings by evidence state",
    ]
    for state in ("supported", "plausible", "hypothesis", "unsupported", "indeterminate"):
        lines.append(f"### {state.title()}")
        findings = [finding for finding in report.findings if finding.section == state]
        if not findings:
            lines.append("None.")
        for finding in findings:
            lines.append(f"- {finding.text} [evidence: {finding.evidence_id}]")
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
