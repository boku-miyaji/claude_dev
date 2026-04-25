# AIチャット会話履歴設計（無制限・暗黙評価）

- **type**: `decision`
- **date**: 2026-04-25
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, auto-detected, daily-batch, llm-classified

## what_happened
focus-youのAIチャット設計を決定：会話履歴は無制限保存・人レベル分離・セッション切替UI、明示的なグッドバッドボタンは廃止し暗黙的評価（質問内容・行動・面談情報から満足度を推定）に振る。質問ログは精度改善の重要資産として残す。

## result
ユーザー負担なく分析可能なログ設計が確立

<!-- id: b5665b49-b827-46ae-8802-ad6a51d99db2 -->
