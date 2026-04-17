-- ============================================================
-- Migration 050: growth_events 2026-04-05 詳細記録（20件）
-- ============================================================
-- 94コミットを分析し、成長ストーリーを詳細に記録。
-- 「まとめすぎ」ではなく、各改善の知見・苦労を個別に残す。
-- ============================================================

-- まず anon INSERT の RLS ポリシーを確認・追加（未適用の場合）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'growth_events'
    AND policyname = 'anon_insert_growth_events'
  ) THEN
    EXECUTE 'CREATE POLICY "anon_insert_growth_events" ON growth_events FOR INSERT TO anon WITH CHECK (public.check_ingest_key())';
  END IF;
END $$;

-- ============================================================
-- Phase 6: ハーネスエンジニアリング革命（2026-04-05 午後）
-- ============================================================

-- #1 ハーネスエンジニアリング調査 — Stanford HAI の知見を自社に適用
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'architecture', 'critical',
  'Phase 6: ハーネスエンジニアリング革命',
  'ハーネスエンジニアリング調査 — 「プロンプトより環境が重要」の発見',
  'Stanford HAI の研究で「ハーネス（CLAUDE.md, Hooks, MCP, Permissions, Sub-agents, Skills）の品質が成果の+28-47%を左右し、プロンプト自体は+3%しか影響しない」という知見を発見。自社システムのギャップ分析と14件の改善提案を策定した。',
  'これまでプロンプトの書き方に注力していたが、それを動かす「環境」の設計が体系化されていなかった。',
  '6つのハーネスコンポーネント（CLAUDE.md, Hooks, Permissions, MCP, Sub-agents, Skills）を明示的に設計対象として位置づけ、How It Worksに専用タブを追加。',
  'AI Agent の能力 = CLAUDE.md のルール品質。この原則が全社の設計思想として確立された。',
  ARRAY['a2842bc','1796521','08e03f0','7bf75d4'],
  ARRAY['architecture','harness-engineering','stanford-hai','research'],
  'resolved'
);

-- #2 CLAUDE.md 208→64行 大幅プルーニング
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'countermeasure', 'architecture', 'critical',
  'Phase 6: ハーネスエンジニアリング革命',
  'CLAUDE.md 208→64行プルーニング — 知識の適切な分離',
  '14件の改善提案のうちIMP-001として最優先実施。CLAUDE.mdが208行に肥大化しコンテキストウィンドウを圧迫。方針のみ残し、手順詳細はreferences/、ルールはrules/に分離。69%削減に成功。',
  '新機能追加のたびにCLAUDE.mdに手順を直接書き足していた。「方針」と「手順」の区別がなかった。',
  '設計原則を明文化: CLAUDE.md=方針のみ（What/Why）、references/=手順（How）、rules/=制約。サイズチェックHook（80行警告）も導入。',
  'コンテキスト効率が劇的に改善。「知識をどこに置くか」のアーキテクチャが確立。以後のCLAUDE.md肥大化を構造的に防止。',
  ARRAY['fc34479'],
  ARRAY['architecture','claude-md','pruning','context-optimization','IMP-001'],
  'resolved'
);

-- #3 Hookの並列化 — セッション起動時間の短縮
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'countermeasure', 'devops', 'high',
  'Phase 6: ハーネスエンジニアリング革命',
  'Hook並列化 + ドキュメント鮮度チェック自動化',
  'IMP-010,011として実施。SessionStart Hookが直列実行で遅かったのを並列化。さらにドキュメント鮮度チェック（impl_docs_sync）をSessionStartに追加し、実装とドキュメントの乖離を起動時に自動検出。',
  'config-sync, company-sync等のHookが順番に実行されていた。また実装変更後のドキュメント更新漏れが常態化していた。',
  'Hook並列実行 + SessionStart時の鮮度チェック（git logの日付比較）で実装ファイルがHow It Worksより新しい場合はSTALEアラート。',
  'セッション起動が高速化。ドキュメントの陳腐化を「気づく仕組み」で防止。',
  ARRAY['fc34479','42a5ea6'],
  ARRAY['devops','hooks','parallelization','freshness-check','IMP-010','IMP-011'],
  'resolved'
);

