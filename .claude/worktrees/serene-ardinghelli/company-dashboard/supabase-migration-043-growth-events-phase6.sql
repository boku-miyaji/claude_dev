-- ============================================================
-- Seed: growth_events Phase 6-7（10件追加）
-- ============================================================
-- 2026-04-01 ~ 04-04 の成長エピソード。migration-035 seed の続き。
-- ============================================================

-- ============================================================
-- Phase 6: Self-Focus Platform（2026-04-02 ~ 04-03）
-- ============================================================

-- #18 1ファイルSPA → React移行
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-01', 'milestone', 'architecture', 'critical',
  'Phase 6: Self-Focus Platform',
  '1ファイルSPA → React+TypeScript移行',
  'Phase 1 で「1ファイルSPA」として始めたダッシュボードが 8000行超に膨張。新機能追加のたびに意図しない副作用が発生し、legacy.ts の保守が困難になっていた。',
  '初期の「Claude Codeで1回で読める」という利点が、コード量の増大で逆にボトルネックに。型安全性の欠如もバグの温床に。',
  'Vite + React + TypeScript で段階的に移行。Phase 0(スキャフォールド) → Phase 1(Shell+Auth) → Phase 2(共通UI) → Phase 3(カスタムhooks) → Phase 4(ページ移行) の5段階で実行。legacy.ts はブリッジ経由で共存させつつ段階的に縮小。',
  '型安全性・コンポーネント分離・状態管理(Zustand)が確立。新機能の追加速度が大幅に向上。「最初は1ファイル、育ったら分離」という成長パターンの実例。',
  ARRAY['dcad590','7bccee5','b834c30','6989f6f','df8c71d','d050954'],
  ARRAY['architecture','react','typescript','migration','vite'],
  'resolved'
);

-- #19 Self-Focus Platformのビジョン策定
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'milestone', 'architecture', 'high',
  'Phase 6: Self-Focus Platform',
  'Self-Focus Platform — ダッシュボードから自己理解プラットフォームへ',
  'ダッシュボードに日記・感情分析・夢リスト・習慣追跡・自己分析を追加してきたが、「何のためのツールか」が曖昧になっていた。PJ管理ツール？セルフケアアプリ？',
  'ビジョンを「Self-Focus Platform — 自分を知る、自分を育てる」に定義。日記を起点に感情分析→パターン認識→自己理解→夢の実現をループさせる設計思想を確立。3フェーズ（感情可視化→パターン認識→自己成長）で段階的に実装。',
  'プロダクトの方向性が明確になり、機能追加の判断基準ができた。「この機能は自己理解に寄与するか？」という問いでスコープを制御できるように。',
  ARRAY['5148eca','c1999b0','b965291','b99a46d'],
  ARRAY['architecture','vision','self-focus','product-strategy'],
  'resolved'
);

-- #20 Zustand による状態管理の集約
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-03', 'countermeasure', 'architecture', 'medium',
  'Phase 6: Self-Focus Platform',
  'Zustand による状態管理集約 — データフェッチの一元化',
  'React移行後、各ページが個別にSupabaseからデータ取得していた。同じデータを複数ページで重複取得し、キャッシュもページごとにバラバラ。',
  'グローバルな状態管理がなく、各ページが独立してデータを管理していた。',
  'useDataStore (Zustand) に全データフェッチ・キャッシュ・ミューテーションを集約。5分間のキャッシュ + 楽観的更新でUXを改善。',
  'データの重複取得が解消され、ページ間のデータ整合性が保証された。新ページ追加時のデータ取得パターンも統一。',
  ARRAY['660f103'],
  ARRAY['architecture','zustand','state-management','data-fetching'],
  'resolved'
);

-- ============================================================
-- Phase 7: 品質・設計改善（2026-04-04）
-- ============================================================

-- #21 OpenAI API直叩き問題の発覚と修正
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-04', 'failure', 'architecture', 'high',
  'Phase 7: 品質・設計改善',
  'OpenAI API直叩き — 5つのhookがEdge Functionを迂回',
  'モバイルから日記を書いたらOpenAI API keyエラーが発生。調査すると、感情分析・ブリーフィング・夢検出・週次ナラティブ・自己分析の5つのhookがブラウザから直接api.openai.comを叩いていた。',
  'AI機能を追加する際に「とりあえず動く」ことを優先し、既存のEdge Function経由パターンを無視して直接APIを叩くコードを書いてしまった。同じミスが5回繰り返された。',
  'Edge Functionにcompletion mode（会話管理なしの軽量エンドポイント）を追加。共通ヘルパー(edgeAi.ts)を作成し、全hookを統一的にEdge Function経由に修正。モデルもgpt-5-nanoに統一。',
  'API呼び出しパターンが統一され、APIキーがサーバー側のみに。共通ヘルパーにより今後同じミスが起きにくい構造に。「同じミスを5回した」という教訓をナレッジとして記録済み。',
  ARRAY['f6bdc22'],
  ARRAY['architecture','security','edge-function','openai','api-pattern'],
  'resolved'
);

-- #22 自動処理がチャット履歴を汚染
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-04', 'failure', 'architecture', 'medium',
  'Phase 7: 品質・設計改善',
  'チャット履歴汚染 — 自動処理がconversationレコードを量産',
  'AIチャットの履歴に「ping」「あなたは社長のことをよく知って...」「【指示】質問や確認をせず...」等の大量のゴミ会話が表示されていた。',
  'Edge Functionの接続チェック(ping)、ブリーフィング一言、ニュース収集がすべてagent loopエンドポイントを叩いており、毎回conversationレコードが作成されていた。「チャット用API」と「バックグラウンド処理用API」の区別がなかった。',
  'pingをEdge Functionで即座にreturn。ブリーフィング・ニュース収集をcompletion mode（会話作成なし）に切り替え。',
  '「ユーザー向けの会話」と「バックグラウンド処理」のAPIを明確に分離。completion modeの導入により、今後のバックグラウンドAI処理はすべて会話レコードなしで実行可能に。',
  ARRAY['5351385'],
  ARRAY['architecture','chat','edge-function','data-quality'],
  'resolved'
);

