import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui'
import { useEmotionAnalysis } from '@/hooks/useEmotionAnalysis'
import { useMorningBriefing } from '@/hooks/useMorningBriefing'

/** Plutchik emotion labels for badge display */
const PLUTCHIK_LABELS: Record<string, { label: string; color: string }> = {
  joy: { label: 'Joy', color: '#FFD700' },
  trust: { label: 'Trust', color: '#98FB98' },
  fear: { label: 'Fear', color: '#228B22' },
  surprise: { label: 'Surprise', color: '#00CED1' },
  sadness: { label: 'Sadness', color: '#4169E1' },
  disgust: { label: 'Disgust', color: '#9370DB' },
  anger: { label: 'Anger', color: '#FF4500' },
  anticipation: { label: 'Anticipation', color: '#FFA500' },
}

/** Time-based greeting with calm tone */
function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'おやすみ前のひととき'
  if (h < 11) return 'おはようございます'
  if (h < 17) return 'こんにちは'
  return 'おつかれさまです'
}

interface DiaryEntry {
  id: string
  content: string
  type: string
  created_at: string
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
}

interface EmotionBadge {
  key: string
  label: string
  color: string
  value: number
}

export function Today() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fragments, setFragments] = useState<DiaryEntry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [dreamsCount, setDreamsCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [wbi, setWbi] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [emotionBadges, setEmotionBadges] = useState<Map<string, EmotionBadge[]>>(new Map())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { analyze, analyzing, error: emotionError } = useEmotionAnalysis()
  const { message: briefingMessage, loading: briefingLoading } = useMorningBriefing()

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const startOfDay = `${todayStr}T00:00:00`
    const endOfDay = `${todayStr}T23:59:59`

    const [diaryRes, tasksRes, dreamsRes, wbiRes] = await Promise.all([
      supabase
        .from('diary_entries')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('id, title, status, priority')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('dreams')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'in_progress']),
      supabase
        .from('wbi_scores')
        .select('wbi')
        .order('scored_at', { ascending: false })
        .limit(1),
    ])

    const diaryData = (diaryRes.data as DiaryEntry[]) || []
    setFragments(diaryData)
    setTasks((tasksRes.data as Task[]) || [])
    setDreamsCount(dreamsRes.count ?? 0)
    if (wbiRes.data?.[0]) setWbi(wbiRes.data[0].wbi)

    // Load emotion data for today's entries
    if (diaryData.length > 0) {
      const entryIds = diaryData.map((e) => e.id)
      const { data: emotionData } = await supabase
        .from('emotion_analysis')
        .select('diary_entry_id, joy, trust, fear, surprise, sadness, disgust, anger, anticipation')
        .in('diary_entry_id', entryIds)

      if (emotionData) {
        const badgeMap = new Map<string, EmotionBadge[]>()
        for (const ea of emotionData) {
          const scores = Object.entries(PLUTCHIK_LABELS).map(([key, info]) => ({
            key,
            label: info.label,
            color: info.color,
            value: (ea as Record<string, number>)[key] ?? 0,
          }))
          scores.sort((a, b) => b.value - a.value)
          badgeMap.set(
            (ea as Record<string, string>).diary_entry_id,
            scores.filter((s) => s.value > 20).slice(0, 2),
          )
        }
        setEmotionBadges(badgeMap)
      }
    }

    // Calculate streak
    const { data: streakData } = await supabase
      .from('diary_entries')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(90)
    if (streakData && streakData.length > 0) {
      const dates = new Set(
        streakData.map((e: { created_at: string }) => e.created_at.substring(0, 10)),
      )
      let s = 0
      const d = new Date()
      if (dates.has(todayStr)) s = 1
      else {
        d.setDate(d.getDate() - 1)
      }
      for (let i = 0; i < 90; i++) {
        if (s === 0 && i === 0) {
          // already adjusted
        }
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        if (dates.has(key)) {
          if (s === 0) s = 1
          else s++
          d.setDate(d.getDate() - 1)
        } else {
          break
        }
      }
      setStreak(s)
    }

    setLoading(false)
  }, [todayStr])

  useEffect(() => { load() }, [load])

  /** Save diary entry and trigger emotion analysis */
  const saveEntry = useCallback(async (content: string) => {
    if (!content.trim()) return
    setSaving(true)
    const { data: inserted } = await supabase
      .from('diary_entries')
      .insert({ content: content.trim(), type: 'fragment' })
      .select()
      .single()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setText('')
    load()

    // Trigger emotion analysis in background
    if (inserted?.id) {
      const result = await analyze(inserted.id, content.trim())
      if (result) {
        // Update badges for this entry
        const scores = Object.entries(PLUTCHIK_LABELS).map(([key, info]) => ({
          key,
          label: info.label,
          color: info.color,
          value: result.plutchik[key] ?? 0,
        }))
        scores.sort((a, b) => b.value - a.value)
        setEmotionBadges((prev) => {
          const next = new Map(prev)
          next.set(inserted.id, scores.filter((s) => s.value > 20).slice(0, 2))
          return next
        })
      }
    }
  }, [load, analyze])

  /** Debounced auto-save */
  const handleTextChange = useCallback(
    (val: string) => {
      setText(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (val.trim().length > 10) {
        debounceRef.current = setTimeout(() => {
          saveEntry(val)
        }, 1500)
      }
    },
    [saveEntry],
  )

  const greeting = getGreeting()

  if (loading) {
    return (
      <div className="page">
        <div className="page-title">{greeting}</div>
        <div style={{ color: 'var(--text3)', marginTop: 12 }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Greeting */}
      <div className="page-title" style={{ marginBottom: 4 }}>{greeting}</div>
      <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 20 }}>
        今日はどんな日でしたか?
      </p>

      {/* Quick entry */}
      <Card style={{ marginBottom: 20 }}>
        <textarea
          className="input"
          placeholder="思ったこと、感じたことを自由に..."
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          style={{ minHeight: 80, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            {saving ? '保存中...' : saved ? '保存しました' : analyzing ? '感情分析中...' : '10文字以上で自動保存'}
          </span>
          <button
            className="btn btn-p btn-sm"
            onClick={() => saveEntry(text)}
            disabled={!text.trim() || saving || analyzing}
          >
            {analyzing ? '分析中...' : '記録する'}
          </button>
        </div>
        {emotionError && (
          <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
            {emotionError}
          </div>
        )}
      </Card>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {streak > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#ff6b35', fontWeight: 600 }}>{streak}</span>日連続
          </div>
        )}
        {wbi !== null && (
          <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
            WBI <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{wbi.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* AI Morning Briefing */}
      <Card style={{ marginBottom: 24, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
        <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          AI の一言
        </div>
        {briefingLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid var(--accent2)',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>考え中...</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontStyle: 'italic' }}>
            {briefingMessage || '今日も穏やかに過ごせますように。'}
          </div>
        )}
      </Card>

      {/* Today's fragments */}
      {fragments.length > 0 && (
        <div className="section">
          <div className="section-title">今日の断片</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fragments.map((f) => {
              const badges = emotionBadges.get(f.id) || []
              return (
                <Card key={f.id} style={{ padding: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{f.content}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                      {new Date(f.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {badges.map((b) => (
                      <span
                        key={b.key}
                        style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          borderRadius: 10,
                          background: b.color,
                          color: '#fff',
                          fontWeight: 600,
                          opacity: 0.85,
                        }}
                      >
                        {b.label} {b.value}
                      </span>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="section">
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>タスク</span>
            <button
              className="btn btn-g btn-sm"
              style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }}
              onClick={() => navigate('/tasks')}
            >
              すべて見る
            </button>
          </div>
          <Card>
            {tasks.map((t) => (
              <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.priority === 'high' ? 'var(--red)' : t.priority === 'low' ? 'var(--text3)' : 'var(--blue)', flexShrink: 0 }} />
                {t.title}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Dreams */}
      <div className="section">
        <div className="section-title">夢への一歩</div>
        <Card
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/dreams')}
        >
          {dreamsCount > 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>{dreamsCount}</span>
              {' '}個の夢が進行中
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              夢リストを作成して、理想の未来を描きましょう
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
