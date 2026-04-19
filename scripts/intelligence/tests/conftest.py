"""pytest 設定: 親ディレクトリを sys.path に入れる。"""
from __future__ import annotations

import sys
from pathlib import Path

# scripts/intelligence を sys.path に入れる
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
