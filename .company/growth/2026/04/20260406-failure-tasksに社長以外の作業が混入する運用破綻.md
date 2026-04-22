# tasksに社長以外の作業が混入する運用破綻

- **type**: `failure`
- **date**: 2026-04-06
- **category**: process / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, automation, llm-retroactive, llm-classified

## what_happened
社長が実施することではないタスクまでtasksテーブルに勝手に追加されており、requestsとの分離運用が機能していない。分類定義はあるが実運用で守られていない状態。

## root_cause
タスク登録時の宛先判定ロジックが機能していない or 秘書がtasks/requestsの境界を守れていない

## countermeasure
宛先の分類定義を再確認し、社長以外の作業はrequestsに入れる運用を徹底する

<!-- id: ce37a0ab-9027-4f89-96e5-9c72fb9872a7 -->
