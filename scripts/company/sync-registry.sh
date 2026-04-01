#!/bin/bash
# sync-registry.sh — マスター (registry.md + departments/) から全派生ファイルを同期
# SSOT: registry.md = 会社一覧マスター, departments/*/ = 部署マスター
set -uo pipefail

WORKSPACE="${1:-/workspace}"
REGISTRY="$WORKSPACE/.company/registry.md"
QUIET="${2:-}"

log() { [ "$QUIET" != "--quiet" ] && echo "$@"; }

# ────────────────────────────────────────
# 1. マスターデータの読み取り
# ────────────────────────────────────────

# 会社一覧を registry.md からパース
parse_companies() {
  awk -F'|' '/^\|[[:space:]]+[a-z]/ && !/\| ID/ {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2);
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $3);
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4);
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $5);
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", $7);
    if ($2 != "") print $2"|"$3"|"$4"|"$5"|"$7
  }' "$REGISTRY" 2>/dev/null
}

# 部署一覧を departments/*/ からスキャン
parse_departments() {
  find "$WORKSPACE/.company/departments" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort | while read -r dir; do
    slug=$(basename "$dir")
    # CLAUDE.md の1行目からタイトルを取得
    title=""
    if [ -f "$dir/CLAUDE.md" ]; then
      title=$(head -1 "$dir/CLAUDE.md" | sed 's/^# //' | sed 's/ — .*//' | sed 's/（.*）//')
    fi
    [ -z "$title" ] && title="$slug"

    # Agent ファイルの存在確認
    agent_file=""
    if [ -f "$WORKSPACE/.claude/agents/dept-${slug}.md" ]; then
      agent_file=".claude/agents/dept-${slug}.md"
    fi

    echo "$slug|$title|$agent_file"
  done
}

COMPANIES=$(parse_companies)
DEPARTMENTS=$(parse_departments)

log "📋 マスターデータ読み取り完了"
log "  会社: $(echo "$COMPANIES" | wc -l | xargs) 社"
log "  部署: $(echo "$DEPARTMENTS" | wc -l | xargs) 部門"

# ────────────────────────────────────────
# 2. マーカーベース更新ユーティリティ
# ────────────────────────────────────────

# update_section <file> <marker_name> <new_content>
# マーカー間のテキストを新しい内容で置換する
update_section() {
  local file="$1" marker="$2" content="$3"
  local ext="${file##*.}"
  local start_marker end_marker

  case "$ext" in
    md|html)
      start_marker="<!-- GENERATED:${marker}:START -->"
      end_marker="<!-- GENERATED:${marker}:END -->"
      ;;
    sh|yaml|yml)
      start_marker="# GENERATED:${marker}:START"
      end_marker="# GENERATED:${marker}:END"
      ;;
  esac

  if ! grep -qF "$start_marker" "$file" 2>/dev/null; then
    log "  ⚠️  $file にマーカー $marker が見つかりません。スキップ"
    return 1
  fi

  # awk でマーカー間を置換
  local tmpfile=$(mktemp)
  awk -v start="$start_marker" -v end="$end_marker" -v content="$content" '
    $0 == start { print; printf "%s\n", content; skip=1; next }
    $0 == end { skip=0 }
    !skip { print }
  ' "$file" > "$tmpfile"
  mv "$tmpfile" "$file"
}

# ────────────────────────────────────────
# 3. CLAUDE.md アーキテクチャ図の生成
# ────────────────────────────────────────

generate_arch_tree() {
  local tree=""
  tree+='```\n'
  tree+='.company/                              HD（統括）\n'
  tree+='├── CLAUDE.md                          ← このファイル\n'
  tree+='├── registry.md                        ← PJ会社一覧（SSOT）\n'
  tree+='├── secretary/                         ← HD秘書室\n'
  tree+='│   ├── inbox/\n'
  tree+='│   ├── todos/\n'
  tree+='│   └── notes/\n'
  tree+='├── hr/                                ← 人事部（組織最適化）\n'
  tree+='│   ├── evaluations/\n'
  tree+='│   ├── proposals/\n'
  tree+='│   └── retrospectives/\n'
  tree+='└── departments/                       ← 共通部署群\n'

  local dept_count=$(echo "$DEPARTMENTS" | wc -l)
  local i=0
  while IFS='|' read -r slug title _; do
    i=$((i + 1))
    if [ "$i" -eq "$dept_count" ]; then
      tree+="    └── ${slug}/CLAUDE.md             ← ${title}\n"
    else
      tree+="    ├── ${slug}/CLAUDE.md             ← ${title}\n"
    fi
  done <<< "$DEPARTMENTS"

  tree+='\n'

  # PJ会社ディレクトリ
  while IFS='|' read -r id name _ _ _; do
    tree+=".company-${id}/                      ${name}\n"
  done <<< "$COMPANIES"

  tree+='```'
  echo -e "$tree"
}

# ────────────────────────────────────────
# 4. Agent 一覧テーブルの生成
# ────────────────────────────────────────

generate_agent_table() {
  local table=""
  table+='| Agent | ファイル | キーワード |\n'
  table+='|-------|---------|-----------|'

  while IFS='|' read -r slug title agent_file; do
    local keywords=""
    local file_col="—"

    if [ -n "$agent_file" ] && [ -f "$WORKSPACE/$agent_file" ]; then
      file_col="\`${agent_file}\`"
      # Agent定義から keywords を抽出（最初の箇条書きを取得）
      keywords=$(grep -m1 '^\- \*\*キーワード\*\*' "$WORKSPACE/$agent_file" 2>/dev/null | sed 's/.*: //' || echo "")
      [ -z "$keywords" ] && keywords=$(grep -m1 'keywords\|キーワード' "$WORKSPACE/$agent_file" 2>/dev/null | sed 's/.*: //' || echo "$slug")
    fi
    [ -z "$keywords" ] && keywords="$slug"

    table+="\n| ${title} | ${file_col} | ${keywords} |"
  done <<< "$DEPARTMENTS"

  echo -e "$table"
}

