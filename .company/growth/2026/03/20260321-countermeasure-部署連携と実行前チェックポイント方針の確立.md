# 部署連携と実行前チェックポイント方針の確立

- **type**: `countermeasure`
- **date**: 2026-03-21
- **category**: process / **severity**: high
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, organization, llm-retroactive, llm-classified

## what_happened
設計と実装の部署連携が不十分でやり直しが発生。対策として、作業開始前に（1）報告のタイミング（2）どこまで自動で実行するか（3）実行時間の見積もり（4）必要なパーミッション、の4点を必ず確認する運用を標準化することを決定。

## root_cause
大規模タスクで最後までやってからやり直しだと手戻りコストが大きすぎる。事前合意のプロトコルが欠けていた。

## countermeasure
中〜大規模タスクは起動時に 4 項目（報告タイミング/自動実行範囲/見積もり/権限）をセットで提示し、社長承認後に着手。

<!-- id: 80e1745a-3b69-4009-a1c4-3d01fccf6e8b -->
