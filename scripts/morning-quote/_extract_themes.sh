#!/bin/bash
# _extract_themes.sh <DIARY_JSON> <EMOTION_JSON> <YESTERDAY_DATE>
#
# Step 1: 昨日の日記+感情分析からテーマを抽出する。
# Claude CLI (opus) を使用。出力は JSON オブジェクト（stdout）。
#
# 期待する出力:
#   {"keywords":[...],"dominant_emotion":{...},"secondary_emotion":{...},"themes":[...],"needed_voice":"..."}
#
# 失敗時は "{}" を返し、呼び出し側で skip する。

set -uo pipefail

DIARY_JSON="${1:-}"
EMOTION_JSON="${2:-[]}"
YESTERDAY="${3:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# プロンプト組み立てを Python で行う（JSON エスケープを正しく処理するため）
INPUT=$(python3 "${SCRIPT_DIR}/_build_extract_prompt.py" "$DIARY_JSON" "$EMOTION_JSON" "$YESTERDAY")

if [ -z "$INPUT" ]; then
  echo "{}"
  exit 0
fi

# Claude CLI を呼び、最大2回リトライ。モデルは env var で上書き可能
CLI_MODEL="${MORNING_QUOTE_CLI_MODEL:-opus}"
RESP=""
for attempt in 1 2; do
  RESP=$(echo "$INPUT" | claude --print --model "$CLI_MODEL" 2>/dev/null)
  if [ -n "$RESP" ]; then
    break
  fi
  # 2回目前に短い待機（30s だとバッチ全体が詰まるので 5s に短縮）
  sleep 5
done

if [ -z "$RESP" ]; then
  echo "{}"
  exit 0
fi

# JSON オブジェクトを抽出（コードフェンス等を除去）
echo "$RESP" | python3 -c "
import sys, re, json
text = sys.stdin.read()
m = re.search(r'\{[\s\S]*\}', text)
if not m:
    print('{}')
    sys.exit(0)
try:
    parsed = json.loads(m.group(0))
    # 必須フィールド検証
    if not parsed.get('keywords') or not parsed.get('themes') or not parsed.get('needed_voice'):
        print('{}')
        sys.exit(0)
    print(json.dumps(parsed, ensure_ascii=False))
except json.JSONDecodeError:
    print('{}')
"
