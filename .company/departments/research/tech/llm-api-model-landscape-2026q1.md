# LLM API モデル最新動向調査レポート

- **調査日**: 2026-04-01
- **ステータス**: completed
- **調査チーム**: 技術調査
- **依頼元**: HD横断

---

## 1. 公知情報ベースの分析

### 1-A. OpenAI API モデル一覧（2026年4月時点）

#### フラッグシップ: GPT-5系（最新世代）

| モデルID | Input/MTok | Cached Input | Output/MTok | コンテキスト | Max Output | 主な用途 |
|----------|-----------|-------------|------------|------------|-----------|---------|
| `gpt-5.4` | $2.50 | $0.25 | $15.00 | 1M | 128K | 最高知能。エージェント、コーディング、プロフェッショナルワークフロー |
| `gpt-5.4-mini` | $0.75 | $0.075 | $4.50 | 400K | 128K | コーディング、コンピュータ使用、サブエージェント |
| `gpt-5.4-nano` | $0.20 | $0.02 | $1.25 | 400K | 128K | 高ボリューム・シンプルタスク |
| `gpt-5.4-pro` | $30.00 | N/A | $180.00 | - | - | 最高精度が必要な場面（高コスト） |

- **ソース**: [OpenAI API Models](https://developers.openai.com/api/docs/models), [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- キャッシュ割引: 90%オフ（GPT-5系）
- Batch API: 全トークンコスト50%オフ

#### 前世代: GPT-4.1系（まだアクティブ）

| モデルID | Input/MTok | Cached Input | Output/MTok | コンテキスト | Max Output | 主な用途 |
|----------|-----------|-------------|------------|------------|-----------|---------|
| `gpt-4.1` | $2.00 | $0.50 | $8.00 | 1M | 32K | 汎用。GPT-4oの後継。コーディング・指示追従に強い |
| `gpt-4.1-mini` | $0.40 | $0.10 | $1.60 | 1M | 32K | コスト効率重視の中量タスク |
| `gpt-4.1-nano` | $0.10 | $0.025 | $0.40 | 1M | 32K | 最安モデル。分類、ルーティング、抽出等 |

- **ソース**: [Introducing GPT-4.1](https://openai.com/index/gpt-4-1/), [PE Collective Pricing](https://pecollective.com/tools/openai-api-pricing/)
- キャッシュ割引: 75%オフ（GPT-4.1系）
- GPT-4oより26%安価（中央値クエリ比較）
- ChatGPTからは2026年2月13日に退役済みだが、**APIはまだ利用可能**

#### o-series（推論特化モデル）

| モデルID | Input/MTok | Cached Input | Output/MTok | コンテキスト | Max Output | 主な用途 |
|----------|-----------|-------------|------------|------------|-----------|---------|
| `o3` | $2.00 | $0.50 | $8.00 | 200K | 100K | 数学・科学・コーディング・視覚推論。マルチステップ問題 |
| `o4-mini` | $1.10 | $0.275 | $4.40 | 200K | 100K | 高速・低コスト推論。コーディング・視覚タスク |
| `o3-mini` | $1.10 | $0.55 | $4.40 | 200K | 100K | **Legacy**。o4-miniに置き換え |
| `o1` | $15.00 | $7.50 | $60.00 | 200K | 100K | **Legacy/非推奨**。o3に置き換え |

- **ソース**: [Introducing o3 and o4-mini](https://openai.com/index/introducing-o3-and-o4-mini/), [o3 Model](https://platform.openai.com/docs/models/o3), [o4-mini Model](https://platform.openai.com/docs/models/o4-mini)
- キャッシュ割引: 50%オフ（o-series）
- 推論トークン（内部Chain-of-Thought）はOutput料金で課金。表示500トークンでも内部5,000トークン消費する場合あり
- o3/o4-mini はツールスキーマをネイティブに理解し、CoT内でツール呼び出しを計画

#### 非推奨/退役モデル

| モデルID | 状態 | 退役日 | 後継 |
|----------|------|--------|------|
| `gpt-4o` | API非推奨 | 2026-02-16 | gpt-4.1 / gpt-5 |
| `gpt-4-turbo` | API非推奨 | 2026-02-16 | gpt-4.1 |
| `gpt-4` | Legacy | - | gpt-4.1 |
| `gpt-3.5-turbo` | Legacy | - | gpt-4.1-nano |
| `o1` | Legacy | - | o3 |
| `o1-mini` | Legacy | - | o4-mini |
| `chatgpt-4o-latest` | 削除済 | 2026-02-17 | - |

- **ソース**: [OpenAI Deprecations](https://developers.openai.com/api/docs/deprecations), [Retiring GPT-4o](https://openai.com/index/retiring-gpt-4o-and-older-models/)

#### 機能対応マトリクス（OpenAI）

| 機能 | GPT-5.4系 | GPT-4.1系 | o3/o4-mini |
|------|----------|----------|-----------|
| Streaming | OK | OK | OK |
| Function Calling | OK | OK | OK（CoT内で推論） |
| Structured Output | OK | OK | OK |
| Vision（画像入力） | OK | OK | OK |
| JSON Mode | OK | OK | OK |
| Tool Search | OK（5.4以降） | 非対応 | 非対応 |
| Web Search | OK | OK | OK |

- **ソース**: [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling), [o3/o4-mini Function Calling Guide](https://developers.openai.com/cookbook/examples/o-series/o3o4-mini_prompting_guide)

---

### 1-B. Anthropic Claude API モデル一覧（2026年4月時点）

#### 現行モデル

| モデル | Input/MTok | Cache Hit | Output/MTok | コンテキスト | Max Output | 主な用途 |
|--------|-----------|-----------|------------|------------|-----------|---------|
| **Claude Opus 4.6** | $5.00 | $0.50 | $25.00 | 1M | 128K (Batch: 300K) | 最高知能。複雑推論、コーディング、エージェント |
| **Claude Sonnet 4.6** | $3.00 | $0.30 | $15.00 | 1M | 64K (Batch: 300K) | バランス型。日常的な開発・分析 |
| Claude Opus 4.5 | $5.00 | $0.50 | $25.00 | 1M | 128K | 前世代Opus。まだ利用可能 |
| Claude Sonnet 4.5 | $3.00 | $0.30 | $15.00 | 1M | 64K | 前世代Sonnet。まだ利用可能 |
| Claude Sonnet 4 | $3.00 | $0.30 | $15.00 | 200K | 64K | 安定版 |
| **Claude Haiku 4.5** | $1.00 | $0.10 | $5.00 | 200K | 32K | 高速・低コスト。大量処理向け |
| Claude Haiku 3.5 | $0.80 | $0.08 | $4.00 | 200K | 32K | Legacy |
| Claude Haiku 3 | $0.25 | $0.03 | $1.25 | 200K | 32K | 最安。簡易タスク |

- **ソース**: [Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing), [What's new in Claude 4.6](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-6)

#### 特殊料金モード

| モード | 適用モデル | 料金 | 用途 |
|--------|----------|------|------|
| **Fast Mode** (beta) | Opus 4.6 | $30/$150 MTok（6倍） | 高速出力が必要な場面 |
| **Batch API** | 全モデル | 50%オフ | 非同期大量処理 |
| **Data Residency (US)** | Opus 4.6以降 | 1.1倍 | US内推論保証 |

#### 非推奨/退役モデル

| モデル | 退役日 | 後継 |
|--------|--------|------|
| Claude Sonnet 3.7 | 2025-10-28 | Sonnet 4 |
| Claude Sonnet 3.5 | 2026-01-05 | Sonnet 4 |
| Claude Opus 3 | 2025-07-21 | Opus 4 |
| Claude Haiku 3.5 | 2026-02-19 | Haiku 4.5 |
| Claude Haiku 3 | 2026-02-19 | Haiku 4.5 |

- **ソース**: [Claude Model Deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)

#### 機能対応マトリクス（Claude）

| 機能 | Opus 4.6 | Sonnet 4.6 | Haiku 4.5 |
|------|---------|-----------|----------|
| Streaming | OK | OK | OK |
| Tool Use | OK | OK | OK |
| Extended Thinking | OK | OK | OK |
| Interleaved Thinking | OK | OK | - |
| Vision（画像入力） | OK | OK | OK |
| Prompt Caching | OK（5min/1h） | OK | OK |
| Computer Use | OK | OK | - |
| Web Search / Fetch | OK | OK | OK |
| 1M Context (標準料金) | OK | OK | 非対応（200K） |

---

### 1-C. コスト比較（同等クラス横断比較）

#### ハイエンド（複雑推論・エージェント）

| モデル | Input | Output | コンテキスト | コスパ評価 |
|--------|-------|--------|------------|----------|
| Claude Opus 4.6 | $5.00 | $25.00 | 1M | 高品質だが高価 |
| GPT-5.4 | $2.50 | $15.00 | 1M | Opusより安い |
| o3 | $2.00 | $8.00 | 200K | 推論特化。ただし内部推論トークンで実コスト増 |

#### ミドルレンジ（日常開発・分析）

| モデル | Input | Output | コンテキスト | コスパ評価 |
|--------|-------|--------|------------|----------|
| Claude Sonnet 4.6 | $3.00 | $15.00 | 1M | バランス良好 |
| GPT-4.1 | $2.00 | $8.00 | 1M | Sonnetより安い。コーディング強い |
| GPT-5.4-mini | $0.75 | $4.50 | 400K | コスパ最高クラス |

#### ローエンド（大量処理・ルーティング）

| モデル | Input | Output | コンテキスト | コスパ評価 |
|--------|-------|--------|------------|----------|
| Claude Haiku 4.5 | $1.00 | $5.00 | 200K | Claude最安（現行） |
| GPT-4.1-nano | $0.10 | $0.40 | 1M | 圧倒的最安。1Mコンテキスト |
| Claude Haiku 3 | $0.25 | $1.25 | 200K | さらに安いがLegacy |

---

## 2. 限界の明示

### 確認できなかった点

1. **OpenAI GPT-5.4の詳細ベンチマーク**: 2026年3月末にリリースされたばかりで、独立ベンチマークが少ない。GPT-5.2やGPT-4.1との詳細な比較データが不足
2. **o3/o4-miniの実効コスト**: 推論トークン（内部CoT）が出力料金で課金されるため、表面上の料金だけでは実コストが見積もれない。タスク依存の変動幅が大きい
3. **レートリミット詳細**: Tierごとの具体的なTPM/RPMは変動が激しく、最新の正確な数値は各コンソールで確認が必要
4. **GPT-4.1系のAPI退役時期**: ChatGPTからは退役済みだが、APIからの完全退役日は現時点で未発表の可能性がある
5. **Claude Opus 4.6 Fast Modeの品質差**: 6倍料金の速度モードが品質面でどの程度トレードオフがあるか、公式ベンチマークが不足
6. **Google Geminiとの比較**: 今回はOpenAI/Anthropicに絞ったため、Gemini 2.5 Pro等との比較は未実施

### 推測・仮説

- **仮説**: GPT-4.1系はコスト効率の観点から、2026年中盤まではプロダクション用途で有力な選択肢であり続ける。GPT-5.4への移行は急がなくてよい
- **仮説**: o-seriesの推論トークンコストを考慮すると、単純なタスクではGPT-4.1/GPT-5の方がトータルコストが安くなるケースが多い
- **推測**: Anthropicは2026年中にHaiku 4.5以上で1Mコンテキストを拡張する可能性がある

---

## 3. 壁打ちモードへの導線

### ダッシュボードAIチャット機能でのモデル使い分け推奨設計

#### 推奨アーキテクチャ: 3層モデルルーティング

```
ユーザー入力
  |
  v
[Router: GPT-4.1-nano / $0.10 MTok]
  ├── 簡易応答（FAQ、要約、分類）
  │     └── GPT-4.1-nano ($0.10/$0.40)
  │         または Claude Haiku 4.5 ($1.00/$5.00)
  │
  ├── 通常チャット（コード生成、分析、対話）
  │     └── GPT-4.1 ($2.00/$8.00)
  │         または Claude Sonnet 4.6 ($3.00/$15.00)
  │
  └── 高度推論（複雑な設計判断、数学、マルチステップ）
        └── o3 ($2.00/$8.00 + 推論トークン)
            または Claude Opus 4.6 ($5.00/$25.00)
```

#### 具体的な使い分け指針

| ユースケース | 推奨モデル | 理由 |
|-------------|----------|------|
| チャットUI（通常対話） | GPT-4.1 | コスパ最良。1Mコンテキスト。ストリーミング快適 |
| コード生成・レビュー | GPT-4.1 or Sonnet 4.6 | 両方コーディングに強い。好みで選択 |
| 長文ドキュメント分析 | GPT-4.1-nano | 1Mコンテキスト+最安料金 |
| 複雑な推論・設計判断 | Opus 4.6 or o3 | Extended Thinking / 内部推論 |
| 大量バッチ処理 | GPT-4.1-nano (Batch) | $0.05/$0.20 MTok。圧倒的最安 |
| エージェント（ツール連携） | GPT-4.1 or Sonnet 4.6 | ツール呼び出し安定。コスト許容範囲 |

#### 壁打ち用の問いかけ例

1. **「ダッシュボードのチャット機能で、ユーザーが選べるモデルは何種類にすべきか？全部見せるか、用途別に3つ程度に絞るか？」**

2. **「推論モデル（o3/o4-mini）をチャットUIに組み込む意味はあるか？通常の対話で推論モデルが必要な場面はどれくらいあるか？」**

3. **「コスト上限設定をどうするか？ユーザー単位の月額上限？リクエスト単位の制限？」**

4. **「Prompt Cachingを活用するなら、システムプロンプトをどう設計するか？PJ会社ごとのコンテキストをキャッシュ対象にすると大幅にコスト削減できる」**

5. **「マルチプロバイダー（OpenAI + Anthropic）でフォールバック構成を組むか？片方のAPI障害時に自動切替するか？」**

6. **「GPT-4.1系がまだ使えるうちはこれをメインにして、GPT-5.4への移行はベンチマーク評価後にすべきでは？」**

---

## 結論

1. **OpenAI**: GPT-5.4系が最新フラッグシップだが、GPT-4.1系がコスト効率で依然として優秀。特にgpt-4.1-nanoの$0.10/MTokは大量処理に最適。o-seriesはo3/o4-miniが現行で、o1は非推奨
2. **Anthropic**: Opus 4.6/Sonnet 4.6が1Mコンテキスト標準料金で提供開始。長文処理のコスパが大幅改善。Haiku 4.5がエントリーモデル
3. **価格競争**: OpenAIがInput単価で優勢（GPT-4.1: $2 vs Sonnet 4.6: $3）。Anthropicは品質とExtended Thinkingで差別化

## ネクストアクション

- [ ] ダッシュボードAIチャットで採用するモデルリストを確定する
- [ ] Prompt Caching戦略を設計する（PJコンテキストのキャッシュ化）
- [ ] o-series（推論モデル）の実効コストをサンプルタスクで検証する
- [ ] Google Gemini 2.5 Proとの比較調査を追加実施するか判断する
