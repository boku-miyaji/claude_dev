#!/usr/bin/env bash
# pre-push hook: focus-you (company-dashboard/) に変更があれば typecheck + test を回す
#
# インストール: bash scripts/setup-git-hooks.sh
#
# 失敗したら push をブロック。--no-verify でバイパスしないこと。
# 失敗したら根本原因を直してから再 push する。

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# 比較先 ref: origin/main を基準。fetch されてなければスキップ（初回 push 等）
REMOTE_REF="origin/main"
if ! git rev-parse --verify --quiet "$REMOTE_REF" >/dev/null; then
  exit 0
fi

CHANGED=$(git diff --name-only "$REMOTE_REF..HEAD" -- 'company-dashboard/' 2>/dev/null || true)

if [[ -z "$CHANGED" ]]; then
  exit 0
fi

echo "[pre-push] company-dashboard/ に変更を検出 → typecheck + test を実行"
cd "$REPO_ROOT/company-dashboard"

if ! npx --no-install tsc --noEmit; then
  echo ""
  echo "❌ pre-push: typecheck 失敗。型エラーを直してから再 push してください。"
  echo "   --no-verify でのバイパスは禁止です（AGENTS.md §4 参照）"
  exit 1
fi

if ! npx --no-install vitest run --passWithNoTests --reporter=dot 2>&1; then
  echo ""
  echo "❌ pre-push: vitest 失敗。テストを直してから再 push してください。"
  exit 1
fi

echo "✅ pre-push OK"
exit 0
