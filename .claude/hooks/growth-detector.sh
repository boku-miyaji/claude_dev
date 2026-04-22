#!/bin/bash
# Hook: UserPromptSubmit — 失敗・修正パターンを検出して growth_events に自動記録
# async: true
#
# 検出パターン:
# - バグ報告: 「バグ」「壊れ」「動かない」「エラー」「おかしい」
# - 修正指示: 「直して」「修正して」「なぜ」「なんで」
# - フラストレーション: 「意味ない」「使えない」「ダメ」「違う」
# - 繰り返し: 同じ修正を2回以上
#
# 検出したらファイルに記録。SessionStop で集計して growth_events に INSERT。

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

# Keyword-based signal detection (no LLM call — batch analysis later)
# 見逃しを避けるため婉曲・曖昧表現も広めに拾う。誤検知のほうが無検知より安い（後で統合できる）。
PROMPT_SHORT=$(echo "$PROMPT" | head -c 300)
SIGNAL="none"

if echo "$PROMPT_SHORT" | grep -qiP 'バグ|壊れ|動かない|動いてない|エラー|error|broken|crash|落ちる|止まる|詰んだ|無限ループ|反応しない|hang'; then
  SIGNAL="bug_report"
elif echo "$PROMPT_SHORT" | grep -qiP '直して|修正して|なぜ|なんで|fix|why.*not|違う.*やって|違うよ|違くない|そうじゃ|こうして|間違い|ミス|逆|反対|書き直|作り直|やり直'; then
  SIGNAL="correction"
elif echo "$PROMPT_SHORT" | grep -qiP '意味ない|使えない|ダメ|だめ|やめて|違う$|ちがう|微妙|違和感|うーん|んー|いやぁ|惜しい|雑|浅い|粗い|弱い|薄い|足りない|物足りない|残念|期待.*違|期待と違|不満|しっくりこ'; then
  SIGNAL="frustration"
elif echo "$PROMPT_SHORT" | grep -qiP 'さっきも|前も|何回も|また同じ|繰り返し|この前も|毎回|いつも.*同じ|懲りず'; then
  SIGNAL="repeated_issue"
elif echo "$PROMPT_SHORT" | grep -qiP 'なぜやらない|なんでやってない|忘れてる|抜けてる|やってくれ|ちゃんと|きちんと|勝手に|頼んでない|言ってない|余計|やりすぎ|出しゃば|指示.*違|指示.*外|意図.*違|意図と異な|そうじゃなくて|そういうこと'; then
  SIGNAL="missed_expectation"
elif echo "$PROMPT_SHORT" | grep -qiP 'もっと|もう少し|もうちょい|もう1回|もう一回|改善|ブラッシュ|磨き|洗練|精度|品質.*上|レベル.*上'; then
  SIGNAL="request_iteration"
fi

if [ -n "$SIGNAL" ] && [ "$SIGNAL" != "none" ] && [ "$SIGNAL" != "null" ]; then
  TIMESTAMP=$(date -Iseconds)
  ENTRY="{\"ts\":\"$TIMESTAMP\",\"signal\":\"$SIGNAL\",\"prompt\":$(echo "$PROMPT_SHORT" | jq -Rs .)}"
  echo "$ENTRY" >> "$GROWTH_DIR/signals.jsonl"

  # Also persist immediately to local log (survives crashes)
  LOG_FILE="$HOME/.claude/logs/growth-signals.jsonl"
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  echo "$ENTRY" >> "$LOG_FILE"

  # 閾値: 1件で即 summarize。見逃すくらいなら記録過多のほうが良い。
  # 重複は後から parent_id / status='recurring' で整理可能。
  SIGNAL_COUNT=$(wc -l < "$GROWTH_DIR/signals.jsonl" 2>/dev/null | tr -d ' ')
  if [ "$SIGNAL_COUNT" -ge 1 ]; then
    bash "$SCRIPT_DIR/growth-summarize.sh" &
  fi
fi

exit 0
