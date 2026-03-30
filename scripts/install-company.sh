#!/bin/bash
# install-company.sh
# boku-miyaji/claude_dev から company プラグインを1コマンドでインストールする
#
# Usage:
#   bash scripts/install-company.sh
#   bash scripts/install-company.sh --force   # 既存ファイルも上書き
#
# インストール先:
#   ~/.claude/plugins/marketplaces/ai-company/  ← プラグイン・スキル
#   $PROJECT_DIR/.company/                      ← HD組織データ
#   $PROJECT_DIR/.company-*/                    ← 子会社データ
#   $PROJECT_DIR/.claude/hooks/                 ← Hooks
#   $PROJECT_DIR/.claude/settings.json          ← 設定追記

set -euo pipefail

REPO_URL="https://github.com/boku-miyaji/claude_dev.git"
TMP_DIR="/tmp/claude_dev_install_$$"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MARKETPLACE_DIR="$HOME/.claude/plugins/marketplaces/ai-company"
CACHE_DIR="$HOME/.claude/plugins/cache/ai-company/company"
FORCE=false

# Parse args
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

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# --- 1. Clone source ---
echo "📥 ソースリポジトリを取得中..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR" 2>/dev/null
info "リポジトリを取得しました"

# --- 2. Install plugin to ~/.claude/plugins/marketplaces/ ---
echo ""
echo "📦 プラグインをインストール中..."

PLUGIN_SRC="$TMP_DIR/plugins/company"

if [ -d "$MARKETPLACE_DIR/plugins/company" ] && [ "$FORCE" = false ]; then
  warn "marketplace プラグインは既に存在します"
  # Still copy missing skills
  added=0
  for skill_dir in "$PLUGIN_SRC/skills/"*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    if [ ! -d "$MARKETPLACE_DIR/plugins/company/skills/$skill_name" ]; then
      cp -r "$skill_dir" "$MARKETPLACE_DIR/plugins/company/skills/$skill_name"
      info "  新スキル追加: $skill_name"
      added=$((added + 1))
    fi
  done
  [ "$added" -eq 0 ] && info "  スキルは全て最新です"
else
  mkdir -p "$MARKETPLACE_DIR/plugins/company"
  rm -rf "$MARKETPLACE_DIR/plugins/company"
  cp -r "$PLUGIN_SRC" "$MARKETPLACE_DIR/plugins/company"
  info "plugins/company/ をインストールしました"
fi

# --- 3. Install marketplace.json ---
echo ""
echo "📋 marketplace.json を生成中..."

mkdir -p "$MARKETPLACE_DIR/.claude-plugin"

# Collect all skill directories
SKILLS_JSON="["
first=true
for skill_dir in "$MARKETPLACE_DIR/plugins/company/skills/"*/; do
  [ -d "$skill_dir" ] || continue
  skill_name=$(basename "$skill_dir")
  if [ "$first" = true ]; then
    first=false
  else
    SKILLS_JSON+=","
  fi
  SKILLS_JSON+=$'\n'"        \"./plugins/company/skills/$skill_name\""
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
      "source": "./plugins/company",
      "description": "HD + PJ company virtual organization management",
      "strict": false,
      "skills": $SKILLS_JSON
    }
  ]
}
JSONEOF
info "marketplace.json を生成しました"

# --- 4. Clear plugin cache (force re-discovery) ---
echo ""
echo "🗑  プラグインキャッシュをクリア中..."

if [ -d "$CACHE_DIR" ]; then
  rm -rf "$CACHE_DIR"
  info "キャッシュをクリアしました"
else
  info "キャッシュなし（スキップ）"
fi

# --- 5. Install .company/ (HD org data) ---
echo ""
echo "🏢 HD組織データをインストール中..."

COMPANY_SRC="$TMP_DIR/.company"
COMPANY_DST="$PROJECT_DIR/.company"

if [ -d "$COMPANY_DST" ] && [ "$FORCE" = false ]; then
  warn ".company/ は既に存在します（--force で上書き可）"
else
  # --force でもデータディレクトリは保護
  if [ "$FORCE" = true ] && [ -d "$COMPANY_DST" ]; then
    for protect_dir in secretary/notes secretary/todos secretary/inbox hr/evaluations; do
      if [ -d "$COMPANY_DST/$protect_dir" ]; then
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

# --- 6. Install .company-* (subsidiaries) ---
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

# --- 7. Install hooks ---
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

# --- 8. Update settings.json ---
echo ""
echo "⚙️  settings.json を更新中..."

SETTINGS="$PROJECT_DIR/.claude/settings.json"

if [ -f "$SETTINGS" ]; then
  if command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const s = JSON.parse(fs.readFileSync('$SETTINGS', 'utf8'));

      // Ensure hooks structure
      if (!s.hooks) s.hooks = {};
      if (!s.hooks.UserPromptSubmit) s.hooks.UserPromptSubmit = [];

      // Add company-pull hook if missing
      const hasCompanyHook = s.hooks.UserPromptSubmit.some(
        h => h.matcher === '^/company'
      );
      if (!hasCompanyHook) {
        s.hooks.UserPromptSubmit.push({
          matcher: '^/company',
          hooks: [{ type: 'command', command: '.claude/hooks/company-pull.sh' }]
        });
      }

      // Enable plugin
      if (!s.enabledPlugins) s.enabledPlugins = {};
      s.enabledPlugins['company@ai-company'] = true;

      // Register marketplace
      if (!s.extraKnownMarketplaces) s.extraKnownMarketplaces = {};
      s.extraKnownMarketplaces['ai-company'] = {
        source: { source: 'github', repo: 'boku-miyaji/claude_dev', path: '.' }
      };

      fs.writeFileSync('$SETTINGS', JSON.stringify(s, null, 2) + '\n');
    "
    info "settings.json を更新しました"
  else
    warn "node が見つかりません。settings.json の手動更新が必要です"
    echo "  以下を settings.json に追記してください:"
    echo '  "enabledPlugins": { "company@ai-company": true }'
    echo '  "extraKnownMarketplaces": { "ai-company": { "source": { "source": "github", "repo": "boku-miyaji/claude_dev", "path": "." } } }'
  fi
else
  warn "settings.json が見つかりません: $SETTINGS"
fi

# --- Done ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✅ インストール完了${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "インストール内容:"
echo "  📦 ~/.claude/plugins/marketplaces/ai-company/"
echo "     └── plugins/company/skills/ → $(ls -d "$MARKETPLACE_DIR/plugins/company/skills/"*/ 2>/dev/null | wc -l) スキル"
echo "  🏢 .company/                   → HD組織データ"
echo "  🏗  .company-*/                 → $sub_count 子会社"
echo "  🪝 .claude/hooks/              → $hook_count hooks"
echo ""
echo "⚡ セッションを再起動して /company を実行してください"
echo ""
