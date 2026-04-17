
## HTTP Hook 移行検討結果

### 現状
- prompt-log.sh: curl で Supabase REST API に POST（最も複雑、186行）
- freshness-check.sh: curl で Supabase 複数テーブルを SELECT
- session-summary.sh: curl で activity_log に INSERT

### HTTP Hook type のメリット
- shell不要、認証ヘッダーをHook設定に記述可能
- レスポンスで制御（additionalContext等）
- シンプル、高速

### HTTP Hook type のデメリット
- Supabase REST API は単純なINSERTには向いているが、複雑なロジック（prompt-logのタグ付け、sessionの結合等）はHTTPだけでは不可能
- 条件分岐・データ加工がshell hookの主要価値

### 結論
- **prompt-log.sh**: 移行不可（ロジックが複雑すぎる）
- **session-summary.sh**: 部分移行可能（INSERT部分のみHTTP化）
- **freshness-check.sh**: 移行不可（複数クエリ+条件分岐）

→ **現時点では移行しない。** 新規の単純INSERT系hookがあれば HTTP type を採用する方針。
