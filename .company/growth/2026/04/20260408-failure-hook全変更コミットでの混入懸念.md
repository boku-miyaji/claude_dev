# hook全変更コミットでの混入懸念

- **type**: `failure`
- **date**: 2026-04-08
- **category**: process / **severity**: low
- **status**: active
- **source**: llm-retroactive
- **tags**: claude-dev, hook, llm-retroactive, llm-classified

## what_happened
hookに関して全変更をコミットする運用について『管理すべきじゃないものもコミットされたりしない？』という懸念が社長から示された。一時ファイルや環境依存ファイルの混入リスク。

## root_cause
hookの変更対象ファイルに一時的/ローカル専用ファイルが含まれる可能性

<!-- id: 11574e72-0a3e-43b1-88af-609de974973c -->
