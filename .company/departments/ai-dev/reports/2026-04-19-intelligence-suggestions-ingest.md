# 情報収集示唆の自動 INSERT 仕組み構築（2026-04-19）

## サマリー

情報収集部レポート末尾の構造化 YAML ブロック (`# suggestions`) を解析し、`intelligence_suggestions` テーブルに自動 INSERT する仕組みを実装した。冪等性は `(title, source_report_path)` の事前 SELECT で担保。

## 変更/追加ファイル一覧

| ファイル | 種別 | 概要 |
|---|---|---|
| `/workspace/scripts/intelligence/ingest-suggestions.py` | 新規 | ハイフン区切りのエントリポイント（実装本体 `ingest_suggestions.py` を呼ぶ薄いラッパー） |
| `/workspace/scripts/intelligence/ingest_suggestions.py` | 修正 | `check_existing()` を追加し、`run()` が INSERT 前に SELECT で既存確認する冪等性ロジックに変更 |
| `/workspace/scripts/intelligence/tests/test_ingest_suggestions.py` | 修正 | `check_existing` の単体テストと冪等性の統合テスト（7件追加、合計34件） |
| `/workspace/.company/departments/intelligence/reports/2026-04-19-briefing.md` | 修正 | 報告末尾に `# suggestions` YAML ブロック（6件）を追加 |
| `/workspace/.company/departments/intelligence/CLAUDE.md` | 修正 | 「構造化 YAML ブロックの追加（必須）」「レポート生成後の自動 INSERT」節を `focus-you への示唆` 節の直後に追記 |
| `/workspace/.company/departments/ai-dev/reports/2026-04-19-intelligence-suggestions-ingest.md` | 新規 | 本報告 |

## 設計判断

### 1. ハイフン版は薄いラッパー、実装本体はアンダースコア版

Python はハイフンを含むファイル名を `import` できないため、テスト・他スクリプトからの import を可能にする本体は `ingest_suggestions.py` に置く。要件が指定する `ingest-suggestions.py` は `sys.path` を整え `main()` を呼ぶだけの2行ラッパー。両方で同じ動作になる。

### 2. 冪等性の実装方式（UNIQUE 制約ではなく SELECT 事前チェック）

Supabase `intelligence_suggestions` テーブルのスキーマを確認した結果、`(title, source_report_path)` に対する UNIQUE 制約は存在しない（確認済み: `pg_constraint` 列挙）。したがって `Prefer: resolution=ignore-duplicates` だけでは冪等性が担保されない。

要件の指示通り、各 suggestion の INSERT 前に:
1. `GET /rest/v1/intelligence_suggestions?title=eq.<t>&source_report_path=eq.<p>&select=id&limit=1`
2. 1件でもあればスキップ
3. なければ POST

SELECT 自体が失敗した場合は `error` としてカウントし、誤って重複 INSERT することを避ける。POST 側には安全網として `ignore-duplicates` ヘッダと 409/23505 のスキップ処理も残している（将来 UNIQUE 制約が追加されたとき自動的に恩恵を受けられる）。

### 3. カテゴリの未知値は 'other' に寄せる

要件の `category` 許容値は `algorithm|architecture|ux|cost|competition|design|other`。DB 側に CHECK 制約はないが、整合性のため未知カテゴリはコードで `other` に正規化する。`priority` / `effort` は DB 側に CHECK 制約があるので、未知値は `None` にして INSERT 時に NULL になるようにした（`NOT NULL` ではないため OK）。

### 4. source_report_path の導出ルール

絶対パス `/workspace/.company/departments/intelligence/reports/2026-04-19-briefing.md` から `.company` を基準に相対化して `.company/departments/intelligence/reports/2026-04-19-briefing.md` として保存する。ダッシュボードや他のスクリプトが `.company/...` 起点でファイルアクセスするため、この相対形が標準。

## 動作確認結果

### パース段階（ローカル）

```text
extracted: 6
  [1] Opus 4.7 × Claude Design による design → code → narrative pipeline | priority=medium effort=medium category=design
  [2] Memory Management Framework の昇格（MIA パターン） | priority=high effort=medium category=algorithm
  [3] Session vs Organization Memory の明示分離（GAM パターン） | priority=medium effort=large category=architecture
  [4] Routines for Intelligence Gathering の評価 | priority=low effort=small category=architecture
  [5] Claude Design の教材化（学習軸） | priority=low effort=medium category=competition
  [6] npm/pip audit の自動化 | priority=high effort=small category=architecture
```

