-- ============================================================
-- Seed: growth_events 初期データ（17件）
-- ============================================================
-- git履歴から抽出した成長エピソード。migration-035 適用後に実行。
-- ============================================================

-- ============================================================
-- Phase 1: 誕生期（2026-03-19）
-- ============================================================

-- #1 ダッシュボード爆速立ち上げ
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-19', 'milestone', 'tooling', 'high',
  'Phase 1: 誕生期',
  'ダッシュボード爆速立ち上げ — 1ファイルSPA設計',
  '仮想カンパニーの概念を作ったが、可視化手段がなかった。複数PJ会社の状態を一覧できるダッシュボードが必要だった。',
  'Supabase + Vercel + 単一HTML で半日でダッシュボードを構築。SPAフレームワークを使わず index.html 1ファイルに全機能を集約する設計判断を下した。',
  '「1ファイルSPA」がClaude Codeとの相性を最大化。全体を1回のReadで把握でき、コンテキストウィンドウを節約しながら高速に機能追加できる基盤が完成。',
  ARRAY['bbc3418','ca16a4d','1a069ab','3d49eab'],
  ARRAY['dashboard','vercel','supabase','1-file-spa'],
  'resolved'
);

-- #2 Supabase認証情報の迷走
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-19', 'failure', 'security', 'high',
  'Phase 1: 誕生期',
  'Supabase認証情報の迷走 — ハードコード削除→30分で復元',
  'ダッシュボードにSupabase anon keyがハードコードされていた。セキュリティ上問題ではないかと判断し削除 → Setup画面で入力する方式に変更。',
  'Supabaseのセキュリティモデル（anon key = publishable key = 公開前提、RLSが防御線）を正しく理解していなかった。',
  'publishable key はpublic by designと判断し復元。RLS側でセキュリティを担保する方針に確定。',
  'Supabaseのセキュリティモデルを正しく理解する転換点になった。「何を隠すべきで何を隠す必要がないか」の判断基準が確立。',
  ARRAY['9389f17','e5daec3'],
  ARRAY['security','supabase','anon-key','rls'],
  'resolved'
);

-- #3 user_id マルチテナント → シングルテナントへ撤回
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, related_migrations, tags, status)
VALUES (
  '2026-03-19', 'failure', 'architecture', 'medium',
  'Phase 1: 誕生期',
  'マルチテナント設計の撤回 — user_id全削除',
  'per-user data isolation (user_id + RLS) を全テーブルに導入した。',
  '「将来マルチユーザーになるかも」という推測で過剰設計してしまった。実態は1ユーザー = 1 Supabaseプロジェクトで十分。',
  'migration-002 で user_id カラムを全テーブルから削除。シングルテナント設計に決定。',
  '過剰なマルチテナント設計よりシンプルな分離がこの規模では正解。YAGNI原則の実践例。',
  ARRAY['6336036'],
  ARRAY['migration-002'],
  ARRAY['architecture','multi-tenant','yagni'],
  'resolved'
);

-- ============================================================
-- Phase 2: セキュリティ硬化（2026-03-20 ~ 03-23）
-- ============================================================

-- #4 anon_all ポリシーの穴
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_migrations, tags, status)
VALUES (
  '2026-03-20', 'failure', 'security', 'critical',
  'Phase 2: セキュリティ硬化',
  'anon_all ポリシーの穴 — 全データ読み書き可能状態',
  'migration-010 で Supabase の状態同期用に anon_all ポリシーを作成。結果として anon key だけで全データの読み書き削除が可能な状態になっていた。',
  'RLSポリシーを「便利さ優先」で足し算的に追加し、全体のアクセス権限を俯瞰できていなかった。',
  '3段階で修正: migration-014 で anon SELECT 削除 → migration-015 で ingest key 導入 → migration-018 で残存 anon_all を完全削除。',
  'RLSポリシーは「足し算」で作ると穴が残る。定期的に全ポリシーを棚卸しする必要があるという教訓。セキュリティ部設立の伏線にもなった。',
  ARRAY['migration-010','migration-014','migration-018'],
  ARRAY['security','rls','anon-key','critical-fix'],
  'resolved'
);

