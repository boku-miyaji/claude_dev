import { PageHeader, Card } from '@/components/ui'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ========== Shared UI primitives ==========

function P({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 8 }}>{children}</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>{body}</div>
    </div>
  )
}

function Principle({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div className="card" style={{ padding: 14, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{body}</div>
    </div>
  )
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
      {steps.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'var(--accent)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{s}</span>
          {i < steps.length - 1 && <span style={{ color: 'var(--text3)' }}>→</span>}
        </span>
      ))}
    </div>
  )
}

function CycleFlow({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
      {steps.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{s}</span>
          <span style={{ color: 'var(--text3)' }}>{i < steps.length - 1 ? '→' : '↩'}</span>
        </span>
      ))}
    </div>
  )
}

function Tbl({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--green)' : 'var(--red)', marginRight: 6 }} />
}

// ========== Tab: Overview ==========

function TabOverview() {
  const [stats, setStats] = useState<{
    knowledgeCount: number; sessionCount: number; sessionsExtracted: number;
    memoryCount: number; growthCount: number; diaryCount: number;
  } | null>(null)

  useEffect(() => {
    async function load() {
      const [kbRes, sessRes, sessExtRes, growthRes, diaryRes] = await Promise.all([
        supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('prompt_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('prompt_sessions').select('id', { count: 'exact', head: true }).eq('knowledge_extracted', true),
        supabase.from('growth_events').select('id', { count: 'exact', head: true }),
        supabase.from('diary_entries').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        knowledgeCount: kbRes.count || 0,
        sessionCount: sessRes.count || 0,
        sessionsExtracted: sessExtRes.count || 0,
        memoryCount: 0,
        growthCount: growthRes.count || 0,
        diaryCount: diaryRes.count || 0,
      })
    }
    load()
  }, [])

  return (
    <>
      <Section title="なぜ回っているか — 3つの原理">
        <P>このシステムが「作って終わり」にならず改善され続ける理由。</P>
        <div className="g3" style={{ marginBottom: 16 }}>
          <Principle title="原理 1: 自動検出" body="手動操作、同じ修正の繰り返し、知識の散在を自動で検出する。問題が見えないと改善は始まらない。" color="var(--accent)" />
          <Principle title="原理 2: 知識の昇格" body="一時メモ → ナレッジ → ルール → スキル。同じ指示を2回しなくていい。" color="var(--green)" />
          <Principle title="原理 3: 仕組みの仕組み" body="機能を作るだけでなく「誰が・いつ・どう回すか」まで設計。ops部署がメタ運用。" color="var(--yellow)" />
        </div>
      </Section>

      <Section title="5つの自己改善ループ">
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="1. ナレッジ蓄積" body="修正指示を検出 → knowledge_base記録 → confidence上昇 → CLAUDE.md昇格" />
          <MiniCard title="2. セッション学習" body="prompt_sessionsでグルーピング → フィードバック含むセッションからナレッジ抽出" />
          <MiniCard title="3. 組織最適化" body="5軸評価 → 低スコア部署のCLAUDE.mdルール改善。組織が自動チューニング" />
          <MiniCard title="4. CEO分析" body="prompt_log → 行動パターン/時間帯/傾向分析 → 秘書が先回り提案" />
          <MiniCard title="5. 日記→自己理解" body="書く → 感情分析 → WBI可視化 → パターン発見 → もっと書きたくなる → データ増 → AI精度↑" />
        </div>
        <CycleFlow steps={['問題検出', '原因分析', '仕組みの修正', '検証', '運用定着']} />
      </Section>

      <Section title="システム健全性">
        {stats ? (
          <div className="g2">
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Data Health</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div><StatusDot ok={stats.knowledgeCount > 0} /> Knowledge Rules: {stats.knowledgeCount}</div>
                <div><StatusDot ok={stats.sessionCount > 0} /> Sessions Tracked: {stats.sessionCount}</div>
                <div><StatusDot ok={stats.growthCount > 0} /> Growth Events: {stats.growthCount}</div>
                <div><StatusDot ok={stats.diaryCount > 0} /> Diary Entries: {stats.diaryCount}</div>
              </div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Knowledge Pipeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div>memory/ → knowledge_base → CLAUDE.md</div>
                <div><StatusDot ok={stats.sessionsExtracted > 0} /> Knowledge Extraction: {stats.sessionsExtracted}/{stats.sessionCount} sessions</div>
              </div>
            </Card>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading...</div>
        )}
      </Section>

      <Section title="データ鮮度マップ — いつ・何が・なぜ更新されるか">
        <P>全データの更新タイミングと連鎖関係。ブラックボックス化を防ぐために全フローを可視化。</P>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--green)' }}>自動更新（人間の操作不要）</div>
        <Tbl headers={['データ', '更新タイミング', '仕組み', '連鎖先']} rows={[
          ['prompt_log', '毎回のユーザー入力', 'Hook (UserPromptSubmit)', 'CEO分析の材料、生活リズム分析'],
          ['設定/MCP/CLAUDE.md同期', 'セッション開始', 'Hook (SessionStart, async)', 'ダッシュボードSettings反映'],
          ['git pull (最新コード)', 'セッション開始', 'Hook (SessionStart, async)', '全ファイルが最新に'],
          ['git push', 'セッション終了', 'Hook (SessionStop)', '他サーバーに変更が伝播'],
          ['セッション状態保存', 'Context Compaction直前', 'Hook (PreCompact)', '.session-state.json に退避'],
          ['コンテキスト再注入', 'Context Compaction直後', 'Hook (PostCompact)', 'additionalContext で重要情報を再注入'],
          ['CLAUDE.md肥大化警告', 'CLAUDE.mdへの書き込み後', 'Hook (PostToolUse)', '200行超で自動警告。60行以下推奨'],
          ['Hook実行ログ', '全ツール実行後', 'Hook (PostToolUse)', '~/.claude/logs/hook-executions.jsonl に記録'],
          ['危険コマンド監査', 'Bash実行前', 'Hook (PreToolUse)', 'ブロック時に blocked-commands.jsonl に記録'],
          ['emotion_analysis', '日記投稿直後', 'useEmotionAnalysis (自動)', 'diary_entries.wbi更新 → Journal可視化 → AI Partner再生成'],
          ['AI Partnerコメント', '日記投稿後 + 時間帯変更 + リロード', 'useMorningBriefing (invalidate)', '表示のみ（DB保存なし）'],
          ['夢進捗検出', '日記投稿後', 'useDreamDetection (自動)', 'toast通知のみ'],
          ['天気', '1時間ごと(TTL)', 'useTodayWeather (localStorage)', 'Today画面表示'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--accent)' }}>ユーザー操作トリガー</div>
        <Tbl headers={['データ', '更新タイミング', 'トリガー', '連鎖先']} rows={[
          ['diary_entries', 'Today画面で「記録する」', 'ユーザー入力', '→ emotion_analysis → AI Partner → 夢検出（3つが自動連鎖）'],
          ['tasks (完了)', 'Today画面でチェックボックス', 'インラインCRUD', 'status=done + 取り消し線表示。再クリックで戻す'],
          ['tasks (追加)', 'Today画面の + ボタン → Enter', 'インラインCRUD', 'due_date=今日で即追加。期限ソート（超過→今日→明日→日付順）'],
          ['tasks (編集)', 'Today画面でタイトルクリック', 'インライン編集', 'タイトル・期限・優先度をその場で変更'],
          ['habits (完了)', 'Today画面でチェック', 'ユーザータップ', '→ 統合プログレスバーに即反映'],
          ['habits (追加)', 'Today画面の + ボタン → Enter', 'インラインCRUD', '即追加。Habitsページで詳細編集'],
          ['weekly_narratives', 'Weeklyページで「生成」ボタン', 'ユーザー操作', 'DB保存。過去の週は再生成可能'],
          ['self_analysis', 'Self Analysisで分析ボタン', 'ユーザー操作', 'DB保存。日記件数でアンロック'],
          ['news_items', 'Reportsで「収集」ボタン', 'ユーザー操作', 'activity_logにも記録'],
          ['goals / dreams', '各ページで追加・更新', 'ユーザー操作', 'goal完了 → dream statusの自動更新連鎖'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--green)' }}>自動メンテナンス（/company 起動時に検出→修復）</div>
        <P>freshness-policy.yaml で定義（14データソース）。stale検出→人間の操作なしでClaude Codeが自動修復。</P>
        <Tbl headers={['データ', '検出条件', '自動修復アクション']} rows={[
          ['harness_research', '最終調査7日超', '情報収集部(最新記事) ∥ 運営改善部(GAP分析) → 改善提案更新'],
          ['dept_knowledge_refresh', '最終更新14日超', 'ローテーションで2部署選定 → 情報収集(調査) ∥ ops(GAP分析) → 社長承認で更新'],
          ['growth_events', '最終記録7日超 + fix/refactor 3件以上', 'git log分析 → パターン検出 → Supabase INSERT'],
          ['knowledge昇格', 'confidence ≥ 3 の未昇格ルール', '社長に提示 → 承認後に rules/ 追記（自動昇格は禁止）'],
          ['CLAUDE.md サイズ', '200行超', '手順的記述をrules/に分離 → CLAUDE.md縮小（Hook でも警告）'],
          ['design-philosophy / HowItWorks', '14日未更新 + AI機能変更あり', 'git diff分析 → 該当セクション自動追記'],
          ['docs/knowledge/', '14日未更新', '新しいドキュメントがあれば追記'],
        ]} />
      </Section>

      <Section title="更新連鎖マップ（1つの操作が何を動かすか）">
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2.2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`日記を書く
  ├→ diary_entries INSERT
  ├→ emotion_analysis 自動生成（感情スコア+WBI）
  │    └→ diary_entries.wbi UPDATE → Journal 感情カレンダー更新
  ├→ AI Partner コメント再生成（invalidate → 10データソース再収集 → LLM生成）
  └→ 夢進捗検出（diary × dreams照合 → 一致あれば toast 通知）

Today画面でタスク操作
  ├→ チェックボックス → status=done + 取り消し線（再クリックで戻す）
  ├→ + ボタン → テキスト入力 → Enter → tasks INSERT（due_date=今日）
  └→ タイトルクリック → インライン編集（タイトル/期限/優先度）→ Save

Today画面で習慣操作
  ├→ チェックボックス → habit_logs INSERT/DELETE（トグル）
  ├→ + ボタン → テキスト入力 → Enter → habits INSERT
  └→ 統合プログレスバー即更新（タスク+習慣の合算）

セッション開始（並列実行）
  ├→ git pull（async — 最新コード取得）
  ├→ session-start-marker.sh（sync — タイムライン記録）
  ├→ supabase-status.sh（async — DB接続確認）
  └→ config-sync.sh（async — settings/MCP/CLAUDE.md → Supabase）

Context Compaction 発生時
  ├→ PreCompact: セッション状態を .session-state.json に退避
  └→ PostCompact: additionalContext で重要情報を再注入

/company 起動
  ├→ knowledge_base 読み込み（active ルール取得）
  ├→ 未処理コメント確認
  ├→ カレンダー取得（今日+明日）
  └→ データ鮮度チェック（14データソース, freshness-policy.yaml）
       └→ harness_research 7日超? → 情報収集部 ∥ 運営改善部 → 改善提案更新

/company 起動時の自動メンテナンス
  ├→ growth_events: git log分析 → パターン検出 → 自動INSERT
  ├→ knowledge昇格: confidence≥3 → 社長に提示 → 承認後にrules/追記（自動昇格禁止）
  ├→ CLAUDE.md: 200行超 → 手順をrules/に分離（PostToolUse Hookでも常時警告）
  └→ design-philosophy / HowItWorks: 14日超 + 変更あり → 自動追記

CLAUDE.mdを編集
  └→ PostToolUse Hook: claude-md-size-guard.sh
       └→ 200行超 → additionalContext で警告（60行以下推奨）

危険コマンド実行
  └→ PreToolUse Hook: bash-guard.sh
       ├→ rm -rf / / force push / reset --hard / DROP → ブロック (exit 2)
       └→ ブロック時 → blocked-commands.jsonl に監査ログ記録`}
        </div>
      </Section>
    </>
  )
}

// ========== Tab: Architecture ==========

function TabArchitecture() {
  return (
    <>
      <Section title="全体アーキテクチャ">
        <P>1人の社長が複数PJを横断管理する仮想持株会社構造。AIエージェント（Claude）が秘書として各社を運営。</P>
        <Flow steps={['/company', 'HD秘書がPJ判断', 'PJ会社のCLAUDE.md読込', 'HD共通部署で作業', '成果物をPJリポジトリに']} />
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="HD（.company/）" body="秘書室 / 人事部 / 共通部署（AI開発・システム開発・PM・資料制作・リサーチ・情報収集・セキュリティ・UX・ops）" />
          <MiniCard title="PJ会社（.company-*/）" body="PJ固有コンテキスト（クライアント情報・ドメイン知識）+ 秘書のみ。部署はHD共通を利用" />
        </div>
      </Section>

      <Section title="知識の階層 — SSOT設計">
        <Tbl headers={['知識の種類', '置き場所（SSOT）', '読み込みタイミング']} rows={[
          ['恒久ルール', 'CLAUDE.md / .claude/rules/', 'セッション開始時（常時）'],
          ['運用手順', 'スキル SKILL.md', '/コマンド実行時（必要時のみ）'],
          ['学習済みパターン', 'knowledge_base (Supabase)', '/company 起動時'],
          ['セッション横断の記憶', 'memory/ (auto-memory)', 'セッション開始時'],
          ['設計思想', '.company/design-philosophy.md', '設計判断時に参照・追記'],
          ['体系知識', 'docs/knowledge/', '学習・調査時に参照・追記'],
        ]} />
      </Section>

      <Section title="3層データ管理">
        <div className="g3" style={{ marginBottom: 12 }}>
          <MiniCard title="Layer 1: ファイル" body="CLAUDE.md / メモ / TODO。エージェントが即座に読み書き" />
          <MiniCard title="Layer 2: Git" body="マルチリポジトリ。claude_dev(HD) + 各PJリポジトリ" />
          <MiniCard title="Layer 3: Supabase" body="プロンプト / ナレッジ / タスク / 日記 / 感情分析。クラウド永続" />
        </div>
        <P>ローカルファイルが常にマスター。Supabaseは分析・同期・モバイルアクセス用。</P>
      </Section>

      <Section title="自動化 — Hook + スキル + スクリプト">
        <Tbl headers={['種類', '代表例', '特性']} rows={[
          ['Hook (27個)', 'prompt-log, bash-guard, claude-md-size-guard, pre/post-compact', '決定論的制御。コンテキスト外で実行。6イベント種別をカバー'],
          ['スキル', '/company, /diary, /deploy', '必要時に呼び出し。判断を伴う処理'],
          ['スクリプト', 'sync-skills.sh, sync-registry.sh', 'SSOT → 派生の一方向同期'],
        ]} />
      </Section>
    </>
  )
}

// ========== Tab: Design Philosophy ==========

function TabDesignPhilosophy() {
  return (
    <>
      <Section title="体験設計">
        <Principle title="Today = コマンドセンター" body="Todayページから一歩も出ずに日常の全操作が完結する設計。タスク完了/追加/編集、習慣チェック/追加、日記記録がすべてインライン。別ページへの遷移=離脱。" color="var(--accent)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="統合Actionsブロック" body="タスクと習慣を1つのブロックに統合。プログレスバーで合算達成度を可視化。「今日やるべきこと」がひと目でわかる。" />
          <MiniCard title="時間帯適応型UI" body="朝=全件フラット / 午後=未完了を上に+「あとX件」 / 夜=やり残し表示+明日の予定。同じ画面を24時間出さない。" />
          <MiniCard title="インラインCRUD" body="タスク: チェック→完了(取り消し線で残る、再クリックで戻す)。+ →即追加(期限=今日)。タイトルクリック→編集。習慣: + →即追加。" />
          <MiniCard title="期限ソート" body="超過(赤) → 今日(赤) → 明日(amber) → 日付順(gray) → 期限なし。同日内は優先度順。期限が最も重要なソート軸。" />
          <MiniCard title="ブランクページ問題" body="白紙のテキストエリアは書けない。時間帯+カレンダーから文脈プロンプトを動的生成。" />
          <MiniCard title="ナビゲーション整理" body="20タブ→8+More構成。毎日使うもの(Today/Journal/Tasks/Chat)だけトップ。月1回以下はMore(折りたたみ)に退避。" />
        </div>
      </Section>

      <Section title="AI設計">
        <Principle title="ディープパーソナライズ" body="10のデータソース（日記感情・WBI推移・生活リズム・カレンダー・CEO分析等）から「この人だからこそ」のコメント。汎用的な「頑張りましょう」は禁止。" color="var(--green)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="LLM指示の5教訓" body="①出力形式を厳密に ②禁止リスト明記 ③時間帯分岐はコードで ④文字数はプロンプト+max_tokens両方で ⑤reasoningモデルのtoken配分に注意" />
          <MiniCard title="API呼び出しパターン" body="ブラウザからOpenAI直叩き禁止。必ずEdge Function経由。共通ヘルパーedgeAi.tsを使う。自動処理はcompletion mode。" />
        </div>
      </Section>

      <Section title="データ設計">
        <Tbl headers={['データ', 'キャッシュ', '無効化トリガー']} rows={[
          ['天気', 'localStorage 1時間', 'TTL切れ'],
          ['AIコメント', 'Zustand in-memory', '日記投稿 / 時間帯変更 / リロード'],
          ['タスク/習慣', 'Zustand 5分', 'ミューテーション'],
        ]} />
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="タイムゾーン" body="全レイヤーでJST統一。Calendar API: timeZone指定、JS: toLocaleString、Supabase: at time zone。部分修正は新バグを生む。" />
          <MiniCard title="RLSポリシー" body="新テーブル作成時に必ずRLSも同時に。6回忘れて6回fixした教訓。" />
        </div>
      </Section>

      <Section title="アーキテクチャ判断">
        <Principle title="YAGNI原則の徹底" body="マルチテナント→撤回、Anthropic対応→削除、会社セレクター→削除、Polaris子会社→統合。「使うかもしれない」は作らない。" color="var(--red)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="1ファイル→分離パターン" body="最初は1ファイルSPA。8000行超で限界 → React+TS。最初から完璧な構造を作ろうとしない。" />
          <MiniCard title="エンハンス、代替ではない" body="AI出力をそのまま使わない。壁打ちの素材→腹落ちまで対話→自分の言葉で説明できる状態に。" />
        </div>
      </Section>

      <Section title="継続改善のメタ設計">
        <P>このシステム自体が改善され続けるための仕組み。</P>
        <Tbl headers={['ループ', '仕組み', 'データの場所']} rows={[
          ['日記ループ', '書く→分析→可視化→もっと書きたくなる→データ増→AI精度↑', 'diary_entries + emotion_analysis'],
          ['ナレッジ昇格', '修正指示→memory→2回目でKB→3回目で社長承認→rules/', 'memory/ → knowledge_base → 承認 → rules/（自動昇格禁止）'],
          ['Growth Chronicle', '失敗→記録→パターン→ルール化→再発防止', 'growth_events'],
          ['人事部サイクル', '部署作業→評価→CLAUDE.md改善→精度↑', '.company/hr/evaluations/'],
          ['設計思想蓄積', '判断→design-philosophy.md追記→次の判断の土台', '.company/design-philosophy.md'],
        ]} />
        <Principle title="知識の3層構造" body="Layer1: docs/knowledge/（体系的学習ノート）→ Layer2: knowledge_base（行動ルール）→ Layer3: CLAUDE.md（全セッション自動適用）。下に行くほど影響範囲が広く、昇格には実績が必要。" color="var(--accent)" />
      </Section>
    </>
  )
}

// ========== Tab: Operations ==========

function TabOperations() {
  return (
    <>
      <Section title="コマンド体系">
        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>常時自動（パイプライン）</div>
        <Tbl headers={['社長の指示', '判定', 'パイプライン']} rows={[
          ['「作って」「新機能」', 'A', 'リサーチ ∥ UX → AI開発 ∥ PM → 実装 → QA'],
          ['「直して」「バグ」', 'B', 'システム開発 → QA'],
          ['「資料作って」', 'C', 'リサーチ → 資料制作'],
          ['「調べて」', 'D', 'リサーチ → 統合報告'],
          ['「セキュリティ監査」', 'E', 'セキュリティ ∥ リサーチ → 修正 → QA'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>/company コマンド</div>
        <Tbl headers={['コマンド', '機能']} rows={[
          ['/company', 'HD秘書起動（ブリーフィング + タスク管理）'],
          ['/company {name}', 'PJ会社の秘書起動'],
          ['/company:diary', '日記の分析・壁打ち'],
          ['/company:auto-prep', 'MTG準備の自動化'],
          ['/company:weekly-digest', '週次CEOレポート'],
        ]} />
      </Section>

      <Section title="部署サイクル設計 — いきなり実行しない">
        <Principle title="全部署に「設計→チェック→実行→評価→学習」サイクルを定義" body="直線的フロー（→→→完了）ではなく、チェックポイントで品質を確認し、評価結果を次の設計にフィードバックするループ。ハーネスエンジニアリングでは Sub-agent のプロンプト品質 = 出力品質。サイクル定義のない部署は出力が不安定になる。" color="var(--accent)" />

        <P>各部署のサイクルは統一テンプレートではなく、部署の特性に最適化されている:</P>
        <Tbl headers={['部署', 'サイクル構造', '特徴的なチェックポイント', '仕様レベル']} rows={[
          ['AI開発', '仮説→設計→[設計レビュー]→実装→評価→[品質判定]→学習', '設計レビュー（成功基準が定量的か）+ 品質判定（合格/不合格/部分合格の3分岐）', 'HIGH'],
          ['システム開発', 'トリガー→実装→QA→[QA判定]→報告', 'API仕様確認ゲート + QA承認ゲート（2重）', 'HIGH'],
          ['PM', '計画→分解・割当→[確認]→追跡→報告→[振り返り]→改善', '週次振り返り（見積もりvs実績のギャップ分析）', 'HIGH'],
          ['資料制作', 'draft→writing→review→[CEO確認]→完了', 'CEO確認必須（「自分の言葉で説明できる」が基準）', 'HIGH'],
          ['リサーチ', 'planning→in-progress→[3段構成チェック]→completed', '公知情報+限界+壁打ち導線の3段構成が必須', 'HIGH'],
          ['UXデザイン', 'シナリオ→感情曲線→摩擦分析→状態遷移→[5原則チェック]→実装仕様', 'HCI法則(Fitts/Hick/Miller)+Nielsen 10項目で検証', 'VERY HIGH'],
          ['情報収集', '収集→スコアリング→[フィードバック反映]→次回収集', 'いいね/クリックの暗黙的FB + スコア減衰で過学習防止', 'VERY HIGH'],
          ['セキュリティ', '日次監視→週次スキャン→月次監査→[SLA追跡]', 'Critical 24h / High 7d / Medium 30d / Low 90d のSLA', 'VERY HIGH'],
          ['マーケ', '仮説→施策実行→計測→[判定]→学習→ピボット or 強化', '仮説検証ループ（成功→強化、失敗→ピボット、不明→計測改善）', 'MEDIUM-HIGH'],
          ['運営改善', 'ヘルスチェック→問題検出→修正→検証→定着', 'CLAUDE.md行数/スキル同期/マイグレーション/ナレッジ重複の4点チェック', 'MEDIUM-HIGH'],
        ]} />

        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="スキップルールの明示" body="全ステップ毎回必須ではない。AI開発部の例: 1行修正→実装+動作確認のみ、新機能→全ステップ必須、アーキテクチャ変更→全ステップ+社長レビュー。省略条件を事前定義することで「省略していい判断」と「省略してはいけない判断」を分離。" />
          <MiniCard title="学習ステップの義務化" body="全部署のサイクル末尾に「学習」がある。成功/失敗に関わらず知見を記録（成果物末尾の「学習メモ」or growth_events）。これがナレッジ昇格パイプラインの入口になり、繰り返しの失敗を構造的に防止する。" />
          <MiniCard title="部署知識ローテーション" body="各部署のCLAUDE.mdは作成時点で固定されがち。14日サイクルで2部署ずつ最新ベストプラクティスを調査→GAP分析→社長承認で更新。5ローテーション（約5週）で全10部署を一巡。情報収集部が調査、ops部がGAP分析。CLAUDE.md直接更新は禁止（社長承認必須）。" />
        </div>
      </Section>

      <Section title="部署連携">
        <P>パイプラインA（新機能開発）の流れ:</P>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`Step 1 [並列]: リサーチ ∥ UXデザイン
Step 2 [並列]: AI開発(設計) ∥ PM(チケット) ← checkpoint
Step 3 [直列]: システム開発(実装) → QA(テスト)
完了: 成果物登録 + commit + 報告`}
        </div>
        <P>ハンドオフ: 部署の成果物末尾にYAMLブロックで記述。秘書がパースして次の部署を自動起動。重複実行防止機能付き。（旧Markdown形式も後方互換で検出）</P>
      </Section>

      <Section title="ops部署 — 仕組みの仕組み">
        <Tbl headers={['検出トリガー', 'opsのアクション']} rows={[
          ['手動操作の発生', 'スクリプト or スキル化'],
          ['同じ修正が2回', 'ルール追加を提案'],
          ['CLAUDE.md肥大化', 'スキル or rules/ に分離'],
          ['知識の分散', 'SSOTを決めて統合'],
        ]} />
      </Section>

      <Section title="フォールバック">
        <Tbl headers={['障害', 'フォールバック']} rows={[
          ['Supabase障害', 'ローカルファイルで代替。マスターは常にファイル'],
          ['Git push不可', 'ローカルにコミット残る。次回conflict検出'],
          ['エージェント誤判断', 'permission-guard + checkpoint + git revert'],
        ]} />
      </Section>
    </>
  )
}

// ========== Tab: AI Features ==========

function AiFeatureCard({ name, trigger, input, model, pipeline, output, storage, hook }: {
  name: string; trigger: string; input: string; model: string; pipeline: string; output: string; storage: string; hook: string
}) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--accent)' }}>{name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '4px 12px', fontSize: 12, lineHeight: 1.6 }}>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>トリガー</span><span style={{ color: 'var(--text2)' }}>{trigger}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Input</span><span style={{ color: 'var(--text2)' }}>{input}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>モデル</span><span style={{ color: 'var(--text2)' }}>{model}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>パイプライン</span><span style={{ color: 'var(--text2)' }}>{pipeline}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Output</span><span style={{ color: 'var(--text2)' }}>{output}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>保存先</span><span style={{ color: 'var(--text2)' }}>{storage}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>コード</span><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{hook}</span>
      </div>
    </div>
  )
}

function TabAiFeatures() {
  return (
    <>
      <Section title="共通アーキテクチャ">
        <P>全AI機能は同じパイプラインを通る。ブラウザからOpenAI APIを直接叩かない。</P>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`ブラウザ (React hook)
  → aiCompletion() [src/lib/edgeAi.ts]
    → POST /functions/v1/ai-agent  mode=completion
      → Edge Function [supabase/functions/ai-agent/index.ts]
        → OpenAI API (gpt-5-nano, reasoning_effort=low)
          → JSON response
            → ブラウザで処理・表示・DB保存`}
        </div>
        <Tbl headers={['設定', '値', '理由']} rows={[
          ['モデル', 'gpt-5-nano', 'コスト最小。reasoning model なので分析系に強い'],
          ['reasoning_effort', 'low', 'minimal だと出力が空になるケースがあった'],
          ['max_completion_tokens', '8000', 'reasoning + output の合計。少ないとreasoning に消費されて出力空に'],
          ['temperature', '(デフォルト1)', 'gpt-5-nano は temperature カスタム非対応'],
        ]} />
      </Section>

      <Section title="AI機能一覧（7機能）">
        <AiFeatureCard
          name="1. 感情分析"
          trigger="日記を投稿したとき（自動）"
          input="日記本文テキスト"
          model="gpt-5-nano (completion mode)"
          pipeline="日記テキスト → system: Plutchik 8感情+Russell+PERMA+V の分析指示 → JSON応答 → パース → DB保存"
          output="Plutchik 8感情(0-100), Russell valence/arousal(-1~1), PERMA+V(0-10), WBI(0-10), summary(1文)"
          storage="emotion_analysis テーブル + diary_entries.wbi を更新"
          hook="useEmotionAnalysis.ts"
        />

        <AiFeatureCard
          name="2. AI Partner コメント（ディープパーソナライズ）"
          trigger="Today画面表示時 + 日記投稿後に自動再生成"
          input="直近日記(5件), 感情分析(10件), WBI推移, カレンダー(今日+明日), タスク(完了+未完了), CEOインサイト, 生活リズム(prompt_log), 連続記録, 夢リスト"
          model="gpt-5-nano (completion mode)"
          pipeline="10データソース並列取得 → コンテキスト組み立て → 時間帯別プロンプト(朝/昼/夜) → AI生成 → 表示"
          output="2-3文、100字以内のパーソナライズコメント"
          storage="Zustand in-memory（キャッシュキー: 日付_timeMode、日記投稿で無効化）"
          hook="useMorningBriefing.ts"
        />

        <AiFeatureCard
          name="3. 夢進捗検出"
          trigger="日記投稿後（自動、バックグラウンド）"
          input="日記テキスト + アクティブな夢リスト(dreams テーブル)"
          model="gpt-5-nano (completion mode, jsonMode)"
          pipeline="日記テキスト+夢リスト → system: 夢との照合指示 → JSON応答 → confidence medium以上をフィルタ → toast通知"
          output='[{dream_id, confidence: "high"|"medium", reason}]'
          storage="表示のみ（toast通知）。DBには保存しない"
          hook="useDreamDetection.ts"
        />

        <AiFeatureCard
          name="4. 週次ナラティブ"
          trigger="Weeklyページで「生成」ボタン押下"
          input="1週間分の日記, 感情分析, 完了タスク, ゴール進捗, 習慣達成率"
          model="gpt-5-nano (completion mode)"
          pipeline="週の全データ並列取得 → 統計算出(平均WBI, 優勢感情, 習慣達成率) → AI生成(200-300字ナラティブ) → DB保存"
          output="200-300字の振り返りナラティブ + stats(diary_count, task_count, avg_wbi, dominant_emotion)"
          storage="weekly_narratives テーブル"
          hook="useWeeklyNarrative.ts"
        />

        <AiFeatureCard
          name="5. 自己分析（6種類）"
          trigger="Self Analysisページで分析ボタン押下（日記件数でアンロック）"
          input="日記(30-80件), タスク実績, 感情分析データ, 夢リスト（分析タイプにより異なる）"
          model="gpt-5-nano (completion mode, jsonMode)"
          pipeline="分析タイプ別にデータ収集 → タイプ別プロンプト → JSON応答 → DB保存 → 可視化"
          output="MBTI推定, Big5スコア, 強み分析, ストレングスファインダーTop5, 感情トリガー, 価値観分析"
          storage="self_analysis テーブル(analysis_type, result JSON, summary, data_count)"
          hook="useSelfAnalysis.ts"
        />

        <AiFeatureCard
          name="6. AI チャット（エージェントループ）"
          trigger="AI Chatページでメッセージ送信"
          input="ユーザーメッセージ + 会話履歴(20件) + パーソナライゼーション(KB,日記,インサイト)"
          model="gpt-5-nano / gpt-5-mini / gpt-5（自動 or ユーザー選択）"
          pipeline="SSEストリーミング。while(tool_call)ループ: LLM応答→ツール実行→結果をLLMに返す→繰り返し"
          output="ストリーミングテキスト + ツール実行結果（タスク検索/作成, ナレッジ検索, Web検索 等）"
          storage="conversations + messages テーブル。cost_tracking でトークン消費記録"
          hook="legacy.ts (renderChat) → ai-agent Edge Function (agentLoop)"
        />

        <AiFeatureCard
          name="7. ニュース収集"
          trigger="Reportsページで収集ボタン / HOME画面の一言生成"
          input="トピックリスト(AI/LLM, Snowflake等) + ユーザー関心度(interest_score)"
          model="gpt-5-nano (completion mode)"
          pipeline="関心度高いトピック抽出 → AI にニュース生成依頼 → JSON配列パース → news_items テーブルに保存"
          output="[{title, summary, url, source, topic, date}] の配列"
          storage="news_items テーブル + activity_log"
          hook="legacy.ts (collectNews) / Reports.tsx"
        />
      </Section>

      <Section title="AIチャットのツール一覧">
        <P>エージェントループで使えるツール。LLMが自律的に選択・実行する。</P>
        <Tbl headers={['ツール', '機能', 'データソース']} rows={[
          ['tasks_search', 'タスク検索（status, company, keyword）', 'tasks テーブル'],
          ['tasks_create', 'タスク新規作成', 'tasks テーブル'],
          ['artifacts_read', '成果物の内容取得', 'artifacts テーブル'],
          ['artifacts_list', '成果物一覧', 'artifacts テーブル'],
          ['knowledge_search', 'ナレッジ検索（カテゴリ, scope）', 'knowledge_base テーブル'],
          ['company_info', 'PJ会社情報・部署構成', 'companies + departments テーブル'],
          ['prompt_history', '直近のプロンプト履歴検索', 'prompt_log テーブル'],
          ['insights_read', 'CEOインサイト（行動パターン等）', 'ceo_insights テーブル'],
          ['activity_search', 'アクティビティログ検索', 'activity_log テーブル'],
          ['intelligence_read', '最新ニュース/レポート', 'news_items テーブル'],
          ['web_search', 'Web検索（外部API）', 'Brave Search API'],
        ]} />
        <P>安全設計: web_search 使用後は write系ツール(tasks_create)をブロック。間接プロンプトインジェクション対策。</P>
      </Section>

      <Section title="ナレッジ体系 — データ・ナレッジ・暗黙知">
        <P>rikyuプロジェクトのナレッジ分類モデルを宮路HDに適用。全ての知識を「形式化度」と「機能（How/What）」の2軸で整理。</P>

        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)', marginBottom: 16 }}>
{`┌─────────────────────────────────────────────────────────────────┐
│                      スキル（How）                              │
│           判断・進め方の「型」。プロンプト/ルールに組み込む        │
│                                                                 │
│   認識           評価           判断           実行              │
│   どう見るか     どう測るか     どうするか     どうやるか          │
│                                                                 │
│   時間帯適応UI    感情分析       ナレッジ昇格    パイプライン      │
│   行動文脈推定    Plutchik/WBI  判断ルール      自動実行          │
│                                                                 │
├──── 参照 → ──────────────────────────────────────────────────────┤
│                                                                 │
│                   ナレッジベース（What）                          │
│            蓄積・検索する知識資産。使うほど賢くなる                 │
│                                                                 │
│   マスタ ─── 抽象化された参照知識（design-philosophy, rules/）   │
│       ↑ パターン抽出・昇格                                       │
│   事例 ──── 個別経験の蓄積（growth_events, diary+emotion）       │
│       ↑ 構造化・蓄積                                             │
│   コンテキスト ── 現在の事実（tasks, calendar, prompt_log）      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘`}
        </div>

        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>形式化度の3段階</div>
        <Tbl headers={['レベル', '名称', '状態', '宮路HDでの例', '蓄積場所']} rows={[
          ['C1 形式知', 'コードとして計算可能', 'ルール化・自動実行される', 'CLAUDE.md, rules/, Hooks, Edge Function', 'Git + 全セッション自動適用'],
          ['C2 言語知', '言語化済みだが未構造化', '記録されているが手動適用', 'knowledge_base, memory/, design-philosophy.md', 'Supabase + ファイル'],
          ['C3 暗黙知', '言語化困難、経験的', '社長の頭の中にしかない', '下記 TK-001〜008 参照', '日記・行動ログから間接抽出'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>暗黙知（TK）の一覧 — 形式化の状態</div>
        <P>社長の頭の中にある知識のうち、システムがまだ完全には捕捉できていないもの。日記・行動ログから間接的に抽出を試みている。</P>
        <Tbl headers={['ID', '暗黙知', '現在の捕捉方法', '形式化状態']} rows={[
          ['TK-001', '「今日は調子がいい/悪い」の身体感覚', 'diary + emotion_analysis → WBI推移', '部分捕捉。気分ログ(Level 0)で改善予定'],
          ['TK-002', '「このPJは今が勝負時」の事業判断', 'prompt_log の頻度・集中度から推定', '間接推定。CEOインサイトで検出'],
          ['TK-003', '「この人との関係性」の対人感覚', 'diary の人名・感情パターンから抽出', '間接推定。emotion_triggers分析'],
          ['TK-004', '「朝型/夜型」「集中できる時間帯」', 'prompt_log timestamps → 生活リズム分析', '定量化済み。AI Partner コメントに反映'],
          ['TK-005', '「この技術は将来有望」の技術直感', 'diary + prompt_log の技術キーワード', '未捕捉。トピック分析で改善可能'],
          ['TK-006', '「このやり方は自分に合う」の作業スタイル', 'knowledge_base feedback カテゴリ', '部分捕捉。2回同じフィードバック→ルール化'],
          ['TK-007', '設計判断の美意識・好み', 'design-philosophy.md への蓄積', '言語知(C2)まで昇格済み。形式知化は困難'],
          ['TK-008', '「いつかやりたい」の漠然とした願望', 'dreams テーブル + diary からの夢検出', '部分捕捉。書き出す→検出→意識化のループ'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>ナレッジの成長パス</div>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`暗黙知(TK)                    言語知(C2)                     形式知(C1)
社長の頭の中            →     記録・言語化              →     コード・ルール化

日記を書く              →  diary_entries              →  emotion_analysis (自動)
「調子悪い」と感じる     →  WBI 4.2 と数値化           →  AI Partner が体調に言及

修正指示を出す          →  memory/ に feedback記録    →  knowledge_base (confidence↑)
「pytest使って」         →  KB: "テストはpytest"        →  CLAUDE.md に昇格 (自動適用)

失敗する               →  growth_events に記録       →  design-philosophy.md に教訓
「RLS忘れた」           →  パターン検出               →  rules/ にチェックリスト化

夢を思いつく            →  dreams テーブル             →  goal分解 → weekly task化
「本を出版したい」       →  夢進捗検出が日記を照合      →  「この経験が夢に近づいている」`}
        </div>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>データ・ナレッジ・暗黙知の定義</div>
        <Tbl headers={['区分', '定義', '特徴', '宮路HDでの例']} rows={[
          ['データ', '事実の記録。解釈を含まない生のログ', '量が多い、自動蓄積、そのままでは意味がない', 'prompt_log, habit_logs, activity_log, calendar events'],
          ['ナレッジ', 'データから抽出された意味のある知見。再利用可能', '構造化されている、文脈依存、陳腐化する', 'knowledge_base, ceo_insights, emotion_analysis, design-philosophy.md'],
          ['暗黙知', '言語化困難な経験的知識。身体感覚・直感・美意識', '個人に属する、伝達困難、最も価値が高い', '事業判断の勘、対人感覚、作業スタイルの好み、設計の美意識'],
        ]} />
        <P>重要: 暗黙知は「別の層」ではなく、同じナレッジの未形式化部分。日記を書くことで暗黙知が言語知に、感情分析で形式知に、少しずつ形式化が進む。</P>
      </Section>

      <Section title="データ構造（テーブル一覧）">
        <Tbl headers={['テーブル', 'カラム（主要）', '知識区分']} rows={[
          ['diary_entries', 'body, entry_type, entry_date, wbi', 'データ → ナレッジ（分析後）'],
          ['emotion_analysis', 'plutchik 8感情, russell, perma_v, wbi_score', 'ナレッジ（データから自動生成）'],
          ['self_analysis', 'analysis_type, result(JSON), summary', 'ナレッジ（蓄積データから生成）'],
          ['weekly_narratives', 'narrative, stats(JSON)', 'ナレッジ（週次集約）'],
          ['knowledge_base', 'category, rule, reason, confidence', 'ナレッジ → 形式知（昇格時）'],
          ['ceo_insights', 'category, insight, evidence', 'ナレッジ（暗黙知の間接抽出）'],
          ['growth_events', 'what_happened, root_cause, countermeasure', 'ナレッジ（事例パターン）'],
          ['prompt_log', 'prompt, context, tags, created_at', 'データ（生ログ）'],
          ['tasks', 'title, status, priority, completed_at', 'データ（行動記録）'],
          ['dreams', 'title, category, status, priority', 'ナレッジ（暗黙知の言語化）'],
          ['goals', 'title, level, progress, dream_id', 'ナレッジ（夢の形式化）'],
          ['conversations / messages', 'role, content, tool_calls', 'データ（対話ログ）'],
          ['cost_tracking', 'model, tokens, total_cost', 'データ（運用メトリクス）'],
        ]} />
      </Section>
    </>
  )
}

// ========== Tab: Harness Engineering ==========

function TabHarness() {
  return (
    <>
      <Section title="ハーネスエンジニアリングとは何か">
        <P>AIの出力品質は「プロンプトの書き方」ではなく「AIを取り巻く環境（=ハーネス）の設計」で決まる。Claude Code は公式に "agentic harness" と位置づけられている。</P>

        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>3つの進化段階</div>
        <P>AI協業の技術は入れ子構造で進化してきた。外側の層が内側を包含する。</P>
        <Tbl headers={['段階', '時期', '問い', '操作対象', '品質への影響']} rows={[
          ['Prompt Engineering', '2022-2023', '「どう聞けばいい？」', 'プロンプト文字列', '品質 +3% 未満（Stanford HAI, 2025）'],
          ['Context Engineering', '2023-2024', '「AIは何を知る必要がある？」', 'RAG, Few-shot, システムプロンプト', '品質 +10-15%'],
          ['Harness Engineering', '2025-現在', '「どんな環境を構築すべき？」', 'ツール, Hook, 権限, サブエージェント', '品質 +28-47%（Stanford HAI, 2025）'],
        ]} />
        <Principle
          title="Stanford HAI 調査結果（2025年後半）"
          body="12の本番ユースケースでの比較: プロンプト改善は出力品質を3%未満しか向上させなかったのに対し、ハーネスレベルの変更（検索追加、ツールアクセス拡張、構造化バリデーション導入）は 28-47% の品質向上をもたらした。品質のボトルネックはモデルの能力ではなく、モデルが動作する環境にある。"
          color="var(--accent)"
        />
        <P>つまり「プロンプトをどう書くか」に時間を費やすより、「どんなツールを渡すか」「どんな制約を設けるか」「どんなフィードバックループを作るか」に注力すべき。OpenAI が自社の API ではなく Claude Code にプラグインを出荷した事実も、堀（moat）がモデルではなくハーネスにあることを示唆する。</P>
      </Section>

      <Section title="「ハーネス」の3つの比喩">
        <div className="g3" style={{ marginBottom: 12 }}>
          <Principle title="馬具 (Horse Harness)" body="AIの能力を正確に制御された方向へ導く。暴走を防ぎ、力を目的に集中させる。→ CLAUDE.md, Permission" color="var(--accent)" />
          <Principle title="安全帯 (Safety Harness)" body="失敗を封じ込め、回復可能にする。Permission deny, sandbox, git revert。→ Hooks (PreToolUse), Permissions" color="var(--green)" />
          <Principle title="テストハーネス (Test Harness)" body="デバッグ、可観測性、ツールセットを備えた実行環境。→ MCP, Tool Search, Sub-agents" color="var(--amber)" />
        </div>
      </Section>

      <Section title="ハーネスの6構成要素">
        <P>Claude Code のハーネスは6つの構成要素から成る。それぞれの性質の違いが重要。</P>
        <Tbl headers={['構成要素', '役割', '性質', '遵守保証', '宮路HDでの実装']} rows={[
          ['CLAUDE.md', '方針・規約の宣言', '助言的（読んでも無視されうる）', '低〜中', '.claude/CLAUDE.md + .company/CLAUDE.md + 部署CLAUDE.md'],
          ['Hooks', 'ライフサイクル制御', '決定論的（確実に実行される）', '高', '.claude/hooks/ に24スクリプト'],
          ['Permissions', '安全制御', '強制的（bypass不可）', '最高', 'settings.json の allow/deny リスト'],
          ['MCP', 'ツール拡張', '外部サービス接続', '—', 'Google Calendar, Supabase, Serena, Context7'],
          ['Sub-agents', 'コンテキスト分離', '独立メモリ・最小権限', '—', 'Agent tool で10部署を委譲'],
          ['Skills', 'ナレッジ注入', 'オンデマンドロード', '—', '/company, /diary 等のスキル'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>CLAUDE.md vs Hooks — 「助言」vs「強制」</div>
        <P>CLAUDE.md に「QAを通さずリリースしない」と書いても、モデルが無視する可能性がある。一方、PreToolUse Hook で <code>git push</code> 前にテスト通過を確認すれば、物理的にスキップできない。重要なルールほど Hooks に移すべき。</P>
        <Tbl headers={['ルール', '現在の配置', '理想の配置', '理由']} rows={[
          ['コミット規約', 'CLAUDE.md', 'CLAUDE.md（OK）', '助言で十分。フォーマット違反は致命的でない'],
          ['ハンドオフ検出', 'CLAUDE.md（正規表現）', 'PostToolUse Hook', '見逃すと部署間連携が壊れる'],
          ['QA未通過防止', 'CLAUDE.md', 'PreToolUse Hook (Bash)', 'テスト未通過のpushは本番障害に直結'],
          ['成果物登録', 'CLAUDE.md（手動）', 'PostToolUse Hook (Write)', 'リアルタイム登録で漏れ防止'],
          ['CLAUDE.md肥大化', 'ops部CLAUDE.md', 'PostToolUse Hook (Edit)', '200行超で自動警告'],
        ]} />
      </Section>

      <Section title="CLAUDE.md の設計原則">
        <Principle title="60行以下が理想" body="全てを1ファイルに詰め込むと指示が埋もれ、遵守率が下がる。Claudeのコンテキスト消費も増加。手順的な内容は rules/ やスキルに分離する。" color="var(--red)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="書くべきもの" body="Claudeが推測できないBashコマンド、デフォルトと異なるスタイル、テスト実行指示、PJ固有のアーキテクチャ決定、IMPORTANT/YOU MUST で強調" />
          <MiniCard title="書くべきでないもの" body="コードを読めばわかること、標準的な言語慣習、詳細なAPIドキュメント、頻繁に変わる情報。@path/to/file でインポート可能" />
        </div>
        <P>配置階層: <code>~/.claude/CLAUDE.md</code>（全PJ共通）→ <code>./CLAUDE.md</code>（プロジェクト、Git共有可）→ <code>./CLAUDE.local.md</code>（個人）→ 子ディレクトリ（オンデマンド読込）</P>
      </Section>

      <Section title="Hooks 詳細 — 決定論的制御">
        <P>Hooks はコンテキストウィンドウの外で実行される。つまりコンテキストを消費せず、確実に動作する。</P>

        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>利用可能なフックイベント</div>
        <Tbl headers={['イベント', 'タイミング', '用途', '宮路HDでの活用']} rows={[
          ['SessionStart', 'セッション開始 / compact後', 'コンテキスト再注入、環境セットアップ', 'auto-pull, config-sync, supabase-status'],
          ['SessionStop', 'セッション終了', 'クリーンアップ、レポート', 'auto-push, session-summary'],
          ['UserPromptSubmit', 'ユーザー入力時', 'additionalContext注入、ログ記録', 'prompt-log（全入力をSupabaseに記録）'],
          ['PreToolUse', 'ツール実行前', 'ブロック / 入力書き換え / ポリシーガード', 'bash-guard（危険コマンドのブロック）'],
          ['PostToolUse', 'ツール実行後', 'バリデーション、クリーンアップ', 'post-edit-check, artifact-auto-sync, tool-collector'],
          ['Stop', 'エージェント応答完了', 'タスク完了確認、自動テスト', '（未活用）'],
          ['PreCompact', 'コンテキスト圧縮前', '重要情報の保存', '（未活用）'],
          ['PostCompact', '圧縮後', '重要コンテキストの再注入', '（未活用）'],
          ['PermissionRequest', '許可ダイアログ表示時', '自動承認 / 条件付き承認', '（未活用）'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>4つのフックタイプ</div>
        <Tbl headers={['タイプ', '仕組み', '用途']} rows={[
          ['command', 'シェルコマンド実行。exit code + stdout で制御', 'ファイル操作、Git操作、外部API呼び出し'],
          ['http', 'HTTP POST 送信。レスポンスで制御', 'Webhook、外部サービス連携'],
          ['prompt', '単発LLM評価。テキスト返却', '出力の品質チェック（軽量）'],
          ['agent', 'マルチターンサブエージェント検証', '複雑な検証ロジック（重い）'],
        ]} />

        <P><strong>重要</strong>: PreToolUse Hook は <code>bypassPermissions</code> モードでも deny を強制可能。つまり、どんな権限設定でもHookによるブロックは覆せない。最も強い制御メカニズム。</P>
        <P>v2.0.10以降、PreToolUse はツール入力の書き換えが可能（ブロック+リトライではなく、入力を修正して続行）。</P>
      </Section>

      <Section title="Sub-agents — コンテキスト分離の設計">
        <P>Sub-agent は「異なるプロンプト」ではなく「異なる作業メモリ」。親の会話を参照できず、プロンプト文字列だけで動作する。</P>
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="設計原則" body="1段落で説明可能 / 「完了」の定義が明確 / 出力フォーマットが記述可能 / 冗長な出力がメインコンテキストを圧迫しない（要約のみ返却）" />
          <MiniCard title="最小権限の原則" body="各エージェントに必要なツールだけ提供。リサーチには読取系のみ、実装には書込系も。モデル選択: リサーチ=opus（高精度）、定型=haiku（高速・安価）" />
        </div>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>宮路HD部署 = Sub-agent としての設計</div>
        <P>各部署は Agent tool で起動される Sub-agent。この視点で見ると、部署設計の良し悪しは Sub-agent のプロンプト品質に直結する。</P>
        <Tbl headers={['部署', '仕様レベル', '完了条件', '課題']} rows={[
          ['UXデザイン部', '最高（5原則+心理学）', '明確', '良好。他部署の模範'],
          ['セキュリティ部', '最高（8ルール+SLA）', '明確', 'SLA追跡の自動化なし'],
          ['AI開発部', '中（柔軟フロー）', 'やや曖昧', 'QAバイパス条件が不明確'],
          ['システム開発部', '中（QAゲートあり）', '明確', 'コードレビュープロトコル未記載'],
          ['リサーチ部', '高（3段構成+URL必須）', '明確', 'フィードバックループなし'],
          ['PM部', '低（基本ワークフロー）', '曖昧', 'ハンドオフ検出が手動パース'],
          ['資料制作部', '中（10原則）', '曖昧', '品質ルーブリック不在'],
          ['情報収集部', '高（スコアリング）', '明確', 'キーワード抽出スクリプト未実装'],
          ['マーケティング部', '低（3柱）', '曖昧', '分類ゲートなし'],
          ['運営改善部', '高（メタ観察）', '明確', '閾値未定義'],
        ]} />
      </Section>

      <Section title="Agentic Loop — Claude Code の動作原理">
        <P>Claude Code は3フェーズのループを繰り返す。各ターンでAPIにメッセージを送り、ツール呼び出しを実行し、結果を次のターンに渡す。</P>
        <CycleFlow steps={['Context Gather', 'Take Action (tool_use)', 'Verify Results']} />
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="Context Loading" body="モデル呼び出し前にシステムプロンプトを組み立て: 日付、Git状態、CLAUDE.md階層、ツールリスト。これがハーネスの「コンテキスト層」" />
          <MiniCard title="Tool Dispatch" body="tool_useブロックをハンドラに振り分け。PreToolUse Hook → 実行 → PostToolUse Hook。5カテゴリ: File / Search / Execution / Web / Code Intelligence" />
        </div>
        <P>セキュリティ: Bash実行に対して23のチェック（ゼロ幅文字インジェクション検出、パストラバーサルブロック等）が内蔵されている。</P>
      </Section>

      <Section title="長時間エージェントのハーネス（Anthropic公式パターン）">
        <P>Anthropic Engineering が提唱する、セッションを跨ぐマルチターンエージェントの設計パターン。宮路HDの /company + session-summary + Supabase に相当。</P>
        <Tbl headers={['構成要素', '役割', '宮路HDの対応物']} rows={[
          ['Initializer Agent', '環境セットアップ、進捗ファイル作成', '/company 起動時のブリーフィング + freshness-check'],
          ['Progress File', 'セッション間の状態引き継ぎ（構造化JSON）', 'session-summary.sh + Supabase 各テーブル'],
          ['Feature List', '離散的要件の追跡・ステータス管理', 'tasks テーブル + TodoWrite'],
          ['Coding Agent', '進捗ファイル+Git履歴を読み込み1機能ずつ作業', '部署Agent（Sub-agent）'],
        ]} />
        <Principle title="Context Compaction 対策" body="長時間セッションでは Compaction（コンテキスト圧縮）が発生し、情報が失われる。重要な決定は即座にファイルに永続化すべき。PostCompact Hook でコンテキスト再注入も可能だが、現在は未活用。" color="var(--amber)" />
      </Section>

      <Section title="宮路HDシステムへの適用状況">
        <P>現在のシステムをハーネスエンジニアリングの観点から評価すると、「先進的だが未完成」。約70%のカバレッジ。</P>

        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>実装済み（強み）</div>
        <Tbl headers={['領域', '実装内容']} rows={[
          ['Hook活用（24スクリプト）', 'prompt-log, config-sync, freshness-check, auto-pull/push, bash-guard, tool-collector 等'],
          ['Freshness Policy', '14データソースの鮮度管理。stale検出→自動修復'],
          ['部署CLAUDE.md分離', '10部署 × 独立仕様書。Sub-agent に近い設計'],
          ['ナレッジ昇格パイプライン', 'memory → knowledge_base → CLAUDE.md。confidence による自動昇格'],
          ['3層データ管理', 'ファイル（即時）→ Git（バージョン管理）→ Supabase（永続・分析）'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>未実装（改善余地）</div>
        <Tbl headers={['領域', '現状', '改善案']} rows={[
          ['重要ルールのHooks化', 'CLAUDE.mdに記載のみ', 'ハンドオフ検出・QA強制・肥大化防止をHookに'],
          ['Sub-agentの最小権限', '全部署が全ツールアクセス可能', '部署ごとにツール・モデルを制限'],
          ['Compaction対策', 'session-summaryのみ', 'PostCompact Hook で重要コンテキスト再注入'],
          ['ハンドオフの構造化', '正規表現でテキスト検索', 'YAMLベースの構造化フォーマット'],
          ['知識昇格のゲート', 'confidence≥3で自動昇格', 'ops部レビュー→承認→昇格'],
          ['Stop Hook活用', '未使用', 'タスク完了時の自動検証・品質チェック'],
        ]} />
      </Section>

      <Section title="Sources">
        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 2 }}>
          <div><a href="https://code.claude.com/docs/en/how-claude-code-works" target="_blank" rel="noopener noreferrer">How Claude Code works (公式)</a></div>
          <div><a href="https://code.claude.com/docs/en/best-practices" target="_blank" rel="noopener noreferrer">Best Practices for Claude Code (公式)</a></div>
          <div><a href="https://code.claude.com/docs/en/hooks-guide" target="_blank" rel="noopener noreferrer">Automate workflows with hooks (公式)</a></div>
          <div><a href="https://code.claude.com/docs/en/sub-agents" target="_blank" rel="noopener noreferrer">Create custom subagents (公式)</a></div>
          <div><a href="https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents" target="_blank" rel="noopener noreferrer">Effective harnesses for long-running agents (Anthropic Engineering)</a></div>
          <div><a href="https://dev.to/wonderlab/from-prompt-engineer-to-harness-engineer-three-evolutions-in-ai-collaboration-5bgp" target="_blank" rel="noopener noreferrer">From Prompt Engineer to Harness Engineer (DEV)</a></div>
          <div><a href="https://wavespeed.ai/blog/posts/claude-code-agent-harness-architecture/" target="_blank" rel="noopener noreferrer">Claude Code Agent Harness Architecture (WaveSpeedAI)</a></div>
          <div><a href="https://www.louisbouchard.ai/harness-engineering/" target="_blank" rel="noopener noreferrer">Harness Engineering: The Missing Layer (Louis Bouchard)</a></div>
          <div>Stanford HAI Survey on LLM Deployment Patterns, 2025 H2 (12 production use cases)</div>
        </div>
      </Section>
    </>
  )
}

// ========== Tab: Improvement Proposals ==========

interface Proposal {
  id: string
  priority: 'P0' | 'P1' | 'P2'
  title: string
  problem: string
  solution: string
  harnessPart: string
  effort: string
  impact: string
  status: 'proposed' | 'in_progress' | 'done'
}

const PROPOSALS: Proposal[] = [
  {
    id: 'IMP-001',
    priority: 'P0',
    title: 'CLAUDE.md の60行以下への剪定',
    problem: 'HD CLAUDE.md 208行（200行閾値超え済み）。公式推奨は60行以下。部署CLAUDE.mdは計1,004行（UXデザイン237行が最大、AI開発30行が最小）。指示が埋もれ遵守率が低下。freshness-policyのclaude_md_sizeチェックが blocking: false で警告止まり。',
    solution: '即時: Hook責務分離表(15行)をrules/hook-responsibilities.mdに移動、MCPプロファイル管理(4行)をrules/に移動。部署は完了条件+入出力仕様に圧縮。claude_md_sizeのblocking: trueに変更し200行超で強制分離。',
    harnessPart: 'CLAUDE.md',
    effort: '2時間',
    impact: '指示遵守率の向上、コンテキスト消費削減。Stanford HAI によれば構造改善は品質+28-47%。',
    status: 'done',
  },
  {
    id: 'IMP-002',
    priority: 'P0',
    title: 'ハンドオフ検出の構造化（正規表現→YAML）',
    problem: '部署間ハンドオフが正規表現でテキストマッチ。フォーマットのずれで見逃す。ネストしたハンドオフに対応不可。',
    solution: '成果物末尾に構造化YAMLブロックを書く形式に統一。PostToolUse(Write) Hook でYAMLパース→次部署を自動起動。handoff_id で重複防止。',
    harnessPart: 'Hooks (PostToolUse)',
    effort: '4時間',
    impact: 'ハンドオフ漏れゼロ化。部署間連携の信頼性が根本的に改善。',
    status: 'done',
  },
  {
    id: 'IMP-003',
    priority: 'P0',
    title: '重要ルールのHooks化（助言→強制）',
    problem: '「QA未通過でリリースしない」「成果物は登録する」等がCLAUDE.md記載のみ。モデルが無視するリスク。',
    solution: 'PreToolUse(Bash) で git push 前にテスト通過を確認。PostToolUse(Write) で成果物を自動登録。PostToolUse(Edit) でCLAUDE.md行数チェック。',
    harnessPart: 'Hooks (PreToolUse/PostToolUse)',
    effort: '3時間',
    impact: '品質ゲートの確実な実行。「助言が無視される」問題の根本解決。',
    status: 'done',
  },
  {
    id: 'IMP-004',
    priority: 'P1',
    title: 'Context Compaction 対策（PostCompact Hook）',
    problem: '長時間セッションでContext Compactionが発生し、重要な決定事項が失われる。現在は対策なし。',
    solution: 'PreCompact Hook で重要コンテキスト（現在のタスク、決定事項、パイプライン状態）をファイルに保存。PostCompact Hook で再注入。進捗ファイルを構造化JSONで管理。',
    harnessPart: 'Hooks (PreCompact/PostCompact)',
    effort: '3時間',
    impact: '長時間セッション（1時間超）での情報損失防止。Anthropic公式パターンの適用。',
    status: 'done',
  },
  {
    id: 'IMP-005',
    priority: 'P1',
    title: 'Sub-agent への最小権限適用',
    problem: '全部署（Sub-agent）が全ツールにアクセス可能。リサーチ部が Write を使えたり、資料制作部が Bash を叩ける。',
    solution: 'Agent tool 起動時に部署ごとのツール制限を設定。リサーチ = Read/Web系のみ。資料制作 = Read/Write のみ。セキュリティ部 = 全ツール。モデルも使い分け（リサーチ=opus, 定型=haiku）。',
    harnessPart: 'Sub-agents',
    effort: '2時間',
    impact: '安全性向上+コスト最適化。haiku活用で月額30-50%削減の可能性。',
    status: 'done',
  },
  {
    id: 'IMP-006',
    priority: 'P1',
    title: 'ナレッジ昇格にレビューゲート追加',
    problem: 'confidence≥3で自動昇格。誤ったルールが CLAUDE.md に入るリスク。一度昇格すると降格されない。',
    solution: '昇格候補をops部が検証→社長承認→昇格のフロー。降格条件を追加（60日間未使用 or 例外3回超で自動降格提案）。knowledge_base に last_validation, promotion_count カラム追加。',
    harnessPart: 'CLAUDE.md + Hooks',
    effort: '4時間',
    impact: 'ルールの品質担保。「間違ったルールが永久に適用される」リスク排除。',
    status: 'done',
  },
  {
    id: 'IMP-007',
    priority: 'P1',
    title: 'Stop Hook でタスク完了検証',
    problem: 'エージェントが「完了」と言っても、テストが通っていない・ファイルが保存されていない等のケースがある。',
    solution: 'Stop Hook（agent タイプ）で完了条件を自動検証。コード変更ならテスト実行確認、ドキュメントなら必須セクション確認、成果物ならartifacts登録確認。',
    harnessPart: 'Hooks (Stop)',
    effort: '3時間',
    impact: '「完了したのに実は未完了」問題の解消。やり直しコスト削減。',
    status: 'done',
  },
  {
    id: 'IMP-008',
    priority: 'P2',
    title: 'Hook 実行の可観測性ダッシュボード',
    problem: 'Hookが || exit 0 で静かに失敗する。prompt-log が落ちてもログが欠落するだけで気づけない。',
    solution: 'hook_execution テーブルに全実行ログ（timestamp, hook名, status, duration, error）を記録。ダッシュボードに「Hook Health」ウィジェット追加。失敗率5%超でアラート。',
    harnessPart: 'Hooks + Dashboard',
    effort: '5時間',
    impact: 'サイレント障害の検出。システムの信頼性向上。',
    status: 'done',
  },
  {
    id: 'IMP-009',
    priority: 'P2',
    title: '部署仕様レベルの均一化',
    problem: 'UXデザイン部・セキュリティ部は仕様が詳細（5原則+心理学/8ルール+SLA）だが、PM部・マーケ部は基本ワークフローのみ。Sub-agentのプロンプト品質がバラバラ。',
    solution: '全部署に統一テンプレート適用: ① 役割（1文）② 完了条件（チェックリスト）③ 入力/出力仕様 ④ 品質基準 ⑤ エスカレーション条件。仕様レベル低い部署から順に改善。',
    harnessPart: 'Sub-agents (CLAUDE.md)',
    effort: '6時間',
    impact: '部署アウトプットの品質安定化。「PMの出力が曖昧」等の問題解消。',
    status: 'done',
  },
  {
    id: 'IMP-010',
    priority: 'P2',
    title: 'ハーネス設計の継続的最新化（自動調査）',
    problem: 'Claude Code は頻繁にアップデートされる。新しいHook、新しいSub-agentパターン等を見逃す。',
    solution: 'freshness-policy.yaml に harness_research を追加（max_age_days: 7）。/company 起動時に情報収集部が最新記事を調査→ops部がギャップ分析→改善提案を自動更新。',
    harnessPart: 'Freshness Policy + Intelligence',
    effort: '2時間',
    impact: 'システムが常に最新のベストプラクティスに追従。「知らなくて使えなかった」を防止。',
    status: 'done',
  },
  {
    id: 'IMP-011',
    priority: 'P0',
    title: 'SessionStart Hook の並列化',
    problem: 'SessionStart に3つの sync hook が直列実行: auto-pull.sh → session-start-marker.sh → supabase-status.sh。セッション起動が遅延。各hookは独立しており待つ必要がない。',
    solution: 'auto-pull.sh と supabase-status.sh を async: true に変更。session-start-marker.sh のみ sync 維持（タイムライン記録のため）。起動時間が約3分の1に。',
    harnessPart: 'Hooks (SessionStart)',
    effort: '30分',
    impact: 'セッション起動の高速化。ユーザー体験の即座の改善。',
    status: 'done',
  },
  {
    id: 'IMP-012',
    priority: 'P1',
    title: 'skipDangerousModePermissionPrompt の無効化',
    problem: 'settings.json で skipDangerousModePermissionPrompt: true。rm -rf、git reset --hard、docker compose down 等の破壊的操作が確認なしで実行される。bash-guard がブロックするのは4パターンのみ。',
    solution: 'skipDangerousModePermissionPrompt: false に変更。PermissionRequest Hook で permission-log.sh を追加し全許可判断を記録。bash-guard のブロックパターンも拡充。',
    harnessPart: 'Permissions + Hooks',
    effort: '1時間',
    impact: '破壊的操作の事前確認が復活。監査証跡の確保。セキュリティリスクの大幅低減。',
    status: 'done',
  },
  {
    id: 'IMP-013',
    priority: 'P1',
    title: 'bash-guard の監査ログ追加',
    problem: 'bash-guard.sh がコマンドをブロック（exit 2）した際、ログが残らない。いつ何がブロックされたか追跡不可。',
    solution: 'ブロック時に ~/.claude/logs/blocked-commands.jsonl に {timestamp, command, reason} を書き込み。ダッシュボードのHook Healthウィジェットで可視化。',
    harnessPart: 'Hooks (PreToolUse)',
    effort: '30分',
    impact: 'セキュリティ監査の実現。ブロックパターンの改善材料。',
    status: 'done',
  },
  {
    id: 'IMP-014',
    priority: 'P2',
    title: 'freshness-policy の priority 重複修正',
    problem: 'growth_events と intelligence_reports が両方 priority: 9。両方 stale の場合に実行順が不定。',
    solution: 'intelligence_reports を priority 8.5 に変更（レポートはデータ入力、growth分析は洞察出力なのでレポートが先）。ceo_insights と knowledge_base を blocking: true に変更（全エージェントの判断品質に影響）。',
    harnessPart: 'Freshness Policy',
    effort: '15分',
    impact: '更新順序の確定。重要データの鮮度保証。',
    status: 'done',
  },
]

const PRIORITY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  P0: { color: 'var(--red)', bg: 'var(--red-bg)', border: 'var(--red-border)' },
  P1: { color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber-border)' },
  P2: { color: 'var(--blue)', bg: 'var(--blue-bg)', border: 'var(--blue-border)' },
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  proposed: { text: '提案', color: 'var(--text3)' },
  in_progress: { text: '進行中', color: 'var(--blue)' },
  done: { text: '完了', color: 'var(--green)' },
}

function TabProposals() {
  const [filterPriority, setFilterPriority] = useState<string>('')

  const filtered = filterPriority ? PROPOSALS.filter((p) => p.priority === filterPriority) : PROPOSALS
  const p0Count = PROPOSALS.filter((p) => p.priority === 'P0').length
  const p1Count = PROPOSALS.filter((p) => p.priority === 'P1').length
  const p2Count = PROPOSALS.filter((p) => p.priority === 'P2').length
  const doneCount = PROPOSALS.filter((p) => p.status === 'done').length

  return (
    <>
      <Section title="改善提案サマリー">
        <P>情報収集部（最新ハーネス記事調査）× 運営改善部（現行システム分析）の協議結果。全提案はハーネスエンジニアリングの6構成要素に紐づく。HD CLAUDE.md: 208行 / 部署CLAUDE.md合計: 1,004行 / Hook: 24スクリプト / Freshness Policy: 13データソース。最終調査日: 2026-04-05</P>
        <div className="g3" style={{ marginBottom: 16 }}>
          <Principle title={`P0: Critical — ${p0Count}件`} body="やらないと品質・信頼性に直結するリスク。CLAUDE.md肥大化、ハンドオフ漏れ、ルール無視。" color="var(--red)" />
          <Principle title={`P1: Important — ${p1Count}件`} body="やると品質・効率が大幅に向上。Compaction対策、最小権限、昇格ゲート。" color="var(--amber)" />
          <Principle title={`P2: Nice-to-have — ${p2Count}件`} body="運用が成熟してから取り組む。可観測性、部署仕様均一化、自動調査。" color="var(--blue)" />
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
          <span>全 <strong>{PROPOSALS.length}</strong> 件</span>
          <span>完了 <strong style={{ color: 'var(--green)' }}>{doneCount}</strong>/{PROPOSALS.length}</span>
          <span>推定工数合計 <strong style={{ fontFamily: 'var(--mono)' }}>{PROPOSALS.reduce((s, p) => s + parseInt(p.effort), 0)}h</strong></span>
        </div>
      </Section>

      <Section title="提案一覧">
        {/* Priority filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[
            { key: '', label: `全て (${PROPOSALS.length})` },
            { key: 'P0', label: `P0 (${p0Count})` },
            { key: 'P1', label: `P1 (${p1Count})` },
            { key: 'P2', label: `P2 (${p2Count})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterPriority(f.key)}
              className="btn btn-g btn-sm"
              style={{
                fontSize: 11, padding: '4px 10px',
                background: filterPriority === f.key ? 'var(--accent-bg)' : undefined,
                color: filterPriority === f.key ? 'var(--accent)' : undefined,
                borderColor: filterPriority === f.key ? 'var(--accent-border)' : undefined,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.map((p) => {
          const ps = PRIORITY_STYLE[p.priority] || PRIORITY_STYLE.P2
          const st = STATUS_LABEL[p.status] || STATUS_LABEL.proposed
          return (
            <div key={p.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: ps.color, background: ps.bg, border: `1px solid ${ps.border}`, fontFamily: 'var(--mono)' }}>{p.priority}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{p.id}</span>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{p.title}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: st.color }}>{st.text}</span>
              </div>
              {/* Body */}
              <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '6px 12px', fontSize: 12, lineHeight: 1.7 }}>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Problem</span>
                <span style={{ color: 'var(--text2)' }}>{p.problem}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Solution</span>
                <span style={{ color: 'var(--text2)' }}>{p.solution}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>対象</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent2)' }}>{p.harnessPart}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>工数</span>
                <span style={{ color: 'var(--text2)' }}>{p.effort}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Impact</span>
                <span style={{ color: 'var(--text2)' }}>{p.impact}</span>
              </div>
            </div>
          )
        })}
      </Section>

      <Section title="継続調査の仕組み">
        <P>この提案リストは自動的に最新化される。</P>
        <Tbl headers={['トリガー', '実行内容', '頻度']} rows={[
          ['/company 起動時', 'freshness-policy.yaml で harness_research の鮮度チェック', '毎回（14日超で調査起動）'],
          ['自動調査', '情報収集部: 最新Claude Code記事・リリースノート調査', '14日ごと'],
          ['ギャップ分析', '運営改善部: 現行システムと最新ベストプラクティスの差分分析', '調査完了後に自動'],
          ['提案更新', 'HowItWorks 改善提案タブの更新提案を社長に提示', 'ギャップ発見時'],
          ['手動トリガー', '/company → 「ハーネス最新化」で即時調査起動', '任意'],
        ]} />
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)', marginTop: 12 }}>
{`/company 起動
  └→ freshness-check.sh
       └→ harness_research: 最終調査 14日超?
            ├→ YES: 情報収集部(最新記事) ∥ 運営改善部(GAP分析) 並列起動
            │        └→ 統合 → 改善提案更新 → 社長に提示
            └→ NO:  スキップ（鮮度OK）`}
        </div>
      </Section>
    </>
  )
}

// ========== Main ==========

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'harness', label: 'Harness Engineering' },
  { key: 'proposals', label: 'Improvement Proposals' },
  { key: 'ai', label: 'AI Features' },
  { key: 'philosophy', label: 'Design Philosophy' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'operations', label: 'Operations' },
] as const

type TabKey = typeof TABS[number]['key']

export function HowItWorks() {
  const [tab, setTab] = useState<TabKey>('overview')

  return (
    <div className="page">
      <PageHeader title="How it Works" description="なぜこの仮想カンパニーは回り続けるのか" />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--accent)' : 'var(--text3)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all .15s',
              fontFamily: 'var(--font)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <TabOverview />}
      {tab === 'harness' && <TabHarness />}
      {tab === 'proposals' && <TabProposals />}
      {tab === 'ai' && <TabAiFeatures />}
      {tab === 'philosophy' && <TabDesignPhilosophy />}
      {tab === 'architecture' && <TabArchitecture />}
      {tab === 'operations' && <TabOperations />}
    </div>
  )
}
