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

## 収集前の準備習慣（必須）

**情報収集を開始する前に、必ず以下の手順を実行する。**

### Step 0-A: 気になった記事のギャップ分析 → sources.yaml 更新

社長がダッシュボードの「気になった記事」タブに登録した URL を分析し、なぜ自動収集できなかったかを判定して sources.yaml を自動更新する。

```bash
python scripts/intelligence/gap-analysis.py
```

`collect.py` はこのスクリプトを自動で呼び出す（Step 0 に組み込み済み）。

#### gap_type の判定ロジック

| gap_type | 意味 | sources.yaml への追記 |
|---|---|---|
| `missing_x_account` | X/Twitter URL だがアカウントが未監視 | `x_accounts` に追加 |
| `missing_keyword` | ドメインはカバー済みだがキーワード未登録 | `keywords` に追加 |
| `missing_domain` | ドメインがどのセクションにも存在しない | `tech_articles` に追加 |
| `already_covered` | 既存ソース・キーワードで拾えるはず | 追記なし・要因を記録 |

#### ダッシュボード連携

- ダッシュボードの **Reports → 気になった記事** タブ（`InterestArticles` コンポーネント）から URL を登録
- Supabase テーブル: `interest_articles`（migration 067）
- 分析後: `analyzed=true`, `gap_type`, `gap_reason`, `added_to_sources` が更新される
- 登録した記事は次回 collect.py 実行時に自動分析される

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

### 日付検証（IMPORTANT・ハルシネーション禁止）

**日付は推測禁止。必ず一次ソースで確認する。** 「最近言及された」と「最近発表された」は別物。

- **論文は arXiv ID / DOI を必須記載**
  - 形式: `(YYYY-MM, arXiv:XXXX.XXXXX)` を文頭に置く（例: `(2024-02, arXiv:2402.17753)`）
  - arXiv ID の先頭4桁 = 発表年月（2402 → 2024年2月）。ここから機械的に確定する
  - arXiv ID がない場合は DOI or 会議名+年（例: `(NeurIPS 2024)`）
  - プロジェクトページ URL だけで日付を判断しない。必ず arXiv / 論文 PDF を WebFetch で確認する
- **ブログ・ニュース記事は記事の published date を WebFetch で確認**
  - URL に `/2026/04/14/` のようなパスがあればそれを使う
  - ない場合は WebFetch で「このページの公開日付は？」と聞いて抽出する
- **X ポスト・ソーシャル言及は発表日ではない**
  - 「X で話題 ≠ 最近発表」。話題の原典（論文・公式ブログ）を辿り、その原典の日付を使う
- **日付が確認できなければ掲載しない**
  - 「(日付不明)」で載せるくらいなら削除する。鮮度を保証できない情報は価値がない
- **収集日 = 発表日ではない**
  - `now()` や `today` をデフォルト値として使わない。必ず原典の日付を引く

### 最新性の担保（毎日実行前提）

情報収集部は**毎日朝夜2回実行される**。存在意義は「**前回レポート以降の新規情報を届けること**」。以下の段階的探索を守る:

#### Step 1: 直近24時間を最優先（必須）

- **対象期間の始端 = 前回レポートの生成時刻**（`reports/` の最新ファイルのタイムスタンプ）
- **終端 = 今**
- 論文: arXiv 新着 (`https://arxiv.org/list/cs.CL/new`, `/list/cs.AI/new`, `/list/cs.LG/new`) を巡回
- 公式ブログ: Anthropic / OpenAI / Google / Meta / DeepMind の最新記事。**published date が 24h 以内のものだけ**を `## 🏢 各社レポート・発表` に入れる
- ニュース: WebSearch で `after:YYYY-MM-DD`（昨日の日付）を付けて検索

#### Step 2: 24h で十分な情報がなければ遡る

以下の条件で Step 2 に進む:
- 24h 以内の新規情報が **3件未満**
- または前回レポートと URL がすべて重複している

遡る順序:
1. **直近3日**（72h）
2. **直近1週間**
3. **直近2週間**

遡った場合は、レポート冒頭に **「直近24時間に新規情報が少なかったため、過去N日分を含みます」** と明記する。ごまかさない。

