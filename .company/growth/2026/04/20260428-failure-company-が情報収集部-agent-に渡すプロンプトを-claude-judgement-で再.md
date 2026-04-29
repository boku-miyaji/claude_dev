# /company が情報収集部 agent に渡すプロンプトを Claude judgement で再構築し、リサーチ部規約を混入させた

- **type**: `failure`
- **date**: 2026-04-28
- **category**: architecture / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, agent-handoff, prompt-design, intelligence, research, manual-record

## what_happened
社長の依頼『/company 情報収集して』に対し、前セッションの Claude が Agent ツール呼び出し時に 6カテゴリ・3段構成（公知情報→限界→壁打ち、これはリサーチ部の規約）・過去2週間・出力先 secretary/notes/ という長いプロンプトを自前で構築。情報収集部のサブエージェントが起動したが、prompt の指示が CLAUDE.md（24h縛り、各社レポート、focus-you/hd-ops 示唆）より強く効き、リサーチ部風の2週間まとめが生成された。dashboard 上で『CEO向けブリーフィング(04/28)』として表示され、社長は『古い・既知ばかり』と感じた

## root_cause
部署委譲時のプロンプト構築が SKILL.md にテンプレ化されておらず、Claude の都度判断に任されていた

## countermeasure
SKILL.md の '部署への振り分け' に (1) 情報収集/リサーチ/調査部の線引き表、(2) 部署委譲時のプロンプト原則（最小プロンプト・別部署規約混入禁止・出力先指定禁止）、(3) 情報収集 prompt 例 を明示追加。pipeline.md の情報収集部モデル haiku→opus に修正（CLI 定額前提）

<!-- id: a47785d4-ee94-46eb-a934-ca8a795f8722 -->
