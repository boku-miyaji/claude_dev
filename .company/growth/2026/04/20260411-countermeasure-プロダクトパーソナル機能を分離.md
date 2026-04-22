# プロダクト/パーソナル機能を分離

- **type**: `countermeasure`
- **date**: 2026-04-11
- **category**: organization / **severity**: medium
- **status**: active
- **source**: daily-digest
- **tags**: focus-you, ia, commercialization
- **commits**: 245c557, 00897e3

## what_happened
サイドバー・モバイルナビをプロダクト機能とCLI/パーソナル機能で分離し、分離マップを文書化。focus-you の商用化を見据えた情報アーキテクチャ整理。

## root_cause
自己理解ツール（個人用）と商用プロダクトが同居しており、UIと責務が混在していた。

## countermeasure
ナビ構造を二層に分け、分離マップを docs に追加してルール化。

## result
商用化対象と個人ツールの境界が明確化。

<!-- id: 14a62977-a43b-4440-a815-6c6673e665c7 -->
