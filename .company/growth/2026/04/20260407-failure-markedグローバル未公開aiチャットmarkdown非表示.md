# markedグローバル未公開→AIチャットmarkdown非表示

- **type**: `failure`
- **date**: 2026-04-07
- **category**: tooling / **severity**: medium
- **status**: resolved
- **source**: manual
- **tags**: legacy, vite, focus-you

## what_happened
ViteビルドでmarkedがESモジュール化→グローバル未公開→プレーンテキスト表示

## root_cause
レガシーコードのCDN前提参照がVite移行で破綻

## countermeasure
import+window.marked公開

## result
markdown正常レンダリング

<!-- id: 0a8c0305-a9bf-4306-b743-9f28618ba39a -->