-- #5 ingest API key の導入
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_migrations, tags, status)
VALUES (
  '2026-03-20', 'countermeasure', 'security', 'high',
  'Phase 2: セキュリティ硬化',
  'ingest API key 導入 — 自動化クライアントの認証',
  'anon SELECT を塞いでも、Hook や GitHub Actions からの anon INSERT は業務上必要で単純に塞げなかった。',
  '「認証できない自動化クライアント」向けのセキュリティ手段が未設計だった。',
  'migration-015 で x-ingest-key ヘッダーチェックを導入。DBレベルの app.ingest_api_key 設定 + RLS の check_ingest_key() 関数で二重防御。',
  'Hook/GitHub Actions → Supabase の通信路にAPIキーベースの認証が確立。anon でも「知っている人だけ書ける」状態に。',
  ARRAY['migration-015'],
  ARRAY['security','api-key','hooks','github-actions'],
  'resolved'
);

-- #6 owner isolation（オーナー限定RLS）
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_migrations, tags, status)
VALUES (
  '2026-03-20', 'countermeasure', 'security', 'high',
  'Phase 2: セキュリティ硬化',
  'オーナー限定RLS — is_owner() 関数',
  'GitHub OAuth でダッシュボードにログイン可能にしたが、OAuth自体は誰でもログインできるため、他のGitHubユーザーが全データを閲覧できる状態だった。',
  'シングルテナントでも OAuth を使う以上、「誰がオーナーか」の認証が必要だった。',
  'migration-017 で is_owner() 関数を作成。user_settings テーブルに登録されたユーザーのみデータアクセス可能に。全テーブルの authenticated ポリシーを差し替え。',
  'OAuth + オーナー認証の二層構造が完成。ダッシュボードを公開URLに置いても安全な状態に。',
  ARRAY['migration-017'],
  ARRAY['security','oauth','rls','owner-isolation'],
  'resolved'
);

-- ============================================================
-- Phase 3: DevOps基盤（2026-03-20 ~ 03-21）
-- ============================================================

-- #7 プラグインインストーラーの苦闘
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-20', 'failure', 'devops', 'medium',
  'Phase 3: DevOps基盤',
  'プラグインインストーラーの苦闘 — 5連続fix',
  'company プラグインの自動インストールスクリプトを作成したが、marketplace.json の形式、skills 配列の定義、パス解決が次々に壊れ、5つの連続fixコミットが必要になった。',
  'Claude Code のプラグイン仕様が未ドキュメントで、正しいディレクトリ構造・JSON形式を手探りで特定する必要があった。',
  'install-company.sh ワンコマンドインストーラーを作成。正解パターン（~/.claude/plugins/marketplaces/ 配下に配置、marketplace.json に skills 配列必須）を確定。',
  '試行錯誤の結果、Claude Code プラグインの正しい配置パターンが判明。新サーバーでもワンコマンドでセットアップ可能に。',
  ARRAY['ae238e1','89baddf','bce8286','4f177a8','2a306d7','151394f','52769d4','c77d7a2','66019dc'],
  ARRAY['devops','plugin','installer','claude-code'],
  'resolved'
);

-- #8 Hook の DNS タイムアウト問題
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-20', 'failure', 'devops', 'medium',
  'Phase 3: DevOps基盤',
  'Hook の DNS タイムアウト — IPv4強制で解決',
  'Supabase への curl が特定の環境（Codespace等）で極端に遅く、Hook がタイムアウトしてプロンプト記録が失敗していた。',
  'IPv6 DNS 解決が遅い環境で curl がデフォルトで IPv6 を試行し、フォールバックに時間がかかっていた。',
  'curl に -4 フラグ（IPv4強制）を追加し、タイムアウト値も増加。',
  'Hook は同期実行されるため、ネットワーク遅延が UX に直結するという教訓。以降すべての curl に -4 を標準適用。',
  ARRAY['53c7fcc'],
  ARRAY['devops','hooks','dns','ipv4','curl'],
  'resolved'
);