### 1回目実行（INSERT）

```text
[ingest] .company/departments/intelligence/reports/2026-04-19-briefing.md (2026-04-19)
[ingest] 抽出件数: 6
  [insert] Opus 4.7 × Claude Design による design → code → narrative pipel
  [insert] Memory Management Framework の昇格（MIA パターン）
  [insert] Session vs Organization Memory の明示分離（GAM パターン）
  [insert] Routines for Intelligence Gathering の評価
  [insert] Claude Design の教材化（学習軸）
  [insert] npm/pip audit の自動化
[ingest] 結果: inserted=6 skipped=0 errors=0
```

### 2回目実行（冪等性検証）

```text
[ingest] 抽出件数: 6
  [skip] 既存: Opus 4.7 × Claude Design による design → code → narrative pipel
  [skip] 既存: Memory Management Framework の昇格（MIA パターン）
  ... (全 6 件スキップ)
[ingest] 結果: inserted=0 skipped=6 errors=0
```

### Supabase 実データ検証（Management API）

```sql
SELECT id, title, priority, effort, category, status, source_report_path, source_report_date
FROM intelligence_suggestions
WHERE source_report_path = '.company/departments/intelligence/reports/2026-04-19-briefing.md'
ORDER BY created_at ASC;
```

6行全て返り、`status='new'`、`source_report_date='2026-04-19'`、priority/effort/category が YAML と一致。

## テスト結果

```text
======================= 34 passed in 0.10s =======================
```

追加されたテスト群:
- `test_check_existing_found` / `test_check_existing_not_found` / `test_check_existing_http_error_returns_none` / `test_check_existing_network_error_returns_none`: SELECT 事前チェックの各パターン
- `test_run_idempotent_skips_existing`: 全件既存シナリオで POST が一度も呼ばれないことを検証
- `test_run_mixed_inserts_and_skips`: 一部既存・一部新規の混在シナリオ
- `test_run_select_failure_counted_as_error`: SELECT が失敗した suggestion は INSERT せずエラー扱いにすることを検証

## 情報収集部 CLAUDE.md の追記内容（要約）

`### focus-you への示唆（必須セクション）` の末尾に、以下2小節を追加:

1. **「構造化 YAML ブロックの追加（必須）」** — Markdown の示唆セクションに加えて `# suggestions` YAML ブロックを必ず併記することをルール化。カテゴリ・priority・effort の許容値とフォーマットを明示。
2. **「レポート生成後の自動 INSERT」** — `set -a; source supabase.env; set +a; python3 scripts/intelligence/ingest-suggestions.py <report.md>` の実行コマンドを明文化。冪等なので再実行安全である旨も記載。

## 運用上の注意

- **環境変数の渡し方**: `source supabase.env && python3 ...` だと子プロセスに届かない場合がある。`bash -c 'set -a; source ...; set +a; python3 ...'` か、GitHub Actions では `env` で直接渡すのが確実。
- **今後 UNIQUE 制約を追加する場合**: `(title, source_report_path)` の UNIQUE INDEX を張れば POST だけで冪等になるが、現状は SELECT + POST の2リクエスト構成で十分速い（suggestion数は1レポートあたり5〜10件）。
- **過去レポート移行**: 今回スコープ外。移行が必要になったら `scripts/intelligence/migrate_past_suggestions.py`（既存）を `check_existing` 対応に揃える or 同じ ingest スクリプトを全レポートに対してループで回す運用で対応可能。

## handoff

```yaml
# handoff
handoff:
  - to: pm
    context: "intelligence_suggestions 自動 INSERT 仕組みが稼働開始。次は GitHub Actions への組み込み検討"
    tasks:
      - "intelligence-collect.yml の後段に ingest-suggestions.py 呼び出しを追加するか判断"
      - "ダッシュボードで intelligence_suggestions を表示・優先度変更・task化する UI の要否をチケット化"
  - to: sys-dev
    context: "自動 INSERT が動作開始したので、ダッシュボード側で新 suggestion を可視化する"
    tasks:
      - "company-dashboard に intelligence_suggestions の一覧ビューを追加（status=new をバッジ表示）"
      - "各 suggestion から tasks テーブルへの変換ボタン（adopted → task_id 紐付け）を実装"
```