#### Step 3: それでも差分がなければ正直に報告

2週間遡っても新規がない場合は、無理にアイテムを埋めない。以下のような短いレポートを出す:

```markdown
# 情報収集: 特筆すべき新規情報なし（MM/DD）

直近2週間の探索範囲で、前回レポート以降の新規情報は確認できませんでした。
既知のトピックに動きがあったら次回反映します。

## 参考: 前回レポート以降に継続観察しているテーマ
- [...]
```

**埋めるために古い論文を「最新」として出すのは禁止**（今回の LoCoMo 事件の再発防止）。

#### 古い情報を混ぜる場合は明示

過去の重要論文を参照する場合は「**背景**」または「**参考**」セクションに分離し、`## 📄 注目論文` には入れない。`## 📄 注目論文` は **Step 1 または Step 2 の期間内に公開されたもの限定**。

#### 前回レポートとの差分チェック

`reports/` の直近3ファイルを読み、**重複 URL は除外**。同じ論文を角度を変えて紹介するのも重複扱い。

### その他

- **日付ファースト**: 各アイテムは日付を先頭に書く。情報の鮮度が最重要
- **差分のみ**: 前回レポートに含まれた情報は繰り返さない。新規情報のみ掲載
- **リンクはインライン必須**: 各アイテムのタイトルや「URL」の箇所に `[タイトル](URL)` 形式でリンクを埋め込む。末尾の「参考リンク」セクションにまとめる形式は禁止。読んでいる流れでその場でクリックできること
- **論文は詳細に記述**: 論文1件ごとに以下を書く
  - タイトルをリンク付きで記載（`[タイトル](https://arxiv.org/abs/XXXX.XXXXX)`）
  - **何をやった論文か**（1〜2文。背景と目的）
  - **手法の要点**（どんなアプローチ・モデル・データセットを使ったか）
  - **主要な結果・知見**（具体的な数字・比較があれば入れる）
  - focus-you / 宮路HD 運営への示唆につながる場合はその旨を1文で添える
- レポート冒頭に**対象期間**を記載する（例: 2026-03-23 ~ 2026-03-30）
- Markdown 形式で記述する（ダッシュボードでレンダリングされる）

### セルフチェック（レポート生成直前に必ず実行）

レポートを書き終えたら commit / INSERT する前に以下を実行する:

1. **論文セクションの全項目に arXiv ID があるか** → なければ追記 or 削除
2. **全項目の日付が今日から見て妥当な範囲か** → 「2026-04」と書いた項目で arXiv ID が2024年以前のものがないか
3. **URL をもう一度 WebFetch して published date を再確認** → 自信のない項目は必ず
4. **過去のレポートと同じ URL が混入していないか** → `grep -r <url> reports/` で確認
5. **24h 優先ルールを守れているか** → レポート冒頭の「対象期間」が Step 1/2/3 のどれに該当するか明記。24h を超えて遡った場合は理由を書いたか

セルフチェックを通過しないレポートは出さない。

### 示唆セクション（2つ・必須）

**全レポートの末尾に以下 2 つのセクションを必ず設ける。両方とも「示唆なし」は不可。**

#### セクション 1: focus-you への示唆

`focus-you` = 日記・感情・自己分析・ダッシュボードのプロダクト本体に関する改善。

分析視点:

| 視点 | 問い | 例 |
|------|------|-----|
| **設計思想** | 今の設計方針を変えるべきか？ | Hook/company分離は正しいか |
| **アルゴリズム** | 感情分析・ナラティブ・自己分析のロジックを改善できるか？ | Memory Intelligence Agent の改善 |
| **アーキテクチャ** | 技術スタック・構成を変えるべきか？ | Managed Agents → Edge Function で実装可能 |
| **コスト** | コスト効率を改善できるか？ | Advisor Strategy → Opus+Sonnet構成 |
| **UX** | ユーザー体験を改善できるか？ | 新しいUI/操作パターンの参考 |
| **競合** | 他社プロダクトと差別化できるか？ | focus-youにしかない強みは何か |

