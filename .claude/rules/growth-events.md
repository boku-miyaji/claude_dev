# growth_events 運用ルール

> claude_dev / focus-you / polaris-circuit など全PJを横断する **意思決定・失敗・対策・到達** の記録。
> `growth_events` テーブル（Supabase）がマスター。`.company/growth/` の Markdown はミラー（自動生成、手編集禁止）。

## 原則: 記録は不変、追記で成長を表現する

- 書き換えない。**続きが出たら新しいレコードで追加する**
- 順序: `failure` → `countermeasure` → `milestone` を `parent_id` で繋ぐ
- 古い `decision` は新 `decision` で置き換える（`status='superseded'`、`parent_id` で新→旧を指す）

## event_type の使い分け

| event_type | いつ使う | 例 |
|---|---|---|
| `failure` | バグ・障害・ミスが起きた事実 | 「ES256 JWT で認証が 401 を返した」 |
| `countermeasure` | 失敗を受けた**対策決定**（parent_id で failure に紐付ける） | 「verify_jwt=false + 関数内 getUser() を標準化」 |
| `decision` | 障害を伴わない**前向きな意思決定** | 「コスト分離の原則」「focus-you は自己理解軸」 |
| `milestone` | 達成・到達・リリース | 「silence-first 原則の確立」 |

`countermeasure` と `decision` の違い: **起点が失敗か前向きか**。「同じ失敗を二度起こさないため」=`countermeasure`、「これで行くと決めた」=`decision`。

## PJ タグ選定（必須、1つのみ）

`.company/growth-tags.yaml` の `project.values` から選ぶ。

境界ルール:

> **「このPJが消滅したら消える知識か？」**

| 知識 | 消えるか | タグ |
|---|---|---|
| Growth UI の感情分析閾値 | focus-you が消えたら消える | `focus-you` |
| Supabase Edge Function の認証方式 | 残る（PJ横断） | `claude-dev` |
| Hook の責務分離 | 残る（PJ横断） | `claude-dev` or `agent-harness` |
| 回路データシート解析プロンプト | polaris-circuit が消えたら消える | `polaris-circuit` |

**迷ったら `claude-dev` に寄せる**（後で focus-you 等に移動しやすい）。

## 領域タグ（0〜N個）

`.company/growth-tags.yaml` の `domain.values` から選ぶ。未登録タグは warning が出るが、INSERT はできる。必要ならタグ辞書に追記して commit。

## 記録方法

### 手動記録（秘書・社長が会話中に記録する場合）

```bash
bash scripts/growth/record.sh <event_type> <project_tag> "<title>" \
  --what-happened="..." \
  --category=architecture \
  --severity=high \
  --tags=supabase,edge-function
```

重複チェック: 同じ title + 直近7日以内の既存レコードがあれば警告して中断（`--force` で上書き可）。

### 自動記録（バッチ）

2経路:

1. **LLM ベース分類**（`daily-analysis-batch.sh [2]`）— 全プロンプト経由
   - `UserPromptSubmit` Hook の `growth-detector.sh` が全ユーザープロンプトを raw で `~/.claude/logs/growth-signals.jsonl` に蓄積（確認・挨拶などだけ事前除外）
   - Daily batch が Claude CLI (opus) で各プロンプトを分類: `failure / countermeasure / decision / milestone / noise`
   - noise 以外を `source='detector'` で INSERT（title 重複は 7日以内でスキップ）
   - キーワード判定は廃止（見逃しが多いため LLM 判定に一本化: 2026-04-22）

2. **コミット+プロンプト要約**（`daily-growth-digest.sh` → `generate-growth-for-day.sh`）— git log ベース
   - 1日分の git log + prompt_log を Claude CLI (opus) で解析
   - `source='daily-digest'` で INSERT

いずれも秘書が必要に応じて確認・補強する責務を持つ。

### Markdown ミラー生成（毎日）

- `scripts/growth/export-mirror.sh` が DB → `.company/growth/` にエクスポート
- Claude がミラーを grep して参照する
- **Markdown を手編集しない**（次回エクスポートで上書きされる）

## 書き換えないフィールド / 更新してよいフィールド

| フィールド | 更新可否 | 補足 |
|---|---|---|
| `title`, `what_happened`, `root_cause`, `countermeasure`, `result` | **不可** | 誤記は新しいレコードで訂正 |
| `status` | 可 | active → resolved / recurring / superseded |
| `parent_id` | 可 | 後から関連づけてもよい |
| `tags` | 可（標準化のみ） | 既存の意味を変える書き換えは不可 |

## 未解決の検知

- `scripts/growth/check-unresolved.sh` が以下を検出:
  - `failure` で `status='active'` のまま 14日超過
  - `failure` に対して `countermeasure` が紐づいていない
- 検出結果は freshness-policy 経由でブリーフィングに反映

## Hook との連動

- `.claude/hooks/growth-reminder.sh`（PostToolUse）
- 重要ファイル（`supabase/functions/`, `.claude/hooks/`, `.claude/rules/`, `supabase/migrations/`）の変更を検知したら、Claude に「growth に記録すべき決定ではないか」とリマインドする
- ブロックはしない。提案のみ

## 初期投入されている記録（Phase 1）

- `decision` / `claude-dev`: コスト分離の原則（ダッシュボード/バッチ/Hook のモデル使い分け）
- `decision` / `focus-you`: プロダクトビジョン（自己理解・幸せ・物語）
- `countermeasure` / `claude-dev`: Supabase Edge Function 認証方式（verify_jwt=false + 関数内 getUser）
