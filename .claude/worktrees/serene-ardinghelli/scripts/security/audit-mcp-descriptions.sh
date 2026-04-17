#!/bin/bash
# ==============================================================================
# MCP Tool Poisoning 監査スクリプト
# ==============================================================================
#
# 概要:
#   MCP サーバーの tool description / plugin 設定ファイルを走査し、
#   プロンプトインジェクション的な危険パターンを検出する。
#
# 対象:
#   - ~/.claude/plugins/ 配下の全 plugin.json / .mcp.json / SKILL.md
#   - .claude/settings.json 内の MCP 関連設定
#
# 使い方:
#   bash scripts/security/audit-mcp-descriptions.sh [--verbose] [--json]
#
# 出力:
#   デフォルト: Markdown 形式のレポート (stdout)
#   --json:     JSON 形式 (stdout)
#   --verbose:  スキャン対象ファイル一覧も表示
#
# 設計思想:
#   Invariant Labs が報告した MCP Tool Poisoning 攻撃パターンに基づき、
#   tool description 内のプロンプトインジェクション試行を検出する。
#   攻撃者は description に LLM への指示を埋め込み、
#   データ窃取・ツール呼び出し操作・権限昇格を試みる。
# ==============================================================================

set -euo pipefail

# ────────────────────────────────────────
# 設定
# ────────────────────────────────────────

PLUGINS_DIR="${HOME}/.claude/plugins"
WORKSPACE_DIR="${WORKSPACE:-$(pwd)}"
SETTINGS_FILE="${WORKSPACE_DIR}/.claude/settings.json"
REPORT_DIR="${WORKSPACE_DIR}/.company/departments/security/audits"

VERBOSE=false
JSON_OUTPUT=false

for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=true ;;
    --json) JSON_OUTPUT=true ;;
    --help|-h)
      head -25 "$0" | tail -20
      exit 0
      ;;
  esac
done

# ────────────────────────────────────────
# 危険パターン定義
# ────────────────────────────────────────
# カテゴリ別に grep -iE 用の正規表現を定義
# 各パターンは "カテゴリ::パターン::説明" の形式

