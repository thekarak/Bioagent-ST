from bioagent_st.schemas.evidence import CheckResult
from bioagent_st.verification.rules import decide_state


def passing(check_id: str, severity: str = "hard") -> CheckResult:
    return CheckResult(check_id=check_id, status="pass", severity=severity)


def warning(check_id: str) -> CheckResult:
    return CheckResult(check_id=check_id, status="warn", severity="soft")


def failing(check_id: str) -> CheckResult:
    return CheckResult(check_id=check_id, status="fail", severity="hard")


def test_supported_when_required_hard_checks_pass() -> None:
    decision = decide_state(
        "cluster_reproducible",
        [passing("cluster.stability.ari"), passing("cluster.min_size"), passing("qc.pass")],
    )

    assert decision.state == "supported"


def test_plausible_when_multiple_soft_warnings_remain() -> None:
    decision = decide_state(
        "cluster_reproducible",
        [
            passing("cluster.stability.ari"),
            passing("cluster.min_size"),
            passing("qc.pass"),
            warning("stat.power_proxy"),
            warning("data.dropout"),
        ],
    )

    assert decision.state == "plausible"


def test_hypothesis_only_for_explicit_extrapolation() -> None:
    checks = [passing("cluster.stability.ari"), passing("cluster.min_size"), passing("qc.pass")]

    assert decide_state("cluster_reproducible", checks).state == "supported"
    assert (
        decide_state("cluster_reproducible", checks, origin="extrapolation").state == "hypothesis"
    )


def test_unsupported_when_contradicting_marker_fdr_fails() -> None:
    decision = decide_state(
        "marker_specific",
        [
            passing("marker.effect_size"),
            failing("marker.fdr"),
            passing("marker.group_size"),
            passing("marker.consistency_resolution"),
            CheckResult(check_id="marker.circularity_flag", status="warn", severity="soft"),
        ],
    )

    assert decision.state == "unsupported"


def test_indeterminate_when_required_check_is_missing() -> None:
    decision = decide_state(
        "cluster_reproducible", [passing("cluster.min_size"), passing("qc.pass")]
    )

    assert decision.state == "indeterminate"


def test_indeterminate_when_check_errors_or_provenance_fails() -> None:
    error = CheckResult(check_id="cluster.stability.ari", status="error", severity="hard")
    assert decide_state("cluster_reproducible", [error]).state == "indeterminate"

    integrity = [
        passing("cluster.stability.ari"),
        passing("cluster.min_size"),
        passing("qc.pass"),
        failing("prov.hashes_match"),
    ]
    assert decide_state("cluster_reproducible", integrity).state == "indeterminate"


def test_all_five_states_are_reachable() -> None:
    states = {
        decide_state(
            "cluster_reproducible",
            [passing("cluster.stability.ari"), passing("cluster.min_size"), passing("qc.pass")],
        ).state,
        decide_state(
            "cluster_reproducible",
            [
                passing("cluster.stability.ari"),
                passing("cluster.min_size"),
                passing("qc.pass"),
                warning("a"),
                warning("b"),
            ],
        ).state,
        decide_state(
            "cluster_reproducible",
            [passing("cluster.stability.ari"), passing("cluster.min_size"), passing("qc.pass")],
            origin="extrapolation",
        ).state,
        decide_state(
            "marker_specific",
            [
                passing("marker.effect_size"),
                failing("marker.fdr"),
                passing("marker.group_size"),
                passing("marker.consistency_resolution"),
                warning("marker.circularity_flag"),
            ],
        ).state,
        decide_state("cluster_reproducible", [passing("cluster.min_size")]).state,
    }

    assert states == {"supported", "plausible", "hypothesis", "unsupported", "indeterminate"}
