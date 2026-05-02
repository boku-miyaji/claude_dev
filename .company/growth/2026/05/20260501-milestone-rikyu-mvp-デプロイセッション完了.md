# rikyu MVP デプロイセッション完了

- **type**: `milestone`
- **date**: 2026-05-01
- **category**: architecture / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: rikyu, backend, ci-cd, auto-detected, daily-digest

## what_happened
rikyu MVP の API/Worker（FastAPI 17 endpoints）コア実装を完了し、Azure 環境へのデプロイセッションを実施。Azure ロール権限・Service Bus 命名衝突など複数の障害を踏みつつデプロイまで到達した。

## result
rikyu MVP の最初のデプロイ完了。CI/CD は SP なしで build/push のみ自動化、deploy は手動という方針で着地。

<!-- id: 71c26638-926f-48ec-bbe2-8a407020aede -->
