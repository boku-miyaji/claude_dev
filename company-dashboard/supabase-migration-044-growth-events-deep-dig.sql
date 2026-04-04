-- ============================================================
-- Seed: growth_events 追加（git履歴深堀り 20件）
-- ============================================================
-- 既存27件(migration-035 + 043)に含まれないエピソードを追加。
-- ============================================================

-- ============================================================
-- Phase 2.5: カレンダー機能の試行錯誤（2026-04-01 ~ 04-02）
-- ============================================================

-- #28 カレンダーUTC/JST地獄
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'failure', 'tooling', 'medium',
  'Phase 5: ダッシュボード機能進化',
  'カレンダー UTC/JST 地獄 — 5連続fix',
  'Google Calendar連携で日付が1日ずれる、時間帯が9時間ずれる、イベント作成時にUTCとJSTが混在する等の問題が5回連続でfixされた。',
  'JavaScriptのDateオブジェクトがUTCベースで動くのに対し、Google Calendar APIはローカルタイムゾーンを期待する。この不一致を統一的に扱う設計がなかった。',
  'すべてのAPI呼び出しでJST(+09:00)を明示的に指定。表示側もtoLocaleStringでtimeZone: Asia/Tokyoを統一。',
  'タイムゾーン問題は「全レイヤーで統一」しないと再発する。部分的な修正は新たなバグを生む。',
  ARRAY['3111f2a','b1ac1d3','0a275a7','eb5b6f9','784576d'],
  ARRAY['tooling','calendar','timezone','utc','jst'],
  'resolved'
);

-- #29 Google Calendar認証の迷走
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'failure', 'security', 'medium',
  'Phase 5: ダッシュボード機能進化',
  'Google Calendar 認証の迷走 — scope不足→トークン消失→サイレント再取得',
  'Calendar連携でOAuth scopeが不足→calendar.events.readonlyを追加→しかしトークンが古いscopeのまま→自動クリア機能追加→ページリロードでトークン消失→localStorage保存に変更、と4段階の修正が必要だった。',
  'OAuth認証のスコープ変更時に既存トークンの invalidation と再取得のフローが未設計だった。',
  'トークンをlocalStorageに永続化 + scope不足検出時の自動クリア + サイレント再取得の3層で解決。',
  'OAuth系の認証は「スコープ変更」「トークン失効」「ストレージ消失」の3つを常に想定して設計する必要がある。',
  ARRAY['d212066','6dd5699'],
  ARRAY['security','oauth','google-calendar','token-management'],
  'resolved'
);

-- ============================================================
-- Phase 3.5: Finance機能の連続バグ（2026-04-02）
-- ============================================================

-- #30 Finance計算ロジックの連続修正
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'failure', 'tooling', 'medium',
  'Phase 5: ダッシュボード機能進化',
  'Finance計算ロジック — 5連続バグ修正',
  '月末日計算エラー、クライアント別グルーピングミス、重複チャート、暦月ベースの誤った売上予測、未定義CSS変数、とFinance機能だけで5つの連続fixが発生。',
  '請求書データの構造（project_id vs client_name、月末日の扱い、実績月 vs カレンダー月）を十分に理解せずに集計ロジックを組んだ。',
  '実データに基づく集計に修正。月末日は専用関数で算出、グルーピングはclient_nameベース、予測は実績月のみ使用。',
  '金融・会計系のロジックは「実データの構造を先に確認」してから組むべき。カレンダー月と請求月は異なるという基本が重要。',
  ARRAY['ccffbb3','06dd65d','61388ee','9576550','1553b55'],
  ARRAY['tooling','finance','calculation','data-modeling'],
  'resolved'
);

-- ============================================================
-- Phase 4.5: Vercelデプロイの試行錯誤（2026-04-03）
-- ============================================================

-- #31 Vercelデプロイ3連続失敗
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-03', 'failure', 'devops', 'medium',
  'Phase 6: Self-Focus Platform',
  'Vercelデプロイ 3連続失敗 — .env問題',
  'React移行後のVercelデプロイが3回連続で失敗。build設定不足→.envをgitにコミット→.envをgitから除外して.env.example追加、とデプロイ設定が二転三転。',
  'Vercelの環境変数管理（ダッシュボードで設定 vs .envファイル vs vercel.json）の正しいパターンを把握していなかった。',
  'Vercelダッシュボードで環境変数を設定、.envは.gitignoreに追加、.env.exampleをテンプレートとして提供。',
  '環境変数は「どこで管理するか」を最初に決める。.envのgitコミットは絶対に避ける（一度コミットすると履歴に残る）。',
  ARRAY['cf1a079','5f47c5b','1523a55'],
  ARRAY['devops','vercel','env','deployment'],
  'resolved'
);

