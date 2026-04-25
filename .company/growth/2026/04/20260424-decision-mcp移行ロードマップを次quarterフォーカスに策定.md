# MCP移行ロードマップを次quarterフォーカスに策定

- **type**: `decision`
- **date**: 2026-04-24
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, operations, migration, auto-detected, daily-digest
- **commits**: 9b353ef

## what_happened
Claude Code v2.1.119のMCP parallelizationで67%起動時間削減が実証されたことを受け、Hook(sb.sh)→MCP serverの3フェーズ段階移行計画をrules/hd-operations.mdに明文化。Phase1=Supabase読み書き、Phase2=GitHub API、Phase3=カレンダー。記録系Hookは移行対象外。

## root_cause
Claude Code v2.1.119のMCP parallelization機能で大幅な起動時間短縮が確認されたため

## result
Hookは軽量イベント記録に留め、データアクセス・集計はMCP serverに分離する方針を確立

<!-- id: 9f44ff1b-dfce-4314-bed6-dbd0f758fea0 -->
