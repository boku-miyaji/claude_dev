#!/bin/bash
# install-company.sh
# boku-miyaji/claude_dev から company プラグインを1コマンドでインストールする
#
# Usage:
#   bash scripts/install-company.sh
#   bash scripts/install-company.sh --force   # 既存ファイルも上書き

set -euo pipefail

REPO_URL="https://github.com/boku-miyaji/claude_dev.git"
TMP_DIR="/tmp/claude_dev_install_$$"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/workspace}"
FORCE=false

# Parse args
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --help|-h)
      echo "Usage: bash scripts/install-company.sh [--force]"
      echo "  --force  Overwrite existing .company/ and plugin files"
      exit 0
      ;;
  esac
done

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Company Plugin Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# --- 1. Clone source ---
echo "📥 ソースリポジトリを取得中..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR" 2>/dev/null
info "リポジトリを取得しました"

# --- 2. Install plugin files ---
echo ""
echo "📦 プラグインをインストール中..."

PLUGIN_SRC="$TMP_DIR/plugins/company"
PLUGIN_DST="$PROJECT_DIR/plugins/company"

if [ -d "$PLUGIN_DST" ] && [ "$FORCE" = false ]; then
  warn "plugins/company/ は既に存在します（--force で上書き可）"
  # Still copy missing skills
  for skill_dir in "$PLUGIN_SRC/skills/"*/; do
    skill_name=$(basename "$skill_dir")
    if [ ! -d "$PLUGIN_DST/skills/$skill_name" ]; then
      cp -r "$skill_dir" "$PLUGIN_DST/skills/$skill_name"
      info "  新スキル追加: $skill_name"
    fi
  done
else
  mkdir -p "$(dirname "$PLUGIN_DST")"
  rm -rf "$PLUGIN_DST"
  cp -r "$PLUGIN_SRC" "$PLUGIN_DST"
  info "plugins/company/ をインストールしました"
fi

# --- 3. Install .company/ (HD org data) ---
echo ""
echo "🏢 HD組織データをインストール中..."

COMPANY_SRC="$TMP_DIR/.company"
COMPANY_DST="$PROJECT_DIR/.company"

if [ -d "$COMPANY_DST" ] && [ "$FORCE" = false ]; then
  warn ".company/ は既に存在します（--force で上書き可）"
else
  rm -rf "$COMPANY_DST"
  cp -r "$COMPANY_SRC" "$COMPANY_DST"
  info ".company/ をインストールしました"
fi

# --- 4. Install .company-* (subsidiaries) ---
echo ""
echo "🏗  子会社データをインストール中..."

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
done

# --- 5. Install hooks ---
echo ""
echo "🪝 Hooksをインストール中..."

HOOKS_DST="$PROJECT_DIR/.claude/hooks"
mkdir -p "$HOOKS_DST"

for hook_file in "$TMP_DIR/.claude/hooks"/company-*.sh; do
  [ -f "$hook_file" ] || continue
  hook_name=$(basename "$hook_file")
  cp "$hook_file" "$HOOKS_DST/$hook_name"
  chmod +x "$HOOKS_DST/$hook_name"
  info "  $hook_name"
done

# --- 6. Update .claude-plugin/marketplace.json ---
echo ""
echo "📋 marketplace.json を更新中..."

MARKETPLACE="$PROJECT_DIR/.claude-plugin/marketplace.json"
mkdir -p "$(dirname "$MARKETPLACE")"

# Collect all skill directories
SKILLS_JSON="["
first=true
for skill_dir in "$PLUGIN_DST/skills/"*/; do
  [ -d "$skill_dir" ] || continue
  skill_name=$(basename "$skill_dir")
  if [ "$first" = true ]; then
    first=false
  else
    SKILLS_JSON+=","
  fi
  SKILLS_JSON+="\"./plugins/company/skills/$skill_name\""
done
SKILLS_JSON+="]"

# Generate marketplace.json
cat > "$MARKETPLACE" <<JSONEOF
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
      "source": "./plugins/company",
      "description": "HD + PJ company virtual organization management",
      "strict": false,
      "skills": $SKILLS_JSON
    }
  ]
}
JSONEOF
info "marketplace.json を更新しました"

# --- 7. Update settings.json (add company hook if missing) ---
echo ""
echo "⚙️  settings.json を更新中..."

SETTINGS="$PROJECT_DIR/.claude/settings.json"

if [ -f "$SETTINGS" ]; then
  if grep -q '"^/company"' "$SETTINGS"; then
    info "company hook は既に設定済み"
  else
    # Use node/python to safely update JSON, fallback to jq
    if command -v node &>/dev/null; then
      node -e "
        const fs = require('fs');
        const s = JSON.parse(fs.readFileSync('$SETTINGS', 'utf8'));
        if (!s.hooks) s.hooks = {};
        if (!s.hooks.UserPromptSubmit) s.hooks.UserPromptSubmit = [];

        const hasCompanyHook = s.hooks.UserPromptSubmit.some(h => h.matcher === '^/company');
        if (!hasCompanyHook) {
          s.hooks.UserPromptSubmit.push({
            matcher: '^/company',
            hooks: [{ type: 'command', command: '.claude/hooks/company-pull.sh' }]
          });
        }

        // Ensure plugin is enabled
        if (!s.enabledPlugins) s.enabledPlugins = {};
        s.enabledPlugins['company@ai-company'] = true;

        // Ensure marketplace is registered
        if (!s.extraKnownMarketplaces) s.extraKnownMarketplaces = {};
        if (!s.extraKnownMarketplaces['ai-company']) {
          s.extraKnownMarketplaces['ai-company'] = {
            source: { source: 'github', repo: 'boku-miyaji/claude_dev', path: '$PROJECT_DIR' }
          };
        }

        fs.writeFileSync('$SETTINGS', JSON.stringify(s, null, 2) + '\n');
      "
      info "settings.json を更新しました"
    else
      warn "node が見つかりません。settings.json の手動更新が必要です"
    fi
  fi
else
  warn "settings.json が見つかりません"
fi

# --- Done ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✅ インストール完了${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "インストール内容:"
echo "  📦 plugins/company/skills/  → $(ls -d "$PLUGIN_DST/skills/"*/ 2>/dev/null | wc -l) スキル"
echo "  🏢 .company/                → HD組織データ"
echo "  🏗  .company-*/              → $(ls -d "$PROJECT_DIR"/.company-*/ 2>/dev/null | wc -l) 子会社"
echo "  🪝 .claude/hooks/           → $(ls "$HOOKS_DST"/company-*.sh 2>/dev/null | wc -l) hooks"
echo ""
echo "⚡ セッションを再起動して /company を実行してください"
echo ""