-- #32 認証画面フラッシュ問題
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-03', 'failure', 'tooling', 'low',
  'Phase 6: Self-Focus Platform',
  '認証画面フラッシュ — ログイン済みなのにログイン画面が一瞬見える',
  'ダッシュボードをリロードすると、認証済みユーザーにもログイン画面が一瞬表示されてからHome画面に遷移する。SPA起動時のちらつき問題。',
  'Supabaseの認証状態チェック（getSession）が非同期で、完了前にデフォルトの未認証状態でレンダリングされていた。',
  '認証状態チェック中はローディング表示にし、確定後に画面を切り替えるようにした。',
  'SPA認証は「未確定状態」を明示的にハンドリングする。デフォルトを未認証にすると必ずフラッシュする。',
  ARRAY['14916fd','b8fded3'],
  ARRAY['tooling','auth','ux','flash-of-content'],
  'resolved'
);

-- ============================================================
-- Phase 3: Newsレポートの連続バグ（2026-04-02）
-- ============================================================

-- #33 Newsレポートのクリック展開3連続バグ
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'failure', 'tooling', 'low',
  'Phase 5: ダッシュボード機能進化',
  'Newsレポート — クリック展開の3連続バグ',
  'Newsレポートをクリックしても開かない→修正→2個目以降が開けない→修正→個別取得方式に変更、と3回の修正が必要だった。',
  'レガシーSPAのDOM操作で、イベントリスナーの付け方とデータの取得タイミングが噛み合っていなかった。全件一括取得→メモリ展開の設計が大量データに対応できなかった。',
  'クリック時に個別取得する方式（遅延読み込み）に変更。',
  'レガシーコードへの機能追加は「動く最小実装」でも複数回のfixが必要になる。React移行の動機付けになった。',
  ARRAY['ff44531','313d8c7','1f94f45'],
  ARRAY['tooling','news','legacy','dom-manipulation'],
  'resolved'
);

-- ============================================================
-- Phase 2: How it Works埋め込みの迷走（2026-03-29 ~ 03-30）
-- ============================================================

-- #34 How it Works ページの埋め込み3段階
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-30', 'failure', 'tooling', 'low',
  'Phase 4: 自動化・インテリジェンス',
  'How it Works 埋め込みの迷走 — 外部リンク→iframe→srcdoc→ネイティブ',
  'How it Worksページを外部リンクで開く→ダッシュボード内に埋め込みたい→iframeで埋め込み→X-Frame-Options DENYでブロック→SAMEORIGINに変更→srcdoc方式→最終的にネイティブページに書き直し、と4段階の迷走。',
  '最初から「ダッシュボード内に表示する」要件を明確にせず、後付けで埋め込もうとした。',
  '最終的にレガシーSPA内のネイティブページとして書き直し。iframeの制約を回避。',
  '「どこに表示するか」は最初に決める。後からiframeで埋め込もうとすると、セキュリティヘッダーやCORS問題にぶつかる。',
  ARRAY['0718690','635ccd1','fd10f20','9ada1d8','6d402e3'],
  ARRAY['tooling','iframe','security-headers','spa'],
  'resolved'
);

-- ============================================================
-- Phase 4: AI Chatの設計進化（2026-03-31 ~ 04-01）
-- ============================================================

-- #35 AIモデル移行の連鎖（gpt-4o → gpt-4.1 → gpt-5）
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-01', 'countermeasure', 'tooling', 'medium',
  'Phase 5: ダッシュボード機能進化',
  'AIモデル3段階移行 — gpt-4o → gpt-4.1 → gpt-5-nano',
  '2週間で3回のモデル移行が発生。gpt-4oが非推奨→gpt-4.1/o4-miniに→gpt-5シリーズ登場→gpt-5-nanoに統一。各移行でモデル名のハードコードを全箇所修正する必要があった。',
  'モデル名が各ファイルにハードコードされており、一括変更が困難だった。',
  'Edge FunctionのMODEL_MAPで一元管理。クライアントは「simple/moderate/complex」のティア指定のみ。',
  'AI機能のモデル名はハードコードせず、設定で一元管理する。モデルの世代交代は頻繁に起きる前提で設計する。',
  ARRAY['075a0a5','364ecb3','8aa04e5'],
  ARRAY['tooling','ai','model-migration','configuration'],
  'resolved'
);

