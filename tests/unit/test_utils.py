import re

import numpy as np
import pytest

from bioagent_st.utils.hashing import sha256_file
from bioagent_st.utils.ids import new_id
from bioagent_st.utils.seeding import set_all_seeds


def test_new_id_is_sortable_and_prefixed() -> None:
    first = new_id("art_qc", clock=lambda: 1_700_000_000)
    second = new_id("art_qc", clock=lambda: 1_700_000_001)

    assert first < second
    assert re.fullmatch(r"art_qc_\d{8}T\d{6}Z_[0-9a-f]{6}", first)


def test_sha256_file_detects_content(tmp_path) -> None:
    first = tmp_path / "first.txt"
    second = tmp_path / "second.txt"
    first.write_bytes(b"alpha")
    second.write_bytes(b"beta")

    assert sha256_file(first) != sha256_file(second)


def test_set_all_seeds_reproduces_numpy_randomness() -> None:
    set_all_seeds(42)
    first = np.random.standard_normal(5)
    set_all_seeds(42)
    second = np.random.standard_normal(5)

    np.testing.assert_array_equal(first, second)


def test_set_all_seeds_rejects_invalid_seed() -> None:
    with pytest.raises(ValueError):
        set_all_seeds(-1)
