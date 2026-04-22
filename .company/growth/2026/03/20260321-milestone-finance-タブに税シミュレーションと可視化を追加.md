# Finance タブに税シミュレーションと可視化を追加

- **type**: `milestone`
- **date**: 2026-03-21
- **category**: tooling / **severity**: medium
- **status**: active
- **source**: backfill
- **tags**: finance, dashboard, 可視化, 税シミュレーション, claude-dev
- **commits**: 13c013b, 4e48b8d, 259211b, 81e71b4, b7a4f8e, a23860a

## what_happened
Finance タブに経費スライダー付きの税シミュレーション、前提条件パネル、月次売上などのグラフを段階的に追加。概要タブもクライアント別チャートで視覚化し、モバイル下部ナビにも Finance を導線として組み込んだ。

## root_cause
数値だけでは経営判断しづらく、視覚的に掴めるUIと税計算の前提明示が求められた

## countermeasure
チャート描画と前提パネルを実装し、スライダーで経費を動的に変えられるシミュレータに発展させた

## result
Finance が単なる数値表示から意思決定支援ツールに進化

<!-- id: eac758d7-deae-4724-918f-1dce5cfe9a0f -->
