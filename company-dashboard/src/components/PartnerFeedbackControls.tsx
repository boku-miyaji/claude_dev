import { useState } from 'react'
import {
  saveGoodFeedback,
  saveCorrectionFeedback,
  CATEGORY_LABELS,
  type FeedbackCategory,
} from '@/lib/partnerFeedback'
import { toast } from '@/components/ui'

interface Props {
  /** The opening message the Partner just produced — target of the feedback. */
  actualOutput: string
  /** Context snapshot from useBriefingStore (time_mode, diary, generated_at). */
  contextSnapshot?: Record<string, unknown> | null
}

/**
 * Inline 👍/違う feedback buttons shown below the Partner message.
 * Captures user judgments into ai_partner_feedback so the next
 * generation can re-inject them as balanced few-shot examples.
 */
export function PartnerFeedbackControls({ actualOutput, contextSnapshot }: Props) {
  const [state, setState] = useState<'idle' | 'correcting' | 'saved'>('idle')
  const [desired, setDesired] = useState('')
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState<FeedbackCategory>('other')
  const [busy, setBusy] = useState(false)

  if (!actualOutput || state === 'saved') {
    return state === 'saved' ? (
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>覚えました</div>
    ) : null
  }

  const handleGood = async () => {
    setBusy(true)
    const ok = await saveGoodFeedback({
      actualOutput,
      contextSnapshot: contextSnapshot ?? undefined,
    })
    setBusy(false)
    if (ok) {
      toast('覚えました')
      setState('saved')
    } else {
      toast('保存に失敗しました')
    }
  }

  const handleSubmitCorrection = async () => {
    if (!desired.trim()) {
      toast('どう返してほしかったかを入力してください')
      return
    }
    setBusy(true)
    const ok = await saveCorrectionFeedback({
      actualOutput,
      desiredOutput: desired.trim(),
      reason: reason.trim() || undefined,
      category,
      contextSnapshot: contextSnapshot ?? undefined,
    })
    setBusy(false)
    if (ok) {
      toast('覚えました。次から反映されます')
      setState('saved')
    } else {
      toast('保存に失敗しました')
    }
  }

  if (state === 'correcting') {
    return (
      <div
        style={{
          marginTop: 10,
          padding: 12,
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>
          AIが返した: <span style={{ color: 'var(--text2)' }}>{actualOutput.substring(0, 80)}{actualOutput.length > 80 ? '…' : ''}</span>
        </div>
        <textarea
          className="input"
          placeholder="どう返してほしかったか（例: 触れずに観察だけでいい）"
          value={desired}
          onChange={(e) => setDesired(e.target.value)}
          style={{ fontSize: 12, minHeight: 60, resize: 'vertical' }}
        />
        <textarea
          className="input"
          placeholder="(任意) 何がズレていたか（例: 本人の意図を潰している）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ fontSize: 12, minHeight: 40, resize: 'vertical' }}
        />
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          style={{ fontSize: 12 }}
        >
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setState('idle'); setDesired(''); setReason('') }}
            disabled={busy}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            キャンセル
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmitCorrection}
            disabled={busy || !desired.trim()}
            style={{ fontSize: 11, padding: '4px 12px' }}
          >
            保存
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleGood}
        disabled={busy}
        title="これは良かった"
        style={{
          fontSize: 11,
          padding: '3px 9px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--text3)',
        }}
      >
        👍 いい
      </button>
      <button
        onClick={() => setState('correcting')}
        disabled={busy}
        title="こう返してほしかった"
        style={{
          fontSize: 11,
          padding: '3px 9px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--text3)',
        }}
      >
        違う
      </button>
    </div>
  )
}
