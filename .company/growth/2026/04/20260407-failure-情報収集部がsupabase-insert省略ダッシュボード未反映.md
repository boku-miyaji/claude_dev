# 情報収集部がSupabase INSERT省略→ダッシュボード未反映

- **type**: `failure`
- **date**: 2026-04-07
- **category**: process / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: intelligence, sub-agent, claude-dev

## what_happened
ファイル保存のみでsecretary_notes+news_items未登録

## root_cause
Sub-agentがCLAUDE.mdのルールを無視。IMPORTANTマーカーなし

## countermeasure
Agent定義にIMPORTANT+4ステップチェックリスト追加

## result
ダッシュボードにニュース正常表示

<!-- id: 355a48e0-1036-42cd-b3db-5073cc39f875 -->
