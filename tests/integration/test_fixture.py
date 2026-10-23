from anndata import read_h5ad

from bioagent_st.fixtures import create_spatial_fixture, write_fixture
from bioagent_st.schemas.datasets import DatasetManifest
from bioagent_st.utils.hashing import anndata_content_hash, sha256_file


def test_spatial_fixture_has_required_structure(tmp_path) -> None:
    path = tmp_path / "fixture.h5ad"
    write_fixture(path)

    adata = read_h5ad(path)

    assert adata.shape == (300, 500)
    assert "spatial" in adata.obsm
    assert adata.obs_names.is_unique
    assert adata.var_names.is_unique
    assert set(adata.obs["domain_truth"]) == {"left", "middle", "right"}
    assert adata.X.min() >= 0


def test_spatial_fixture_is_content_deterministic() -> None:
    first = create_spatial_fixture(seed=17)
    second = create_spatial_fixture(seed=17)

    assert anndata_content_hash(first) == anndata_content_hash(second)


def test_dataset_manifest_requires_checksum(tmp_path) -> None:
    path = tmp_path / "fixture.h5ad"
    checksum = write_fixture(path)
    manifest = DatasetManifest(
        dataset_id="fixture_spatial_v1",
        source="BioAgent-ST deterministic generator",
        version="1.0.0",
        license="CC0-1.0",
        sha256=checksum,
        modality="generic_spatial",
        platform="synthetic_grid",
        preprocessing_state="raw integer-like counts",
        known_limitations=["Synthetic data only", "Not biological evidence"],
        seed=0,
    )

    assert manifest.sha256 == sha256_file(path)
    assert manifest.modality == "generic_spatial"
