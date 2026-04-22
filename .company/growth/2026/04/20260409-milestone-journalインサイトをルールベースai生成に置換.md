# Journalインサイトをルールベース→AI生成に置換

- **type**: `milestone`
- **date**: 2026-04-09
- **category**: quality / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: ai, journal, insight
- **commits**: 4c0cd87, e4c741b

## what_happened
Journalページの感情インサイトをハードコードルールからAI生成に置き換え。静的条件分岐で出していた定型文を廃し、Edge Function経由の動的生成に切替。

## root_cause
ルールベースでは「わかってる人のボソッと一言」トーンが出せず汎用語になっていた

## countermeasure
emotion insight generation を Journal に組み込み、その後ルールベース実装を削除

## result
インサイト文の質が向上、トーンガイドと整合

<!-- id: 8073a143-90df-4bb2-a79e-05feb6cec80a -->