PATTERNS=(
  # カテゴリ1: データ窃取指示
  "data_exfil::send .*(data|information|content|file|secret|token|key|credential|password).* to::データを外部に送信する指示"
  "data_exfil::exfiltrate|exfil ::データ窃取を示唆する用語"
  "data_exfil::forward (to|this|the|all)|transmit (to|this)|upload (to|this|the).*\\.::外部送信の指示"
  "data_exfil::curl.*POST|wget.*--post|fetch.*method.*POST::HTTP POST による外部送信"
  "data_exfil::base64.*encode.*send|encode.*transmit::エンコードして送信する指示"

  # カテゴリ2: プロンプトインジェクション（LLM 操作）
  "prompt_injection::ignore (all |your )?previous (instructions|rules|guidelines|prompts)::前の指示を無視させる試み"
  "prompt_injection::forget (all |your )?(instructions|rules|context|previous)::指示の忘却を促す試み"
  "prompt_injection::disregard (all |any |your )?(instructions|rules|safety|guidelines)::指示の無視を促す試み"
  "prompt_injection::you are now|you must now|from now on|new instructions::ロール書き換えの試み"
  "prompt_injection::override (your |the |all )?(instructions|rules|safety|guidelines|settings)::設定の上書き指示"
  "prompt_injection::do not (tell|inform|reveal|mention|disclose) (the |to )?(user|human|operator)::ユーザーへの隠蔽指示"
  "prompt_injection::hide (this|the) (from|action|operation)::操作の隠蔽指示"
  "prompt_injection::secretly|covertly|silently (perform|execute|run|call|invoke)::秘密裏の操作指示"
  "prompt_injection::act as|pretend (to be|you are)|roleplay as::ロール偽装の指示"

  # カテゴリ3: 不正なツール呼び出し
  "tool_abuse::call (the |this |another )?tool|invoke (the |this |another )?tool|use (the |this |another )?tool (to|for|and)::他ツール呼び出しの指示（description内での言及は不審）"
  "tool_abuse::execute (this |the |a )?(command|script|code|shell|bash)::コマンド実行の指示"
  "tool_abuse::run (this |the |a )?(command|script|code|shell|bash)::スクリプト実行の指示"
  "tool_abuse::write (to |into |a )?(file|disk|filesystem).*without::無断ファイル書き込みの指示"
  "tool_abuse::modify (the |this )?(settings|config|permission|allow)::設定変更の指示"

  # カテゴリ4: 権限昇格
  "privilege_escalation::grant (yourself|me|this) (access|permission|admin|root)::権限付与の指示"
  "privilege_escalation::elevate (your |the )?(privilege|permission|access)::権限昇格の指示"
  "privilege_escalation::bypass (the |any )?(security|auth|permission|restriction|filter|guard)::セキュリティバイパスの指示"
  "privilege_escalation::disable (the |any )?(security|auth|permission|restriction|filter|guard|hook)::セキュリティ無効化の指示"
  "privilege_escalation::add .* to (the )?allow(list| list|ed)::allowlist への不正追加指示"

  # カテゴリ5: 隠しテキスト / ステガノグラフィー
  "steganography::<!-- .*instruction|<!-- .*ignore|<!-- .*override::HTMLコメント内の隠し指示"
  "steganography::\\\\u200b|\\\\u200c|\\\\u200d|\\\\ufeff::ゼロ幅文字の使用（不可視テキスト）"

  # カテゴリ6: 日本語の危険パターン
  "jp_injection::この情報を(外部|別の|他の).*に(送信|転送|アップロード)::日本語でのデータ送信指示"
  "jp_injection::ユーザーに(知らせ|通知|報告).*ない::ユーザーへの非通知指示"
  "jp_injection::前の指示を(無視|忘れ|取り消)::日本語でのプロンプトインジェクション"
  "jp_injection::秘密(に|裏に|で)(実行|送信|呼び出)::秘密裏の操作指示"
  "jp_injection::権限を(昇格|追加|変更)::権限昇格の指示"
)

# ────────────────────────────────────────
# スキャン対象ファイル収集
# ────────────────────────────────────────

SCAN_FILES=()

# plugin.json ファイル
while IFS= read -r -d '' f; do
  SCAN_FILES+=("$f")
done < <(find "$PLUGINS_DIR" -name "plugin.json" -print0 2>/dev/null || true)

# .mcp.json ファイル
while IFS= read -r -d '' f; do
  SCAN_FILES+=("$f")
done < <(find "$PLUGINS_DIR" -name ".mcp.json" -print0 2>/dev/null || true)

# SKILL.md ファイル
while IFS= read -r -d '' f; do
  SCAN_FILES+=("$f")
done < <(find "$PLUGINS_DIR" -name "SKILL.md" -print0 2>/dev/null || true)

# marketplace.json ファイル
while IFS= read -r -d '' f; do
  SCAN_FILES+=("$f")
done < <(find "$PLUGINS_DIR" -name "marketplace.json" -print0 2>/dev/null || true)

# ワークスペース内の .mcp.json
while IFS= read -r -d '' f; do
  SCAN_FILES+=("$f")
done < <(find "$WORKSPACE_DIR" -maxdepth 3 -name ".mcp.json" -print0 2>/dev/null || true)

# settings.json
if [ -f "$SETTINGS_FILE" ]; then
  SCAN_FILES+=("$SETTINGS_FILE")
fi

# ────────────────────────────────────────
# スキャン実行
# ────────────────────────────────────────