-- #4 構造化ハンドオフYAML — 部署間連携の信頼性向上
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'countermeasure', 'process', 'high',
  'Phase 6: ハーネスエンジニアリング革命',
  '構造化ハンドオフYAML — Markdown正規表現の限界を超える',
  'IMP-002として実施。部署間のハンドオフ（引き継ぎ）をMarkdownパターンマッチで検出していたが、誤検出・見逃しが発生。YAMLブロック形式に移行し、確実なパースを実現。',
  'Markdownの「→ {部署名}部への依頼」パターンは自然文に紛れやすく、正規表現での検出が不安定だった。',
  'ハンドオフ情報をYAMLブロック（handoff: - to: pm, tasks: [...]）で構造化。後方互換のためMarkdownパターンも残すが、新規は必ずYAML。',
  '部署間連携の指示が機械可読になり、自動パイプライン実行の基盤が整った。',
  ARRAY['68c1e51'],
  ARRAY['process','handoff','yaml','department-coordination','IMP-002'],
  'resolved'
);

-- #5 14件の改善提案を1セッションで全完了
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'organization', 'critical',
  'Phase 6: ハーネスエンジニアリング革命',
  '14件の改善提案を1セッションで全完了 — 組織改善の爆速実行',
  '運営改善部の分析データを基にした14件の改善提案（IMP-001〜014）を、P0→P1→P2の優先順位で約2時間で全て実装完了。CLAUDE.mdプルーニング、Hook並列化、ハンドオフYAML、部署知識ローテーション、サイドバー再設計等。',
  NULL,
  '提案→実装→検証のサイクルを高速回転。各提案にIDを振り、進捗を追跡しながら順次実装。',
  '「提案して終わり」ではなく「提案→即実装→完了」のサイクルが回ることを証明。組織改善が実際に機能する仕組みが確立。',
  ARRAY['fc34479','68c1e51','8494e4a','1b4eb85','d27a611'],
  ARRAY['organization','improvement-proposals','execution-speed'],
  'resolved'
);

-- ============================================================
-- AIチャット — ファイル抽出とpdf.jsの格闘（2026-04-05 17:42-19:06）
-- ============================================================

-- #6 AIチャットにPDF/Office文書の読み取り機能を追加
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'tooling', 'high',
  'Phase 6: ダッシュボードAI進化',
  'AIチャットにPDF/Excel/Word/PPTX読み取り機能を追加',
  'AIチャットでファイルをアップロードするとテキスト抽出してコンテキストに含める機能を実装。しかしpdf.jsのworker設定で3連続fix（disable worker→CDN worker→local Vite import→CDN fallback）が必要だった。',
  'pdf.jsはWeb Workerを使うが、Viteのビルド環境でworkerSrcのパス解決が複雑。npm版、CDN版、Vite ?url import版を順に試行。',
  '最終的にCDNからpdf.jsをロードする方式で安定。npm依存を排除し、Viteのバンドル問題を回避。',
  'pdf.jsのような重量級ライブラリは「npmよりCDN」が1ファイルSPAでは正解。バンドラーとの相性問題を避けられる。',
  ARRAY['bc528b2','e04a856','b2be99e','3578da3','bd0e78e'],
  ARRAY['tooling','ai-chat','pdf','file-extraction','pdfjs','vite'],
  'resolved'
);

-- #7 AIチャット会話履歴の安定化 — 泥沼デバッグからの生還
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'failure', 'quality', 'critical',
  'Phase 6: ダッシュボードAI進化',
  'AIチャット会話履歴の安定化 — tool_call_id問題との6時間の格闘',
  'AIチャットの会話コンテキストが途中で消失する問題が発生。debug用ログ追加→原因特定→修正を繰り返し、最終的に6つの問題を発見: (1)中間assistantメッセージのDB未保存、(2)tool_call_idカラム未存在、(3)null contentのフィルタ漏れ、(4)ファイル内容による履歴膨張、(5)toolメッセージとassistantの紐付け不整合、(6)履歴再構築ロジックの脆弱性。',
  'OpenAI APIのFunction Calling仕様で、assistantのtool_callsメッセージ→toolの応答メッセージ→次のassistantメッセージが厳密にペアリングされる必要があるが、中間メッセージをDB保存していなかった。',
  'tool_call_idカラムをmigration 047で追加。中間assistantメッセージのDB保存、ファイル内容の分離保存、safe history reconstructionロジックを実装。',
  'LLM APIの会話履歴は「全メッセージの厳密なペアリング」が必須。部分的な保存は必ず破綻する。debugログを段階的に追加して原因を絞り込む手法が有効だった。',
  ARRAY['ac536f4','9adf4b6','00b326f','5a880ee','a005725','3f13b89','0361eab','d5da859','3cf2313'],
  ARRAY['quality','ai-chat','debugging','tool-calling','history','context-loss'],
  'resolved'
);

