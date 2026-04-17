# 2026-04-17 意思決定ログ

## DIVE論文の電子回路応用 — 動くデモの設計・実装

### 背景
- 2026-04-11〜14 にかけて DIVE 論文(Chem.Sci.2026)の分析と電子部品ドメインへの移植設計を完了
  - [DIVE_PAPER_ANALYSIS.md](../../../polaris-circuit-diagram/docs/survey/DIVE_PAPER_ANALYSIS.md)
  - [DIVE_REPRODUCTION_BRIEF.md](../../../polaris-circuit-diagram/docs/survey/DIVE_REPRODUCTION_BRIEF.md) — MTG発表用
  - [DIVE_REPRODUCTION_DEEPDIVE.md](../../../polaris-circuit-diagram/docs/survey/DIVE_REPRODUCTION_DEEPDIVE.md) — 社長理解用
  - [PART_RECOMMENDER_AGENT_DESIGN.md](../../../polaris-circuit-diagram/docs/designs/PART_RECOMMENDER_AGENT_DESIGN.md) — 7層設計 L0〜L7
- ただし実装は未着手（BRIEFでは琴岡さん依頼として計画）

### 社長の指示（本日）
「電子回路でDIVEをどう流用するのか記事にまとめたと思いますが、あれを実際に動くデモを作成したい。どうするか振り返って、設計してください。」
追加で:
- スコープ: DC/DC + 何か(LDO) の2カテゴリで、仮DB + Agent推薦機能
- 担当: Claude Code が主担当
- ブランチを切って作業

### 決定事項
1. **7層設計を MVP に圧縮** — 実PDF抽出は含めず seed JSON を直投入。1カテゴリあたり3〜5部品、特性曲線は実データシートの代表値
2. **Agent loop の核を移植** — DIVE Fig.5 の relax/switch アクション構造をそのまま翻訳（カテゴリ変更 = 論文の組成変更に相当）
3. **scipyを使わず bisect線形補間** — 部品数が小さいため依存最小化
4. **LLM は既存 Gemini サービスを使用**（max_tokensを4096に増量、thinking-modelで出力が切れる問題を回避）

### 成果物（polaris-circuit-diagram リポジトリ）
- ブランチ: `feat/part-recommender-demo` (5 commits, 7767行追加)
- PR URL: https://github.com/PolarisAI-Projects/denso_circuit_diagram/pull/new/feat/part-recommender-demo
- 追加ファイル:
  - 設計書: MVP_DEMO_DESIGN.md
  - Backend: models/part.py, schemas/recommend.py, routers/recommend.py, services/recommender/ (L1-L6 + seed + seed_loader)
  - Seed: dcdc.json (5部品) + ldo.json (3部品)
  - Frontend: /recommend ページ + 3コンポーネント + サイドバー更新

### 動作確認（e2e）
3シナリオで動作確認:
- **A: DC/DC仕様マッチ** → Top1 TPS54331 (SO-8)、制約違反も明記
- **B: LDO低ノイズ** → 該当なし→Agent が relax_constraint 提案
- **C: カテゴリ切り替え** → LLMが「12V+超低ノイズ+SOT-23は市場困難、DFN変更推奨」と実用アドバイス

全シナリオで L1-L6 パイプラインが正しく動作。応答時間 10-40秒。

### 次のステップ
- 社長レビュー → PR マージ判断
- seed にもう数部品追加してシナリオB/Cで実候補が出るよう調整（任意）
- 親設計 L7 フェーズ: 実PDFからのseed自動生成、ground truth評価

### 関連
- [MVP実装設計](../../../polaris-circuit-diagram/docs/designs/MVP_DEMO_DESIGN.md)
- [PRリンク](https://github.com/PolarisAI-Projects/denso_circuit_diagram/pull/new/feat/part-recommender-demo)
