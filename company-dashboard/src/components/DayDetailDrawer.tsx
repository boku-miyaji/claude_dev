import { useEffect } from 'react'
import type { DayLayerData } from '@/hooks/useCalendarLayers'
import { moodLevel, moodBgColor, moodEmoji } from '@/hooks/useCalendarLayers'
import type { CalendarEvent } from '@/types/calendar'

interface Task {
  id: number
  title: string
  status: string
  priority: string
  due_date: string | null
  scheduled_at: string | null
  completed_at: string | null
}

interface Props {
  dateStr: string | null
  layer: DayLayerData | null
  events: CalendarEvent[]
  tasks: Task[]
  onClose: () => void
}

function fmtEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo',
  })
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00+09:00`)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日（${dow}）`
}

export function DayDetailDrawer({ dateStr, layer, events, tasks, onClose }: Props) {
  useEffect(() => {
    if (!dateStr) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [dateStr, onClose])

  if (!dateStr) return null

  const level = moodLevel(layer?.mood ?? null)
  const chipBg = moodBgColor(level) || 'var(--surface2)'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '60px 20px 40px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          maxWidth: 640,
          width: '100%',
          padding: '28px 32px 32px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>
            {formatDateLabel(dateStr)}
          </h3>
          {layer && layer.mood != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 12px', borderRadius: 20,
              fontSize: 12, fontWeight: 600,
              background: chipBg, color: 'var(--text)',
              border: '1px solid var(--border)',
            }}>
              {moodEmoji(level)} {layer.mood.toFixed(1)}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              marginLeft: 'auto',
              background: 'transparent', border: 'none', color: 'var(--text3)',
              cursor: 'pointer', fontSize: 20, padding: 4, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Diary */}
        {layer && layer.diaryEntries.length > 0 && (
          <Section label="日記">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {layer.diaryEntries.map((e) => (
                <div key={e.id} style={{
                  fontSize: 13, color: 'var(--text)', lineHeight: 1.7,
                  background: 'var(--surface2)',
                  padding: '12px 14px', borderRadius: 6,
                  borderLeft: '3px solid #3b82f6',
                  whiteSpace: 'pre-wrap',
                }}>
                  {e.body}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Events */}
        {events.length > 0 && (
          <Section label="予定">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {events.map((evt) => (
                <div key={evt.id} style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text2)', padding: '4px 0' }}>
                  <span style={{
                    fontFamily: 'var(--mono)', color: 'var(--text3)',
                    fontSize: 11, width: 110, flexShrink: 0,
                  }}>
                    {evt.all_day ? '終日' : `${fmtEventTime(evt.start_time)}–${fmtEventTime(evt.end_time)}`}
                  </span>
                  <span style={{ color: 'var(--text)' }}>{evt.summary}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Habits */}
        {layer && layer.habitTotals.total > 0 && (
          <Section label={`ハビッツ (${layer.habitTotals.done}/${layer.habitTotals.total})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {layer.habitLogs.map((h) => (
                <div key={h.habitId} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 3,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#fff',
                    background: h.done ? '#16a34a' : '#d4d4d8',
                  }}>
                    {h.done ? '✓' : ''}
                  </span>
                  <span style={{ color: h.done ? 'var(--text)' : 'var(--text3)' }}>{h.habitTitle}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <Section label="タスク">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tasks.map((t) => (
                <div key={t.id} style={{
                  display: 'flex', gap: 10, fontSize: 12,
                  color: t.status === 'done' ? 'var(--text3)' : 'var(--text)',
                  textDecoration: t.status === 'done' ? 'line-through' : 'none',
                  padding: '3px 0',
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: '#fff',
                    background: t.status === 'done' ? '#8b5cf6' : 'var(--border)',
                    flexShrink: 0,
                  }}>
                    {t.status === 'done' ? '✓' : ''}
                  </span>
                  <span>{t.title}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Empty state */}
        {(!layer || (layer.diaryEntries.length === 0 && layer.habitTotals.total === 0)) && events.length === 0 && tasks.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: '20px 0' }}>
            この日の記録はまだありません
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}
