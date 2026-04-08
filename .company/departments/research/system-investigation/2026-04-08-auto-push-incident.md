# インシデントレポート: auto-push.sh が Stop hook から意図せず削除された問題

**調査日**: 2026-04-08
**調査部署**: 調査部
**重大度**: 中（データ損失の可能性あり）

---

## 1. インシデント概要

`auto-push.sh`（Stop hook）が settings.json のワーキングコピーから削除され、セッション終了時の自動 commit+push が機能しなくなっていた。同時に `growth-summarize.sh` も Stop から削除されていた。これらの変更はコミットされておらず、ワーキングコピーのみに存在する未コミット変更だった。

**タイムライン**:
| 時刻 (2026-04-07) | イベント |
|---|---|
| 23:28:53 | `dfec86e` — auto-save が settings.json に growth-summarize.sh を Stop に追加（最後の settings.json コミット） |
| 23:31:20 | `05aaa4c` — growth-detector の LLM 分類化 |
| 23:31:43〜23:38:27 | `d0b0287`〜`a7f00c3` — 5回の auto-save（いずれも settings.json 変更なし） |
| 23:40:01 | `cba2202` — growth signals の即時永続化 |
| **23:45:50** | **settings.json ワーキングコピーが変更される**（ファイルの mtime） |
| 23:46:06 | `3434d64` — "remove SessionStop dependency" コミット。**しかし settings.json の変更は含まれていない** |
| 23:50:57 | `60761d2` — Blueprint 更新（SessionStop fix を文書化） |

## 2. 根本原因分析（5 Whys）

### Why 1: なぜ auto-push が Stop から消えたのか？

settings.json のワーキングコピーが 23:45:50 に編集され、auto-push.sh と growth-summarize.sh が Stop セクションから削除された。同時に session-summary-periodic.sh が UserPromptSubmit に追加された。

### Why 2: なぜこの変更がコミットに含まれなかったのか？

コミット `3434d64` は `session-summary-periodic.sh` の新規ファイル追加のみを `git add` した。settings.json の変更は `git add -u` や明示的な `git add .claude/settings.json` に含まれなかった。

**エビデンス**:
- `git show 3434d64 --stat` → 変更ファイルは `.claude/hooks/session-summary-periodic.sh` の1ファイルのみ
- `git diff dfec86e 3434d64 -- .claude/settings.json` → 空（settings.json の変更はこのコミット範囲に含まれない）
- その後の auto-save コミット（d0b0287〜a7f00c3）も settings.json を含んでいない

### Why 3: なぜ settings.json が auto-save でコミットされなかったのか？

**これが最も重要な発見**: auto-push.sh の `git add -u` は「既にトラッキングされているファイルの変更」をステージする。settings.json はトラッキング済みなので、本来なら auto-save でコミットされるはずだった。

しかし、**時系列が鍵**:
1. 23:28:53 に dfec86e（auto-save）が settings.json をコミット
2. 23:31:43〜23:38:27 に 5 回の auto-save が走ったが、この時点では settings.json はまだ変更されていなかった
3. **23:45:50 に settings.json が変更された**（mtime による）
4. 23:46:06 に `3434d64` がコミットされたが、これは Claude が意図的に作ったコミットで、auto-push.sh の自動コミットではない
5. **この後、auto-push.sh はもう Stop hook から外されている（ワーキングコピー上）ので、次のレスポンス完了時に auto-push が発火しなくなった**

つまり、**auto-push.sh が自分自身を Stop から外す変更を含むワーキングコピーを、自身がコミットする前に、手動コミット（3434d64）が先に作られた。そして手動コミットは settings.json を含まなかった。その後は auto-push 自体が無効化されているので、永遠にコミットされない状態になった。**

### Why 4: なぜ「auto-save hook already does commit+push」という誤った前提があったのか？

コミット `3434d64` のメッセージに以下の記述がある:
> `auto-push: REMOVED from Stop (auto-save hook already does commit+push)`

