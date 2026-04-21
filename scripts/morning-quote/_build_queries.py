#!/usr/bin/env python3
"""
_build_queries.py

stdin で Step 1 の JSON を受け取り、検索クエリを1行ずつ stdout に出力する。
LLM は使わない（コスト削減）。

入力 (stdin):
  {"keywords":[...],"dominant_emotion":{...},"secondary_emotion":{...},"themes":[...],"needed_voice":"..."}

出力 (stdout):
  <query 1>
  <query 2>
  ...

最大5件、重複排除後。
"""

from __future__ import annotations

import json
import re
import sys

VOICE_MAP = {
    "cheer": "勇気 名言",
    "calm": "落ち着く 名言",
    "challenge": "挑戦 名言",
    "company": "孤独 支え 名言",
    "permission": "ありのまま 名言",
    "reframe": "視点を変える 名言",
}


def extract_noun(text: str) -> str:
    """簡易的な主要名詞抽出（mecab が無い環境向け）。
    日本語テキストから句読点・助詞を取り除き、最も長い漢字連続 or カタカナ連続を返す。
    """
    if not text:
        return ""
    cleaned = re.sub(r"[、。！？!?「」『』（）\(\)\[\]\s]+", " ", text)
    # 漢字 2文字以上 or カタカナ 2文字以上の連続を候補とする
    tokens = re.findall(r"[\u4E00-\u9FFF]{2,}|[\u30A0-\u30FF]{2,}", cleaned)
    if not tokens:
        return ""
    # 最も長いトークンを代表語として採用
    tokens.sort(key=len, reverse=True)
    return tokens[0]


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0

    keywords = data.get("keywords") or []
    themes = data.get("themes") or []
    needed_voice = data.get("needed_voice") or ""

    queries: list[str] = []

    # 観点1: キーワード軸（上位2キーワード × 名言/quote）
    for kw in keywords[:2]:
        if not kw:
            continue
        queries.append(f"{kw} 名言")
        queries.append(f'"{kw}" quote')

    # 観点2: 感情軸（needed_voice）
    voice_query = VOICE_MAP.get(needed_voice)
    if voice_query:
        queries.append(voice_query)

    # 観点3: テーマ軸（themes[0] の主要名詞）
    if themes:
        theme_core = extract_noun(themes[0])
        if theme_core:
            queries.append(f"{theme_core} 名言")

    # 重複除去 + 最大5件
    seen: set[str] = set()
    deduped: list[str] = []
    for q in queries:
        if q not in seen:
            seen.add(q)
            deduped.append(q)
    for q in deduped[:5]:
        print(q)

    return 0


if __name__ == "__main__":
    sys.exit(main())
