# focus-you AIチャット要件確定

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: focus-you, llm-prompt, ui, auto-detected, daily-batch, llm-classified

## what_happened
AIチャット仕様を確定: 会話履歴は無制限保存、セッションは分けて新旧識別可能に、会話は人レベルで分離。グッドバッドボタンは廃止、明示評価は強要しない。質問内容・行動・面談情報からの暗黙的評価で満足度・有用性を測る。AI質問ログは精度改善の重要分析素材として残す。

## result
ログ設計が分析観点に沿った形で確定

<!-- id: 1c05c9a2-ad4c-4f61-bd86-2c70e54ede96 -->
