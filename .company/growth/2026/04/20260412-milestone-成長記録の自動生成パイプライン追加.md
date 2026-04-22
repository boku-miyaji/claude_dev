# 成長記録の自動生成パイプライン追加

- **type**: `milestone`
- **date**: 2026-04-12
- **category**: process / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: automation, growth, hook, focus-you
- **commits**: 571bef2

## what_happened
prompt_log と git log から日次で成長イベントを抽出・記録する仕組みを新設。daily-growth-digest.sh などの hook を追加した。

## root_cause
日々の意思決定や学びが会話に埋もれて蓄積されていなかった

## countermeasure
hook + バッチ分析で成長イベントを構造化 JSON として永続化

## result
振り返り・週次digestの基盤が整備された

<!-- id: 0a1b41c0-29da-4d0e-ac9d-c46f8f47cfa4 -->
