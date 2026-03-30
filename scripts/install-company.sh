#!/bin/bash
# install-company.sh
# boku-miyaji/claude_dev から company プラグインを1コマンドでインストールする
#
# Usage:
#   bash scripts/install-company.sh
#   bash scripts/install-company.sh --force   # 既存ファイルも上書き
#
# インストール先:
#   ~/.claude/plugins/marketplaces/ai-company/  ← プラグイン・スキル・marketplace.json
#   $PROJECT_DIR/.company/                      ← HD組織データ
#   $PROJECT_DIR/.company-*/                    ← 子会社データ
#   $PROJECT_DIR/.claude/hooks/                 ← Hooks
#   ~/.claude/settings.json                     ← グローバル設定追記

set -euo pipefail

REPO_URL="https://github.com/boku-miyaji/claude_dev.git"
TMP_DIR="/tmp/claude_dev_install_$$"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MARKETPLACE_DIR="$HOME/.claude/plugins/marketplaces/ai-company"
CACHE_DIR="$HOME/.claude/plugins/cache/ai-company"
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --help|-h)
      echo "Usage: bash scripts/install-company.sh [--force]"
      echo "  --force  Overwrite existing plugin and org data"
      exit 0
      ;;
  esac
done

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Company Plugin Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Project:     $PROJECT_DIR"
echo "  Marketplace: $MARKETPLACE_DIR"
echo ""

# ─── 1. Clone source ───
echo "📥 ソースリポジトリを取得中..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR" 2>/dev/null
info "リポジトリを取得しました"

# ─── 2. Install plugin to ~/.claude/plugins/marketplaces/ai-company/ ───
# Claude Code expects:
#   marketplaces/ai-company/
#   ├── .claude-plugin/marketplace.json   (source: "./" , skills: ["./skills/*"])
#   └── skills/
#       ├── company/SKILL.md
#       ├── invoice/SKILL.md
#       └── ...
echo ""
echo "📦 プラグインをインストール中..."

SKILLS_SRC="$TMP_DIR/plugins/company/skills"

if [ -d "$MARKETPLACE_DIR/skills" ] && [ "$FORCE" = false ]; then
  warn "marketplace スキルは既に存在します"
  added=0
  for skill_dir in "$SKILLS_SRC/"*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    if [ ! -d "$MARKETPLACE_DIR/skills/$skill_name" ]; then
      cp -r "$skill_dir" "$MARKETPLACE_DIR/skills/$skill_name"
      info "  新スキル追加: $skill_name"
      added=$((added + 1))
    fi
  done
  [ "$added" -eq 0 ] && info "  スキルは全て最新です"
else
  mkdir -p "$MARKETPLACE_DIR/skills"
  rm -rf "$MARKETPLACE_DIR/skills"
  cp -r "$SKILLS_SRC" "$MARKETPLACE_DIR/skills"
  info "skills/ をインストールしました ($(ls -d "$MARKETPLACE_DIR/skills/"*/ 2>/dev/null | wc -l) スキル)"
fi

# ─── 3. Generate marketplace.json ───
echo ""
echo "📋 marketplace.json を生成中..."

mkdir -p "$MARKETPLACE_DIR/.claude-plugin"

SKILLS_JSON="["
first=true
for skill_dir in "$MARKETPLACE_DIR/skills/"*/; do
  [ -d "$skill_dir" ] || continue
  skill_name=$(basename "$skill_dir")
  [ "$first" = true ] && first=false || SKILLS_JSON+=","
  SKILLS_JSON+=$'\n'"        \"./skills/$skill_name\""
done
SKILLS_JSON+=$'\n'"      ]"

cat > "$MARKETPLACE_DIR/.claude-plugin/marketplace.json" <<JSONEOF
{
  "name": "ai-company",
  "owner": {
    "name": "owner"
  },
  "metadata": {
    "description": "AI company plugin"
  },
  "plugins": [
    {
      "name": "company",
      "source": "./",
      "description": "HD + PJ company virtual organization management",
      "strict": false,
      "skills": $SKILLS_JSON
    }
  ]
}
JSONEOF
info "marketplace.json を生成しました"

# ─── 4. Copy skill references (CLAUDE.md templates etc.) ───
echo ""
echo "📚 参照ファイルをコピー中..."

# Skills reference directories need the actual reference files
for skill_dir in "$MARKETPLACE_DIR/skills/"*/; do
  [ -d "$skill_dir" ] || continue
  skill_name=$(basename "$skill_dir")
  ref_src="$TMP_DIR/plugins/company/skills/$skill_name/references"
  ref_dst="$skill_dir/references"
  if [ -d "$ref_src" ] && [ ! -d "$ref_dst" ]; then
    cp -r "$ref_src" "$ref_dst"
    info "  $skill_name/references"
  fi
done
info "参照ファイルを確認しました"

# ─── 5. Clear plugin cache ───
echo ""
echo "🗑  プラグインキャッシュをクリア中..."

