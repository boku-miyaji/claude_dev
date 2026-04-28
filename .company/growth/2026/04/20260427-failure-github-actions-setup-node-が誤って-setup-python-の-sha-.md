# GitHub Actions setup-node が誤って setup-python の SHA を pinning し全バッチ6日連続停止

- **type**: `failure`
- **date**: 2026-04-27
- **category**: devops / **severity**: high
- **status**: active
- **source**: manual
- **tags**: claude-dev, github-actions, sha-pinning, workflow, batch, silent-failure, manual-record

## what_happened
2026-04-21 から 04-26 まで morning-quote / proactive-prep / news-collect / narrator-update / intelligence-collect / security-scan の 6 workflow が連続失敗。原因は actions/setup-node@SHA に setup-python v5 の SHA (a26af69be951a213d495a4c3e4e4022e16d87065) が誤って当てられ、setup-node リポジトリに該当 commit が存在せず Unable to resolve action エラーで Set up job ステップが落ちていた。気付くきっかけは Today 画面の名言が表示されないという社長指摘で、user_quote_deliveries テーブルが空だったことから判明。

## root_cause
SHA pinning の更新時に setup-node と setup-python に同じ SHA を貼り付ける single-source ミス。レビュー時に SHA 値が同一なことに気づかず通過した。

<!-- id: d521941e-cd5f-48ce-8a11-0833e9c85b9f -->
