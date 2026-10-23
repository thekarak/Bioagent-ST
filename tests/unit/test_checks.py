from bioagent_st.fixtures import create_spatial_fixture
from bioagent_st.verification.checks import (
    counts_available_check,
    duplicate_id_check,
    marker_circularity_check,
    marker_fdr_check,
    min_observation_check,
    spatial_coordinate_check,
)
from bioagent_st.verification.claim_types import required_checks


def test_claim_type_registry_has_only_initial_claim_types() -> None:
    assert set(required_checks("cluster_reproducible")) == {
        "cluster.stability.ari",
        "cluster.min_size",
        "qc.pass",
    }
    assert "cell_type_identity" not in {
        "cluster_reproducible",
        "marker_specific",
        "spatial_domain_coherent",
        "spatial_pattern_gene",
    }


def test_data_checks_are_pure_and_pass_for_valid_spatial_adata() -> None:
    adata = create_spatial_fixture()

    assert adata.var_names[0] == "GENE_0000"
    assert min_observation_check(adata).status == "pass"
    assert spatial_coordinate_check(adata).status == "pass"
    assert duplicate_id_check(adata).status == "pass"
    assert counts_available_check(adata).status == "pass"


def test_checks_reject_invalid_inputs() -> None:
    adata = create_spatial_fixture()
    del adata.obsm["spatial"]

    assert spatial_coordinate_check(adata).status == "fail"
    assert min_observation_check(adata, minimum=301).status == "fail"


def test_circularity_is_always_soft_warning() -> None:
    check = marker_circularity_check()

    assert check.status == "warn"
    assert check.severity == "soft"


def test_marker_fdr_direction_is_tested() -> None:
    assert marker_fdr_check(0.01, 0.05).status == "pass"
    assert marker_fdr_check(0.2, 0.05).status == "fail"


def test_thresholds_are_marked_provisional() -> None:
    from bioagent_st.verification.config import load_thresholds

    config = load_thresholds()

    assert config.provisional is True
    assert config.get("marker", "max_padj") == 0.05
