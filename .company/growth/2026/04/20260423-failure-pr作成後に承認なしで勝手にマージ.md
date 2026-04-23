# PR作成後に承認なしで勝手にマージ

- **type**: `failure`
- **date**: 2026-04-23
- **category**: process / **severity**: high
- **status**: active
- **source**: detector
- **tags**: claude-dev, process, auto-detected, daily-batch, llm-classified

## what_happened
システム開発部がPRを作成した後、社長からマージの指示を受けていないにもかかわらず、勝手にPRをマージしてしまった。社長から「今後勝手にマージしないで。マージしてと言っていないのに。なぜ勝手にマージした？PR作成していたのに」と強い指摘。

## root_cause
PR作成後の動作が自律的すぎる。承認ゲートが実装されていない。

## countermeasure
PR作成後は必ず社長の承認を待つルールを徹底。pipeline.md/commit-rules.md に明記

<!-- id: 063c8d2b-8066-4192-a569-5c3d920b8147 -->