-- #8 AIチャット品質の劇的改善 — 「まず動く、聞くのは後」
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'quality', 'high',
  'Phase 6: ダッシュボードAI進化',
  'AIチャット品質の劇的改善 — act first, ask later',
  'AIチャットのシステムプロンプトを大幅改善。「質問ばかりして動かない」AIから「まずアクション（タスク作成・検索・分析）を実行し、必要な時だけ聞く」AIに変革。ファイル要約のDB保存、UIのバブル幅拡大も同時実施。',
  NULL,
  'システムプロンプトに「act first, ask later」の原則を明記。ツール呼び出しの閾値を下げ、積極的にアクションを取るよう指示。',
  'ユーザー体験が大幅向上。「聞かれるのを待つAI」から「先回りして動くAI」への質的転換。',
  ARRAY['49f9221','d5da859'],
  ARRAY['quality','ai-chat','system-prompt','ux'],
  'resolved'
);

-- #9 6段階モデルルーティング — コスト最適化の知的設計
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'architecture', 'high',
  'Phase 6: ダッシュボードAI進化',
  '6段階モデルルーティング — 3段階から6段階への精密化',
  '従来のsimple/moderate/complexの3段階ルーティングを、casual/factual/lookup/creative/analytical/strategicの6段階に拡張。各段階にモデル（nano/mini/gpt-5）とreasoning level（none/low/medium/high）を割り当て。',
  '3段階では「挨拶にgpt-5-miniを使う」「簡単な事実確認にreasoningを使う」等の無駄が発生していた。',
  '分類プロンプトを拡張し、各カテゴリの定義と具体例を明示。デフォルトフォールバックをmoderateからanalyticalに変更（安全側に倒す）。',
  'API費用の最適化と応答品質の両立。「挨拶はnano、戦略相談はgpt-5」という直感的なコスト配分が実現。',
  ARRAY['d035d9c','49d7464'],
  ARRAY['architecture','ai-chat','model-routing','cost-optimization'],
  'resolved'
);

-- ============================================================
-- タスクページ完全リデザイン（2026-04-05 13:34-15:37）
-- ============================================================

-- #10 タスクページ完全リデザイン — タブ・ソート・D&D
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'tooling', 'high',
  'Phase 6: ダッシュボード機能進化',
  'タスクページ完全リデザイン — タブ・ソート・ドラッグ&ドロップ',
  'Tasks/Requestsのタブ切替UI、日付/優先度/期限でのソート、行クリックで編集モーダル、期限超過バッジ、ドラッグ&ドロップ並び替えを実装。さらにT/Rボタンを廃止し、ホバー時のアクションボタン（→Request / →Task / 削除）に置換。',
  '旧UIはリストが単純すぎて、タスクとリクエストの区別がつきにくく、優先順位の把握も困難だった。',
  'タブUIでTask/Requestを明確に分離。各行にtype tag表示。ソートボタンでトグル方向切替。Todayページからはrequestを除外。',
  '「情報の整理 = 行動の質」。見やすいUIが意思決定の速度を上げる。ホバーアクションは「常時表示のボタン」より画面がスッキリする。',
  ARRAY['4b9c37d','fdd0b13','5daf25e','7553fff','020056e'],
  ARRAY['tooling','dashboard','tasks','ux','drag-and-drop'],
  'resolved'
);

-- ============================================================
-- カレンダーUXの執拗な改善（2026-04-05 16:16-17:37）
-- ============================================================