FINDINGS=()
FINDING_COUNT=0
SCANNED_COUNT=${#SCAN_FILES[@]}

scan_file() {
  local filepath="$1"
  local content
  content=$(cat "$filepath" 2>/dev/null || echo "")

  if [ -z "$content" ]; then
    return
  fi

  for pattern_def in "${PATTERNS[@]}"; do
    local category pattern description
    category="${pattern_def%%::*}"
    local rest="${pattern_def#*::}"
    pattern="${rest%%::*}"
    description="${rest#*::}"

    # grep -iE でパターン検索
    local matches
    matches=$(echo "$content" | grep -inE "$pattern" 2>/dev/null || true)

    if [ -n "$matches" ]; then
      while IFS= read -r match_line; do
        local line_num
        line_num=$(echo "$match_line" | cut -d: -f1)
        local line_content
        line_content=$(echo "$match_line" | cut -d: -f2-)
        # 先頭・末尾の空白を除去し、長すぎる場合は切り詰め
        line_content=$(echo "$line_content" | sed 's/^[[:space:]]*//' | head -c 200)

        FINDINGS+=("${category}|${filepath}|${line_num}|${description}|${line_content}")
        FINDING_COUNT=$((FINDING_COUNT + 1))
      done <<< "$matches"
    fi
  done
}

for file in "${SCAN_FILES[@]}"; do
  scan_file "$file"
done

# ────────────────────────────────────────
# レポート出力
# ────────────────────────────────────────

NOW=$(date '+%Y-%m-%d %H:%M JST' 2>/dev/null || date '+%Y-%m-%d %H:%M')

if [ "$JSON_OUTPUT" = true ]; then
  # JSON 出力
  echo "{"
  echo "  \"scan_date\": \"$NOW\","
  echo "  \"scanned_files\": $SCANNED_COUNT,"
  echo "  \"finding_count\": $FINDING_COUNT,"
  echo "  \"findings\": ["
  local_first=true
  for finding in "${FINDINGS[@]}"; do
    IFS='|' read -r cat file line desc content <<< "$finding"
    if [ "$local_first" = true ]; then
      local_first=false
    else
      echo ","
    fi
    # JSON エスケープ（簡易版）
    content=$(echo "$content" | sed 's/\\/\\\\/g; s/"/\\"/g')
    printf '    {"category": "%s", "file": "%s", "line": %s, "description": "%s", "content": "%s"}' \
      "$cat" "$file" "$line" "$desc" "$content"
  done
  echo ""
  echo "  ]"
  echo "}"
else
  # Markdown 出力
  echo "# MCP Tool Poisoning 監査結果 -- $NOW"
  echo ""
  echo "## サマリー"
  echo ""
  echo "- スキャン対象ファイル数: $SCANNED_COUNT"
  echo "- 検出された警告数: $FINDING_COUNT"
  echo ""

  if [ "$VERBOSE" = true ]; then
    echo "## スキャン対象ファイル"
    echo ""
    for file in "${SCAN_FILES[@]}"; do
      echo "- \`$file\`"
    done
    echo ""
  fi

  if [ "$FINDING_COUNT" -eq 0 ]; then
    echo "## 結果: 問題なし"
    echo ""
    echo "全ファイルを走査した結果、MCP Tool Poisoning の兆候は検出されませんでした。"
  else
    echo "## 検出結果"
    echo ""
    echo "| カテゴリ | ファイル | 行 | 説明 | 該当箇所 |"
    echo "|----------|---------|---:|------|----------|"
    for finding in "${FINDINGS[@]}"; do
      IFS='|' read -r cat file line desc content <<< "$finding"
      # ファイルパスを短縮
      short_file=$(echo "$file" | sed "s|$HOME|~|g" | sed "s|$WORKSPACE_DIR|.|g")
      # Markdown テーブル内のパイプをエスケープ
      content=$(echo "$content" | sed 's/|/\\|/g' | head -c 80)
      echo "| $cat | \`$short_file\` | $line | $desc | \`$content\` |"
    done
  fi

  echo ""
  echo "---"
  echo "Generated by: scripts/security/audit-mcp-descriptions.sh"
fi
