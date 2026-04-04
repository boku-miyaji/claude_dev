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
          ['Hook', 'prompt-log.sh, config-sync.sh', '軽量・非同期・毎回自動実行'],
          ['スキル', '/migrate, /deploy, /company', '必要時に呼び出し。判断を伴う処理'],
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
        <Principle title="時間帯適応型UI" body="朝=計画（スケジュール先頭）、昼=実行（メモ先頭）、夜=振り返り（達成感先頭）。同じ画面を24時間出さない。" color="var(--accent)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="ブランクページ問題" body="白紙のテキストエリアは書けない。時間帯+カレンダーから文脈プロンプトを動的生成。白紙より3-5倍の入力完了率。" />
          <MiniCard title="ポジティブファースト" body="夜は完了タスクを先に見せる。未完了は「明日に持ち越す?」と穏やかに。ピーク・エンドの法則。" />
          <MiniCard title="ファーストビュー3セクション" body="モバイルでスクロールなしに最重要情報だけ。8セクション全表示はスクロール疲れ。" />
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
          ['ナレッジ昇格', '修正指示→memory→2回目でKB→3回目でCLAUDE.md', 'memory/ → knowledge_base → CLAUDE.md'],
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

      <Section title="部署連携">
        <P>パイプラインA（新機能開発）の流れ:</P>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`Step 1 [並列]: リサーチ ∥ UXデザイン
Step 2 [並列]: AI開発(設計) ∥ PM(チケット) ← checkpoint
Step 3 [直列]: システム開発(実装) → QA(テスト)
完了: 成果物登録 + commit + 報告`}
        </div>
        <P>ハンドオフ: 部署の成果物に「→ PM部への依頼」等があると秘書が自動検出して次の部署を起動。</P>
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

// ========== Main ==========

const TABS = [
  { key: 'overview', label: 'Overview' },
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
      {tab === 'philosophy' && <TabDesignPhilosophy />}
      {tab === 'architecture' && <TabArchitecture />}
      {tab === 'operations' && <TabOperations />}
    </div>
  )
}
