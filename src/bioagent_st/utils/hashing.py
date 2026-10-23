import hashlib
from pathlib import Path
from typing import Any

import numpy as np
from anndata import AnnData
from scipy import sparse


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def sha256_text(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode('utf-8')).hexdigest()}"


def _update_array(digest: Any, array: np.ndarray) -> None:
    contiguous = np.ascontiguousarray(array)
    digest.update(str(contiguous.shape).encode())
    digest.update(str(contiguous.dtype).encode())
    digest.update(contiguous.tobytes())


def anndata_content_hash(adata: AnnData) -> str:
    digest = hashlib.sha256()
    digest.update("|".join(map(str, adata.shape)).encode())
    digest.update(b"\x00obs\x00")
    digest.update("\x00".join(map(str, adata.obs_names)).encode())
    digest.update(b"\x00var\x00")
    digest.update("\x00".join(map(str, adata.var_names)).encode())
    digest.update(b"\x00X\x00")

    if sparse.issparse(adata.X):
        matrix = adata.X.tocsr()
        digest.update(str(matrix.shape).encode())
        digest.update(matrix.data.tobytes())
        digest.update(matrix.indices.tobytes())
        digest.update(matrix.indptr.tobytes())
    else:
        _update_array(digest, np.asarray(adata.X))

    for key in sorted(adata.obsm):
        digest.update(f"\x00obsm:{key}\x00".encode())
        _update_array(digest, np.asarray(adata.obsm[key]))

    return f"sha256:{digest.hexdigest()}"
