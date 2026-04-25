# focus-you AIチャット仕様確定

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: high
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, llm-prompt, auto-detected, daily-batch, llm-classified

## what_happened
focus-youのAIチャット機能仕様を決定。会話履歴は無制限保持、セッション分離可能、人レベル分離、グッドバッドボタンは廃止（誰も押さない）、暗黙的評価のみ採用（質問内容・行動・面談情報から満足度を推定）。明示的評価の強要は逆効果。

<!-- id: d7ad5df9-b977-455e-ab15-587bf21ce870 -->