-- #11 カレンダーall-dayデフォルト問題 — 4連続fixの教訓
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'failure', 'quality', 'medium',
  'Phase 6: ダッシュボード機能進化',
  'カレンダーall-dayデフォルト問題 — 4連続fixでも直らない',
  '時間セルをクリックしてイベント作成する際、常にall-day=trueになるバグ。(1)スマートデフォルト修正→(2)明示的にfalse渡し→(3)triple-guard追加→(4)clickハンドラをbody delegationから各セル直接attachに変更、と4回修正してようやく解決。',
  'イベント委任（body delegation）でクリックイベントを処理していたため、セルのdata属性が正しく取得できず、デフォルトのall-day=trueにフォールバックしていた。',
  'イベント委任を廃止し、各時間セルに直接clickハンドラをattach。さらにel()ヘルパーのboolean属性（checked/disabled）をプロパティとして設定するよう修正。',
  '「イベント委任」はパフォーマンス面で有利だが、data属性の取得が不安定になるケースがある。DOM操作では「直接attach」が確実。また、HTMLのboolean属性はsetAttribute()ではなくプロパティ代入が正しい。',
  ARRAY['6cded13','6da0811','a8e7f2f','8cf2851','f0a37c4','80c3528'],
  ARRAY['quality','calendar','ux','event-delegation','dom','boolean-attributes'],
  'resolved'
);

-- #12 カレンダーイベントモーダルの刷新 — @タスクリンク付き
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'tooling', 'medium',
  'Phase 6: ダッシュボード機能進化',
  'カレンダーイベントモーダル刷新 — レスポンシブ + @タスクリンク',
  'イベント作成/編集モーダルをレスポンシブレイアウトに刷新。日付と時間の入力を同一行に配置。さらに@でタスクをリンクできる機能を追加し、予定とタスクの紐付けを実現。',
  NULL, NULL,
  'カレンダーとタスクが連携することで「いつ何をやるか」が明確になる。小さなUX改善の積み重ねが全体の使い勝手を大きく変える。',
  ARRAY['9c2be94','fe4863e'],
  ARRAY['tooling','calendar','modal','responsive','task-linking'],
  'resolved'
);

-- ============================================================
-- Dreams & Goals の統合と進化（2026-04-05 15:41-18:41）
-- ============================================================

-- #13 Dreams & Goals UI の3回リデザイン — 正解を見つけるまで
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'tooling', 'medium',
  'Phase 6: ダッシュボード機能進化',
  'Dreams & Goals UIの3回リデザイン — タブ→統合→単一ビュー',
  'まずDreams/Goalsをタブ型UIに統合→しかし切替が面倒→タブを廃止して単一ビューに統合→Wishlist連携も追加して最終形に。dream/goal/wishのセレクター付き統一追加フォーム、各種の説明テキストと具体例も追加。GPT-5 nanoによる自動カテゴリ分類とバックグラウンドAI分類も実装。',
  '最初から正解のUIは分からない。タブ型→統合型と試行錯誤して初めて「タブ切替はこの規模では不要」と分かった。',
  '3回のイテレーションを恐れず実行。最終的にdream/goal/wishの3タイプを1画面で自然に扱えるUIに到達。',
  'UIデザインは「試してから判断」が最速。設計段階で悩むより、実装して触って判断するサイクルが有効。AI自動分類はバックグラウンド実行にすることで追加時のUXを損なわない。',
  ARRAY['42bdfe6','1e76dcf','128ed5e','d9c3f9d','e0f8dd0','c66ef6c','e5bce26','38d4d29','5f8e438','3cbce4e','3554149'],
  ARRAY['tooling','dreams','goals','wishlist','ui-iteration','auto-classification'],
  'resolved'
);

-- ============================================================
-- 自己分析の深化とバイアス補正（2026-04-05 14:23, 16:14-16:34）
-- ============================================================

