import functools
import subprocess
from importlib.metadata import PackageNotFoundError, version

PACKAGES = (
    "anndata",
    "numpy",
    "pandas",
    "pydantic",
    "scanpy",
    "scipy",
    "squidpy",
    "statsmodels",
)


def library_versions(packages: tuple[str, ...] = PACKAGES) -> dict[str, str]:
    versions: dict[str, str] = {}
    for package in packages:
        try:
            versions[package] = version(package)
        except PackageNotFoundError:
            versions[package] = "not-installed"
    return versions


@functools.lru_cache(maxsize=1)
def git_commit() -> str:
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=False,
            timeout=2,
        )
        if proc.returncode == 0:
            commit = proc.stdout.strip()
            diff_proc = subprocess.run(
                ["git", "status", "--porcelain"],
                capture_output=True,
                text=True,
                check=False,
                timeout=2,
            )
            if diff_proc.returncode == 0 and diff_proc.stdout.strip():
                return f"{commit}-dirty"
            return commit
    except Exception:
        pass
    return "uncommitted"
