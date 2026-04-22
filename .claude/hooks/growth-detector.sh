#!/bin/bash
# Hook: UserPromptSubmit — ユーザープロンプトを raw で growth-signals に蓄積
# async: true
#
# 2026-04-22 変更: キーワード判定を廃止し LLM 判定に一本化。
# 本スクリプトは軽量なプリフィルタ（短すぎ・システム生成・一般的な承認発話を除外）だけを担当する。
# 残ったプロンプトは signal='raw_prompt' として保存し、daily-analysis-batch.sh の LLM が
# failure / countermeasure / decision / milestone / noise を判定して growth_events に INSERT する。
#
# キーワードマッチでは婉曲・新しい表現の見逃しが避けられないため、この方針変更が必要だった。

set -uo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || true)
[ -z "$PROMPT" ] && exit 0

# Skip short prompts (confirmations, greetings)
[ ${#PROMPT} -lt 15 ] && exit 0

# Skip system-generated prompts (daily-analysis-batch / ceo-insights LLM inputs)
# これらは UserPromptSubmit のように流れてくるが、実体は内部LLM呼び出しであり
# 誤って correction シグナル化すると自己再帰ループの原因になる。
if echo "$PROMPT" | head -c 200 | grep -qE '^(Classify each prompt|Analyze these failure signals|Evaluate HD organization|Analyze this pipeline|あなたは.{0,30}アナリスト|あなたは claude_dev|日記エントリの下処理|仮説検証アナリスト|JSON formatで返|JSON形式で返)'; then
  exit 0
fi

GROWTH_DIR="/tmp/claude-growth-signals"
mkdir -p "$GROWTH_DIR" 2>/dev/null || true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/supabase-check.sh" 2>/dev/null || true
[ "${SUPABASE_AVAILABLE:-false}" = "true" ] || exit 0

# --- プリフィルタ: LLM 判定に回す前に明らかに不要なものを除外 ---
PROMPT_SHORT=$(echo "$PROMPT" | head -c 500)

# 1) 純粋な確認・挨拶（短文）は除外（既存の長さチェック + 追加）
case "$PROMPT_SHORT" in
  ok|OK|yes|no|はい|いいえ|了解|わかった|ありがとう|thanks)
    exit 0 ;;
esac

# 2) 既存のシステム生成プロンプト除外（上流で exit 済みだが念のため）
# 3) bot 自己言及・メタ指示（例: 「続けて」「進めて」）の短いものは除外
if [ ${#PROMPT_SHORT} -lt 20 ] && echo "$PROMPT_SHORT" | grep -qiE '^(続け|続行|進めて|やって|お願い|proceed|continue|go)'; then
  exit 0
fi

# --- Raw prompt を signal として記録 ---
# signal type は 'raw_prompt' 固定。LLM が後段で failure/countermeasure/decision/milestone/noise を判定する。
SIGNAL="raw_prompt"
TIMESTAMP=$(date -Iseconds)
ENTRY="{\"ts\":\"$TIMESTAMP\",\"signal\":\"$SIGNAL\",\"prompt\":$(echo "$PROMPT_SHORT" | jq -Rs .)}"

# 永続ログ（daily-batch の LLM が読む）
LOG_FILE="$HOME/.claude/logs/growth-signals.jsonl"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
echo "$ENTRY" >> "$LOG_FILE"

# Tmp signals ファイルにも残す（互換性のため。summarize スクリプトが既に読んでいる）
echo "$ENTRY" >> "$GROWTH_DIR/signals.jsonl"

exit 0