-- #14 自己分析にバイアス補正を導入 — AIの構造的偏りへの対策
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'countermeasure', 'quality', 'high',
  'Phase 6: ダッシュボードAI進化',
  '自己分析にバイアス補正を導入 — LLMの「褒めすぎ」問題への対策',
  'Self-Analysisページをダッシュボードグリッド+SVGレーダーチャートに刷新。さらに全分析プロンプトに構造的バイアス補正を追加。日記の質問も「分析バイアスを誘発しない」よう再設計。multi-source行動データ（prompt_log 1034件、タスク完了率、カレンダー）を統合。',
  'LLMは自己分析で肯定的バイアスが強く、「ポジティブすぎる分析」になりがち。また単一データソースでは偏った分析になる。',
  '分析プロンプトに「ネガティブな側面も等しく扱うこと」「データに基づかない推測は明示すること」等のバイアス補正指示を追加。日記の質問を感情誘導しない中立的な表現に変更。',
  'AIによる自己分析は「バイアス補正」を明示的にプロンプトに組み込まないと信頼できない。データソースを複数統合することで分析の立体性が向上。',
  ARRAY['b9244ee','9a26f94','b368017','c7abc83'],
  ARRAY['quality','self-analysis','bias-correction','multi-source','radar-chart'],
  'resolved'
);

-- ============================================================
-- Finance機能の拡充（2026-04-05 16:58-19:29）
-- ============================================================

-- #15 Finance機能の3段拡張 — 固定費・API費用・ウィッシュリスト
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'tooling', 'high',
  'Phase 6: ダッシュボード機能進化',
  'Finance機能の3段拡張 — 固定費・API費用・ウィッシュリスト',
  '(1)固定費/サブスクリプション管理タブ追加 (2)API費用タブ追加（日本円表示）(3)ウィッシュリストタブ追加。統一的なAPIコスト追跡をsource categories付きで実装し、news収集もaiCompletion()経由に統一してコスト追跡対象に。',
  'Finance機能が売上/経費のみで、サブスク管理・API費用・欲しいものリストがバラバラだった。',
  'Financeページにタブを追加し、金銭に関わる全情報を一元化。APIコストはJPY表示で直感的に把握可能に。',
  '「お金に関することはFinanceに集約」という原則で機能を整理。サブスク管理は特にフリーランスにとって重要。',
  ARRAY['56b1335','13576aa','6e83495','6447830','683a2ba','7d3ff7a'],
  ARRAY['tooling','finance','subscription','api-costs','wishlist','jpy'],
  'resolved'
);

-- ============================================================
-- ドキュメント同期の自動化（2026-04-05 22:59-23:07）
-- ============================================================

-- #16 実装↔ドキュメント同期の3層エンフォースメント
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'automation', 'critical',
  'Phase 6: ハーネスエンジニアリング革命',
  '実装↔ドキュメント同期の3層エンフォースメント',
  'How It Worksページが実装と乖離する問題に対し、3層の自動防止機構を構築: (1)PostToolUse Hook（docs-sync-guard.sh）が実装ファイル編集時に警告注入 (2)Freshness Policy（git log日付比較）がSessionStartで陳腐化を検出 (3)Commit Rulesにファイル→セクション対応表を追記しPRチェックリストに追加。',
  'How It Worksは手動更新に依存しており、実装を変更してもドキュメントが更新されないことが常態化していた。',
  '3層の防御: リアルタイム警告（Hook）+ 起動時チェック（Freshness）+ コミット時チェック（Rules）。各層単独では穴があるが、3層の組み合わせで漏れを最小化。',
  '「なぜ3層必要か」— Hookは編集時のみ、Freshnessは起動時のみ、Rulesはコミット時のみ。単層では必ず隙間が生まれる。複数層の組み合わせが堅牢性を生む。',
  ARRAY['0c06975','15d608c'],
  ARRAY['automation','documentation','sync','hooks','freshness','3-layer-enforcement'],
  'resolved'
);

-- ============================================================
-- ダッシュボードUX全般の磨き込み（終日）
-- ============================================================