if [ -d "$CACHE_DIR" ]; then
  rm -rf "$CACHE_DIR"
  info "キャッシュをクリアしました"
else
  info "キャッシュなし（スキップ）"
fi

# ─── 6. Install .company/ (HD org data) ───
echo ""
echo "🏢 HD組織データをインストール中..."

COMPANY_SRC="$TMP_DIR/.company"
COMPANY_DST="$PROJECT_DIR/.company"

if [ -d "$COMPANY_DST" ] && [ "$FORCE" = false ]; then
  warn ".company/ は既に存在します（--force で上書き可）"
else
  if [ "$FORCE" = true ] && [ -d "$COMPANY_DST" ]; then
    for protect_dir in secretary/notes secretary/todos secretary/inbox hr/evaluations; do
      if [ -d "$COMPANY_DST/$protect_dir" ] && [ "$(ls -A "$COMPANY_DST/$protect_dir" 2>/dev/null)" ]; then
        mkdir -p "$COMPANY_SRC/$protect_dir"
        cp -rn "$COMPANY_DST/$protect_dir/"* "$COMPANY_SRC/$protect_dir/" 2>/dev/null || true
      fi
    done
    info "既存データを保護しました"
  fi
  rm -rf "$COMPANY_DST"
  cp -r "$COMPANY_SRC" "$COMPANY_DST"
  info ".company/ をインストールしました"
fi

# ─── 7. Install .company-* (subsidiaries) ───
echo ""
echo "🏗  子会社データをインストール中..."

sub_count=0
for src_dir in "$TMP_DIR"/.company-*/; do
  [ -d "$src_dir" ] || continue
  name=$(basename "$src_dir")
  dst_dir="$PROJECT_DIR/$name"
  if [ -d "$dst_dir" ] && [ "$FORCE" = false ]; then
    warn "$name/ は既に存在 → スキップ"
  else
    rm -rf "$dst_dir"
    cp -r "$src_dir" "$dst_dir"
    info "$name/ をインストールしました"
  fi
  sub_count=$((sub_count + 1))
done
[ "$sub_count" -eq 0 ] && info "子会社なし"

# ─── 8. Install hooks ───
echo ""
echo "🪝 Hooksをインストール中..."

HOOKS_DST="$PROJECT_DIR/.claude/hooks"
mkdir -p "$HOOKS_DST"

hook_count=0
for hook_file in "$TMP_DIR/.claude/hooks"/company-*.sh; do
  [ -f "$hook_file" ] || continue
  hook_name=$(basename "$hook_file")
  cp "$hook_file" "$HOOKS_DST/$hook_name"
  chmod +x "$HOOKS_DST/$hook_name"
  info "  $hook_name"
  hook_count=$((hook_count + 1))
done
[ "$hook_count" -eq 0 ] && info "company hooks なし"

# ─── 9. Update settings.json (global + project) ───
echo ""
echo "⚙️  settings.json を更新中..."

update_settings() {
  local settings_file="$1"
  local label="$2"

  if [ ! -f "$settings_file" ]; then
    # Create minimal settings.json
    echo '{}' > "$settings_file"
  fi

  if command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const s = JSON.parse(fs.readFileSync('$settings_file', 'utf8'));

      // Enable plugin
      if (!s.enabledPlugins) s.enabledPlugins = {};
      s.enabledPlugins['company@ai-company'] = true;

      // Register marketplace
      if (!s.extraKnownMarketplaces) s.extraKnownMarketplaces = {};
      s.extraKnownMarketplaces['ai-company'] = {
        source: { source: 'github', repo: 'boku-miyaji/claude_dev', path: '.' }
      };

      fs.writeFileSync('$settings_file', JSON.stringify(s, null, 2) + '\n');
    "
    info "$label を更新しました"
  else
    warn "node が見つかりません。$label の手動更新が必要です"
  fi
}

# Global settings (primary)
GLOBAL_SETTINGS="$HOME/.claude/settings.json"
mkdir -p "$(dirname "$GLOBAL_SETTINGS")"
update_settings "$GLOBAL_SETTINGS" "~/.claude/settings.json (global)"

# Project settings
PROJECT_SETTINGS="$PROJECT_DIR/.claude/settings.json"
if [ -f "$PROJECT_SETTINGS" ]; then
  update_settings "$PROJECT_SETTINGS" ".claude/settings.json (project)"
fi

# ─── Done ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✅ インストール完了${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "インストール内容:"
echo "  📦 ~/.claude/plugins/marketplaces/ai-company/"
echo "     ├── .claude-plugin/marketplace.json"
echo "     └── skills/ → $(ls -d "$MARKETPLACE_DIR/skills/"*/ 2>/dev/null | wc -l) スキル"
echo "  🏢 .company/        → HD組織データ"
echo "  🏗  .company-*/      → $sub_count 子会社"
echo "  🪝 .claude/hooks/   → $hook_count hooks"
echo ""
echo "⚡ セッションを再起動して /company を実行してください"
echo ""
