# 情報収集部レポートの品質改善要件

- **type**: `countermeasure`
- **date**: 2026-03-31
- **category**: quality / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, automation, llm-retroactive, llm-classified

## what_happened
情報収集部のレポートに日付が書かれていない・前回と同じ内容を繰り返す・ユーザー興味への追随が弱いという問題を指摘。対策として日付明記・同内容排除・リンククリックベースのスコア調整・項目単位のいいねボタン・プロンプト履歴からの興味推定検索を追加することを決定。

## root_cause
情報の鮮度と差分を意識したテンプレートになっていなかった、ユーザーフィードバックの学習ループがなかった

## countermeasure
レポート先頭に日付必須化、既報ネタ除外、クリック/いいねシグナル反映、プロンプト履歴からの興味推定

<!-- id: 7a73f41c-eaa4-4fdf-93d8-23d2a12ebbab -->
