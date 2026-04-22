# Requests.tsxの通知機能をシンプル化

- **type**: `decision`
- **date**: 2026-04-14
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: llm-retroactive
- **tags**: focus-you, ui, frontend, llm-retroactive, llm-classified

## what_happened
Requests.tsx の通知機能について「複雑すぎる」「やりたいことではない」と方針転換を指示。毎回日記を入れた後に反応するだけでよい、朝と夜の通知はあってもいい、「みていましたよ」のような表現は不要、という方針を明確化した。

## root_cause
過剰設計で機能が複雑化していた

## result
シンプルな日記反応通知+朝夜通知のみの方針に決定

<!-- id: 28af3b79-7180-4a2e-83fc-04ab7659dabf -->
