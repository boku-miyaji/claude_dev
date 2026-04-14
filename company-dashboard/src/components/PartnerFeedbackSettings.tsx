import { useCallback, useEffect, useState } from 'react'
import { Card, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import {
  CATEGORY_LABELS,
  type PartnerFeedback,
  type FeedbackCategory,
} from '@/lib/partnerFeedback'

interface PromptRuleRow {
  id: number
  category: string | null
  rule: string
  active: boolean
  created_at: string
}

const PROMOTION_THRESHOLD = 3

export function PartnerFeedbackSettings() {
  const [rows, setRows] = useState<PartnerFeedback[]>([])
  const [rules, setRules] = useState<PromptRuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'good' | 'correction'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [fbRes, rulesRes] = await Promise.all([
      supabase
        .from('ai_partner_feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('ai_partner_prompt_rules')
        .select('id, category, rule, active, created_at')
        .order('created_at', { ascending: false }),
    ])
    setRows((fbRes.data as PartnerFeedback[]) ?? [])
    setRules((rulesRes.data as PromptRuleRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleActive = async (id: number, next: boolean) => {
    const { error } = await supabase.from('ai_partner_feedback').update({ active: next }).eq('id', id)
    if (!error) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active: next } : r)))
  }

  const deleteRule = async (id: number) => {
    const { error } = await supabase.from('ai_partner_prompt_rules').update({ active: false }).eq('id', id)
    if (!error) setRules((prev) => prev.filter((r) => r.id !== id))
  }

  // Candidates for promotion: correction categories with ≥ threshold active, unpromoted rows
  const promotionCandidates = (() => {
    const byCat = new Map<FeedbackCategory, PartnerFeedback[]>()
    for (const r of rows) {
      if (r.feedback_type !== 'correction') continue
      if (!r.active || r.promoted || !r.category) continue
      const arr = byCat.get(r.category) ?? []
      arr.push(r)
      byCat.set(r.category, arr)
    }
    const out: { category: FeedbackCategory; items: PartnerFeedback[] }[] = []
    for (const [category, items] of byCat.entries()) {
      if (items.length >= PROMOTION_THRESHOLD) out.push({ category, items })
    }
    return out
  })()

  const promoteCategory = async (category: FeedbackCategory, items: PartnerFeedback[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Synthesize a rule from the recurring corrections
    const examples = items
      .slice(0, 5)
      .map((i) => `「${i.actual_output.substring(0, 60)}」→「${(i.desired_output ?? '').substring(0, 60)}」`)
      .join(' / ')
    const ruleText = `【${CATEGORY_LABELS[category]}】同じ失敗を繰り返さない。過去の修正: ${examples}`

    const { error: insertErr } = await supabase.from('ai_partner_prompt_rules').insert({
      user_id: user.id,
      category,
      rule: ruleText,
      source_feedback_ids: items.map((i) => i.id),
      active: true,
    })
    if (insertErr) {
      toast('昇格に失敗しました')
      return
    }
    // Deactivate source feedback so it's not double-weighted
    const ids = items.map((i) => i.id)
    await supabase
      .from('ai_partner_feedback')
      .update({ promoted: true, active: false })
      .in('id', ids)
    toast('恒久ルールに昇格しました')
    load()
  }

  const visible = rows.filter((r) => filter === 'all' || r.feedback_type === filter)

  return (
    <>
      <div className="section-title">AI Partner フィードバック</div>
      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          「👍 いい」「違う」で残したフィードバックの一覧。同じカテゴリで {PROMOTION_THRESHOLD} 件以上 correction が溜まると恒久ルールに昇格できます。
        </p>

        {promotionCandidates.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--accent-bg)', borderRadius: 8, border: '1px solid var(--accent-border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--accent2)' }}>
              昇格候補（{promotionCandidates.length} 件）
            </div>
            {promotionCandidates.map(({ category, items }) => (
              <div key={category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12 }}>
                  {CATEGORY_LABELS[category]} — {items.length} 件
                </span>
                <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => promoteCategory(category, items)}>
                  恒久ルールに昇格
                </button>
              </div>
            ))}
          </div>
        )}

        {rules.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              恒久ルール（{rules.length} 件）
            </div>
            {rules.map((r) => (
              <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', flex: 1, lineHeight: 1.5 }}>{r.rule}</div>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => deleteRule(r.id)}>削除</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['all', 'good', 'correction'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={filter === k ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              {k === 'all' ? 'すべて' : k === 'good' ? '👍' : '違う'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)', alignSelf: 'center' }}>
            {visible.length} 件
          </span>
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>読み込み中...</div>
        ) : visible.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>まだフィードバックがありません</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map((r) => (
              <div key={r.id} style={{ padding: 10, background: r.active ? 'var(--bg2)' : 'transparent', border: '1px solid var(--border)', borderRadius: 6, opacity: r.active ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {r.feedback_type === 'good' ? '👍' : '違う'} · {r.category ? CATEGORY_LABELS[r.category] : '(未分類)'} · {new Date(r.created_at).toLocaleDateString('ja-JP')}
                    {r.promoted && ' · 昇格済'}
                  </span>
                  <label style={{ fontSize: 10, color: 'var(--text3)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={r.active} onChange={(e) => toggleActive(r.id, e.target.checked)} style={{ marginRight: 4 }} />
                    有効
                  </label>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--text3)' }}>AI: </span>
                  {r.actual_output}
                </div>
                {r.desired_output && (
                  <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, marginTop: 3 }}>
                    <span style={{ color: 'var(--text3)' }}>本当は: </span>
                    {r.desired_output}
                  </div>
                )}
                {r.reason && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', marginTop: 3 }}>
                    理由: {r.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
