# narrator/news-enrich を Claude CLI に移行

- **type**: `decision`
- **date**: 2026-04-22
- **category**: devops / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, cost, automation, auto-detected, daily-digest
- **commits**: 9b453c3

## what_happened
Edge Function経由でAnthropic APIを叩いていた narrator-update と news-enrich のバッチ処理を、GitHub Actions上の `claude --print` (Claude Code CLI) 実行に置換。コスト分離原則（ダッシュボード=gpt-5-nano、バッチ=Claude CLI、Hook=API禁止）に沿った運用統一。

## root_cause
バッチ処理でもAnthropic APIの従量課金が発生しており、既存の「コスト分離原則」との齟齬が残っていた。

## countermeasure
Claude Max枠でまかなえるCLI実行に切り替え、Edge FunctionからAPI呼び出しロジックを撤去。

## result
バッチのAPI課金ゼロ化。コスト分離原則の運用がダッシュボード/バッチ/Hookの3経路すべてで一貫。

<!-- id: 1be642cf-9635-4fc8-aff8-7341e12ad40e -->