-- #9 マルチサーバー対応
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, related_migrations, tags, status)
VALUES (
  '2026-03-21', 'milestone', 'architecture', 'high',
  'Phase 3: DevOps基盤',
  'マルチサーバー対応 — ローカルファイル→DB移行',
  '複数マシン（Mac, Codespace, Devcontainer等）で作業すると .company/ のローカルファイルが同期しない。あるマシンで作ったタスクが別のマシンで見えない。',
  'migration-009 でマルチサーバー対応、migration-010 で .company/ の状態を Supabase に移行、migration-012 でサーバー識別（hostname:dir）を追加。',
  '「ファイルベース → DB バック」の移行で、どのマシンでも同じ状態で作業可能に。サーバーごとのコンテキスト（どのマシンから入力されたか）も追跡可能に。',
  ARRAY['cf6e7d8'],
  ARRAY['migration-009','migration-010','migration-012'],
  ARRAY['architecture','multi-server','supabase','state-sync'],
  'resolved'
);

-- ============================================================
-- Phase 4: 自動化・インテリジェンス（2026-03-23 ~ 03-31）
-- ============================================================

-- #10 Hook による自動記録システム
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-23', 'milestone', 'automation', 'high',
  'Phase 4: 自動化・インテリジェンス',
  'Hook による自動記録システム — /company 不要のデータ蓄積',
  'プロンプトログや設定同期を手動で行う（/company 起動時のみ）のは非現実的。データが断片的にしか溜まらなかった。',
  'UserPromptSubmit Hook でプロンプト自動記録、SessionStart Hook で設定同期、PostToolUse Hook でアーティファクト自動同期。3つの Hook で「常時記録」体制を構築。',
  '「/company を起動しなくてもデータが溜まる」設計にしたことで、CEO分析やナレッジ蓄積の基盤が完成。行動データの網羅性が飛躍的に向上。',
  ARRAY['2f20030','081701f','99902aa'],
  ARRAY['automation','hooks','prompt-log','artifact-sync'],
  'resolved'
);

-- #11 auto-pull / auto-push
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-31', 'countermeasure', 'devops', 'medium',
  'Phase 4: 自動化・インテリジェンス',
  'auto-pull / auto-push — git同期の完全自動化',
  'マルチサーバーで git の状態がずれる。手動 pull/push を忘れて、古いコードで作業してしまうことがあった。',
  'DB（Supabase）は同期されているが、ファイルシステム（git）は手動同期が必要だった。',
  'SessionStart で auto-pull、SessionStop で auto-push する Hook を追加。',
  '開発者がやるべき定型作業をすべて Hook に任せる思想が確立。「セッション開始 = 最新状態」が保証されるように。',
  ARRAY['b67e612'],
  ARRAY['devops','git','auto-sync','hooks'],
  'resolved'
);

-- #12 Intelligence部の設立
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, related_migrations, tags, status)
VALUES (
  '2026-03-23', 'milestone', 'organization', 'high',
  'Phase 4: 自動化・インテリジェンス',
  'Intelligence部の設立 — 情報収集の組織化と自動化',
  '最新の技術動向・業界情報のキャッチアップが属人的で、忙しいときは情報収集が止まっていた。',
  'HD に intelligence 部署を新設。GitHub Actions で夜間自動収集 → Supabase に蓄積 → ダッシュボードで閲覧。いいねボタン + リンククリック追跡で関心度を計測するフィードバックループも構築。',
  '情報収集を「組織機能」として定義し、自動化 + フィードバックループを構築。属人的だったキャッチアップが毎日自動で行われるように。',
  ARRAY['f302aef','f126ace'],
  ARRAY['migration-019','migration-020'],
  ARRAY['organization','intelligence','github-actions','feedback-loop'],
  'resolved'
);

-- #13 データ鮮度チェックの自動化
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-30', 'countermeasure', 'process', 'medium',
  'Phase 4: 自動化・インテリジェンス',
  'データ鮮度チェック — 腐ったデータを自動検出',
  'ナレッジベースや評価データが古くなっても気づかない。stale なデータに基づいた判断をしてしまうリスクがあった。',
  'freshness-policy.yaml で各データソースの鮮度閾値を定義。/company 起動時に自動で鮮度チェックを実行し、stale データは auto_update: true なら自動更新、false ならリマインド。',
  '「データが腐る」問題をシステム化して解決。起動のたびにデータの健全性が検証され、古いデータに基づく誤判断を防止。',
  ARRAY['32b8029'],
  ARRAY['process','freshness','data-quality','automation'],
  'resolved'
);