**この「auto-save hook」は存在しない。** `/workspace/.claude/hooks/` に `auto-save` という名前のファイルは存在しない。

実際には、**auto-push.sh 自身が「auto-save」の役割を果たしていた**（コミットメッセージ "chore: auto-save session changes" を生成するのは auto-push.sh の27行目）。つまり、削除しようとしているもの自体が、削除の根拠として挙げられている「代替手段」だった。**循環論法的な誤り**。

### Why 5: なぜ「Stop = セッション終了時のみ」という誤解が生じたのか？

コミットメッセージに以下の記述がある:
> `Problem: Stop hooks don't fire on crashes, disconnects, codespace auto-stop.`

これは事実だが、問題の設定が間違っている。Stop hook は「セッション終了」ではなく「**各レスポンス完了後**」に発火する。つまり:
- クラッシュ時にデータが失われるリスクは存在するが、それは最後の1レスポンス分のみ
- 毎レスポンスで auto-push が走ることで、蓄積される未コミット変更は最小限に抑えられていた

**Claude Code の hook イベントの正確な発火タイミングがプロジェクト内にドキュメント化されていなかった**ため、LLM エージェントが「Stop = セッション終了時の1回」と誤解した。

## 3. 影響範囲

### 3.1 失われた変更の有無

最後の auto-save コミット `dfec86e`（2026-04-07 23:28:53）以降、以下の未コミット変更がワーキングコピーに存在する:

**追跡済みファイルの変更（Modified）**:
- `.claude/.claude.json`
- `.claude/hooks/artifacts-cache.json`
- `.claude/plugins/known_marketplaces.json`
- `.claude/settings.json`（本インシデントの対象）
- `.company/secretary/notes/2026-04-07-session-summary.md`

**未追跡ファイル（Untracked）**: 約20ファイル/ディレクトリ（backups, logs, skills, session-summaries 等）

auto-push が停止したのは 23:45:50 以降。その後のコミット `3434d64`〜`5dd642e`（8コミット）は全て Claude が意図的に作成したもので、auto-save ではない。つまり、**意図的にコミットされなかった変更（上記のワーキングコピー変更）が push されずに残っている**。

### 3.2 growth-summarize.sh が外れた影響

growth-summarize.sh は Stop hook から外されたが、commit `cba2202` で growth-detector.sh 内に「3件蓄積で即実行」の仕組みが追加されている。このため、機能的には代替経路が存在する。ただし、セッション中に蓄積された3件未満のシグナルが最終的に集計されないリスクが残る。

## 4. 構造的問題の特定

### 4.1 settings.json の変更管理問題

**問題**: settings.json は Claude Code のツール使用（設定変更）によってワーキングコピーが変更されるが、その変更が「意図的な設計変更」なのか「ツールによる副作用」なのか区別できない。

**エビデンス**: 今回のケースでは、LLM エージェントが settings.json を編集したが、その変更をコミットに含めなかった。コミットメッセージでは「REMOVED from Stop」と宣言しているが、実際のファイル変更は未コミットのまま放置された。

### 4.2 コミットメッセージと実際の変更の不一致

**問題**: コミット `3434d64` のメッセージは settings.json の変更を記述しているが、実際のコミットには含まれていない。これは「方針のコミット」と「実装のコミット」が分離してしまった状態。

**構造的リスク**: コミットメッセージを信頼してコードレビューすると、実際に適用された変更を見落とす。

### 4.3 自己参照的な hook 削除の危険性

**問題**: auto-push.sh を Stop から外す → auto-push が発火しなくなる → settings.json の変更（auto-push 削除）が永遠にコミットされない。これは「自分自身を無効化する変更を、自分自身がコミットする」必要がある自己参照問題。

### 4.4 Hook イベントの発火タイミングが未ドキュメント

**問題**: Claude Code の hook イベント（Stop, SessionStart, UserPromptSubmit 等）の正確な発火タイミングが `.claude/rules/` にも `.company/` にもドキュメント化されていない。

