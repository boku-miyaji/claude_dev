# Azure OpenAI は既存 Foundry (Australia East) を再利用、East US 2 新設は Phase 1 中盤で再判断

- **type**: `decision`
- **date**: 2026-04-30
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: manual
- **tags**: rikyu, azure, openai, ai-foundry, latency

## what_happened
rikyu MVP の Azure OpenAI を構築する際、ACES 内に既存の Foundry Hub steph-mkysqnov-australiaeast / project_rikyu (Australia East) があった。他リソースは East US 2 に揃えているが、新規作成のオーバーヘッドを回避するため既存を再利用する判断。

## countermeasure
既存の Foundry Project project_rikyu に gpt-4o デプロイを作る。Container Apps からは Endpoint と API Key で接続。NAMING.md に「例外: AI Foundry は命名規則対象外」として記録。Phase 1 中盤で同期チャット UX のレイテンシを観測し、遅ければ East US 2 に rikyu-dev-aoai を新設して移行。

## result
クロスリージョン (East US 2 ↔ Australia East) で片道 150-220ms の追加レイテンシ。提案生成のようなバッチ処理では許容、同期チャットでは要観測。

<!-- id: b98628e2-8c84-495d-9b42-91882f51d91a -->