-- ============================================================
-- Phase 5: ダッシュボード機能進化（2026-03-29 ~ 04-01）
-- ============================================================

-- #14 AI Chat の設計進化
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-03-31', 'milestone', 'architecture', 'high',
  'Phase 5: ダッシュボード機能進化',
  'AI Chat の設計進化 — チャット→エージェントアーキテクチャ',
  '初期設計(v1)ではシンプルなチャットUIを想定していたが、実際にはダッシュボード内のコンテキスト（タスク・ナレッジ・CEO分析等）を使った深い分析が必要だった。',
  'v1 設計が「汎用チャット」の延長で、ダッシュボード固有のデータ活用を考慮していなかった。',
  'agent-loop アーキテクチャ(v2)に再設計。OpenCode の deep-dive で学んだパターンを適用。パーソナライゼーション + ディープコンテキスト統合（タスク・評価・ナレッジを自動注入）。',
  '「チャット」ではなく「エージェント」として設計することで、ダッシュボードの全データを活用した回答が可能に。パーソナライゼーションで社長の好みにも適応。',
  ARRAY['3eaf414','70cc2bb','4947cbf'],
  ARRAY['architecture','ai-chat','agent-loop','personalization'],
  'resolved'
);

-- #15 セキュリティ部の設立
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-01', 'milestone', 'security', 'high',
  'Phase 5: ダッシュボード機能進化',
  'セキュリティ部の設立 — 場当たり対応から組織的管理へ',
  'セキュリティ対策が場当たり的だった。migration-014, 015, 017, 018 は個別の穴を見つけるたびに塞ぐ対応で、体系的な監視ができていなかった。',
  '「問題が起きてから塞ぐ」リアクティブなセキュリティから脱却できていなかった。',
  'HD にセキュリティ部を新設。security-audit-pipeline.yml で GitHub Actions による自動監視パイプラインを構築。依存関係の脆弱性スキャン、RLSポリシーの定期監査を自動化。',
  '個別の穴塞ぎから「組織的なセキュリティ管理」への進化。Phase 2 の教訓（anon_all の穴）を組織構造として昇華させた。',
  ARRAY['e636238','cb349fe'],
  ARRAY['security','organization','github-actions','audit-pipeline'],
  'resolved'
);

-- #16 モバイルUXの最適化
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, related_migrations, tags, status)
VALUES (
  '2026-04-01', 'countermeasure', 'tooling', 'medium',
  'Phase 5: ダッシュボード機能進化',
  'モバイルUX最適化 — 行動データによるタブ自動並び替え',
  'ダッシュボードのタブが増えすぎて（10+タブ）、モバイルでよく使う機能にたどり着くのに何度もスクロールが必要だった。',
  'tab_clicks テーブルでクリック頻度を記録し、よく使うタブを自動的に上位に並び替える仕組みを導入。ユーザーの行動データに基づくUI最適化。',
  '使えば使うほど良くなるUXが実現。モバイルでの操作効率が大幅に改善。「ユーザーが適応する」のではなく「UIがユーザーに適応する」設計思想。',
  ARRAY['45ec35d'],
  ARRAY['migration-026'],
  ARRAY['tooling','mobile','ux','adaptive-ui','tab-clicks'],
  'resolved'
);

-- #17 Quick Ask（グローバル選択テキスト分析）
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-01', 'milestone', 'tooling', 'medium',
  'Phase 5: ダッシュボード機能進化',
  'Quick Ask — どのページでも選択テキストをAI分析',
  'ダッシュボード内のテキスト（タスク説明、ナレッジ、レポート等）を深掘りしたい時に、チャットタブに移動してコンテキストをコピペする手間があった。',
  'テキスト選択 → ポップオーバーで即座に AI 分析する Quick Ask 機能を実装。precision mode で精度優先モードも用意し、コスト上限ガードレール（$0.50/回）で暴走防止。グローバル機能として全ページで動作。',
  '「どのページでも使える」グローバルAI機能の先例。コストガードレールにより安心して高精度モードを使える設計。情報の「消費」から「深掘り」への行動変容を促進。',
  ARRAY['10f59f3','4e4ce88','d1e099a'],
  ARRAY['tooling','ai','quick-ask','precision-mode','cost-control'],
  'resolved'
);
