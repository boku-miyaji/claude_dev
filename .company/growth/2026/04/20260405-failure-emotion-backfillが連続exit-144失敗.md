# Emotion backfillが連続exit 144失敗

- **type**: `failure`
- **date**: 2026-04-05
- **category**: devops / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, backend, operations, llm-retroactive, llm-classified

## what_happened
感情分析バックフィルのバックグラウンドコマンドが4回連続でexit code 144で失敗（env読み込み修正版含む）。254エントリの処理が完走しない状態が継続。

## root_cause
バックグラウンド実行環境でのenv/タイムアウト問題

## countermeasure
curlベースのbackfillに切り替え

## result
最終的にcurlベース版でexit code 0で完走（254エントリ処理）

<!-- id: 31b63639-eace-4c2a-9a62-fc27d579e5ec -->
