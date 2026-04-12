import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, SkeletonGrid } from '@/components/ui'
import { DepartmentDetailModal, type DeptDetail } from '@/components/DepartmentDetailModal'

/* ── Static data: HD departments ── */

type Dept = DeptDetail & { keywords: string[] }

const DEPARTMENTS: Dept[] = [
  {
    id: 'ai-dev',
    name: 'AI開発部',
    icon: '▣',
    role: 'LLM/AIシステムの要件定義・設計・実装・評価・運用',
    longDescription: 'LLM/AIシステム全般を担当。要件定義からモデル選定、プロンプト設計、実装、精度評価、デプロイまでを一貫して扱う。PJ会社のコンテキストを読み込んで、AI関連の設計とコーディングを実行する。',
    model: 'opus',
    keywords: ['LLM', 'プロンプト', 'RAG', 'エージェント', 'モデル'],
    teams: [
      { name: '要件定義', role: 'ユースケース整理、AI適用可否判断' },
      { name: '設計', role: 'アーキテクチャ設計、プロンプト設計、モデル選定' },
      { name: '実装', role: 'LLM API連携、RAG構築、エージェント実装' },
      { name: 'アルゴ', role: 'アルゴリズム検討、最適化、モジュール化' },
      { name: '評価', role: '精度評価、ベンチマーク、品質保証' },
      { name: 'AIOps', role: 'デプロイ、モニタリング、運用' },
    ],
    skills: ['LLM設計', 'プロンプトエンジニアリング', 'RAG構築', 'エージェント実装', 'モデル選定', '精度評価', 'AIOps'],
    triggers: ['LLM', 'プロンプト', 'RAG', 'エージェント', 'モデル', 'AI機能', '自動生成'],
    inputs: ['タスク内容の詳細', '対象PJ会社名', '前ステップの成果物パス', '実行モード（full-auto / checkpoint / step-by-step）'],
    outputs: ['設計書・仕様書（.company-{name}/ or docs/）', '実コード（紐づきリポジトリ）', '次ステップへの申し送り'],
    rules: [
      '外部への提供物は必ずAPI仕様/モジュール仕様を明記',
      'プロンプトは設計チームが管理。実装で勝手に変更しない',
      'アルゴの成果物はモジュール化しインターフェースで提供',
      '既存コードのパターンに従う。新しいimportは既存の使い方を確認してから',
    ],
    pipelines: ['A: 新機能開発'],
  },
  {
    id: 'sys-dev',
    name: 'システム開発部',
    icon: '⚙',
    role: 'バックエンド・フロントエンド・QA',
    longDescription: 'API・DB・UIなどシステムの実装を担当。AI開発部のモジュールを統合して、PJのシステム部分を構築する。',
    model: 'sonnet',
    keywords: ['API', 'DB', 'フロント', 'テスト', 'バグ'],
    teams: [
      { name: 'バックエンド', role: 'API設計、DB設計、サーバーサイド実装' },
      { name: 'フロントエンド', role: 'UI/UX実装、コンポーネント設計' },
      { name: 'QA', role: 'テスト計画、テスト実行、バグ管理' },
    ],
    skills: ['TypeScript', 'React', 'Supabase', 'Edge Functions', 'API設計', 'DB設計', 'テスト自動化'],
    triggers: ['実装して', '作って', 'API', 'DB', 'UI', '画面', '直して', 'バグ'],
    inputs: ['タスク内容の詳細', '対象PJ会社名', 'AI開発部の成果物パス（統合が必要な場合）'],
    outputs: ['実コード（紐づきリポジトリ）', 'テスト結果・実行ログ', '次ステップへの申し送り'],
    rules: [
      'API設計はバックエンドチームが一元管理',
      'フロントエンドはバックエンドのAPI仕様確定後に実装',
      'QAを経由せずリリースしない（軽微な修正を除く）',
      '既存コードのパターンに従う',
    ],
    pipelines: ['A: 新機能開発', 'B: バグ修正', 'E: セキュリティ'],
  },
  {
    id: 'research',
    name: 'リサーチ部',
    icon: '◇',
    role: '市場調査・技術調査・対象企業調査',
    longDescription: '壁打ちの素材となるリサーチを提供する。出力は必ず3段構成（公知情報分析→限界の明示→壁打ち導線）。社長が腹落ちして自分の解釈に昇華できる状態を目指す。',
    model: 'opus',
    keywords: ['調べて', '調査', '競合', '市場', '比較'],
    teams: [
      { name: 'マーケット調査', role: '市場、トレンド、競合分析' },
      { name: '技術調査', role: '技術動向、ツール、ライブラリ' },
      { name: '対象企業調査', role: '企業分析、ニーズ推定、アプローチ検討' },
    ],
    skills: ['Web検索', '情報源の信頼性判断', '構造化分析', '仮説の明示', 'ソース管理'],
    triggers: ['調べて', '調査', '競合', '市場', '比較', 'どうなってる', 'リサーチ'],
    inputs: ['調査テーマ', '対象PJ会社名'],
    outputs: ['調査レポート（3段構成）→ .company/departments/research/{team}/'],
    rules: [
      'すべての情報にソースURLを付与',
      '結論 + ネクストアクションを必ず含める',
      '推測・仮説は明確にラベル付け',
      '限界（何がわからないか）を明示',
      '壁打ち導線（深掘り質問例）を添える',
    ],
    pipelines: ['A: 新機能開発', 'C: 資料作成', 'D: 調査', 'E: セキュリティ'],
  },
  {
    id: 'pm',
    name: 'PM',
    icon: '▦',
    role: 'プロジェクトの立ち上げから完了まで進捗管理',
    longDescription: 'プロジェクト・チケット・マイルストーンを管理。部署横断のタスク可視化とボトルネック特定を担う。',
    model: 'haiku',
    keywords: ['プロジェクト', 'マイルストーン', '進捗', 'チケット'],
    teams: [],
    skills: ['プロジェクト管理', 'チケット分割', 'マイルストーン設計', 'ボトルネック特定', '進捗可視化'],
    triggers: ['プロジェクト', 'マイルストーン', '進捗', 'チケット', 'スケジュール', 'いつまで'],
    inputs: ['プロジェクト情報/タスク内容', '対象PJ会社名'],
    outputs: ['プロジェクトファイル → .company/departments/pm/projects/', 'チケット → .company/departments/pm/tickets/', '進捗レポート'],
    rules: [
      'プロジェクト状態: planning → in-progress → review → completed → archived',
      'チケット状態: open → in-progress → done',
      '新規プロジェクト作成時は必ずゴールとマイルストーンを定義',
    ],
    pipelines: ['A: 新機能開発'],
  },
  {
    id: 'materials',
    name: '資料制作部',
    icon: '▤',
    role: '提案書・プレゼン・デモ資料・技術説明資料の作成',
    longDescription: '壁打ち素材としての資料を作成。社長が自分の言葉で説明できる状態を目指す。完成品ではなく、腹落ちするための道具。',
    model: 'sonnet',
    keywords: ['資料', 'プレゼン', '提案書', 'スライド'],
    teams: [],
    skills: ['提案書設計', 'プレゼン構成', 'スライド作成', 'PPTX生成', '情報の強弱付け'],
    triggers: ['資料', 'プレゼン', '提案書', 'スライド', 'PPT', 'まとめて'],
    inputs: ['資料の目的・対象者・キーメッセージ', '対象PJ会社名', 'リサーチ部の調査結果（あれば）'],
    outputs: ['資料ファイル → .company/departments/materials/deliverables/', 'PPTX → output/'],
    rules: [
      '必ず「対象者」「目的」「キーメッセージ」を定義してから作成',
      '技術的な内容はAI開発部に確認を取る',
      'ステータス: draft → writing → review → completed',
      '社長レビューを経ずに完成にしない',
    ],
    pipelines: ['C: 資料作成'],
  },
  {
    id: 'ux-design',
    name: 'UXデザイン部',
    icon: '◎',
    role: 'ユーザーが考える前に欲しいものが届く体験設計',
    longDescription: 'UIコンポーネントの追加屋ではない。人間の行動・感情・認知心理学に基づき、シナリオ→感情曲線→5原則→設計の順で体験を設計する専門家。',
    model: 'opus',
    keywords: ['UI', 'UX', 'デザイン', '画面設計'],
    teams: [],
    skills: ['シナリオ設計', '感情曲線マッピング', '5原則（意図の先読み/認知負荷最小化/フィードバック/エラー回復/フロー保護）', '状態遷移設計', 'アクセシビリティ'],
    triggers: ['UI', 'UX', 'デザイン', '画面', '体験', '使いやすく'],
    inputs: ['タスク内容の詳細', '対象PJ会社名', '対象ユーザーの文脈'],
    outputs: ['シナリオ分析', '感情曲線マップ', '設計判断ログ', 'インタラクション仕様', '実装コード（プロトタイプまたは本実装）'],
    rules: [
      'UIコンポーネントから設計を始めない。必ずシナリオ→感情→原則→設計の順',
      '「なぜこの設計か」を5原則で説明できること',
      '最新のUX研究・事例をWebSearchで参照してから設計する',
      'アクセシビリティ（WCAG 2.1 AA）を常に考慮',
      'Linear, Notion, Superhuman, Apple等の優れたUXを参考に',
    ],
    pipelines: ['A: 新機能開発', 'C: 資料作成'],
  },
  {
    id: 'intelligence',
    name: '情報収集部',
    icon: '◈',
    role: 'ニュース・トレンド・競合情報の収集とブリーフィング',
    longDescription: 'キーワード検索・X監視・Web巡回で最新情報を収集。社長の関心（prompt_log）から動的にキーワードを抽出し、CEO向けブリーフィングレポートを生成する。',
    model: 'haiku',
    keywords: ['ニュース', 'トレンド', 'Web巡回'],
    teams: [],
    skills: ['キーワード検索', 'X監視', 'Web巡回', '動的キーワード抽出', '差分検出', 'Supabase連携'],
    triggers: ['ニュース', '最新', 'トレンド', '業界の動向', '情報収集'],
    inputs: ['収集指示（オンデマンド or 定期）', '特定の関心トピック（あれば）'],
    outputs: ['JSON → intelligence/reports/', 'Markdown → intelligence/reports/', 'Supabase news_items / secretary_notes への INSERT'],
    rules: [
      '日付ファースト（鮮度が最重要）',
      '各情報に必ず情報源URLを明記',
      '前回レポートと重複する情報は除外（差分のみ）',
      '破壊的変更・メジャーリリース等を冒頭で報告',
      'ファイル保存だけで終わらない。ダッシュボードに必ず反映する',
    ],
    pipelines: [],
  },
  {
    id: 'security',
    name: 'セキュリティ部',
    icon: '◆',
    role: 'ソフトウェアサプライチェーンセキュリティの統括管理',
    longDescription: '依存関係の脆弱性、認証フロー、RLSポリシー、シークレット管理など、プロダクトのセキュリティ全般を統括する。',
    model: 'opus',
    keywords: ['脆弱性', '監査', 'セキュリティ'],
    teams: [],
    skills: ['脆弱性診断', 'RLS設計', '認証フロー監査', 'シークレット管理', '依存関係監査'],
    triggers: ['脆弱性', 'セキュリティ', '監査', 'RLS', '認証', 'シークレット'],
    inputs: ['監査対象', '対象PJ会社名'],
    outputs: ['セキュリティ監査レポート', '修正推奨事項'],
    rules: [
      '推測ではなく実証で脆弱性を特定する',
      '修正の優先度を明記（P0/P1/P2）',
      'シークレットは絶対にログ・コミット・レポートに含めない',
    ],
    pipelines: ['E: セキュリティ'],
  },
  {
    id: 'marketing',
    name: 'マーケティング部',
    icon: '▲',
    role: '仮想カンパニーシステム自体のプロダクト化推進',
    longDescription: 'focus-you 自体の商用化・ポジショニング・価格戦略を担当。ターゲット層の定義、競合分析、プロダクトメッセージングを設計する。',
    model: 'opus',
    keywords: ['マーケ', 'プロダクト', '売れる'],
    teams: [],
    skills: ['ポジショニング', '競合分析', '価格戦略', 'メッセージング', 'ターゲット層分析'],
    triggers: ['マーケ', '売れる', 'ポジショニング', '商用化', '価格', 'ターゲット'],
    inputs: ['プロダクトの現状', '市場文脈'],
    outputs: ['ポジショニング案', 'ターゲット定義', 'メッセージング案'],
    rules: [
      '個人の幸せ・自己理解を軸にする（仕事効率化ではない）',
      '商用化の判断は社長。提案まで',
    ],
    pipelines: [],
  },
  {
    id: 'ops',
    name: '運営改善部',
    icon: '↻',
    role: '仕組み自体の改善・継続運用の維持',
    longDescription: 'Hook・バッチ・ルールなど運営基盤そのものの改善を担当。社長が同じ指示を2回しなくて済むように、自動化と仕組み化を進める。',
    model: 'opus',
    keywords: ['運営', '改善', '仕組み', 'CI/CD'],
    teams: [],
    skills: ['Hook設計', 'バッチ実装', 'ルール改善', 'CI/CD', '仕組み化', '自動化'],
    triggers: ['運営', '仕組み', '改善', 'Hook', 'バッチ', '自動化'],
    inputs: ['改善したいポイント', '現状の課題'],
    outputs: ['Hook スクリプト', 'バッチ設定', 'ルールファイル更新', '改善提案'],
    rules: [
      '気をつける」は対策ではない。仕組みで防ぐ',
      '変更は可逆性を確保してから',
      '自己参照・循環参照に注意',
    ],
    pipelines: [],
  },
]