-- #36 AI Chatのプロバイダー選択ミス
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-31', 'failure', 'architecture', 'low',
  'Phase 5: ダッシュボード機能進化',
  'AI Chat — Anthropic対応を作って即削除',
  'AI ChatにOpenAIとAnthropicのデュアルプロバイダー対応を実装したが、Anthropic APIはブラウザからの直接呼び出しにCORS制限がありEdge Functionが必要。結局OpenAIのみに絞って削除。',
  '「両方対応しておけば便利だろう」という推測で実装したが、実際にはAnthropicはCORS問題で使えなかった。',
  'OpenAIのみに絞り、Anthropicの選択肢を削除。',
  'YAGNI。「使うかもしれない」機能は作らない。特にAPI連携は実際に動くか先に検証してから組み込む。',
  ARRAY['83f4d06'],
  ARRAY['architecture','ai','anthropic','yagni','cors'],
  'resolved'
);

-- ============================================================
-- Phase 2: 組織設計の試行錯誤（2026-03-20 ~ 04-02）
-- ============================================================

-- #37 部署の中央集約化
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-23', 'countermeasure', 'organization', 'high',
  'Phase 3: DevOps基盤',
  '部署の中央集約化 — 子会社ごとの部署をHDに統合',
  '各PJ会社（foundry, rikyu, circuit）にそれぞれ ai-dev, sys-dev, research 等の部署を作っていたが、部署のルール更新が各社に分散し、同じ改善を3回やる羽目に。',
  '「各PJ会社が独立した組織」という設計が、小規模運用では過剰だった。部署のルールは共通なのに、各社に別々のCLAUDE.mdを持たせていた。',
  '共通部署をHD（.company/departments/）に集約。子会社はPJ固有コンテキスト（クライアント情報、リポジトリ）のみ保持する設計に変更。',
  '組織設計も「共通ロジックの集約」が重要。DRY原則は人間の組織にも適用できる。',
  ARRAY['f72958d','3f97d7a'],
  ARRAY['organization','architecture','dry','centralization'],
  'resolved'
);

-- #38 Polaris AIの統合と廃止
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'countermeasure', 'organization', 'medium',
  'Phase 5: ダッシュボード機能進化',
  'Polaris AI会社の統合廃止 — 実態に合わない組織を解体',
  'Polaris AIという協業先向けの子会社を作ったが、実際には回路図PJ（circuit）の一部でしかなく、独立会社として運用する実態がなかった。',
  '「将来的に独立したPJになるかも」と推測して先行して会社を作ったが、実態が伴わなかった。',
  'Polaris AIをcircuit会社に統合し、Polaris AI会社をアーカイブ。ダッシュボードからも参照を削除。',
  '組織は「実態に合わせて作る」。実態のない組織は管理コストだけ増える。YAGNI。',
  ARRAY['41a9ffa','42d1e1f','ec09237'],
  ARRAY['organization','yagni','company-lifecycle'],
  'resolved'
);

-- #39 ページ統合の大掃除
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'countermeasure', 'architecture', 'medium',
  'Phase 5: ダッシュボード機能進化',
  'ページ統合の大掃除 — 6つのリファクタ一気実行',
  'ダッシュボードのタブが15以上に膨張。Inbox/Tasks/Dashboard/Portfolio/Careerが重複・中途半端な状態で並存していた。',
  '機能を追加するたびに新しいタブを作り、既存タブとの関係を整理しなかった。',
  'InboxをTasksに統合、DashboardタブをHome化、Portfolioを削除してCareerに統合、OrgchartをカードUIに、Intelligence→Newsにリネーム。6つのrefactorを一気に実行。',
  '定期的な「ページ棚卸し」が必要。機能は足し算で増えるが、UXは引き算で良くなる。',
  ARRAY['35396ad','42d1e1f','462da9c','af0a6ee','9c3845b','1d1071c'],
  ARRAY['architecture','ux','page-consolidation','refactor'],
  'resolved'
);

