# 意思決定ログ — 2026-04-19

## 情報収集部 arxiv 取りこぼし事象 — 根本対応

### 事象

社長が arXiv:2604.14228 "Dive into Claude Code: The Design Space of Today's and Future AI Agent Systems"（Liu et al., 2026-04-14）を自力で発見し、情報収集部が拾えなかった理由と再発防止を依頼。

### 根本原因（5 Whys）

1. 論文が収集されなかった → `fetchArxiv()` が返さなかった
2. `max_results=8` がハードコードされていた（[index.ts:163](company-dashboard/supabase/functions/news-collect/index.ts#L163)）
3. 8件では arxiv cs.AI (1日数百本) から最新数時間分しか掬えない
4. キーワードフィルタを使っていなかった → sources.yaml の `LLM agent` `Claude Code` 等が **一切 API 呼び出しに反映されていない**（死に設定）
5. カテゴリも `cs.AI/cs.CL/cs.LG` のみ → `cs.SE`（Claude Code 論文の主カテゴリ）が漏れていた

**構造的原因**: sources.yaml（設計ドキュメント）と news-collect Edge Function（本番実装）が分離し、yaml の更新が本番に波及しない仕組みだった。

### 実施した対策

**即時**:
- `max_results` を 8 → 150 に
- カテゴリに `cs.SE / cs.MA` を追加

**構造**:
- `fetchArxiv()` を二段構成にリライト:
  - catch-all（5カテゴリ/過去3日/150件）
  - keyword-filtered（`(cat:...) AND (all:"LLM agent" OR ... OR all:"Claude Code")` / 過去7日/150件）
- `ARXIV_KEYWORDS` に `Claude Code` と `AI coding assistant` を追加
- sources.yaml にも同じ2つを追加

**横展開**:
- `scripts/intelligence/check-arxiv-sync.sh` を作成。yaml ⊆ Edge Function の関係を保証。CI で毎回検証
- `news-collect.yml` に arxiv 単体の回収率モニタを追加（< 5 で fail）
- Blueprint の該当セクションを更新（二段構成と CI 検証を明記）

### 検証

- 修正後の手動 run: arxiv 収集数 8 → 39、目的論文（2604.14228）が `news_items` に入った
- 04-14〜04-16 投稿の取りこぼし分（AnyPoC, CoopEval, HWE-Bench など15+本）も同時に回収

### 学び（運営改善）

- **「設定ファイルに書いたから反映されている」は幻想**。CI で yaml → 本番実装の同期を強制すべき
- **単一ハードコード値は禁止**。`max_results` のような閾値は constants として明示し、sources.yaml 由来と CI で検証
- **monitoring は「何かが入ったか」ではなく「期待する量が入ったか」**。`> 0` ではなく source 別の床を定義

### 関連コミット

- 83568d1: fetchArxiv リライト + sources.yaml 更新 + sync check スクリプト
- 3619228: workflow に sync check / 回収率モニタ追加
- （本コミット）: Blueprint 更新 + 本ノート
