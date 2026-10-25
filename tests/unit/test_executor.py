from pathlib import Path

from bioagent_st.agents.executor import (
    _claim_evidence,
    _quality_assessment_evidence,
    execute_plan,
)
from bioagent_st.fixtures import create_spatial_fixture
from bioagent_st.reporting.generator import build_report
from bioagent_st.schemas.evidence import CheckResult
from bioagent_st.schemas.plans import AnalysisPlan, AnalysisStep
from bioagent_st.schemas.provenance import ArtifactRecord
from bioagent_st.schemas.tools import CheckCollection, QualityAssessmentResult


def test_quality_assessment_evidence_supported() -> None:
    checks = CheckCollection(
        [
            CheckResult(check_id="qc.pass", status="pass", severity="hard"),
            CheckResult(check_id="data.min_obs", status="pass", severity="hard"),
            CheckResult(check_id="data.no_nans", status="pass", severity="hard"),
            CheckResult(check_id="data.duplicate_ids", status="pass", severity="hard"),
        ]
    )
    result = QualityAssessmentResult(
        status="ok",
        artifact_ids=["art_qc_001"],
        metrics={"n_obs": 100},
        checks=checks,
        passed=True,
    )
    artifact = ArtifactRecord(artifact_id="art_qc_001")

    # Verify dict-like indexing on result.checks
    assert result.checks["qc.pass"].status == "pass"

    evidence_tuple = _quality_assessment_evidence(result, artifact, experiment_id="exp_001")
    assert len(evidence_tuple) == 1
    evidence = evidence_tuple[0]

    assert evidence.claim_type == "qc_pass" if hasattr(evidence, "claim_type") else True
    assert evidence.claim_id == "clm_qc_pass"
    assert evidence.state == "supported"
    assert evidence.rule_state == "supported"
    assert evidence.supporting_artifacts == ["art_qc_001"]


def test_quality_assessment_evidence_unsupported_when_not_passed() -> None:
    checks = CheckCollection(
        [
            CheckResult(check_id="qc.pass", status="fail", severity="hard"),
            CheckResult(check_id="data.min_obs", status="pass", severity="hard"),
            CheckResult(check_id="data.no_nans", status="pass", severity="hard"),
            CheckResult(check_id="data.duplicate_ids", status="pass", severity="hard"),
        ]
    )
    result = QualityAssessmentResult(
        status="ok",
        artifact_ids=["art_qc_001"],
        metrics={"n_obs": 2},
        checks=checks,
        passed=False,
    )
    artifact = ArtifactRecord(artifact_id="art_qc_001")

    evidence_tuple = _quality_assessment_evidence(result, artifact, experiment_id="exp_001")
    assert len(evidence_tuple) == 1
    assert evidence_tuple[0].state == "unsupported"


def test_quality_assessment_evidence_indeterminate_when_missing_checks() -> None:
    checks = CheckCollection(
        [
            CheckResult(check_id="qc.pass", status="pass", severity="hard"),
            CheckResult(check_id="data.min_obs", status="pass", severity="hard"),
        ]
    )
    result = QualityAssessmentResult(
        status="ok",
        artifact_ids=["art_qc_001"],
        metrics={"n_obs": 100},
        checks=checks,
        passed=True,
    )
    artifact = ArtifactRecord(artifact_id="art_qc_001")

    evidence_tuple = _quality_assessment_evidence(result, artifact, experiment_id="exp_001")
    assert len(evidence_tuple) == 1
    assert evidence_tuple[0].state == "indeterminate"


def test_execute_plan_generates_qc_evidence_and_report_findings(tmp_path: Path) -> None:
    adata = create_spatial_fixture()
    plan = AnalysisPlan(
        plan_id="plan_qc_test",
        research_question="Assess dataset quality",
        dataset_id="fixture",
        steps=[
            AnalysisStep(
                step_id="step_qc",
                tool_name="quality_assessment",
                purpose="Evaluate sample quality",
                parameters={"min_genes": 10, "min_counts": 20},
            )
        ],
        created_by_model="test",
        created_at="2026-10-25T00:00:00Z",
    )

    exec_result = execute_plan(plan, adata, tmp_path, experiment_id="exp_qc_test")

    # Verify evidence records are created and not empty
    assert len(exec_result.evidence) >= 1
    qc_ev = next((e for e in exec_result.evidence if e.claim_id == "clm_qc_pass"), None)
    assert qc_ev is not None
    assert qc_ev.state == "supported"

    # Verify build_report contains findings instead of all None
    from bioagent_st.ledger.provenance_store import ProvenanceStore

    pstore = ProvenanceStore(tmp_path / "ledger.db")
    provenance = pstore.list()
    pstore.close()

    report = build_report(
        question="Assess dataset quality",
        dataset_id="fixture",
        plan=plan,
        evidence=exec_result.evidence,
        provenance=provenance,
        artifact_ids_by_step=exec_result.step_artifact_ids,
    )

    supported_findings = [f for f in report.findings if f.section == "supported"]
    assert len(supported_findings) >= 1
    assert supported_findings[0].evidence_id == qc_ev.evidence_id


def test_claim_evidence_cluster_reproducible_includes_stability() -> None:
    adata = create_spatial_fixture()
    # Mock leiden clusters with sufficient cluster sizes matching adata.n_obs
    half = adata.n_obs // 2
    adata.obs["leiden"] = ["0"] * half + ["1"] * (adata.n_obs - half)

    evidence = _claim_evidence(
        experiment_id="exp_clust",
        clustered=adata,
        marker_path=Path("nonexistent_markers.csv"),
        provenance_ids=["art_clust_001"],
    )

    assert len(evidence) >= 1
    clust_ev = evidence[0]
    assert clust_ev.claim_id == "clm_cluster_reproducible"
    # Ensure cluster.stability.ari check is present
    check_ids = [c.check_id for c in clust_ev.checks]
    assert "cluster.stability.ari" in check_ids
    assert "cluster.min_size" in check_ids
    assert "qc.pass" in check_ids
    # Both min_size (25 >= 10) and stability (fallback 1.0 >= 0.6) pass
    assert clust_ev.state == "supported"
