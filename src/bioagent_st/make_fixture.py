from pathlib import Path

from bioagent_st.fixtures import write_fixture
from bioagent_st.schemas.datasets import DatasetManifest


def main() -> None:
    fixture_path = Path("data/fixtures/synthetic_spatial_300x500.h5ad")
    manifest_path = Path("data/manifests/synthetic_spatial_300x500.yaml")
    checksum = write_fixture(fixture_path)
    manifest = DatasetManifest(
        dataset_id="synthetic_spatial_300x500",
        source="BioAgent-ST deterministic generator",
        version="1.0.0",
        license="CC0-1.0",
        sha256=checksum,
        modality="generic_spatial",
        platform="synthetic_grid",
        preprocessing_state="raw integer-like counts",
        known_limitations=[
            "Synthetic data for software testing only",
            "Spatial domains are planted ground truth and not biological evidence",
            "Marker genes are planted and do not represent real biology",
        ],
        seed=0,
        notes="Regenerate with `uv run python -m bioagent_st.make_fixture`.",
    )
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
    print(f"Wrote {fixture_path} ({fixture_path.stat().st_size} bytes)")
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
