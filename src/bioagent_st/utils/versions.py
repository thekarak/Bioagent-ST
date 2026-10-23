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
