# system-specドキュメントを上流→下流に再整理

- **type**: `countermeasure`
- **date**: 2026-04-23
- **category**: organization / **severity**: medium
- **status**: active
- **source**: detector
- **tags**: rikyu, documentation, auto-detected, daily-batch, llm-classified

## what_happened
rikyuのシステム仕様ドキュメントが分散しすぎて、どこから読めばいいかわからない状態。社長から「system-specに必要なドキュメントおいてほしいのと上流から下流に綺麗にならべてほしい」と指示。各ドキュメントの粒度と整合性を精査し、読む順序が明確になるよう再構成する。

## root_cause
ドキュメントの配置ポリシーがなく、書き足す場所が場当たりだったため情報が分散した。

## countermeasure
system-spec配下に上流→下流の順で並べ、粒度を精査。自力で気付けるズレは事前に修正してから社長レビューへ。

<!-- id: 342927a3-63d8-4e78-a42d-33952c19df4b -->