-- #23 HOME一言の口調問題
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-01', 'failure', 'process', 'medium',
  'Phase 6: Self-Focus Platform',
  'HOME一言の口調迷走 — 3回の修正を経て着地',
  'Home画面のAI一言メッセージが「業務報告」「タメ口」「実行不可能な約束」を繰り返し、社長から3回連続で修正指示が入った。',
  'LLMに丸投げするとプロンプトの意図を外れやすい。特に「感情に寄り添う」と「実行できない約束をしない」のバランスがLLM単独では取れなかった。',
  'プロンプトに【絶対禁止】リストを明記。深夜は無条件で休息メッセージ（LLMに判断させない）。日記・CEOインサイト・セッション履歴をコンテキストとして注入。',
  '「LLMに自由度を与えすぎない」という教訓。ガードレール（禁止リスト）+ コンテキスト注入 + 時間帯ルールの3層で安定した出力に。',
  ARRAY['f3a8da3','13b5d9d','fa5f761','29692a5','837c3a9','18f3344'],
  ARRAY['process','llm','prompt-engineering','guardrails'],
  'resolved'
);

-- #24 NEWS収集のAI暴走
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-01', 'failure', 'tooling', 'medium',
  'Phase 6: Self-Focus Platform',
  'NEWS収集のAI暴走 — 質問返し・白画面・パース失敗',
  'ニュース収集ボタンを押すとAIが「どのようなニュースをお探しですか？」と質問返しをしたり、白画面になったり、JSON配列ではなくマークダウンで返したりして、3回連続でバグ修正が必要になった。',
  'LLMへの指示が「ニュースを教えて」と曖昧で、LLMが対話モードに入ってしまった。SSEレスポンスのパースもエッジケースでの処理が甘かった。',
  'プロンプトに「【指示】質問や確認をせず、即座にJSON配列だけを出力」を明記。出力形式を厳密に指定し、context_mode: none で余計なコンテキストを排除。',
  'LLMへの指示は「何をどの形式で返すか」を徹底的に具体化すべきという教訓。曖昧な指示 = 不安定な出力。',
  ARRAY['848a82c','7f505d0','9e5f982'],
  ARRAY['tooling','llm','news','json-output','prompt-engineering'],
  'resolved'
);

-- #25 ブリーフィングのSSE接続問題
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-01', 'failure', 'devops', 'medium',
  'Phase 6: Self-Focus Platform',
  'ブリーフィングSSEパースの連鎖障害',
  'Home画面のブリーフィングが表示されない。Edge Functionへの接続、JWT認証、SSEパース、レスポンスのパースがそれぞれ別のバグを持っており、1つ直すと次が発覚する連鎖障害。',
  'Edge Function呼び出し→SSEストリーミング→パース→表示という長いパイプラインの各段階にテストがなく、end-to-endでしか問題が見えなかった。',
  'JWT自動リフレッシュ、SSE deltaイベントのパース修正、2段階アーキテクチャ（即時表示→非同期LLM呼び出し）で解決。',
  '複雑なパイプラインは各段階でのエラーハンドリングが必要。「動く最短パス」を先に確保し、非同期で豊かな体験を追加する2段階アーキテクチャが有効。',
  ARRAY['3145ebe','036f624','c9379ae','5f45b1a','75c3665'],
  ARRAY['devops','sse','jwt','edge-function','error-handling'],
  'resolved'
);

-- #26 会社セレクターの無意味なUI
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, tags, status)
VALUES (
  '2026-04-04', 'failure', 'process', 'low',
  'Phase 7: 品質・設計改善',
  '会社セレクターの無意味なUI — 機能なしで放置',
  'サイドバーに「全社（HD）」の会社切替セレクターが表示されていたが、どのページでもactiveCompanyIdを参照しておらず、選択しても何も起きない状態だった。',
  '将来の機能として先にUIだけ作ったが、実装が追いつかず「UIだけ存在する」状態で放置された。ユーザーに混乱を与える無意味な要素。',
  '会社セレクターを削除。必要になった時点で再追加する方針に。',
  'UIは「動く機能」とセットで追加する。スタブUIは混乱の元。YAGNI原則の再確認。',
  ARRAY['architecture','ui','yagni','sidebar'],
  'resolved'
);

-- #27 Claude Code-aware HD設計
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-02', 'milestone', 'architecture', 'high',
  'Phase 6: Self-Focus Platform',
  'Claude Code-aware HD設計 — LLM内部構造を踏まえた最適化',
  'CLAUDE.mdが肥大化し、Context Loadingのたびに大量のトークンを消費。Sub-agentに必要な情報が渡らない、意思決定が会話内に残ってContext Compactionで消えるなどの問題が発生。',
  'Claude Codeの内部構造（Context Loading, Compaction, Tool Execution Model, Agentic Loop）を分析し、それぞれに対応した設計原則を策定。CLAUDE.mdは方針のみ、手順はreferences/に分離、意思決定は即時永続化、ブリーフィングは並列実行。',
  'LLM Agentの内部動作を理解した上で設計することで、コンテキスト効率と実行精度が大幅に向上。「LLMの仕組みに合わせた設計」というメタレベルの知見が蓄積。',
  ARRAY['ee00235'],
  ARRAY['architecture','claude-code','context-optimization','meta-design'],
  'resolved'
);