# ────────────────────────────────────────
# 5. registry.md 部署テーブルの生成
# ────────────────────────────────────────

generate_dept_registry_table() {
  local table=""
  table+='| 部署 | パス | 役割 |\n'
  table+='|------|------|------|'

  while IFS='|' read -r slug title _; do
    local role=""
    local dept_claude="$WORKSPACE/.company/departments/$slug/CLAUDE.md"
    if [ -f "$dept_claude" ]; then
      # ## ミッション or ## 役割 の次の行を取得
      role=$(awk '/^## (ミッション|役割|Role)/{getline; if(/^$/){getline}; print; exit}' "$dept_claude" 2>/dev/null | head -1)
    fi
    [ -z "$role" ] && role="$title"

    table+="\n| ${title} | departments/${slug}/ | ${role} |"
  done <<< "$DEPARTMENTS"

  echo -e "$table"
}

# ────────────────────────────────────────
# 6. task-classification.md タグの生成
# ────────────────────────────────────────

generate_scope_tags() {
  local table=""
  table+='| タグ | 意味 |\n'
  table+='|------|------|\n'
  table+='| `hd` | HD全社横断 |'

  while IFS='|' read -r id name _ _ _; do
    table+="\n| \`pj:${id}\` | ${name} |"
  done <<< "$COMPANIES"

  table+='\n| `personal` | 個人のこと |'
  echo -e "$table"
}

generate_dept_tags() {
  local table=""
  table+='| タグ | 意味 |\n'
  table+='|------|------|'

  while IFS='|' read -r slug title _; do
    table+="\n| \`dept:${slug}\` | ${title} |"
  done <<< "$DEPARTMENTS"

  table+='\n| `dept:hr` | 人事 |'
  table+='\n| `dept:secretary` | 秘書室 |'
  echo -e "$table"
}

# ────────────────────────────────────────
# 7. prompt-log.sh 会社パターンの生成
# ────────────────────────────────────────

generate_prompt_patterns() {
  # 各会社のCLAUDE.mdからキーワードを推定
  while IFS='|' read -r id name desc _ _; do
    local keywords="$id"
    local pj_claude="$WORKSPACE/.company-${id}/CLAUDE.md"
    if [ -f "$pj_claude" ]; then
      # クライアント名、ドメインキーワードを抽出
      local extra=$(grep -oP '(?<=\*\*会社\*\*: |関係性|ドメイン知識|キーワード).+' "$pj_claude" 2>/dev/null | head -3 | tr '\n' ' ' | sed 's/[^a-zA-Zぁ-ん゠-ヿ㐀-䶵一-鿋豈-頻々〇〻\u3400-\u9FFF ]//g' || true)
      [ -n "$extra" ] && keywords="$keywords $extra"
    fi
    echo "if [ -z \"\$COMPANY_ID\" ]; then"
    echo "  echo \"\$PROMPT\" | grep -qi \"$(echo "$name" | tr ' ' '\n' | head -1)\\\\|$id\" && COMPANY_ID=\"$id\""
    echo "fi"
  done <<< "$COMPANIES"
}

# ────────────────────────────────────────
# 8. 実行
# ────────────────────────────────────────

log ""
log "🔄 派生ファイルを同期中..."

# 8.1 CLAUDE.md アーキテクチャ図
ARCH_TREE=$(generate_arch_tree)
update_section "$WORKSPACE/.company/CLAUDE.md" "ARCH_TREE" "$ARCH_TREE" && log "  ✅ CLAUDE.md アーキテクチャ図"

# 8.2 CLAUDE.md Agent一覧
AGENT_TABLE=$(generate_agent_table)
update_section "$WORKSPACE/.company/CLAUDE.md" "AGENT_TABLE" "$AGENT_TABLE" && log "  ✅ CLAUDE.md Agent一覧"

# 8.3 registry.md 部署テーブル
DEPT_TABLE=$(generate_dept_registry_table)
update_section "$REGISTRY" "DEPT_TABLE" "$DEPT_TABLE" && log "  ✅ registry.md 部署テーブル"

# 8.4 task-classification.md スコープタグ
SCOPE_TAGS=$(generate_scope_tags)
TASK_CLASS="$WORKSPACE/.company/secretary/policies/task-classification.md"
update_section "$TASK_CLASS" "SCOPE_TAGS" "$SCOPE_TAGS" && log "  ✅ task-classification.md 軸1(スコープ)"

# 8.5 task-classification.md 部署タグ
DEPT_TAGS=$(generate_dept_tags)
update_section "$TASK_CLASS" "DEPT_TAGS" "$DEPT_TAGS" && log "  ✅ task-classification.md 軸2(部署)"

# 8.6 Supabase 同期（既存の company-sync.sh を呼び出し）
if [ -f "$WORKSPACE/.claude/hooks/company-sync.sh" ]; then
  echo '{}' | bash "$WORKSPACE/.claude/hooks/company-sync.sh" 2>/dev/null && log "  ✅ Supabase 同期" || log "  ⚠️  Supabase 同期スキップ（接続不可）"
fi

# 8.7 変更サマリー
log ""
CHANGES=$(cd "$WORKSPACE" && git diff --stat 2>/dev/null || true)
if [ -n "$CHANGES" ]; then
  log "📝 変更されたファイル:"
  log "$CHANGES"
else
  log "✅ 全ファイルが既に最新です"
fi
