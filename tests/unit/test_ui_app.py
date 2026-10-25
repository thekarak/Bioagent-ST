"""Unit tests for Streamlit UI helpers and upload configuration."""

import io
from pathlib import Path

from apps.ui.app import (
    MAX_UPLOAD_SIZE_BYTES,
    MAX_UPLOAD_SIZE_MB,
    evaluate_gate_preview,
    execute_pipeline,
    get_available_datasets,
    get_dataset_gene_names,
    instantiate_selector,
    list_prior_runs,
    save_uploaded_stream,
    validate_upload_size,
)
from bioagent_st.fixtures import create_spatial_fixture
from bioagent_st.routing import ManualSelector, RuleSelector


def test_ui_get_available_datasets() -> None:
    catalog = get_available_datasets()
    assert "synthetic" in catalog
    assert catalog["synthetic"]["available"] is True
    assert "upload" in catalog


def test_ui_instantiate_selector() -> None:
    manual = instantiate_selector("manual", "spatial_clustering")
    assert isinstance(manual, ManualSelector)
    rule = instantiate_selector("rules", None)
    assert isinstance(rule, RuleSelector)


def test_ui_evaluate_gate_preview_allow() -> None:
    decision, gate = evaluate_gate_preview("manual", "Cluster spots", "spatial_clustering")
    assert decision.decision == "spatial_clustering"
    assert gate.decision == "ALLOW"
    assert not gate.requires_human_review


def test_ui_list_prior_runs(tmp_path: Path) -> None:
    del tmp_path
    runs = list_prior_runs()
    assert isinstance(runs, list)


def test_ui_max_upload_size_configured() -> None:
    assert MAX_UPLOAD_SIZE_MB == 500
    assert MAX_UPLOAD_SIZE_BYTES == 500 * 1024 * 1024

    # Verify .streamlit/config.toml exists and has maxUploadSize = 500
    config_path = Path(".streamlit/config.toml")
    assert config_path.is_file()
    content = config_path.read_text(encoding="utf-8")
    assert "maxUploadSize = 500" in content


def test_ui_validate_upload_size() -> None:
    # 250 MB -> valid
    valid_ok, valid_msg = validate_upload_size(250 * 1024 * 1024)
    assert valid_ok is True
    assert valid_msg == "OK"

    # Exactly 500 MB -> valid
    valid_limit_ok, valid_limit_msg = validate_upload_size(500 * 1024 * 1024)
    assert valid_limit_ok is True
    assert valid_limit_msg == "OK"

    # 501 MB -> invalid
    invalid_ok, invalid_msg = validate_upload_size(501 * 1024 * 1024)
    assert invalid_ok is False
    assert "exceeds maximum supported limit of 500 MB" in invalid_msg


def test_ui_save_uploaded_stream(tmp_path: Path) -> None:
    target = tmp_path / "streamed_test.bin"
    dummy_data = b"STREAMED_CHUNK_TEST_DATA_" * 1024
    stream = io.BytesIO(dummy_data)
    bytes_written = save_uploaded_stream(stream, target)

    assert bytes_written == len(dummy_data)
    assert target.is_file()
    assert target.read_bytes() == dummy_data


def test_ui_get_dataset_gene_names_synthetic() -> None:
    genes = get_dataset_gene_names("synthetic")
    assert isinstance(genes, list)
    assert len(genes) == 500
    assert "GENE_0000" in genes
    assert "GENE_0020" in genes


def test_ui_get_dataset_gene_names_manual_upload(tmp_path: Path) -> None:
    adata = create_spatial_fixture(seed=99)
    adata.var_names = [f"CUSTOM_GENE_{i}" for i in range(adata.n_vars)]
    upload_file = tmp_path / "custom_genes.h5ad"
    adata.write_h5ad(upload_file)

    genes = get_dataset_gene_names("upload", custom_file_path=upload_file)
    assert len(genes) == 500
    assert "CUSTOM_GENE_0" in genes
    assert "GENE_0000" not in genes


def test_ui_get_dataset_gene_names_missing_file() -> None:
    genes = get_dataset_gene_names("upload", custom_file_path=Path("non_existent.h5ad"))
    assert genes == []


def test_ui_execute_pipeline_parameter_mismatch_resilience() -> None:
    # Test 1: User passes QC parameters in rules mode, query routes to spatial_clustering
    qc_params = {
        "min_genes": 200,
        "min_counts": 500,
        "min_cells": 3,
        "max_mito_pct": 20.0,
        "mito_prefix": "MT-",
    }
    rec_cluster = execute_pipeline(
        dataset_key="synthetic",
        custom_file_path=None,
        question="Show spatial clusters based on expression patterns",
        selector_kind="rules",
        target_workflow=None,
        parameters=qc_params,
    )
    assert rec_cluster["workflow"] == "spatial_clustering"
    assert "clustering" in rec_cluster["parameters"]
    assert rec_cluster["validation_status"] == "passed"

    # Test 2: User passes QC parameters in rules mode, query routes to gene_expression
    rec_expr = execute_pipeline(
        dataset_key="synthetic",
        custom_file_path=None,
        question="Show spatial expression of GENE_0000",
        selector_kind="rules",
        target_workflow=None,
        parameters=qc_params,
    )
    assert rec_expr["workflow"] == "gene_expression"
    assert "genes" in rec_expr["parameters"]
    assert len(rec_expr["parameters"]["genes"]) >= 1
    assert rec_expr["validation_status"] == "passed"

    # Test 3: Quality assessment with partial parameters merges defaults cleanly
    rec_qc = execute_pipeline(
        dataset_key="synthetic",
        custom_file_path=None,
        question="Assess data quality and filter low count spots.",
        selector_kind="manual",
        target_workflow="quality_assessment",
        parameters={"min_genes": 100},
    )
    assert rec_qc["workflow"] == "quality_assessment"
    assert rec_qc["parameters"]["min_genes"] == 100
    assert rec_qc["parameters"]["min_counts"] == 0
    assert rec_qc["validation_status"] == "passed"
