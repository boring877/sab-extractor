#!/usr/bin/env python3
"""
Local dev runner for sab_engine without requiring installation.
"""

from __future__ import annotations

import sys
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parent
SRC_DIR = ENGINE_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from sab_engine.cli import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())
