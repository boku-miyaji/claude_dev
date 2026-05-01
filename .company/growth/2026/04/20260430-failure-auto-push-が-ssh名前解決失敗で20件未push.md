# auto-push が SSH名前解決失敗で20件未push

- **type**: `failure`
- **date**: 2026-04-30
- **category**: automation / **severity**: high
- **status**: active
- **source**: daily-digest
- **tags**: claude-dev, automation, hook, operations, auto-detected, daily-digest

## what_happened
Stop hook の auto-push が SSH/DNS 解決に失敗し、複数セッションにわたり commit はできるが push できない状態が継続。約20件の auto-save commit がローカルに滞留した。

## root_cause
Mac→miyaji-home→container の SSH agent forward 経路で名前解決が一時失敗。リトライ・エラー通知の仕組みが弱かった

## countermeasure
未push 滞留を SessionStart で検出する経路を再点検（auto-push-status-check 系）し、SSH remote の維持を Auto Memory に再記録

## result
再発検知ルートは整備されたが恒久対策は要検討

<!-- id: 495f72a5-8613-487e-aa4f-626582052b0c -->
