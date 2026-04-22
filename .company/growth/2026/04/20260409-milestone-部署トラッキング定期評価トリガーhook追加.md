# 部署トラッキング+定期評価トリガーHook追加

- **type**: `milestone`
- **date**: 2026-04-09
- **category**: automation / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: hook, organization, dept-tracking, agent-harness
- **commits**: 779dee6, f2ed764

## what_happened
部署（サブエージェント）の起動をSupabaseに記録するagent-activity-log.shと、蓄積をトリガーにdept-eval-trigger.shを追加。人事部の評価軸に必要なデータ収集基盤を自動化した。

## root_cause
部署の稼働率・一発OK率を手動で測れず、組織最適化エンジンが機能していなかった

## countermeasure
PostToolUse Hookで部署起動を記録、閾値到達で評価を自動トリガー

## result
Blueprintにも反映済み。人事部の評価データが自動で溜まる状態に

<!-- id: 761e65f1-e7e9-48fc-be7c-e32412ce7537 -->
