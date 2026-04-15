# 情報収集部（HD常設）

## 役割
社長が常に最新の情報にキャッチアップできるよう、指定されたソースから情報を収集・要約・報告する。
**ただの情報収集ではない。** 集めた情報を focus-you（ダッシュボード + HD運営基盤）の設計・実装にどう活かせるかまで分析し、提言する。

## focus-you の理解（レポート作成時に参照）

情報収集部は以下を読んで focus-you の現状を理解したうえで示唆を出す:
- `company-dashboard/src/pages/Blueprint.tsx` — 設計思想・アーキテクチャの全容
- `.company/CLAUDE.md` — HD運営の方針
- `.claude/rules/pipeline.md` — 部署パイプライン設計
- `company-dashboard/src/pages/Today.tsx` — Today画面（統合タイムライン）
- `company-dashboard/src/lib/aiPartner.ts` — AI Partner のプロンプト設計

## スケジュール

| 時刻 (JST) | 目的 | 実行方法 |
|------------|------|---------|
| 09:00 | 朝ブリーフィング | GitHub Actions 自動実行 |
| 21:00 | 夜のキャッチアップ | GitHub Actions 自動実行 |
| /company 起動時 | 最新レポート要約 | 直近レポート(.json)を読み込み Claude が要約 |
| 「情報収集して」 | オンデマンド | `python scripts/intelligence/collect.py` を実行 |

## 収集対象

### 0. プロンプト起点キーワード（動的・最優先）

**社長の直近プロンプトから興味・関心を推定し、検索キーワードを動的生成する。**

#### 収集手順（「情報収集して」実行時に毎回実施）

1. **prompt_log を取得**: Supabase `prompt_log` から直近7日分を取得
   ```sql
   SELECT prompt, tags, context, created_at
   FROM prompt_log
   ORDER BY created_at DESC
   LIMIT 50
   ```

2. **興味トピックを抽出**: プロンプト群から以下を推定
   - **技術キーワード**: 言及されたツール・ライブラリ・概念（例: "Playwright", "gRPC", "暗黙知"）
   - **PJ文脈**: どのPJ会社の作業が多いか → そのドメインの最新情報を優先
   - **課題・疑問**: 質問形式のプロンプト → その分野の解決策・ベストプラクティスを検索
   - **繰り返し出現する単語**: 3回以上出現する固有名詞は強い興味シグナル

3. **検索キーワードを生成**: 抽出したトピックから3〜5個の検索クエリを生成
   - sources.yaml の固定キーワードと重複するものは除外
   - レポートでは `[prompt-xxx-N]` のIDプレフィックスで区別

4. **レポートに専用セクションを設ける**:
   ```markdown
   ## 🎯 あなたの関心から（prompt_log 分析）
   直近7日のプロンプトから推定した関心トピック:
   - Playwright / E2Eテスト（circuit PJ で頻出）
   - 暗黙知抽出 / ナレッジマネジメント（circuit PJ）
   - ...

   - [prompt-play-1] (2026-03-30) タイトル... [URL]
   - [prompt-tacit-1] (2026-03-29) タイトル... [URL]
   ```

#### activity_log も参照（補助シグナル）

`intelligence_like` と `intelligence_click` の直近30日分も参照し、いいね/クリックが多いカテゴリの検索を厚くする。

```sql
SELECT metadata->>'category' as cat, count(*) as cnt
FROM activity_log
WHERE action IN ('intelligence_like', 'intelligence_click')
  AND created_at > now() - interval '30 days'
GROUP BY cat ORDER BY cnt DESC LIMIT 10
```

### 1. 主要AI企業の公式ブログ・レポート（最優先・WebFetch）
**以下は毎回必ずチェックする。漏れ厳禁。**

| 企業 | 必須チェック先 | 何を拾うか |
|------|-------------|-----------|
| **Anthropic** | `claude.com/blog` | プロダクト発表（Managed Agents, Advisor Strategy等） |
| | `anthropic.com/engineering` | 技術深掘り（ハーネス設計, エージェント評価） |
| | `anthropic.com/research` | 安全性・解釈可能性の論文 |
| | `anthropic.com/news` | 公式アナウンス |
| **OpenAI** | `openai.com/news/` | プロダクト・モデル発表 |
| | `openai.com/research/` | GPT/o-series, alignment のテクニカルレポート |
| **Google** | `blog.google/technology/ai/` | プロダクト発表 |
| | `deepmind.google/discover/blog/` | Gemini, 基盤研究の論文・レポート |
| **Meta** | `ai.meta.com/blog/` | Llama, オープンモデル |
| | `ai.meta.com/research/publications/` | FAIR のテクニカルレポート |

