# ダッシュボード大規模機能拡張（Chat/Calendar/Costs等）

- **type**: `milestone`
- **date**: 2026-04-01
- **category**: automation / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: dashboard, gpt-5, ai-chat, focus-you
- **commits**: 364ecb3, 4947cbf, d1e099a, 1998b98, a5992b7, a515f44

## what_happened
AI ChatをGPT-5系へ移行しVision・ファイルアップロード・パーソナライゼーション・reasoning effort制御を追加。API Costs、Growth Chronicle、Calendar、Career/Portfolio CRUDなど多数のページを実装。

## root_cause
ダッシュボードを日次運用のハブにするための機能不足

## countermeasure
GPT-5対応、Quick Ask全ページ化、精度優先モードとコストガードレール、Claude Code tool usage trackingを一気に実装

## result
運用中核のfocus-youダッシュボードが大幅に強化された

<!-- id: 6562982a-f2e9-4aa3-a2ad-edb68f2b35a6 -->
