# permission承認が頻繁すぎて作業を阻害

- **type**: `failure`
- **date**: 2026-04-17
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, automation, hook, llm-retroactive, llm-classified

## what_happened
破壊的作業以外でもpermission承認ダイアログが頻繁に出て作業効率を下げていた。社長が「必要以上に聞いてくる。破壊的作業以外は全部許可したい」と訴えた。

## root_cause
permission設定が過度に厳格で、読み取り系・安全なコマンドまで毎回承認を要求していた

## countermeasure
permissionレベルの切り替え機構（/permission スキル、low レベル等）を整備し、破壊的作業以外を自動許可するモードを提供する

<!-- id: 9cd847e9-dfcd-4833-bfe9-3b38b556f98a -->