**結果**: LLM エージェントが「Stop = セッション終了時の exit」と誤解し、「クラッシュ時に発火しない → 信頼性が低い → 削除すべき」という誤った推論を行った。

## 5. 対策提案

### 5.1 即時修正（P0）

1. **settings.json のワーキングコピー変更を取り消す**: `git checkout -- .claude/settings.json` で HEAD の状態（auto-push.sh が Stop に含まれる状態）に戻す
2. **取り消し後、session-summary-periodic.sh の追加だけを再適用する**: UserPromptSubmit への session-summary-periodic.sh 追加は有用な改善なので、auto-push.sh と growth-summarize.sh を Stop に残したまま追加する

### 5.2 構造的再発防止（P1）

#### A. Hook イベント仕様のドキュメント化

`.claude/rules/hook-events.md` を新設し、以下を明記する:

```
| イベント | 発火タイミング | 回数 |
|---------|-------------|------|
| SessionStart | セッション開始時 | 1回 |
| UserPromptSubmit | ユーザーがプロンプトを送信した時 | 毎回 |
| Stop | Claude のレスポンス完了後 | 毎回（セッション終了ではない） |
| PreToolUse | ツール実行前 | 毎回 |
| PostToolUse | ツール実行後 | 毎回 |
```

特に **「Stop はセッション終了ではなく、各レスポンス完了後」** を強調する。

#### B. settings.json 変更のコミット強制

settings.json を変更する場合、必ず同一コミットにその変更を含めるルールを追加する。具体的には:

- `.claude/rules/commit-rules.md` に追記: 「settings.json の変更は必ずコミットに含める。方針だけコミットしてファイル変更を未コミットのまま放置しない」
- auto-push.sh に settings.json の変更検出ロジックを追加: `git diff --name-only` に settings.json が含まれる場合、警告を出す

#### C. Hook 削除の安全手順

Stop hook から hook を削除する場合、以下の手順を必須とする:

1. 削除対象の hook が提供していた機能の代替手段を特定する
2. **代替手段が実在し、テスト済みであることを確認する**（「auto-save hook」のように存在しないものを根拠にしない）
3. settings.json の変更を含むコミットを作成する（方針だけのコミットにしない）
4. 削除後、1セッション分のテストを行い、期待通りに動作することを確認する

#### D. settings.json の差分検出 hook

PostToolUse hook に settings.json の変更を検出する仕組みを追加する:

```bash
# settings.json が変更されたら警告
if ! git diff --quiet -- .claude/settings.json 2>/dev/null; then
  echo "⚠️ settings.json に未コミットの変更があります"
fi
```

## 6. ハンドオフ

```yaml
# handoff
handoff:
  - to: system-dev
    context: "調査レポートに基づく即時修正と構造的再発防止の実装"
    tasks:
      - "settings.json のワーキングコピーを HEAD に戻し、auto-push.sh を Stop に復元する"
      - "session-summary-periodic.sh の UserPromptSubmit 追加は残す（auto-push 削除だけリバート）"
      - ".claude/rules/hook-events.md を新設し、各 hook イベントの発火タイミングをドキュメント化する"
      - ".claude/rules/commit-rules.md に settings.json 変更のコミット必須ルールを追記する"
  - to: pm
    tasks:
      - "今回のインシデントをタスクとして Supabase に登録（[ops] auto-push 復元 + hook 管理改善）"
      - "構造的対策の優先度付けと期限設定"
```

---

**調査結論**: このインシデントの根本原因は、(1) Claude Code の Stop hook の発火タイミングに関する誤解、(2) 存在しない「auto-save hook」を代替手段として誤認した循環論法的推論、(3) settings.json の変更をコミットに含めなかったことによる「宙に浮いた変更」の3点が複合したもの。局所修正（settings.json の復元）に加え、hook イベント仕様のドキュメント化と settings.json 変更管理ルールの追加が必要。
