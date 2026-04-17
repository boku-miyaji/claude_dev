# Narrator Implementation — タスク一覧

> 2026-04-05 作成
> 設計書: docs/design/life-companion-evolution.md
> type: request (全て)

---

## Phase 1: Story Memory 基盤 + Arc Reader

### TASK-N01: story_memory / story_moments テーブル作成
- **priority**: high
- **tags**: dashboard, db, narrator
- **内容**: `story_memory` テーブル（memory_type, content JSONB, narrative_text, data_range, version）と `story_moments` テーブル（moment_type, title, description, diary_entry_id, emotion_snapshot, user_confirmed）を作成。RLSポリシー（owner_full + ingest）も同時に。
- **成果物**: supabase-migration-047-story-memory.sql
- **参照**: docs/design/life-companion-evolution.md のテーブル設計セクション

### TASK-N02: Arc Reader 実装（感情弧分析エンジン）
- **priority**: high
- **tags**: dashboard, ai, narrator
- **内容**: 過去N日分の diary_entries + emotion_analysis を入力とし、LLM（gpt-5）が感情の推移を物語構造として読み解く。出力: 現在のフェーズ（探索/没頭/内省/再構築/飛躍）+ 解釈文。過去の類似パターンとの接続も含む。
- **成果物**: src/hooks/useArcReader.ts + Edge Function拡張
- **重要**: ルールベースのif文で判定しない。LLMの深い推論で「この低下は疲労か、新しい挑戦への不安か」を読み解く
- **更新頻度**: 週次（Today画面表示時にトリガー、7日キャッシュ）

### TASK-N03: Today画面に「今の章」表示
- **priority**: high
- **tags**: dashboard, ui, narrator
- **内容**: Today画面のブリーフィング下に、Arc Reader が生成した「今の章」タイトル + 1-2行の解釈文を表示。控えめだが存在感のあるUI。
- **成果物**: src/components/StoryArcCard.tsx + Today.tsx への統合

---

## Phase 2: Theme Finder + Story ページ

### TASK-N04: Theme Finder 実装（人生テーマ発見）
- **priority**: high
- **tags**: dashboard, ai, narrator
- **内容**: 長期間（3ヶ月+）の diary_entries + dreams + goals + self_analysis + prompt_log を横断的に分析。通底するテーマ（「つくる人」「意味を問う人」等）を発見。emotionalDNA（喜びのトリガー、エネルギー源、回復スタイル）も生成。
- **成果物**: Edge Function拡張 + useThemeFinder.ts
- **モデル**: gpt-5 or claude-sonnet-4-6（深い推論が必要）
- **更新頻度**: 月次
- **前提**: 日記30件以上でアンロック（self_analysisと同条件）

### TASK-N05: Story ページ構築
- **priority**: high
- **tags**: dashboard, ui, narrator
- **内容**: 新規ページ。感情アーク（時系列ビジュアル）+ 転機マーカー + 今の章 + これまでの章一覧 + テーマ表示。感情アークは emotion_analysis の valence/wbi を時系列プロットし、story_moments をマーカーとして重ねる。
- **成果物**: src/pages/Story.tsx + ルーティング追加
- **デザイン**: design-principles スキルを適用。Linear/Notion的なミニマルさ

### TASK-N06: Chapter 自動生成
- **priority**: normal
- **tags**: dashboard, ai, narrator
- **内容**: 四半期ごとに、その期間の日記・感情・転機を元にLLMが「章」を生成。タイトル（「チームで乗り越えた冬」等）+ 要約 + 感情の旅路 + 学んだこと。story_memory テーブルに memory_type='chapter' で保存。
- **成果物**: Chapter生成ロジック + Story ページの章詳細ビュー

---

## Phase 3: チャットへの Narrative Memory 注入

