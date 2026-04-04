import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, SkeletonGrid } from '@/components/ui'

/* ── Static data: HD departments ── */

interface Dept {
  id: string
  name: string
  role: string
  keywords: string[]
  icon: string
}

const DEPARTMENTS: Dept[] = [
  { id: 'ai-dev', name: 'AI開発部', role: 'LLM/AIシステムの要件定義・設計・実装・評価・運用', keywords: ['LLM', 'プロンプト', 'RAG', 'エージェント', 'モデル'], icon: '▣' },
  { id: 'sys-dev', name: 'システム開発部', role: 'バックエンド・フロントエンド・QA', keywords: ['API', 'DB', 'フロント', 'テスト', 'バグ'], icon: '⚙' },
  { id: 'research', name: 'リサーチ部', role: '市場調査・技術調査・対象企業調査', keywords: ['調べて', '調査', '競合', '市場', '比較'], icon: '◇' },
  { id: 'pm', name: 'PM', role: 'プロジェクトの立ち上げから完了まで進捗管理', keywords: ['プロジェクト', 'マイルストーン', '進捗', 'チケット'], icon: '▦' },
  { id: 'materials', name: '資料制作部', role: '提案書・プレゼン・デモ資料・技術説明資料の作成', keywords: ['資料', 'プレゼン', '提案書', 'スライド'], icon: '▤' },
  { id: 'ux-design', name: 'UXデザイン部', role: 'ユーザーが考える前に欲しいものが届く体験設計', keywords: ['UI', 'UX', 'デザイン', '画面設計'], icon: '◎' },
  { id: 'intelligence', name: '情報収集部', role: 'ニュース・トレンド・競合情報の収集とブリーフィング', keywords: ['ニュース', 'トレンド', 'Web巡回'], icon: '◈' },
  { id: 'security', name: 'セキュリティ部', role: 'ソフトウェアサプライチェーンセキュリティの統括管理', keywords: ['脆弱性', '監査', 'セキュリティ'], icon: '◆' },
  { id: 'marketing', name: 'マーケティング部', role: '仮想カンパニーシステム自体のプロダクト化推進', keywords: ['マーケ', 'プロダクト', '売れる'], icon: '▲' },
  { id: 'ops', name: '運営改善部', role: '仕組み自体の改善・継続運用の維持', keywords: ['運営', '改善', '仕組み', 'CI/CD'], icon: '↻' },
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
  // Count dept mentions in recent activity
  const deptActivity = new Map<string, number>()
  for (const a of recentActivity) {
    const meta = a.metadata as Record<string, string> | null
    const dept = meta?.department || meta?.dept
    if (dept && typeof dept === 'string') {
      deptActivity.set(dept, (deptActivity.get(dept) || 0) + 1)
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {DEPARTMENTS.map(d => {
          const count = deptActivity.get(d.id) || 0
          return (
            <Card key={d.id} glow>
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
                </div>
              </div>
            </Card>
          )
        })}
      </div>

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
