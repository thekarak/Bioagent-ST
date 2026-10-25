from bioagent_st.schemas.evidence import CheckResult
from bioagent_st.verification.rules import evidence_from_checks


def test_cluster_claim_produces_persisted_evidence() -> None:
    checks = [
        CheckResult(check_id="cluster.stability.ari", status="pass", severity="hard"),
        CheckResult(check_id="cluster.min_size", status="pass", severity="hard"),
        CheckResult(check_id="qc.pass", status="pass", severity="hard"),
    ]

    evidence = evidence_from_checks(
        experiment_id="exp_001",
        claim_id="clm_cluster_001",
        claim="Clustering identifies stable groups.",
        claim_type="cluster_reproducible",
        checks=checks,
        supporting_artifacts=["art_cluster_001"],
        provenance_ids=["art_cluster_001"],
    )

    assert evidence.state == "supported"
    assert evidence.rule_state == "supported"
    assert evidence.state_source == "rule_engine"


def test_marker_claim_records_circularity_limitation() -> None:
    checks = [
        CheckResult(check_id="marker.effect_size", status="pass", severity="hard"),
        CheckResult(check_id="marker.fdr", status="pass", severity="hard"),
        CheckResult(check_id="marker.group_size", status="pass", severity="hard"),
        CheckResult(check_id="marker.consistency_resolution", status="pass", severity="hard"),
        CheckResult(check_id="marker.circularity_flag", status="warn", severity="soft"),
    ]

    evidence = evidence_from_checks(
        experiment_id="exp_001",
        claim_id="clm_marker_001",
        claim="Gene G is associated with cluster C.",
        claim_type="marker_specific",
        checks=checks,
        supporting_artifacts=["art_markers_001"],
        provenance_ids=["art_markers_001"],
        limitations=["Markers and clusters derive from the same expression matrix."],
    )

    assert evidence.state == "supported"
    assert evidence.limitations
    assert evidence.checks[-1].check_id == "marker.circularity_flag"


def test_qc_pass_claim_supported_when_all_checks_pass() -> None:
    checks = [
        CheckResult(check_id="qc.pass", status="pass", severity="hard"),
        CheckResult(check_id="data.min_obs", status="pass", severity="hard"),
        CheckResult(check_id="data.no_nans", status="pass", severity="hard"),
        CheckResult(check_id="data.duplicate_ids", status="pass", severity="hard"),
    ]

    evidence = evidence_from_checks(
        experiment_id="exp_001",
        claim_id="clm_qc_pass",
        claim="Dataset passed quality control checks.",
        claim_type="qc_pass",
        checks=checks,
        supporting_artifacts=["art_qc_001"],
        provenance_ids=["art_qc_001"],
    )

    assert evidence.state == "supported"
    assert evidence.rule_state == "supported"
    assert evidence.state_source == "rule_engine"


def test_qc_pass_claim_unsupported_when_qc_pass_fails() -> None:
    checks = [
        CheckResult(check_id="qc.pass", status="fail", severity="hard"),
        CheckResult(check_id="data.min_obs", status="pass", severity="hard"),
        CheckResult(check_id="data.no_nans", status="pass", severity="hard"),
        CheckResult(check_id="data.duplicate_ids", status="pass", severity="hard"),
    ]

    evidence = evidence_from_checks(
        experiment_id="exp_001",
        claim_id="clm_qc_pass",
        claim="Dataset failed quality control requirements.",
        claim_type="qc_pass",
        checks=checks,
        supporting_artifacts=["art_qc_001"],
        provenance_ids=["art_qc_001"],
    )

    assert evidence.state == "unsupported"


def test_qc_pass_claim_indeterminate_when_required_check_missing() -> None:
    checks = [
        CheckResult(check_id="qc.pass", status="pass", severity="hard"),
        CheckResult(check_id="data.min_obs", status="pass", severity="hard"),
    ]

    evidence = evidence_from_checks(
        experiment_id="exp_001",
        claim_id="clm_qc_pass",
        claim="Dataset quality indeterminate.",
        claim_type="qc_pass",
        checks=checks,
        supporting_artifacts=["art_qc_001"],
        provenance_ids=["art_qc_001"],
    )

    assert evidence.state == "indeterminate"
