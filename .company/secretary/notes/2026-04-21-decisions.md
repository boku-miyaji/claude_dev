# 2026-04-21 意思決定ログ — Blueprint ↔ 実装 整合化

## 背景

社長の指示: 「Blueprint と実際の挙動・実装に違う部分があると思う。私にどちらに合わせるか聞いて整合性をとって」

調査部が Blueprint.tsx と実装の差分を22件特定し（`scratch/research/blueprint-vs-impl-diff-2026-04-21.md`）、社長判断で整合化を進めた。同時に Narrator 実装点検（`scratch/research/narrator-prompts-audit-2026-04-21.md`）とナラティブ系競合調査（`scratch/research/narrative-ai-competitors-2026-04-21.md`）も実施した。

## 社長判断（すべて本日確定）

### 設計原則追加

| 原則 | 内容 | 反映先 |
|---|---|---|
| **⑪ Active vs Passive Response Boundary** | 能動チャットは相談されたらアドバイスOK、受動生成（Narrator / 未来の自分から / 週次ナラティブ / ブリーフィング）は想起誘導のみ | design-philosophy.md ⑪ / Auto Memory / Narrator プロンプト修正 |
| **⑫ Positioning Focus** | 表看板を「連続データ × 忘れていた範囲のパターン発見」に確定。Foresight Engine は「Foresight as Question」に再定義（予言ではなく兆候の問い） | design-philosophy.md ⑫ / Blueprint.tsx（次セッションで反映） |

### Blueprint 差分の社長判断

| 差分 | 判断 |
|---|---|
| **#1** 6段階ルーティング（実装は gpt-5.4 固定 + effort 6段階） | Blueprint を実装に合わせる |
| **#2** Arc/Theme/Foresight モデル（バッチ Opus / ブラウザ nano の二重実装） | **バッチ Opus に一本化、ブラウザ hook は読み取り専用化** |
| **#21** Agent 未定義の4部署（security / marketing / ops / refactoring） | **Agent ファイルを4つ新規作成** |

### 表看板選択

4候補から **A. 連続データ × 忘れていた範囲のパターン発見** を選択。

競合調査の決定的な発見:
- StoriedLife / Life Story AI も進行中の物語を扱う（前回の「過去限定」前提は誤り）
- 立ち位置が最も近いのは **Rosebud**（Wrapped 2025 の archetype/arcs/moments が Narrator 4エンジンと名称レベルで重複）
- 「未来予見」は predictive wellness トレンドに吸収されつつあり表看板としては脆い
- 構造差（多チャネル統合・忘れていた範囲）は音声会話中心のナラティブ系・単一チャネルの Rosebud には追いつきにくい

## 実施済みの変更

auto-save hook が各段階で commit 済み:

- `.company/design-philosophy.md`: ⑪ / ⑫ を追記（+86 行）
- `memory/feedback_ai_active_passive.md`: 新規作成 + MEMORY.md 索引追加
- `.claude/agents/dept-security.md` / `dept-marketing.md` / `dept-ops.md` / `dept-refactoring.md`: 新規作成（計4ファイル）
- `.company/CLAUDE.md`: `sync-registry.sh` で Agent 一覧を再生成（4箇所の「—」が埋まった）
- `company-dashboard/src/hooks/useMorningBriefing.ts`: 提案型例外条項を削除、観察/過去接続/問い の3型に再構成（+86 行）
- `company-dashboard/src/hooks/useForesight.ts`: 「予言」構造を「過去パターン + 問い」に書き換え、SILENT 指示追加（-134 行）
- `company-dashboard/src/hooks/useArcReader.ts`: LLM 呼び出し削除、story_memory 読み取り専用化（-201 行）
- `company-dashboard/src/hooks/useThemeFinder.ts`: 同上（-212 行）
- `company-dashboard/src/pages/Journal.tsx`: emotion_insights を「事実+問い」に書き換え（+38 行）

## 残タスク（次セッション継続）

**Blueprint.tsx の大規模更新が未完遂**。システム開発部 bg が行1760 付近で早期終了。以下の14件以上の古い記述が残存:

- 「25スクリプト」「Hook (32個)」 → 42スクリプトに更新
- 「1,004行」「208行」 → HD 30行・部署合計 1,677行 に更新
- 「14データソース」「13データソース」 → 19データソース
- 「10部署」 → 11部署（+リファクタ含めて12）
- 「21ルート」 → 27ルート
- 「Foresight Engine」 → 「Foresight as Question」
- 6段階ルーティングの記述を「gpt-5.4 統一 + effort 6段階」に
- Arc/Theme のモデル記述を3タブで統一（バッチ Opus / ブラウザ読み取り専用）
- AI Features 4カード（#1 #2 #4 #5）のモデル記述を実態に
- 表看板 A の反映（冒頭キャッチ補強、Narrative Intelligence 再定義、競合比較テーブル新設）

詳細は `scratch/research/blueprint-vs-impl-diff-2026-04-21.md` の各項目と、`scratch/research/narrative-ai-competitors-2026-04-21.md` の書き換え候補文①②③を参照。

## 次セッションの着手手順

1. `scratch/research/blueprint-vs-impl-diff-2026-04-21.md` と本ノートを読む
2. Blueprint.tsx の現状を Grep で残存記述を確認（`25スクリプト|Hook \(32個\)|1,004行|208行|Foresight Engine|14データソース|13データソース|10部署|21ルート`）
3. 22件の差分を順に反映（Critical → High → Medium → Low）
4. 表看板 A の書き換え（競合比較テーブルは Roadmap or AI Features タブに新設）
5. typecheck / lint を通す
6. 最終検証: Blueprint 内部の自己矛盾8項目も解消

## 備考

- Edge Function `narrator-update` は今回触っていないのでデプロイ不要
- `useForesight.ts` の型（`prediction` → `question`）変更に伴い、呼び出し側（Today.tsx / FutureYouChat 等）で型エラーが出ていないか確認が必要
- Blueprint 未更新のまま PR を作らない