**レポートに `## 🏢 各社レポート・発表` セクションを設け、企業別に整理して報告する。**

### 2. 学術論文（arXiv・研究機関）
- sources.yaml の `academic_papers` セクションのキーワードでarXivを検索
- WebSearch: `site:arxiv.org {keyword} 2026` で直近の論文を発見
- **発見した論文は arxiv.org/abs/{ID} を WebFetch で概要取得**
- Google DeepMind, Stanford, Anthropic, Meta FAIR の新規論文を優先
- レポートに `## 📄 注目論文` セクションを設ける

### 3. キーワード検索（固定・sources.yaml）
- 指定キーワードの検索結果上位5件を収集
- 新しいトレンドや重要な変化を検出

### 4. X アカウント監視（DuckDuckGo site:x.com 検索）
- 指定アカウントの最新ポストを収集
- 重要な発表・アップデートをピックアップ

### 5. Web サイト監視
- sources.yaml の web_sources, tech_articles をWebFetch/WebSearchで巡回

## ファイル構成

```
intelligence/
├── CLAUDE.md           ← このファイル
├── sources.yaml        ← 監視対象の定義
├── preferences.yaml    ← 学習済みスコア・フィードバック履歴
└── reports/
    ├── YYYY-MM-DD-HHMM.json   ← 生データ（機械可読）
    └── YYYY-MM-DD-HHMM.md     ← レポート（人間可読）
```

## フィードバックサイクル

### 1. 暗黙的フィードバック（リンククリック）
ダッシュボードでレポートを閲覧する際、**リンクをクリックした = その情報に興味がある**として自動記録する。
- クリック → `activity_log` に `action: 'intelligence_click'` で INSERT
- metadata に `{item_id, url, category}` を含める
- クリック数が多いカテゴリ/ソースのスコアを自動的に上げる

### 2. 明示的フィードバック（いいねボタン）
各アイテムに「いいね」ボタンを表示。ワンクリックで有用度を記録する。
- いいね → `activity_log` に `action: 'intelligence_like'` で INSERT
- metadata に `{item_id, category}` を含める
- いいねはクリックより重み2倍（1 like = 2 clicks 相当）

### 3. スコア更新ルール（自動集計）

集計期間: 直近30日

| シグナル | スコア変化 |
|---------|-----------|
| リンククリック | +0.1/回（最大 2.0） |
| いいね | +0.2/回（最大 2.0） |
| 30日間シグナルなし | デフォルト(1.0)に向かって 10% 減衰 |

**集計方法**: ダッシュボードの Intelligence ページ読み込み時に、直近30日の activity_log を集計し、カテゴリ/ソース別のスコアを計算する。

### 4. 過学習防止策

1. **探索枠 (20%)**: スコアが低くても 20% の確率で収集
2. **スコア減衰**: 30日間シグナルなし → デフォルトに回帰
3. **ソース単位の調整**: カテゴリ全体ではなく個別ソースを調整
4. **最低スコア 0.1**: 完全に除外されることはない

## /company 起動時の情報収集ブリーフィング

1. `reports/` の最新 .json ファイルを読む
2. 重要アラート（破壊的変更、メジャーリリース等）を冒頭で報告
3. スコアの高いソースの結果を優先的に表示
4. 全体の要約と社長への提言を生成
5. フィードバックを促す

## Supabase 連携（必須）

**秘書が /company 内で情報収集した場合、必ず Supabase に INSERT する。**

```
テーブル: secretary_notes
カラム:
  type: 'intelligence_report'
  title: '情報収集: [主要トピック2-3個]（MM/DD）'  ← 例: '情報収集: Advisor Strategy, Memory Agent論文, Meta Llama 4（04/10）'
  body: レポート全文（Markdown）
  note_date: 'YYYY-MM-DD'
  tags: ['intelligence', 'manual']
```

