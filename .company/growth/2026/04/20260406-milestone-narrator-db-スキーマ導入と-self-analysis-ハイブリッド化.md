# Narrator DB スキーマ導入と Self-Analysis ハイブリッド化

- **type**: `milestone`
- **date**: 2026-04-06
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: narrator, self-analysis, schema, product-vision
- **commits**: 011c977, bb13c57, ea69a5f, e0b3a64, 04546db, fc285d1

## what_happened
story_memory/story_moments/shared_stories の Narrator 用スキーマを追加し、Self-Analysis に差分分析・全分析ボタンとハイブリッド分析モード、統合Summaryタブを実装。データソース文脈（Claude Code指示 vs AIチャット）の区別もプロンプトに反映。

## root_cause
個人の物語・自己理解を軸にしたプロダクトビジョンに沿って、分析の粒度と文脈理解を深める必要があった

## countermeasure
DBスキーマ追加 + UI分離 + プロンプト改善を一連のコミットで実装

## result
自己分析の再実行バグ解消、データソース誤認識の修正、物語基盤の土台完成

<!-- id: 4105e8ef-ccc0-4b7d-b445-f58359a6cc7c -->
