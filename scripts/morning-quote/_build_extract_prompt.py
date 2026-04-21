#!/usr/bin/env python3
"""
_build_extract_prompt.py <DIARY_JSON> <EMOTION_JSON> <YESTERDAY>

stdout にテーマ抽出用プロンプトを出力する。
JSON は文字列として渡されるため、ここでパースする。
"""

from __future__ import annotations

import json
import sys


def safe_json_load(s: str):
    try:
        return json.loads(s)
    except Exception:
        return None


def first(data):
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    return {}


def main() -> int:
    if len(sys.argv) < 4:
        print("", end="")
        return 1

    diary_raw, emotion_raw, yesterday = sys.argv[1], sys.argv[2], sys.argv[3]
    diary = first(safe_json_load(diary_raw) or [])
    emotion = first(safe_json_load(emotion_raw) or [])

    body = (diary.get("body") or "").strip()
    if not body or len(body) < 20:
        # 短すぎる日記はスキップ
        print("", end="")
        return 0

    ai_summary = diary.get("ai_summary") or "（なし）"
    topics_val = diary.get("topics") or []
    topics = ", ".join(topics_val) if topics_val else "（なし）"

    # Plutchik 8感情（欠落時 0 扱い）
    def g(key: str, default: float = 0.0) -> float:
        v = emotion.get(key)
        if v is None:
            return default
        try:
            return float(v)
        except Exception:
            return default

    joy = int(g("joy"))
    trust = int(g("trust"))
    fear = int(g("fear"))
    surprise = int(g("surprise"))
    sadness = int(g("sadness"))
    disgust = int(g("disgust"))
    anger = int(g("anger"))
    anticipation = int(g("anticipation"))
    valence = g("valence")
    arousal = g("arousal")
    wbi_score = g("wbi_score")

    prompt = f"""あなたは focus-you の自己理解支援アシスタントです。
以下は昨日のユーザーの日記と、その感情分析結果です。

このユーザーの「今朝に響く名言を選ぶための観点」を3方向から抽出してください。
自己理解と物語の感覚を大事にし、決めつけや大げさな語彙を避けます。

=== 昨日の日記 (entry_date: {yesterday}) ===
{body}

=== AI要約（既存） ===
{ai_summary}

=== 検出トピック ===
{topics}

=== 感情分析 ===
Plutchik 8感情（0-100）:
  喜び={joy} 信頼={trust} 恐れ={fear} 驚き={surprise}
  悲しみ={sadness} 嫌悪={disgust} 怒り={anger} 期待={anticipation}
Russell 円環: valence={valence:.2f}（-1快↔1不快）, arousal={arousal:.2f}（-1沈静↔1覚醒）
WBI score: {wbi_score:.2f}

=== 出力指示 ===
以下の JSON を返してください。他の文字は出さない。

{{
  "keywords": ["3〜5個のキーワード。具体的な名詞・動詞。抽象語は避ける"],
  "dominant_emotion": {{
    "label": "英語ラベル（joy/trust/fear/surprise/sadness/disgust/anger/anticipation のいずれか）",
    "jp": "日本語ラベル（例: 不安・期待）",
    "intensity": 0-100
  }},
  "secondary_emotion": {{
    "label": "...",
    "jp": "...",
    "intensity": 0-100
  }},
  "themes": [
    "1〜2個の『昨日ユーザーが向き合っていた主題』を短文で（例: 『期限前の迷い』『他人と自分を比べる苦しさ』）"
  ],
  "needed_voice": "cheer | calm | challenge | company | permission | reframe のいずれか1つ"
}}

JSON のみ出力:"""

    print(prompt, end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