### TASK-N07: Narrative Memory をチャットに注入
- **priority**: high
- **tags**: dashboard, ai, narrator
- **内容**: aiPartner.ts の `buildPartnerSystemPrompt()` を拡張。story_memory から identity（テーマ）, currentArc（今のフェーズ）, emotionalDNA（感情パターン）, aspirations（欲求）を取得し、システムプロンプトに注入。v1のDomain Advisor方式ではなく、物語文脈として自然に注入する。
- **成果物**: src/lib/aiPartner.ts 改修 + useNarrativeMemory.ts
- **重要**: 「テーマ: つくる人」とデータを渡すだけでなく、「あなたはこの人の物語を読んできた存在です」という指示で語り口を変える

### TASK-N08: Moment Detector 実装（転機検出）
- **priority**: normal
- **tags**: dashboard, ai, narrator
- **内容**: 日記投稿後に自動実行。LLM（gpt-5-mini）が「これは通常の日記か、転機か」を判定。転機タイプ: decision/realization/breakthrough/connection/setback。検出時にユーザーに確認（「この瞬間を記録しますか？」）。
- **成果物**: src/hooks/useMomentDetector.ts
- **連携**: useEmotionAnalysis と同じタイミング（日記投稿後）で並列実行

### TASK-N09: Foresight Engine 実装（予感）
- **priority**: normal
- **tags**: dashboard, ai, narrator
- **内容**: Arc Reader + Theme Finder の出力 + 過去の類似パターンから、「これから起きそうなこと」を予感。物語ベースのプロアクティブ提案を生成。Today画面のブリーフィングに統合。
- **成果物**: useForesight.ts + Today.tsx統合
- **重要**: 「WBIが低いから休め」ではなく「あなたの物語の流れを読むと、次はこういう展開」

---

## Phase 4: Story Sharing + Courage Board

### TASK-N10: shared_stories テーブル + Story Card 生成
- **priority**: normal
- **tags**: dashboard, db, ai, narrator
- **内容**: shared_stories テーブル作成（story_type, content, anonymized, empathy_count, is_public）。Chapter や転機から美しいカードテキストをLLMで生成。匿名化エンジン（個人特定情報の自動除去）。
- **成果物**: マイグレーションSQL + useStorySharing.ts

### TASK-N11: Courage Board UI
- **priority**: normal
- **tags**: dashboard, ui, narrator
- **内容**: 匿名の成長物語が並ぶページ。リアクションは「共感した」のみ。コメントなし。AI品質管理（本当に勇気になる物語だけ表示）。
- **成果物**: src/pages/CourageBoard.tsx + ルーティング
- **デザイン**: 温かみのあるミニマルデザイン。SNS的な要素は排除

### TASK-N12: Growth Story 生成（年間物語）
- **priority**: low
- **tags**: dashboard, ai, narrator
- **内容**: 年末に1年の物語を長文で生成。全Chapter + 転機 + テーマの変遷を1つの文章に。「結婚式の成長ムービー」のテキスト版。PDF/画像出力対応。
- **成果物**: useGrowthStory.ts + 出力フォーマット

---

## 横断タスク

### TASK-N13: Narrative Memory 更新スケジューラ
- **priority**: normal
- **tags**: dashboard, infra, narrator
- **内容**: 各エンジンの更新スケジュール管理。日記書き込み → Moment Detector（即時）。Today表示 → Arc Reader（週次キャッシュ）。月初 → Theme Finder。四半期 → Chapter生成。バックグラウンド実行、コスト管理。
- **成果物**: src/hooks/useNarrativeScheduler.ts

### TASK-N14: コスト管理の拡張
- **priority**: normal
- **tags**: dashboard, infra, narrator
- **内容**: 既存の chat_usage テーブルに Narrator 系のコスト追跡を追加。Arc Reader / Theme Finder / Moment Detector それぞれのトークン消費を記録。月次コスト上限の設定。
- **成果物**: Edge Function のコスト追跡拡張 + マイグレーション
