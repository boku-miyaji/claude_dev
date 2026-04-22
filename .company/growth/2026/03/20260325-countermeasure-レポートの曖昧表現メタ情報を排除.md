# レポートの曖昧表現・メタ情報を排除

- **type**: `countermeasure`
- **date**: 2026-03-25
- **category**: communication / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, documentation, llm-retroactive, llm-classified

## what_happened
成果物レポートに対し、「v2/v3」等の内部バージョン名を前提知識なしに使う・「テキスト埋め込みや実データでの改善余地あり」等の根拠不明な楽観表現・「LLMが担当すべき」等の断言過多、が複数箇所で指摘された。

## root_cause
レポート生成時に社内文脈を外部視点に変換せず、検証済み事実と推測を区別せずに書いていた

## countermeasure
レポート作成時は(1)内部バージョン名を外から見てわかる語に置換(2)未検証の改善余地に触れない(3)現状の技術ではと限定を付けて断言を避ける

## result
executive_report_final.htmlを結論先行・トグル収納構成に再構築

<!-- id: 88140c08-61e3-4968-a198-d9655b160939 -->