```markdown
## 💡 focus-you への示唆

### 取り入れるべき
- **[情報タイトル]** → [具体的に何を変えるか]
  - 対象: [ファイル/テーブル/機能名]
  - 工数: [小/中/大]

### 検討に値する
- **[情報タイトル]** → [検討理由と判断ポイント]

### 今のやり方が裏付けられたもの（継続でOK）
- **[情報タイトル]** → [業界トレンドや論文が示す通り、自分たちの○○は正しい方向にある]
```

#### セクション 2: 宮路HD 運営への示唆

`hd-ops` = Claude Code を使った開発全般・運用フロー・エージェント運営・Hook/バッチ設計に関する改善。**focus-you プロダクトの話ではなく、開発基盤・運用仕組みの話。**

分析視点:

| 視点 | 問い | 例 |
|------|------|-----|
| **エージェント設計** | 部署・パイプライン構成を改善できるか？ | Multi-agent coordination の新パターン |
| **Claude Code 活用** | Claude Code の新機能を運営に取り込めるか？ | Vim mode, カスタムテーマ, plugin versioning |
| **Hook/バッチ** | 自動化フローを改善できるか？ | 新しい Hook trigger やバッチ設計パターン |
| **MCP連携** | MCP server を運営基盤に統合できるか？ | 社内ナレッジをMCP化して複数agent から参照 |
| **セキュリティ** | サプライチェーン・依存関係のリスクがあるか？ | npm/PyPI 汚染パッケージの検知 |
| **開発生産性** | ワークフロー全体の効率を上げられるか？ | 新しいCLIパターン・IDE統合 |

```markdown
## 💡 宮路HD 運営への示唆

### 取り入れるべき
- **[情報タイトル]** → [具体的に何を変えるか]
  - 対象: [ファイル/ルール/Hook名]
  - 工数: [小/中/大]

### 検討に値する
- **[情報タイトル]** → [検討理由と判断ポイント]

### 今のやり方が裏付けられたもの（継続でOK）
- **[情報タイトル]** → [業界トレンドや論文が示す通り、自分たちの○○は正しい方向にある]
```

**「示唆なし」は不可。** どんな情報でも両視点で解釈する。それが情報収集部の付加価値。

#### 構造化 YAML ブロックの追加（必須）

2 つの Markdown セクションに加えて、レポート末尾に機械可読 YAML ブロックを **1 つ** 追加する。`target` フィールドで対象を区別する。

````markdown
```yaml
# suggestions
suggestions:
  - title: "..."
    description: "..."
    priority: high|medium|low
    effort: small|medium|large
    category: algorithm|architecture|ux|cost|competition|design|other
    target: focus-you   # focus-you | hd-ops | both
    source_urls:
      - https://...
  - title: "..."
    ...
    target: hd-ops
  - title: "..."
    ...
    target: both        # 両方に関わる場合
```
````

`target` の選び方:
- `focus-you` … 日記・感情分析・ダッシュボード UI/UX/アルゴリズムの改善
- `hd-ops` … Claude Code 運用・Hook・バッチ・MCP・エージェント基盤の改善
- `both` … 両方に直接影響する（例: コスト削減策、認証方式変更など）

Markdown セクションと YAML の内容は同期させる（同じ示唆を 2 表現で書く）。YAML ブロックの最初の行は `# suggestions` というコメントを必ず入れる。

### レポート生成後の自動 INSERT

レポートを保存した後、必ず以下を実行して `intelligence_suggestions` テーブルに記録する:

```bash
source /home/node/.claude/hooks/supabase.env
python3 /workspace/scripts/intelligence/ingest-suggestions.py \
  /workspace/.company/departments/intelligence/reports/YYYY-MM-DD-briefing.md
```

INSERT 件数がレポートの suggestion 数と一致することを確認する。一致しない場合は YAML ブロックの syntax を見直す。同じレポートを2回流しても既存分はスキップされる（冪等）。

## 手動実行（GitHub Actions）

```bash
cd /workspace && python scripts/intelligence/collect.py
```

## GitHub Actions

`.github/workflows/intelligence-collect.yml` で定期実行。
手動実行も workflow_dispatch で可能。
