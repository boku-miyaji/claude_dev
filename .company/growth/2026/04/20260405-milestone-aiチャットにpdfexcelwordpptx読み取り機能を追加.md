# AIチャットにPDF/Excel/Word/PPTX読み取り機能を追加

- **type**: `milestone`
- **date**: 2026-04-05
- **category**: tooling / **severity**: high
- **status**: resolved
- **source**: manual
- **tags**: tooling, ai-chat, pdf, file-extraction, pdfjs, vite
- **commits**: bc528b2, e04a856, b2be99e, 3578da3, bd0e78e

## what_happened
AIチャットでファイルをアップロードするとテキスト抽出してコンテキストに含める機能を実装。しかしpdf.jsのworker設定で3連続fix（disable worker→CDN worker→local Vite import→CDN fallback）が必要だった。

## root_cause
pdf.jsはWeb Workerを使うが、Viteのビルド環境でworkerSrcのパス解決が複雑。npm版、CDN版、Vite ?url import版を順に試行。

## countermeasure
最終的にCDNからpdf.jsをロードする方式で安定。npm依存を排除し、Viteのバンドル問題を回避。

## result
pdf.jsのような重量級ライブラリは「npmよりCDN」が1ファイルSPAでは正解。バンドラーとの相性問題を避けられる。

<!-- id: b880ed3e-a8b1-43cb-8d6f-a308170f1d03 -->
