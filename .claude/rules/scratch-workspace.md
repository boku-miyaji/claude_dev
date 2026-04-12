# Scratch ワークスペース（壁打ち・モックアップ・試作品の置き場）

> このルールは常時有効。モックアップ・壁打ち資料・試作ファイルを作るときに必ず適用する。

## 目的

確定していない成果物（モックアップ、壁打ち資料、試作コード、HTMLプレビュー、スケッチ）を git 管理下に混入させない。
雑多なファイルが `.company/` や `docs/` や `company-dashboard/` に散ることを防ぎ、リポジトリを clean に保つ。

## 配置場所（絶対ルール）

**リポジトリルートの `scratch/` 以下に必ず配置する。**

```
/workspace/scratch/
├── design/      ← UIモックアップ、HTMLプレビュー、設計の比較案
├── research/    ← 調べ物の壁打ち、まだ決定していない調査メモ
├── experiments/ ← 試作コード、プロトタイプ
└── ...          ← 必要に応じて自由にサブディレクトリを作ってよい
```

`scratch/` は `.gitignore` で恒久的に除外されているため、中身は **絶対に commit されない**。
auto-save hook も拾わない。安心して書き捨てできる。

## 何を置くか

以下はすべて `scratch/` に置く。他の場所には作らない。

| 種類 | 配置先 | 例 |
|------|--------|-----|
| UIモックアップ | `scratch/design/` | `ai-chat-positioning.html`, `new-sidebar-mockup.html` |
| 設計比較案・壁打ち | `scratch/design/` | `deploy-options.md`, `auth-flow-comparison.md` |
| 調べ物の途中メモ | `scratch/research/` | `vector-db-options.md`, `llm-routing-notes.md` |
| 試作コード・実験 | `scratch/experiments/` | `test-new-prompt.py`, `poc-streaming.ts` |
| スクリーンショット類 | `scratch/` | `screenshot-2026-04-12.png` |
| 一時的な分析出力 | `scratch/` | `query-result.json`, `profile-dump.txt` |

## 何を置かないか（通常の git 管理対象）

- **確定した設計決定** → `.company/design-philosophy.md` に追記
- **部署の成果物** → `.company/departments/{部署}/` 配下
- **プロダクトコード** → `company-dashboard/` 配下
- **公式ドキュメント・README** → `docs/` または各リポジトリのREADME
- **恒久的なルール** → `.claude/rules/` 配下

## 昇格ルール（壁打ち → 正式成果物）

`scratch/` に作った資料が社長の承認を得て正式採用された場合、以下の手順で昇格する:

1. 該当ファイルの内容を、確定成果物にふさわしい場所にコピー（`.company/design-philosophy.md` への追記など）
2. `scratch/` の元ファイルはそのまま残してよい（履歴として）
3. コピー先のファイルを commit する

**逆はやらない。** 一度 `scratch/` に置いたものを `.company/` や `docs/` に直接 mv しない。内容を整理してから別ファイルとしてコピーする。

## 迷ったときの判断

「これはコミットすべきか？」と迷うものはすべて `scratch/` に置く。後で必要になれば昇格させればよい。**迷ったら scratch**。

## アンチパターン

- ❌ モックアップを `.company/design/` や `docs/mockups/` に置く → `scratch/design/` に置く
- ❌ HTMLプレビューを `company-dashboard/public/` に置く → `scratch/design/` に置く
- ❌ 壁打ちメモを `.company/secretary/notes/` に書く（notes は確定した意思決定用） → `scratch/research/` に書く
- ❌ 試作コードを `src/` 配下に作る → `scratch/experiments/` に作る
- ❌ `scratch/` にあるものを「残すべき」と判断して直接 mv → コピーして昇格する
