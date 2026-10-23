import re
import secrets
import time
from collections.abc import Callable

_ID_PREFIX = re.compile(r"^[a-z][a-z0-9_]*$")


def new_id(prefix: str, clock: Callable[[], float] | None = None) -> str:
    if not _ID_PREFIX.fullmatch(prefix):
        raise ValueError("prefix must contain only lowercase letters, digits, and underscores")
    timestamp = time.gmtime((clock or time.time)())
    stamp = time.strftime("%Y%m%dT%H%M%SZ", timestamp)
    return f"{prefix}_{stamp}_{secrets.token_hex(3)}"