-- ============================================================
-- Phase 1.5: RLSポリシーの繰り返し修正（2026-03-20 ~ 04-03）
-- ============================================================

-- #40 RLSポリシー追加忘れの繰り返し
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-03', 'failure', 'security', 'medium',
  'Phase 7: 品質・設計改善',
  'RLSポリシー追加忘れ — 新テーブルのたびに同じ失敗',
  'secretary_notes, activity_log, comments, tasks など、新テーブルを作るたびにRLSポリシーの追加を忘れ、「データが読めない」「INSERTできない」問題が繰り返し発生。少なくとも6回の個別fix。',
  'テーブル作成時のチェックリストがなく、CREATE TABLE と RLS ポリシー作成が別のステップとして分離していた。',
  'マイグレーションテンプレートにRLSポリシーを必ず含めるルールを策定。新テーブルは CREATE TABLE + ENABLE RLS + ポリシー作成を1つのマイグレーションに含める。',
  '「テーブルを作ったらRLSも作る」は鉄則。チェックリスト化しないと必ず忘れる。',
  ARRAY['1b034f3','dbf46b3','769df04','725d88e','bdd8e81','44d5c36'],
  ARRAY['security','rls','checklist','migration-template'],
  'resolved'
);

-- ============================================================
-- Phase 0: pptx-rikyuの試行錯誤（2026-02-26 ~ 02-27）
-- ============================================================

-- #41 pptx-rikyuコマンドの3回書き直し
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-02-27', 'failure', 'tooling', 'medium',
  'Phase 0: 原始時代',
  'pptx-rikyu コマンド3回書き直し — テンプレート方式に収束',
  'りそな向けPPTX生成コマンドを作成したが、仕様変更→リネーム→テンプレート方式に書き直し→デュアル出力対応、と3回のリファクタが必要だった。',
  '最初にテンプレートPPTXの構造を十分に分析せず、コードで0からスライドを組み立てる方式で始めてしまった。',
  'テンプレートPPTXをベースに内容だけ差し替える方式に変更。通常版と詳細版の2バージョン同時生成も追加。',
  'PPTX生成は「テンプレート差し替え」が正解。0からの生成はレイアウト制御が地獄。テンプレートを先に分析すべき。',
  ARRAY['5db1f22','5b1985b','2a6652b','ba4689f','3aadc30'],
  ARRAY['tooling','pptx','template','rikyu'],
  'resolved'
);

-- #42 全体設計テンプレートの6回修正
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-02-19', 'failure', 'process', 'medium',
  'Phase 0: 原始時代',
  '全体設計テンプレート — 6回の修正で「前提→ゴール→計画→成果」に収束',
  '回路図PJの全体設計テンプレートを作成したが、品質基準の削除、検証設計の追加、アウトプット定義の追加、冗長なIDプレフィックスの削除、メタデータの削除、MTG設計の統合、と6回の連続修正が必要だった。',
  'ドキュメントテンプレートの設計を「あるべき論」から始めたが、実際に使ってみると不要な項目が多く、逆に必要な項目が欠けていた。',
  '4層構造（前提→ゴール→計画→成果）にシンプル化。実際に使いながら育てる方針に転換。',
  'テンプレートは「最小限で始めて実用で育てる」。最初から完璧を目指すと使われないテンプレートができる。',
  ARRAY['d4107b6','551c9f4','df1e85e','031dae0','2316a74','3ca3a3f','3de8ed1'],
  ARRAY['process','template','documentation','iterative-design'],
  'resolved'
);

-- ============================================================
-- Phase 4: キャッシュとパフォーマンス（2026-04-02 ~ 04-03）
-- ============================================================

-- #43 ブリーフィングのキャッシュ戦略迷走
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-03', 'failure', 'architecture', 'low',
  'Phase 6: Self-Focus Platform',
  'ブリーフィングのキャッシュ戦略迷走 — 短すぎ→長すぎ→時間ベース',
  'LLMブリーフィングのキャッシュがなく毎回API呼び出し→1時間キャッシュに→しかし夜に朝のメッセージが残る→時間帯ベースのキャッシュに修正。',
  'LLM応答のキャッシュは「いつ無効化するか」の設計が抜けていた。固定時間のキャッシュは時間帯依存のコンテンツには不適切。',
  '時間帯（朝/昼/夜）が変わったらキャッシュ無効化する方式に。localStorage + 時間帯キーで管理。',
  'LLM応答のキャッシュは「何が変わったら無効化するか」を先に定義する。固定TTLでは不十分な場合がある。',
  ARRAY['a380605','49a1808'],
  ARRAY['architecture','cache','llm','time-based-invalidation'],
  'resolved'
);

