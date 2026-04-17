#!/bin/bash
# Hook: PostToolUse (Edit|Write) — 実装変更時にドキュメント同期を警告
# 対象ファイルが変更されたら How It Works の更新を促す

set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null || true)

[ -z "$FILE" ] && exit 0

# 実装ファイル → ドキュメント対応表
NEEDS_UPDATE=""

case "$FILE" in
  */supabase/functions/ai-agent/index.ts)
    NEEDS_UPDATE="AI Features タブ（モデル設定、ルーティング、ツール一覧、プロンプト構成）"
    ;;
  */src/hooks/useSelfAnalysis.ts)
    NEEDS_UPDATE="AI Features タブ（5. 自己分析カード: 入力/パイプライン/出力）+ Design Philosophy タブ（ハイブリッド分析方式）"
    ;;
  */src/pages/SelfAnalysis.tsx)
    NEEDS_UPDATE="AI Features タブ（5. 自己分析カード: 出力/可視化）"
    ;;
  */src/hooks/useEmotionAnalysis.ts)
    NEEDS_UPDATE="AI Features タブ（1. 感情分析カード）+ Overview タブ（更新連鎖マップ）"
    ;;
  */src/hooks/useMorningBriefing.ts)
    NEEDS_UPDATE="AI Features タブ（2. AI Partnerカード）"
    ;;
  */src/hooks/useWeeklyNarrative.ts)
    NEEDS_UPDATE="AI Features タブ（4. 週次ナラティブカード）"
    ;;
  */src/hooks/useDreamDetection.ts)
    NEEDS_UPDATE="AI Features タブ（3. 夢進捗検出カード）"
    ;;
  */src/lib/aiPartner.ts)
    NEEDS_UPDATE="AI Features タブ（2. AI Partnerカード: プロンプト/コンテキスト）+ Vision タブ（Narrative Intelligence）"
    ;;
  */src/pages/Today.tsx)
    NEEDS_UPDATE="Design Philosophy タブ（体験設計セクション）"
    ;;
  */.claude/hooks/*.sh)
    NEEDS_UPDATE="Overview タブ（データ鮮度マップ、更新連鎖マップ）+ Harness Engineering タブ（Hooks詳細）+ Operations タブ（同期メカニズム）"
    ;;
  */.claude/rules/*.md)
    NEEDS_UPDATE="Operations タブ（パイプライン、ハンドオフ）+ Harness Engineering タブ"
    ;;
  */.company/departments/*/CLAUDE.md)
    NEEDS_UPDATE="Operations タブ（部署サイクル設計テーブル）"
    ;;
  */.company/freshness-policy.yaml)
    NEEDS_UPDATE="Overview タブ（自動メンテナンスセクション）"
    ;;
  */.company/design-philosophy.md)
    NEEDS_UPDATE="Design Philosophy タブ（同期確認）"
    ;;
  */src/lib/fileExtract.ts)
    NEEDS_UPDATE="AI Features タブ（ファイル抽出対応形式）"
    ;;
  */supabase-migration-*.sql)
    NEEDS_UPDATE="AI Features タブ（データ構造テーブル一覧）"
    ;;
esac

if [ -n "$NEEDS_UPDATE" ]; then
  cat <<EOF
{
  "additionalContext": "WARNING: ${FILE} を変更しました。Blueprint ページの更新が必要です: ${NEEDS_UPDATE}。commit前に company-dashboard/src/pages/Blueprint.tsx を確認・更新してください。"
}
EOF
fi

exit 0