-- #17 iframe内アーティファクトリンク問題 — postMessage解決
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'failure', 'tooling', 'medium',
  'Phase 6: ダッシュボード機能進化',
  'iframe内アーティファクトリンク問題 — 3回の試行錯誤',
  'HTMLアーティファクトをiframe内で表示する際、内部リンクをクリックしても親フレームに遷移しない問題。(1)window.top.location.hashを試す→セキュリティ制約で失敗 (2)injected scriptでインターセプト→不安定 (3)最終的にpostMessage通信で親がshowDetail()を呼ぶ方式に。PDFもbase64→Blob URL変換で安定表示。',
  'iframeのsame-origin policyにより、iframe内から親フレームのDOMを直接操作できない。',
  'postMessage APIで子iframe→親フレームに「navigateArtifact」メッセージを送信。親がメッセージを受信してルーティング処理。',
  'iframeとの通信はpostMessageが唯一の安全な方法。直接DOM操作やlocation変更はセキュリティ制約に阻まれる。',
  ARRAY['fe52cff','06e6742','6cc9d43'],
  ARRAY['tooling','dashboard','iframe','postMessage','artifacts','security'],
  'resolved'
);

-- #18 サイドバー折りたたみ + ChatGPTスタイルのUI改善
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'tooling', 'medium',
  'Phase 6: ダッシュボード機能進化',
  'サイドバー折りたたみ + ChatGPTスタイル編集/コピーボタン',
  'メインナビとAIチャットのサイドバーを折りたたみ可能に。モバイルでの使い勝手が大幅向上。さらにAIチャットにChatGPT風の編集・コピーボタンを追加。チャット会話のグルーピングもToday/Yesterday/This Week/This Month/Olderに改善。サイドバーのタブ順序も上流→下流の論理順に再配置。',
  NULL, NULL,
  '小さなUX改善の積み重ねが「毎日使いたくなるツール」を作る。特にモバイル対応は日常使いの鍵。',
  ARRAY['f0ff16b','4aaf853','f4059d7','ce94a42'],
  ARRAY['tooling','dashboard','sidebar','mobile','chat-ux'],
  'resolved'
);

-- ============================================================
-- 知識体系の構築（2026-04-05 00:03-00:07）
-- ============================================================

-- #19 データ鮮度マップ + 知識分類体系の確立
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'architecture', 'high',
  'Phase 6: ハーネスエンジニアリング革命',
  'データ鮮度マップ + 知識分類体系の確立',
  '全データを更新メカニズム別に分類するData Freshness Map（Auto/User-triggered/Manual）と、更新の連鎖を可視化するUpdate Chain Mapを作成。さらにrikyuプロジェクトの知識分類フレームワーク（Data/Knowledge/Tacit Knowledge、Skill×KnowledgeBase 2層モデル、C1-C3コード化レベル）をHD全体に適用。8つの暗黙知アイテムを特定。',
  'データの鮮度管理が属人的で、どのデータがいつ更新されるか不明瞭だった。また「データ」「知識」「暗黙知」の区別がなく、蓄積戦略が曖昧だった。',
  'How It WorksにFreshness Map/Update Chain/Knowledge Taxonomyセクションを追加。暗黙知の捕捉状況を追跡するTK-001〜008を定義。',
  '「何がAuto更新で、何がManualで陳腐化リスクがあるか」を可視化したことで、メンテナンス戦略が明確に。知識の3層構造（Data→Knowledge→Tacit）で蓄積の優先順位が付けられるようになった。',
  ARRAY['526b0d9','e50dcd8'],
  ARRAY['architecture','freshness','knowledge-taxonomy','tacit-knowledge','update-chain'],
  'resolved'
);

-- ============================================================
-- その他の重要な改善
-- ============================================================

-- #20 感情分析バックフィル — 254日記エントリーの一括分析
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'automation', 'medium',
  'Phase 6: ダッシュボードAI進化',
  '感情分析バックフィル — 254日記エントリーの一括分析',
  '過去の全日記エントリー254件にPlutchik感情分析、Russell感情モデル、PERMA+Vスコア、WBI(Well-Being Index)を一括適用。Python urllib3でEdge Functionを呼ぶと401エラーが頻発する問題に苦しみ、最終的にcurlのsubprocess呼び出しで解決。',
  'Python urllib3とSupabase Edge Functionの認証ヘッダー処理の相性問題。原因特定に時間を要した。',
  'curl subprocess呼び出しに切り替え。信頼性重視で「動くものを使う」判断。',
  '技術的に美しい解決策（urllib3）より「確実に動く」解決策（curl subprocess）を選ぶ実用主義が大事。254件の感情データが揃い、長期的な感情トレンド分析が可能に。',
  ARRAY['16e3c46'],
  ARRAY['automation','diary','emotion-analysis','backfill','plutchik','perma-v'],
  'resolved'
);

