# sb.sh+prefer-native-toolsで承認ダイアログ削減

- **type**: `decision`
- **date**: 2026-04-22
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, hook, tooling, auto-detected, daily-digest
- **commits**: 13a5c5b, e6f991f

## what_happened
Supabase API呼び出し用ラッパー `sb.sh` を新設し、`source supabase.env && curl ...` の生書きを廃止。加えて rules/prefer-native-tools.md を新設し、Bash合成コマンドより Read/Glob/Grep を優先するようLLMを誘導する恒久ルールを追加した。

## root_cause
毎回生curlを書いて承認ダイアログが頻発、url/header/ingest-keyの付け忘れも起きていた。Bash合成コマンドの多用で意図が読めなくなる問題も併発

## countermeasure
Bash(.claude/hooks/api/sb.sh:*)をallow済みにしてコマンドを `sb.sh query/get/post/...` に統一。ネイティブツール優先の判断フローを.claude/rules/配下にルール化

## result
承認プロンプトの削減、プロンプト短縮、意図可読性向上

<!-- id: 5eaee2af-d8d5-4165-9bb1-604cba6cc68e -->
