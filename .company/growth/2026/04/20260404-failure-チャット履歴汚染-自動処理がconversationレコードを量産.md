# チャット履歴汚染 — 自動処理がconversationレコードを量産

- **type**: `failure`
- **date**: 2026-04-04
- **category**: architecture / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: architecture, chat, edge-function, data-quality, focus-you
- **commits**: 5351385

## what_happened
AIチャットの履歴に「ping」「あなたは社長のことをよく知って...」「【指示】質問や確認をせず...」等の大量のゴミ会話が表示されていた。

## root_cause
Edge Functionの接続チェック(ping)、ブリーフィング一言、ニュース収集がすべてagent loopエンドポイントを叩いており、毎回conversationレコードが作成されていた。「チャット用API」と「バックグラウンド処理用API」の区別がなかった。

## countermeasure
pingをEdge Functionで即座にreturn。ブリーフィング・ニュース収集をcompletion mode（会話作成なし）に切り替え。

## result
「ユーザー向けの会話」と「バックグラウンド処理」のAPIを明確に分離。completion modeの導入により、今後のバックグラウンドAI処理はすべて会話レコードなしで実行可能に。

<!-- id: c2c6f013-473d-4005-8ab0-f08247e5644d -->
