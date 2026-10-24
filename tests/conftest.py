import os
from pathlib import Path

# Set writable directory for matplotlib cache to eliminate sandbox permission delays
mpl_dir = Path(".matplotlib").resolve()
mpl_dir.mkdir(parents=True, exist_ok=True)
os.environ["MPLCONFIGDIR"] = str(mpl_dir)
