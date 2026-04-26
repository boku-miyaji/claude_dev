import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Proactive Prelude (前奏) — 夜間バッチが用意した「気づいたら準備されている」短い言葉。
 *
 * バッチ: scripts/proactive-prep/ (Claude CLI + 4種シグナル評価)
 *   - 沈黙 / 詰まり / パターン再来 / 前夜の橋渡し のいずれかが立つ日にだけ 1件
 *   - シグナルが立たなければ何も書き込まれない（=この hook は null を返す）
 *
 * design-philosophy ⑪: 完全な受動表示。ブラウザ側から再生成しない。
 * design-philosophy ⑩: 当日分が無いならセクション非表示（prelude=null）。
 *
 * 設計参照:
 *   - arXiv:2604.00842 (Pare): proactive agent の 4軸
 *   - Migration 069: proactive_preparations
 */
export type PreludeKind =
  | 'gentle_prelude'
  | 'silence_acknowledge'
  | 'pattern_echo'
  | 'schedule_softener'

export interface Prelude {
  id: string
  kind: PreludeKind
  body: string
  hint: string | null
  /** semi-formal の結論（監査用。UI には出さないが debug overlay 等で見せられる） */
  conclusion: string
  status: 'ready' | 'viewed' | 'dismissed'
}

interface UsePreludeResult {
  prelude: Prelude | null
  loading: boolean
  /** 表示済みマーキング（status: ready → viewed）。1度だけ呼ぶ想定 */
  markViewed: () => Promise<void>
  /** 今日は閉じる（status: dismissed）。再表示しない */
  dismiss: () => Promise<void>
}

function getTodayStrJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000)
  return `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}-${String(jst.getDate()).padStart(2, '0')}`
}

export function usePrelude(): UsePreludeResult {
  const [prelude, setPrelude] = useState<Prelude | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMarked, setViewMarked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = getTodayStrJST()
      const { data, error } = await supabase
        .from('proactive_preparations')
        .select('id, kind, body, hint, conclusion, status')
        .eq('delivery_date', today)
        .neq('status', 'dismissed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error || !data) {
        setPrelude(null)
        return
      }

      setPrelude({
        id: data.id as string,
        kind: data.kind as PreludeKind,
        body: data.body as string,
        hint: (data.hint as string | null) ?? null,
        conclusion: data.conclusion as string,
        status: data.status as Prelude['status'],
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markViewed = useCallback(async () => {
    if (!prelude || viewMarked || prelude.status !== 'ready') return
    setViewMarked(true)
    const { error } = await supabase
      .from('proactive_preparations')
      .update({ status: 'viewed', shown_at: new Date().toISOString() })
      .eq('id', prelude.id)
    if (error) {
      // 失敗しても UI には影響させない（受動表示の原則を壊さない）
      setViewMarked(false)
      return
    }
    setPrelude((p) => (p ? { ...p, status: 'viewed' } : p))
  }, [prelude, viewMarked])

  const dismiss = useCallback(async () => {
    if (!prelude) return
    const prev = prelude
    setPrelude(null) // 楽観的に隠す
    const { error } = await supabase
      .from('proactive_preparations')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
      .eq('id', prev.id)
    if (error) {
      // 失敗時は復帰
      setPrelude(prev)
    }
  }, [prelude])

  return { prelude, loading, markViewed, dismiss }
}
