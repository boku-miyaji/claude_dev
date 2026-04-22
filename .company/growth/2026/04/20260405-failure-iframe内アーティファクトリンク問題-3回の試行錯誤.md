# iframe内アーティファクトリンク問題 — 3回の試行錯誤

- **type**: `failure`
- **date**: 2026-04-05
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: tooling, dashboard, iframe, postMessage, artifacts, security, claude-dev
- **commits**: fe52cff, 06e6742, 6cc9d43

## what_happened
HTMLアーティファクトをiframe内で表示する際、内部リンクをクリックしても親フレームに遷移しない問題。(1)window.top.location.hashを試す→セキュリティ制約で失敗 (2)injected scriptでインターセプト→不安定 (3)最終的にpostMessage通信で親がshowDetail()を呼ぶ方式に。PDFもbase64→Blob URL変換で安定表示。

## root_cause
iframeのsame-origin policyにより、iframe内から親フレームのDOMを直接操作できない。

## countermeasure
postMessage APIで子iframe→親フレームに「navigateArtifact」メッセージを送信。親がメッセージを受信してルーティング処理。

## result
iframeとの通信はpostMessageが唯一の安全な方法。直接DOM操作やlocation変更はセキュリティ制約に阻まれる。

<!-- id: d25f58a9-4af3-4a14-b51c-07140ff890bf -->
