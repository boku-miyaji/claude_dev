# 情報収集部（HD常設）

## 役割
社長が常に最新の情報にキャッチアップできるよう、指定されたソースから情報を収集・要約・報告する。

## スケジュール

| 時刻 (JST) | 目的 | 実行方法 |
|------------|------|---------|
| 09:00 | 朝ブリーフィング | GitHub Actions 自動実行 |
| 21:00 | 夜のキャッチアップ | GitHub Actions 自動実行 |
| /company 起動時 | 最新レポート要約 | 直近レポート(.json)を読み込み Claude が要約 |
| 「情報収集して」 | オンデマンド | `python scripts/intelligence/collect.py` を実行 |

## 収集対象

### 1. キーワード検索（DuckDuckGo）
- 指定キーワードの検索結果上位5件を収集
- 新しいトレンドや重要な変化を検出

### 2. X アカウント監視（DuckDuckGo site:x.com 検索）
- 指定アカウントの最新ポストを収集
- 重要な発表・アップデートをピックアップ

### 3. Web サイト監視（将来拡張）
- sources.yaml の web_sources に URL を追加

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

### 1. レポート内のアイテムID
各レポートのアイテムには ID が付与される（例: `kw-Claude-1`, `x-Anthr-2`）

### 2. /company でのフィードバック
社長がレポートを見て以下のように反応できる:
- `[kw-Claude-1] 有用` → そのソース/カテゴリのスコアを上げる
- `[x-OpenA-3] ノイズ` → そのソース/カテゴリのスコアを下げる
- 複数まとめて: `kw-Claude-1,kw-Claude-3 有用、x-OpenA-2 ノイズ`

### 3. スコア更新ルール

| フィードバック | スコア変化 |
|--------------|-----------|
| 有用 | +0.2（最大 2.0） |
| ノイズ | -0.2（最小 0.1） |
| 30日間FBなし | デフォルト(1.0)に向かって 10% 減衰 |

### 4. 過学習防止策

1. **探索枠 (20%)**: スコアが低くても 20% の確率で収集する
   - これにより「一度ノイズと判断したが実は重要だった」ケースを救済
2. **スコア減衰**: 長期間 FB がないスコアは自然にデフォルトに戻る
   - 一時的な好みの変化が永続化しない
3. **ソース単位の調整**: カテゴリ全体ではなく個別ソースを調整
   - 「AI tools カテゴリ」を殺さず、特定キーワードだけスコアを下げる
4. **最低スコア 0.1**: 完全に除外されることはない
5. **探索枠のラベル表示**: レポートで [探索] とタグ付けして透明性を確保

### 5. フィードバック処理（秘書が /company 内で実行）

```python
# preferences.yaml を更新する際のロジック
# 秘書はこのルールに従って preferences.yaml を編集する

# useful の場合:
# scores[source_id] = min(current + 0.2, 2.0)
# feedback_history に追記

# noise の場合:
# scores[source_id] = max(current - 0.2, 0.1)
# feedback_history に追記

# 減衰（月1回）:
# for each score: score = score + (1.0 - score) * 0.1
```

## /company 起動時の情報収集ブリーフィング

1. `reports/` の最新 .json ファイルを読む
2. 重要アラート（破壊的変更、メジャーリリース等）を冒頭で報告
3. スコアの高いソースの結果を優先的に表示
4. 全体の要約と社長への提言を生成
5. フィードバックを促す

## 手動実行

```bash
cd /workspace && python scripts/intelligence/collect.py
```

## GitHub Actions

`.github/workflows/intelligence-collect.yml` で定期実行。
手動実行も workflow_dispatch で可能。
