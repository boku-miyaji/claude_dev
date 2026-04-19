#!/usr/bin/env python3
"""情報収集レポート → intelligence_suggestions INSERT のエントリポイント（ハイフン版）。

ハイフン区切りのファイル名は Python の `import` では扱えないため、
実装本体は `ingest_suggestions.py`（アンダースコア版）に置き、本ファイルは
その `main()` を呼ぶだけの薄いラッパーにする。

使い方:
    python3 scripts/intelligence/ingest-suggestions.py <report.md>
"""
from __future__ import annotations

import sys
from pathlib import Path

# 同ディレクトリを import path に追加して実装本体を呼ぶ
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from ingest_suggestions import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