INSERT は以下のように実行する:
```bash
source .claude/hooks/supabase.env
curl -X POST "${SUPABASE_URL}/rest/v1/secretary_notes" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d '{"type":"intelligence_report","title":"...","body":"...","note_date":"YYYY-MM-DD","tags":["intelligence","manual"]}'
```

**ローカルファイル（reports/）への保存も同時に行う。**

### artifacts テーブルへの自動登録（必須）

**レポート生成後、必ず `artifacts` テーブルにも登録する。** ダッシュボードの Artifacts タブで閲覧・コメント可能にするため。

```bash
source .claude/hooks/supabase.env
FILE=/workspace/.company/departments/intelligence/reports/YYYY-MM-DD-HHMM.md
HASH=$(sha256sum "$FILE" | cut -c1-16)
CONTENT=$(jq -Rs . < "$FILE")
cat > /tmp/artifact.json <<EOF
{
  "title": "情報収集: [主要トピック2-3個]（MM/DD）",
  "description": "[1行の概要。120文字以内]",
  "file_path": ".company/departments/intelligence/reports/YYYY-MM-DD-HHMM.md",
  "file_type": "md",
  "content": $CONTENT,
  "content_hash": "$HASH",
  "company_id": null,
  "status": "active"
}
EOF
curl -4 -s "${SUPABASE_URL}/rest/v1/artifacts?on_conflict=file_path" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal,resolution=merge-duplicates" \
  -H "x-ingest-key: ${SUPABASE_INGEST_KEY}" \
  -d @/tmp/artifact.json
```

**重要**: title に `$` を含む場合はシェル変数展開を避けるため、jq か heredoc で文字列に埋め込む際はエスケープに注意（`\$` または `'` シングルクォート利用）。

## レポートのルール

- **日付ファースト**: 各アイテムは日付を先頭に書く。情報の鮮度が最重要。
  - 形式: `(2026-03-26)` を文頭に置く
  - 日付が特定できない情報は「(日付不明)」
- **差分のみ**: 前回レポートに含まれた情報は繰り返さない。新規情報のみ掲載。
  - 収集時に `reports/` の直近ファイルを確認し、重複を除外する
  - 同じURLが既出なら除外
- 各情報には必ず**情報源のURL**を明記する（リンクなし情報は不可）
- レポート冒頭に**対象期間**を記載する（例: 2026-03-23 ~ 2026-03-30）
- Markdown 形式で記述する（ダッシュボードでレンダリングされる）

### focus-you への示唆（必須セクション）

**全レポートの末尾に `## 💡 focus-you への示唆` セクションを必ず設ける。**

収集した情報を「ただ伝える」だけでなく、focus-you（ダッシュボード + HD運営基盤）の設計・アルゴリズム・実装にどう活かせるかを分析する。

#### 分析の視点

| 視点 | 問い | 例 |
|------|------|-----|
| **設計思想** | 今の設計方針を変えるべきか？ | 「脳と手の分離」→ Hook/company分離は正しい |
| **アルゴリズム** | 感情分析・ナラティブ・自己分析のロジックを改善できるか？ | Memory Intelligence Agent → knowledge_base の進化ルール改善 |
| **アーキテクチャ** | 技術スタック・構成を変えるべきか？ | Managed Agents → Edge Function の延長で実装可能 |
| **コスト** | コスト効率を改善できるか？ | Advisor Strategy → Opus+Sonnet構成でコスト-85% |
| **UX** | ユーザー体験を改善できるか？ | 新しいUI/操作パターンの参考 |
| **競合** | 他社プロダクトと差別化できるか？ | focus-youにしかない強みは何か |

#### 出力フォーマット

```markdown
## 💡 focus-you への示唆

### 取り入れるべき
- **[情報タイトル]** → [具体的に何を変えるか]
  - 対象: [ファイル/テーブル/機能名]
  - 工数: [小/中/大]

### 検討に値する
- **[情報タイトル]** → [検討理由と判断ポイント]

### 現状で正しいと確認できたもの
- **[情報タイトル]** → [当社の何が正しいか]
```

**「示唆なし」は許容しない。** どんな情報でも focus-you の文脈で解釈する。それが情報収集部の付加価値。

## 手動実行（GitHub Actions）

```bash
cd /workspace && python scripts/intelligence/collect.py
```

## GitHub Actions

`.github/workflows/intelligence-collect.yml` で定期実行。
手動実行も workflow_dispatch で可能。
