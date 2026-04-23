# sb.sh Supabase APIラッパー導入で承認削減

- **type**: `decision`
- **date**: 2026-04-22
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, tooling, supabase, auto-detected, daily-digest
- **commits**: 13a5c5b

## what_happened
Hook/CLI/バッチからのSupabase API呼び出しを `.claude/hooks/api/sb.sh` ラッパー経由に統一。query/get/post/patch/delete/fn の6パターンに標準化し、env source とx-ingest-key付与を隠蔽。rules/supabase-access.md で強制。

## root_cause
`source supabase.env && curl ...` の生コマンドが毎回承認ダイアログを発生させ、URL・ヘッダ・ingest-keyの付け忘れも頻発していた。

## countermeasure
Bash(.claude/hooks/api/sb.sh:*) をallowに載せ、新規コードはsb.sh必須、既存の生curlは触るタイミングで書き換える方針に。

## result
承認プロンプト削減、Supabaseアクセスの標準パス確立、プロンプト短縮。

<!-- id: 431c176c-10b2-4180-b749-61aa5d2149f5 -->
