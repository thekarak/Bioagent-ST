import hashlib
import urllib.request
from pathlib import Path

URL = "https://ndownloader.figshare.com/files/39055568"
EXPECTED_SIZE = 120_647_211
EXPECTED_MD5 = "b9c4619f9ddd3398e1ab098a8a0266e3"
EXPECTED_SHA256 = "fdbff7911f485e38daf4d8850f0b0bf3a38bd94510c651c6a33d310b718b2696"
OUTPUT = Path("data/raw/real/dlpfc/151673.h5ad")


def file_hash(path: Path, algorithm: str) -> str:
    digest = hashlib.new(algorithm)
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
    if file_hash(OUTPUT, "md5") != EXPECTED_MD5:
        raise RuntimeError("downloaded file MD5 does not match Figshare metadata")
    if file_hash(OUTPUT, "sha256") != EXPECTED_SHA256:
        raise RuntimeError("downloaded file SHA-256 does not match local manifest")
    print(f"ready: {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
