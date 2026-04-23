# Requests機能は日記反応のみに簡素化

- **type**: `decision`
- **date**: 2026-04-23
- **category**: architecture / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: focus-you, ui, simplification, auto-detected, daily-batch, llm-classified

## what_happened
Requests.tsxが複雑すぎる。「みていましたよ」等の機能は不要。毎回日記を入れた後にAIが反応する+朝夜の通知だけのシンプルな設計に決定。

## result
複雑な機能を削ぎ落としてシンプルな日記反応+朝夜通知の構成で行く。

<!-- id: 783f7379-7b45-4407-a4c3-07175063d6b2 -->
