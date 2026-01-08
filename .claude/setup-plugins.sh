#!/bin/bash

# Claude Code Plugin Setup Script
# This script helps set up the recommended plugins for this project

set -e

echo "🔌 Claude Code Plugin Setup"
echo "============================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Claude Code is installed
if ! command -v claude &> /dev/null; then
    echo -e "${RED}❌ Error: Claude Code CLI is not installed${NC}"
    echo "Please install Claude Code first:"
    echo "  npm install -g @anthropic-ai/claude-code"
    exit 1
fi

echo -e "${GREEN}✓${NC} Claude Code CLI found"
echo ""

# Recommended plugins for this project
declare -A PLUGINS
PLUGINS["document-skills"]="anthropic-agent-skills"
PLUGINS["frontend-design"]="claude-plugins-official"
PLUGINS["context7"]="claude-plugins-official"
PLUGINS["serena"]="claude-plugins-official"
PLUGINS["pr-review-toolkit"]="claude-plugins-official"
PLUGINS["github"]="claude-plugins-official"
PLUGINS["code-review"]="claude-plugins-official"
PLUGINS["security-guidance"]="claude-plugins-official"
PLUGINS["supabase"]="claude-plugins-official"
PLUGINS["commit-commands"]="claude-plugins-official"

echo "📦 Recommended Plugins:"
echo ""
for plugin in "${!PLUGINS[@]}"; do
    echo "  • ${plugin}@${PLUGINS[$plugin]}"
done
echo ""

# Ask user if they want to install all or select
read -p "Install all recommended plugins? (y/n): " install_all

if [[ "$install_all" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Installing all plugins..."
    echo ""

    for plugin in "${!PLUGINS[@]}"; do
        marketplace="${PLUGINS[$plugin]}"
        echo -e "${YELLOW}Installing${NC} ${plugin}@${marketplace}..."

        # Note: Actual installation command depends on Claude Code CLI
        # This is a placeholder - adjust based on actual CLI commands
        echo "  → Please install manually in Claude Code: /plugin install ${plugin}@${marketplace}"
    done
else
    echo ""
    echo -e "${YELLOW}Please install plugins manually in Claude Code:${NC}"
    echo ""
    for plugin in "${!PLUGINS[@]}"; do
        marketplace="${PLUGINS[$plugin]}"
        echo "  /plugin install ${plugin}@${marketplace}"
    done
fi

echo ""
echo "📝 Additional Setup Steps:"
echo ""
echo "1. Initialize plugin marketplaces (if using git submodules):"
echo "   cd .claude/plugins/marketplaces"
echo "   git submodule update --init --recursive"
echo ""
echo "2. Verify installed plugins:"
echo "   claude plugins list"
echo ""
echo -e "${GREEN}✓${NC} Setup script completed!"
echo ""
echo "For more information, see README.md"
