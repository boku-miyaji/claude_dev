# 依頼ステータス追跡システムを実装

- **type**: `milestone`
- **date**: 2026-04-23
- **category**: automation / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, hook, operations, auto-detected, daily-digest
- **commits**: 54f9b24

## what_happened
秘書への依頼が done/partial/missed でどう処理されたか追跡できる仕組みを実装。CLAUDE.md に /tmp/claude-req-status.json の書き出しルールを追加し、書き出し漏れを missed として Stop hook で自動記録する。

## root_cause
依頼を出した後に本当に完了したか・取りこぼしはないかを振り返る手段がなかった

## result
依頼 → 処理結果の追跡ができるようになり、見落とし検知が可能に

<!-- id: 84f65315-0a19-4934-b6db-cbac6061c74a -->
