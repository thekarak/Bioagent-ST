import hashlib
import json
import urllib.request
from pathlib import Path

URL = "https://ndownloader.figshare.com/files/39055556"
EXPECTED_SIZE = 104_314_118
EXPECTED_MD5 = "9c1d950fcaadb6a39e5194621482aaa1"
EXPECTED_SHA256 = "fd588ae557dd16d0940600676a2fa0a45718696eab233197aec44140f0046315"
OUTPUT = Path("data/raw/real/dlpfc/151507.h5ad")


def file_md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if not OUTPUT.exists() or OUTPUT.stat().st_size != EXPECTED_SIZE:
        urllib.request.urlretrieve(URL, OUTPUT)
    if OUTPUT.stat().st_size != EXPECTED_SIZE:
        raise RuntimeError("downloaded file size does not match Figshare metadata")
    if file_md5(OUTPUT) != EXPECTED_MD5:
        raise RuntimeError("downloaded file MD5 does not match Figshare metadata")
    manifest = {
        "dataset_id": "libd_dlpfc_151507_v2",
        "source": "Varrone, Marco (2023), Figshare",
        "source_url": "https://doi.org/10.6084/m9.figshare.22004273.v2",
        "version": "2",
        "license": "CC BY 4.0",
        "sha256": f"sha256:{EXPECTED_SHA256}",
        "modality": "visium",
        "platform": "10x Genomics Visium",
        "preprocessing_state": "preprocessed integer-like expression matrix",
        "known_limitations": [
            "Human postmortem DLPFC section; not a disease-treatment experiment",
            "Layer labels are study annotations, not cell-type identity claims",
            "Spatial proximity does not establish interaction",
        ],
        "tissue": "dorsolateral prefrontal cortex",
        "organism": "Homo sapiens",
        "label_columns": ["sce.layer_guess"],
        "citation": "Maynard et al. (2021), doi:10.1038/s41593-020-00787-0",
        "notes": "Downloaded but never committed; reproduce with scripts/download_dlpfc.py",
    }
    path = Path("data/manifests/libd_dlpfc_151507.yaml")
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"ready: {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