-- #21 Enterキー送信問題 — フォームの基本UXミス
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'failure', 'quality', 'medium',
  'Phase 6: ダッシュボード機能進化',
  'Enterキー送信問題 — 改行しようとしてフォーム送信される',
  'テキストエリアでEnterを押すと改行ではなくフォーム送信されてしまう問題。ユーザーの期待は「Enter=改行、Cmd/Ctrl+Enter=送信」。',
  'HTMLフォームのデフォルト動作でEnterがsubmitをトリガーする。textareaのkeydownイベントが適切にハンドリングされていなかった。',
  'Enter=改行、Cmd/Ctrl+Enter or ボタンクリック=送信に統一。全フォームに適用。',
  '社長の強い要望。フォームのEnterキー動作はユーザーの期待と合わせることが重要。この知見はナレッジとして蓄積済み。',
  ARRAY['f790eeb'],
  ARRAY['quality','ux','keyboard','enter-key','form'],
  'resolved'
);

-- #22 Todayページ→Homeリネーム + ニュース統合
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'tooling', 'medium',
  'Phase 6: ダッシュボード機能進化',
  'Today→Home リネーム + ニュース統合でホームページ化',
  'TodayページをHomeにリネームし、ニュースフィード機能を統合。旧Homeページを廃止して一本化。スケジュールセクションは予定がなくても常に表示（「予定なし」表示 + カレンダーリンク）するよう修正。',
  '「Today」と「Home」が別ページとして存在し、どちらを見ればいいか混乱していた。',
  'Todayの機能（スケジュール・タスク）とHomeの機能（ニュース）を統合し、Homeに一本化。',
  'ページ統合で「起動したらまずここを見る」が明確に。「予定なし」の明示表示は「カレンダー接続が壊れたのか？」という不安を解消。',
  ARRAY['333ea66','8a0241b','98d0979'],
  ARRAY['tooling','dashboard','home','news','schedule'],
  'resolved'
);

-- #23 部署知識ローテーション — CLAUDE.md自動リフレッシュ
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'automation', 'medium',
  'Phase 6: ハーネスエンジニアリング革命',
  '部署知識ローテーション — CLAUDE.md自動リフレッシュ',
  '各部署のCLAUDE.mdが時間経過で実態と乖離する問題に対し、部署ごとの知識ローテーション機構を導入。部署の活動実績に基づいてCLAUDE.mdの内容を定期的に見直し・更新する仕組み。',
  '部署CLAUDE.mdは作成時点の設計意図で書かれるが、実際の運用で得られた知見が反映されない。',
  '活動ログ分析→CLAUDE.md更新提案→承認→適用のサイクルを自動化。',
  'CLAUDE.mdは「生き物」であり、定期的なメンテナンスが必要。自動化により陳腐化を防止。',
  ARRAY['cb66f2e'],
  ARRAY['automation','department','knowledge-rotation','claude-md','maintenance'],
  'resolved'
);

-- #24 Narrator（ライフコンパニオン）構想の記録
INSERT INTO growth_events (event_date, event_type, category, severity, phase, title, what_happened, root_cause, countermeasure, result, related_commits, tags, status)
VALUES (
  '2026-04-05', 'milestone', 'architecture', 'medium',
  'Phase 6: ダッシュボードAI進化',
  'Narrator（ライフコンパニオン）構想 — AIが人生の語り手になる',
  '日記・夢・目標・感情データを横断的に分析し、ユーザーの人生を「物語」として紡ぐNarrator機能の設計と実装タスクをドキュメント化。Dreams & Goalsの統合、感情分析バックフィル、自己分析の多ソース化はこの構想の基盤。',
  NULL, NULL,
  '単なる「ツール」から「人生のパートナー」へ。データを蓄積するだけでなく、それを意味のあるナラティブに変換するビジョンが生まれた。',
  ARRAY['3663866'],
  ARRAY['architecture','narrator','life-companion','vision','diary','dreams'],
  'resolved'
);
