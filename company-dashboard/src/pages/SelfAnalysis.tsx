import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, PageHeader } from '@/components/ui'

interface AnalysisCard {
  id: string
  title: string
  description: string
  icon: string
  requiredTable: string
  requiredCount: number
  extraRequirement?: string
  unlocked: boolean
  currentCount: number
}

export function SelfAnalysis() {
  const [diaryCount, setDiaryCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [dreamCount, setDreamCount] = useState(0)
  const [hasEmotionData, setHasEmotionData] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [diaryRes, taskRes, dreamRes, emotionRes] = await Promise.all([
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }),
      supabase.from('tasks').select('id', { count: 'exact', head: true }),
      supabase.from('dreams').select('id', { count: 'exact', head: true }),
      supabase
        .from('diary_entries')
        .select('id')
        .not('emotion_scores', 'is', null)
        .limit(1),
    ])
    setDiaryCount(diaryRes.count ?? 0)
    setTaskCount(taskRes.count ?? 0)
    setDreamCount(dreamRes.count ?? 0)
    setHasEmotionData((emotionRes.data?.length ?? 0) > 0)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const analyses: AnalysisCard[] = [
    {
      id: 'mbti',
      title: 'MBTI推定',
      description: '日記の文体と内容から、あなたのMBTIタイプを推定します。',
      icon: '🧩',
      requiredTable: 'diary_entries',
      requiredCount: 20,
      currentCount: diaryCount,
      unlocked: diaryCount >= 20,
    },
    {
      id: 'big5',
      title: 'Big5 パーソナリティ',
      description: '開放性・誠実性・外向性・協調性・神経症傾向の5因子を分析します。',
      icon: '📊',
      requiredTable: 'diary_entries',
      requiredCount: 30,
      currentCount: diaryCount,
      unlocked: diaryCount >= 30,
    },
    {
      id: 'strengths',
      title: '強み・才能分析',
      description: 'タスクの実績と日記から、あなたの強みパターンを発見します。',
      icon: '💎',
      requiredTable: 'tasks',
      requiredCount: 50,
      currentCount: taskCount,
      unlocked: taskCount >= 50,
    },
    {
      id: 'emotion-trigger',
      title: '感情トリガーマップ',
      description: 'どんな出来事がどんな感情を引き起こすか、パターンを可視化します。',
      icon: '🗺️',
      requiredTable: 'diary_entries',
      requiredCount: 30,
      extraRequirement: '感情データあり',
      currentCount: diaryCount,
      unlocked: diaryCount >= 30 && hasEmotionData,
    },
    {
      id: 'values',
      title: '価値観の優先順位',
      description: '日記と夢リストから、あなたが大切にしていることを明らかにします。',
      icon: '🎯',
      requiredTable: 'diary_entries',
      requiredCount: 50,
      extraRequirement: '夢リストあり',
      currentCount: diaryCount,
      unlocked: diaryCount >= 50 && dreamCount > 0,
    },
  ]

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Self-Analysis" />
        <div style={{ color: 'var(--text3)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Self-Analysis" description="あなたのことを分析します" />

      {/* Profile overview */}
      <div className="section">
        <div className="section-title">プロファイル概要</div>
        <Card>
          {diaryCount < 10 ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧠</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
                分析にはデータが必要です
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Today ページで日記を書くと分析が始まります
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>{diaryCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>日記</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--green)' }}>{taskCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>タスク</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{dreamCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>夢</div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Analysis cards */}
      <div className="section">
        <div className="section-title">利用可能な分析</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {analyses.map((a) => {
            const pct = Math.min((a.currentCount / a.requiredCount) * 100, 100)
            const remaining = Math.max(a.requiredCount - a.currentCount, 0)
            return (
              <Card key={a.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{a.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</span>
                      <span style={{ fontSize: 12 }}>{a.unlocked ? '🔓' : '🔒'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.5 }}>
                      {a.description}
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: a.unlocked ? 'var(--green)' : 'var(--accent)',
                          borderRadius: 2,
                          transition: 'width .4s ease',
                        }} />
                      </div>
                    </div>

                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                      {a.requiredTable === 'diary_entries' ? '日記' : a.requiredTable === 'tasks' ? 'タスク' : 'データ'}
                      {' '}{a.currentCount}/{a.requiredCount}件
                      {!a.unlocked && remaining > 0 && ` (あと${remaining}件)`}
                      {a.extraRequirement && !a.unlocked && ` + ${a.extraRequirement}`}
                    </div>

                    {a.unlocked && (
                      <button
                        className="btn btn-p btn-sm"
                        style={{ marginTop: 10, opacity: 0.6, cursor: 'not-allowed' }}
                        disabled
                      >
                        分析を実行 (Phase 2)
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
