# コメント取得の遅さを次回以降改善する記録

- **type**: `countermeasure`
- **date**: 2026-03-30
- **category**: process / **severity**: low
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, process, documentation, llm-retroactive, llm-classified

## what_happened
/company成果物のコメント取得に時間がかかった。社長から「その方法は次回以降ちゃんとできるように学んで、どこかに記載しておいて」と指示。full-auto実行で当面対応。

## root_cause
コメント取得ロジックが未最適化(具体的手順がナレッジ化されていなかった)。

## countermeasure
取得手順・改善点をナレッジ／ルールに記録し、次回以降は最初から最適化された方法で取得する運用へ。

<!-- id: 48451a76-e5ba-46fd-b35a-3ddef1b35c5f -->
