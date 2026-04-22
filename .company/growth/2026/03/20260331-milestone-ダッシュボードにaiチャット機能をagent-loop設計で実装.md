# ダッシュボードにAIチャット機能をagent-loop設計で実装

- **type**: `milestone`
- **date**: 2026-03-31
- **category**: architecture / **severity**: high
- **status**: active
- **source**: backfill
- **tags**: ai-chat, agent-loop, opencode, dashboard, focus-you
- **commits**: 70cc2bb, 3eaf414, 87a461a, e26a948, 83f4d06

## what_happened
ChatGPT風のAIチャット機能をダッシュボードに追加。OpenCodeを参考にagent-loopアーキテクチャで設計し、過去の会話保持・プロンプト履歴・タスクに応じたモデル選択を実現。設計ドキュメント2本と実装、マイグレーションを同日で投入。

## root_cause
社長からの大幅機能アップデート要望。コスト・速度最適化を重視

## countermeasure
リサーチ部でOpenCode調査→AI開発部で設計v2→システム開発で実装のパイプライン実行

## result
agent-loop版AIチャットが動作、後続で OpenAI のみに絞る調整も実施

<!-- id: c2c8aa4b-a7be-41e9-91aa-b762c49052ad -->