/* ── Static data: Pipelines ── */

interface Pipeline {
  id: string
  name: string
  trigger: string
  steps: string[]
}

const PIPELINES: Pipeline[] = [
  { id: 'A', name: '新機能開発', trigger: '「作って」「実装して」「新機能」', steps: ['リサーチ ∥ UX', 'AI開発 ∥ PM', 'システム開発', 'QA'] },
  { id: 'B', name: 'バグ修正', trigger: '「直して」「バグ」「修正」', steps: ['システム開発', 'QA'] },
  { id: 'C', name: '資料作成', trigger: '「資料」「プレゼン」「提案書」', steps: ['リサーチ ∥ UX', '資料制作'] },
  { id: 'D', name: '調査', trigger: '「調べて」「調査」「比較」', steps: ['リサーチ', '統合報告'] },
  { id: 'E', name: 'セキュリティ', trigger: '「セキュリティ」「脆弱性」', steps: ['セキュリティ ∥ リサーチ', 'システム開発', 'QA'] },
]

/* ── Types ── */

interface Company {
  id: string
  name: string
  description: string | null
  status: string
}

interface ActivityRow {
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
}

/* ── Component ── */

export function Companies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'departments' | 'pipelines' | 'companies'>('departments')

  const load = useCallback(async () => {
    setLoading(true)
    const [cosRes, actRes] = await Promise.all([
      supabase.from('companies').select('id, name, description, status').order('created_at'),
      supabase.from('activity_log').select('action, metadata, created_at').order('created_at', { ascending: false }).limit(20),
    ])
    setCompanies((cosRes.data as Company[]) || [])
    setRecentActivity((actRes.data as ActivityRow[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="page"><PageHeader title="Organization" /><SkeletonGrid cols={3} count={6} /></div>

  return (
    <div className="page">
      <PageHeader title="Organization" description="HD共通部署・パイプライン・PJ会社" />

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface2)', borderRadius: 'var(--r)', padding: 3, width: 'fit-content' }}>
        {([
          { key: 'departments' as const, label: '部署', count: DEPARTMENTS.length },
          { key: 'pipelines' as const, label: 'パイプライン', count: PIPELINES.length },
          { key: 'companies' as const, label: 'PJ会社', count: companies.filter(c => c.status === 'active').length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 16px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'var(--font)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              background: tab === t.key ? 'var(--surface)' : 'transparent',
              color: tab === t.key ? 'var(--text)' : 'var(--text3)',
              boxShadow: tab === t.key ? 'var(--shadow)' : 'none',
              transition: 'all .2s',
            }}
          >
            {t.label} <span style={{ opacity: 0.5, marginLeft: 4 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'departments' && <DepartmentsTab recentActivity={recentActivity} />}
      {tab === 'pipelines' && <PipelinesTab />}
      {tab === 'companies' && <CompaniesTab companies={companies} />}
    </div>
  )
}

/* ── Departments Tab ── */

function DepartmentsTab({ recentActivity }: { recentActivity: ActivityRow[] }) {
  const [selected, setSelected] = useState<Dept | null>(null)

  // Count dept mentions in recent activity
  const deptActivity = new Map<string, number>()
  const deptActivityItems = new Map<string, { action: string; created_at: string; summary?: string }[]>()
  for (const a of recentActivity) {
    const meta = a.metadata as Record<string, string> | null
    const dept = meta?.department || meta?.dept
    if (dept && typeof dept === 'string') {
      deptActivity.set(dept, (deptActivity.get(dept) || 0) + 1)
      const list = deptActivityItems.get(dept) || []
      list.push({
        action: a.action,
        created_at: a.created_at,
        summary: (meta?.summary || meta?.description || meta?.title) as string | undefined,
      })
      deptActivityItems.set(dept, list)
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {DEPARTMENTS.map(d => {
          const count = deptActivity.get(d.id) || 0
          return (
            <Card key={d.id} glow onClick={() => setSelected(d)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--r)',
                  background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: 'var(--accent2)', flexShrink: 0,
                }}>
                  {d.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.02em' }}>{d.name}</span>
                    {count > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                        background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-border)',
                      }}>
                        {count} recent
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5 }}>
                    {d.role}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {d.keywords.map(k => (
                      <span key={k} style={{
                        fontSize: 10, fontFamily: 'var(--mono)', padding: '2px 7px',
                        background: 'var(--surface2)', borderRadius: 4, color: 'var(--text3)',
                        border: '1px solid var(--border)',
                      }}>
                        {k}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>詳細を見る</span>
                    <span style={{ fontSize: 11 }}>→</span>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <DepartmentDetailModal
        dept={selected}
        recentActivity={selected ? (deptActivityItems.get(selected.id) || []) : []}
        onClose={() => setSelected(null)}
      />

      {/* How it works */}
      <div style={{ marginTop: 32 }}>
        <div className="section-title">How departments work</div>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
            <p style={{ marginBottom: 8 }}>
              部署はHD（ホールディングス）に集約されており、全PJ会社で共有されます。
              社長の指示に含まれるキーワードに応じて、秘書が自動的に適切な部署を選択しパイプラインを組み立てます。
            </p>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', padding: '10px 14px', borderRadius: 'var(--r)', marginTop: 4 }}>
              社長の指示 → HD秘書（判断） → 部署の自動選択 → パイプライン実行 → 成果物
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

/* ── Pipelines Tab ── */

function PipelinesTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {PIPELINES.map(p => (
        <Card key={p.id} glow>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            {/* Pipeline ID badge */}
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--r)',
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: 'var(--accent2)', fontFamily: 'var(--mono)',
              flexShrink: 0,
            }}>
              {p.id}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.02em', marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, fontFamily: 'var(--mono)' }}>
                {p.trigger}
              </div>
              {/* Step flow */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                {p.steps.map((s, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: '4px 10px',
                      background: 'var(--surface2)', borderRadius: 5,
                      border: '1px solid var(--border)', color: 'var(--text)',
                      whiteSpace: 'nowrap',
                    }}>
                      {s}
                    </span>
                    {i < p.steps.length - 1 && (
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}

      {/* Legend */}
      <div style={{ marginTop: 8 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.8 }}>
            <span style={{ fontWeight: 600, color: 'var(--text2)' }}>∥</span> = 並列実行 &nbsp;&nbsp;
            <span style={{ fontWeight: 600, color: 'var(--text2)' }}>→</span> = 直列（前の出力を次が利用）
            <br />
            パイプラインは秘書が社長の指示から自動選択します。明示的に指定することも可能です。
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ── Companies Tab (minimal) ── */

function CompaniesTab({ companies }: { companies: Company[] }) {
  const active = companies.filter(c => c.status === 'active')
  const archived = companies.filter(c => c.status === 'archived')

  return (
    <>
      {active.length === 0 && archived.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)', fontSize: 13 }}>
          PJ会社がまだありません。<code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>/company {'<name>'}</code> で作成できます。
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="section-title">Active</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
                {active.map(co => (
                  <Card key={co.id} glow>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{co.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{co.id}</div>
                      </div>
                    </div>
                    {co.description && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>{co.description}</div>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}

          {archived.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 8 }}>Archived</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {archived.map(co => (
                  <Card key={co.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text3)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{co.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{co.id}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ marginTop: 24 }}>
        <Card>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
            PJ会社は「コンテキストの箱」です。クライアント情報・ドメイン知識・リポジトリを保持し、
            HD共通部署がそのコンテキストを注入して作業します。
            会社の作成・アーカイブは <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>/company</code> から行います。
          </div>
        </Card>
      </div>
    </>
  )
}