-- #44 ダッシュボードのstaleコンテンツ問題
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'failure', 'devops', 'low',
  'Phase 5: ダッシュボード機能進化',
  'staleコンテンツ配信 — デプロイしても古いファイルが表示',
  'Vercelにデプロイしても、ブラウザが古いHTML/JSをキャッシュして新機能が反映されない問題が発生。',
  'VercelのCDNキャッシュ＋ブラウザキャッシュの二重キャッシュで、デプロイ後もstaleファイルが配信されていた。',
  'HTMLにcache-control meta tagを追加し、キャッシュを制御。',
  'SPAのデプロイ後は「ユーザーに新しいファイルが届くか」まで確認する。CDN＋ブラウザの二重キャッシュ問題は見落としやすい。',
  ARRAY['8cd4d16'],
  ARRAY['devops','cache','vercel','cdn','deployment'],
  'resolved'
);

-- ============================================================
-- Phase 3: AIペルソナの設計（2026-04-01 ~ 04-03）
-- ============================================================

-- #45 AIペルソナの2段階進化
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-03', 'countermeasure', 'process', 'medium',
  'Phase 6: Self-Focus Platform',
  'AIペルソナの設計 — 「最高の相棒」→「丁寧だが堅すぎない秘書」',
  'AI Chatのペルソナを「最高の相棒」として設計→タメ口で馴れ馴れしい→「丁寧だが堅すぎない」に修正。距離感の設計が2回で安定。',
  'フランクすぎるペルソナは信頼感を損なう。一方で堅すぎると壁打ち相手として機能しない。',
  '「です・ます調だがフランクな語尾」「感情に寄り添うが約束はしない」というバランスを明文化。',
  'AIペルソナの距離感は「近すぎず遠すぎず」。具体的な口調ルールを明文化しないとLLMが勝手に距離感を変える。',
  ARRAY['8b3e5ef','45635a7'],
  ARRAY['process','ai','persona','tone','prompt-engineering'],
  'resolved'
);

-- ============================================================
-- Phase 1: 投票アプリの連続バグ（2025-08-16）
-- ============================================================

-- #46 投票アプリ — 初日7連続fix
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2025-08-16', 'failure', 'tooling', 'medium',
  'Phase 0: 原始時代',
  '投票アプリ初日 — 7連続fix（DB/認証/バリデーション）',
  '投票アプリを1日で作ろうとしたが、SQLiteのDB設定、npm依存関係、ポート衝突、セッションバリデーション（UUID vs CUID）、投票率制限、ステータス値の大文字小文字、投票方式の固定化、と7つの連続fixが発生。',
  '「1日で完成させる」プレッシャーで、設計を飛ばして実装に入った。各コンポーネントの仕様（Prismaのデフォルト型、Supabaseのバリデーション等）を確認せずに進めた。',
  '各fixを順に適用して最終的に動作する状態に。投票方式を3-2-1に固定してUIもシンプル化。',
  '急いで作るほどfixが増える。「設計30分→実装2時間」の方が「実装3時間→fix3時間」より速い。',
  ARRAY['ba06193','43a5e30','fb1331e','8effc27','0aa9b21','a27a5b6','320c0c1'],
  ARRAY['tooling','rapid-dev','validation','database'],
  'resolved'
);

-- #47 スキル管理の運用自動化
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-03', 'milestone', 'devops', 'medium',
  'Phase 6: Self-Focus Platform',
  'スキル管理の運用自動化 — sync-skills.sh',
  'スキルの追加・変更のたびにmarketplace.jsonの手動編集、キャッシュの手動コピー、整合性の手動チェックが必要で、ミスが頻発していた。',
  'sync-skills.sh ワンコマンドで marketplace.json 自動生成 + 全キャッシュ同期 + 整合性チェックを実行。skill-managementルールも策定し、「手動編集禁止」を明文化。',
  '運用手順の自動化は「ミスが2回起きた時点」で投資すべき。手動手順は必ず劣化する。',
  ARRAY['041bbcf'],
  ARRAY['devops','skills','automation','sync-script'],
  'resolved'
);
