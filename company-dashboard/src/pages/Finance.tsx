import { useEffect, useState } from 'react'
import { PageHeader, Modal, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'

// ============================================================
// Utility helpers
// ============================================================

const fmtYen = (v: number) => '¥' + Math.round(v).toLocaleString()
const fmtDate = (s: string) => {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================
// Types
// ============================================================

interface Invoice { id: string; client_name: string; amount: number; invoice_date: string; paid_date?: string; due_date?: string; status: string; company_id?: string; file_url?: string; notes?: string; project_id?: string }
interface Expense { id: string; description: string; amount: number; expense_date: string; category: string; is_recurring?: boolean; recurring_status?: string; recurring_interval?: string; service_name?: string; is_deductible?: boolean }
interface Project { id: string; name: string; client_name: string; status: string; contract_type: string; default_rate?: number; budget?: number; start_date?: string; end_date?: string }
interface WishlistItem { id: string; title: string; amount: number; status: string; category?: string; priority?: string; url?: string; description?: string; purchased_at?: string }
interface TaxPayment { id: string; tax_type: string; due_date: string; amount: number; status: string }

// ============================================================
// Tax Calculator
// ============================================================

interface TaxResult {
  revenue: number; expense: number; income: number; taxableBase: number; taxableIncome: number
  incomeTax: number; reconstructionTax: number; residentTax: number; businessTax: number
  totalTax: number; takeHome: number
}

function calcTax(revenue: number, expense: number): TaxResult {
  const income = revenue - expense
  const blueDeduction = 650000
  const basicDeduction = 480000
  const taxableBase = Math.max(0, income - blueDeduction)
  const taxableIncome = Math.max(0, taxableBase - basicDeduction)
  const brackets: [number, number, number][] = [
    [1950000, 0.05, 0], [3300000, 0.10, 97500], [6950000, 0.20, 427500],
    [9000000, 0.23, 636000], [18000000, 0.33, 1536000], [40000000, 0.40, 2796000], [Infinity, 0.45, 4796000]
  ]
  let incomeTax = 0
  for (const [limit, rate, deduction] of brackets) {
    if (taxableIncome <= limit) { incomeTax = Math.floor(taxableIncome * rate - deduction); break }
  }
  const reconstructionTax = Math.floor(incomeTax * 0.021)
  const residentTax = Math.floor(taxableIncome * 0.10) + 5000
  const businessTax = income > 2900000 ? Math.floor((income - 2900000) * 0.05) : 0
  const totalTax = incomeTax + reconstructionTax + residentTax + businessTax
  const takeHome = revenue - expense - totalTax
  return { revenue, expense, income, taxableBase, taxableIncome, incomeTax, reconstructionTax, residentTax, businessTax, totalTax, takeHome }
}

// ============================================================
// Overview Tab
// ============================================================

const PROJ_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']

function FinOverview() {
  // viewDate represents the month being viewed (always day=1)
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [data, setData] = useState<{ invoices: Invoice[]; expenses: Expense[]; projects: Project[]; allInv: Invoice[]; allExp: Expense[]; recurSubs: Expense[]; wishItems: WishlistItem[]; apiCostTotal: number } | null>(null)

  useEffect(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth() + 1
    const ym = `${year}-${String(month).padStart(2, '0')}`
    const startOfMonth = `${ym}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endOfMonth = `${ym}-${String(lastDay).padStart(2, '0')}`
    const startOfYear = `${year}-01-01`
    const endOfYear = `${year}-12-31`

    setData(null)
    Promise.all([
      supabase.from('invoices').select('*').gte('invoice_date', startOfMonth).lte('invoice_date', endOfMonth),
      supabase.from('expenses').select('*').gte('expense_date', startOfMonth).lte('expense_date', endOfMonth),
      supabase.from('projects').select('*'),
      supabase.from('invoices').select('*').gte('invoice_date', startOfYear).lte('invoice_date', endOfYear),
      supabase.from('expenses').select('*').gte('expense_date', startOfYear).lte('expense_date', endOfYear),
      supabase.from('expenses').select('*').eq('is_recurring', true).eq('recurring_status', 'active'),
      supabase.from('wishlist').select('*').in('status', ['want', 'considering']),
      supabase.from('messages').select('cost_usd').eq('role', 'assistant').gte('created_at', startOfMonth).lte('created_at', endOfMonth + 'T23:59:59').not('cost_usd', 'is', null),
    ]).then(([invM, expM, proj, invY, expY, recur, wish, api]) => {
      const apiTotal = (api.data || []).reduce((s: number, m: { cost_usd: string }) => s + parseFloat(m.cost_usd || '0'), 0)
      setData({
        invoices: invM.data || [],
        expenses: (expM.data || []).filter(e => e.is_deductible !== false),
        projects: proj.data || [],
        allInv: invY.data || [],
        allExp: (expY.data || []).filter(e => e.is_deductible !== false),
        recurSubs: recur.data || [],
        wishItems: wish.data || [],
        apiCostTotal: apiTotal,
      })
    })
  }, [viewDate])

  if (!data) return <div className="skeleton-card" style={{ height: 200 }} />

  const { invoices, expenses, projects, allInv, allExp, recurSubs, wishItems, apiCostTotal } = data
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth() + 1
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const totalRev = invoices.reduce((s, i) => s + i.amount, 0)
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0)
  const grossProfit = totalRev - totalExp
  const yearRev = allInv.reduce((s, i) => s + i.amount, 0)
  const yearExp = allExp.reduce((s, e) => s + e.amount, 0)
  const monthlyFixed = recurSubs.filter(s => s.is_deductible !== false).reduce((sum, s) => {
    if (s.recurring_interval === 'yearly') return sum + Math.round(s.amount / 12)
    if (s.recurring_interval === 'quarterly') return sum + Math.round(s.amount / 3)
    return sum + s.amount
  }, 0)
  const wishTotal = wishItems.reduce((s, w) => s + w.amount, 0)

  const kpis = [
    { l: '売上', v: fmtYen(totalRev), c: 'var(--accent)', sub: `年計 ${fmtYen(yearRev)}` },
    { l: '経費', v: fmtYen(totalExp), c: 'var(--text3)', sub: `年計 ${fmtYen(yearExp)}` },
    { l: '粗利', v: fmtYen(grossProfit), c: grossProfit >= 0 ? '#22c55e' : '#ef4444', sub: `${totalRev > 0 ? Math.round(grossProfit / totalRev * 100) : 0}%` },
    { l: '固定費(経費分)', v: fmtYen(monthlyFixed), c: 'var(--amber)', sub: `年${fmtYen(monthlyFixed * 12)}` },
    { l: 'ほしい物', v: fmtYen(wishTotal), c: 'var(--blue)', sub: `${wishItems.length}件` },
    { l: 'APIコスト', v: `$${apiCostTotal.toFixed(2)}`, c: 'var(--amber)', sub: `${Math.round(apiCostTotal * 150)}円` },
  ]

  // Build project map for client-name resolution
  const projMap = new Map(projects.map(p => [p.id, p]))

  // Build stacked bar data: monthly revenue by client
  const clientNameOf = (inv: Invoice) => (inv.project_id && projMap.get(inv.project_id)?.client_name) || inv.client_name || '未割当'
  const clientSet = new Set<string>()
  allInv.forEach(inv => clientSet.add(clientNameOf(inv)))
  const clientKeys = Array.from(clientSet)

  const monthlyByClient: Record<number, { total: number; clients: Record<string, number> }> = {}
  for (let m = 1; m <= 12; m++) {
    monthlyByClient[m] = { total: 0, clients: {} }
    clientKeys.forEach(ck => { monthlyByClient[m].clients[ck] = 0 })
  }
  allInv.forEach(inv => {
    const mon = parseInt(inv.invoice_date.substring(5, 7))
    const name = clientNameOf(inv)
    monthlyByClient[mon].clients[name] += inv.amount
    monthlyByClient[mon].total += inv.amount
  })

  const maxMonthly = Math.max(...Object.values(monthlyByClient).map(d => d.total)) || 1
  const ovMonthSet = new Set(allInv.map(i => i.invoice_date.substring(0, 7)))
  const dataMonths = Math.max(ovMonthSet.size, 1)
  const avgRev = yearRev / dataMonths
  const fmtAxis = (v: number) => v >= 10000 ? `${Math.round(v / 10000)}万` : fmtYen(v)

  const navMonth = (dir: number) => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + dir, 1))

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navMonth(-1)}>◀</button>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, minWidth: 120 }}>{year}年{month}月{!isCurrentMonth && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8, fontWeight: 400 }}>(過去)</span>}</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => navMonth(1)} disabled={isCurrentMonth} style={{ opacity: isCurrentMonth ? 0.3 : 1 }}>▶</button>
        {!isCurrentMonth && <button className="btn btn-ghost btn-sm" onClick={() => setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))}>今月へ</button>}
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
        {kpis.map(d => (
          <div key={d.l} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>{d.l}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: d.c }}>{d.v}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{d.sub}</div>
          </div>
        ))}
      </div>

      {/* Monthly stacked chart by client */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{year}年 月別売上推移（クライアント別）</div>
          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text3)', flexWrap: 'wrap' }}>
            {clientKeys.map((ck, i) => (
              <span key={ck} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PROJ_COLORS[i % PROJ_COLORS.length] }} />
                {ck}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {/* Y-axis */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6, height: 160, fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
            <span>{fmtAxis(maxMonthly)}</span>
            <span>{fmtAxis(Math.round(maxMonthly / 2))}</span>
            <span>0</span>
          </div>
          {/* Bars */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', padding: '0 2px', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: `${avgRev / maxMonthly * 100}%`, left: 0, right: 0, borderTop: '1px dashed var(--text3)', opacity: 0.3, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: `calc(${avgRev / maxMonthly * 100}% + 2px)`, right: 2, fontSize: 8, color: 'var(--text3)', opacity: 0.5, pointerEvents: 'none' }}>平均</div>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(mi => {
              const md = monthlyByClient[mi]
              const isViewing = mi === month
              const isFutureRel = year === now.getFullYear() && mi > now.getMonth() + 1
              const tipParts = [`${mi}月: 合計${fmtYen(md.total)}`]
              clientKeys.forEach(ck => { if (md.clients[ck]) tipParts.push(`${ck}: ${fmtYen(md.clients[ck])}`) })

              return (
                <div key={mi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} title={tipParts.join('\n')}
                  onClick={() => setViewDate(new Date(year, mi - 1, 1))}>
                  {md.total > 0 && !isFutureRel && (
                    <div style={{ fontSize: 8, color: 'var(--text3)', marginBottom: 1, whiteSpace: 'nowrap' }}>
                      {md.total >= 1000000 ? `${Math.round(md.total / 10000)}万` : `${Math.round(md.total / 1000)}K`}
                    </div>
                  )}
                  <div style={{ width: '80%', maxWidth: 28, display: 'flex', flexDirection: 'column-reverse', height: 150, opacity: isFutureRel ? 0.15 : 1, outline: isViewing ? '2px solid var(--accent)' : 'none', outlineOffset: 1, borderRadius: 2 }}>
                    {clientKeys.map((ck, ci) => {
                      const val = md.clients[ck] || 0
                      if (val <= 0) return null
                      const segH = val / maxMonthly * 150
                      return <div key={ck} style={{ width: '100%', height: segH, background: PROJ_COLORS[ci % PROJ_COLORS.length], minHeight: 2 }} />
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Month labels */}
        <div style={{ display: 'flex', marginLeft: 40, marginTop: 4 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(ml => (
            <div key={ml} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: ml === month ? 'var(--accent)' : 'var(--text3)', fontWeight: ml === month ? 600 : 400 }}>{ml}月</div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>月平均売上: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{fmtYen(Math.round(avgRev))}</span></span>
          <span>年間予測: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{fmtYen(Math.round(avgRev * 12))}</span></span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Invoices Tab
// ============================================================

function InvoiceForm({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const [clientName, setClientName] = useState('')
  const [amount, setAmount] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().substring(0, 10))
  const [status, setStatus] = useState('sent')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!clientName.trim() || !amount) return
    setSaving(true)
    const { error } = await supabase.from('invoices').insert({ client_name: clientName.trim(), amount: parseInt(amount), invoice_date: invoiceDate, status })
    setSaving(false)
    if (error) { toast(`保存に失敗: ${error.message}`); return }
    toast('追加しました')
    onSave()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="請求書を追加"
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={saving || !clientName.trim() || !amount} onClick={save}>{saving ? '保存中...' : '追加'}</button>
          <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: '請求先', el: <input className="input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="クライアント名" autoFocus /> },
          { label: '金額（税込）', el: <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /> },
          { label: '請求日', el: <input className="input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /> },
          { label: 'ステータス', el: <select className="input" value={status} onChange={e => setStatus(e.target.value)}><option value="sent">送付済み</option><option value="paid">入金済み</option><option value="overdue">支払遅延</option><option value="draft">下書き</option><option value="cancelled">キャンセル</option></select> },
        ].map(({ label, el }) => (
          <div key={label}>
            <label style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'block' }}>{label}</label>
            {el}
          </div>
        ))}
      </div>
    </Modal>
  )
}

function FinInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    const res = await supabase.from('invoices').select('*').order('invoice_date', { ascending: false })
    setInvoices(res.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="skeleton-card" style={{ height: 150 }} />

  return (
    <div>
      <button className="btn btn-p btn-sm" style={{ marginBottom: 16 }} onClick={() => setShowForm(true)}>+ 請求書追加</button>

      {invoices.length === 0 ? (
        <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>請求書が未登録です。/invoice コマンドでPDFをアップロードしてください。</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['日付', '請求先', '金額', '入金日', 'ステータス'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 500 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px' }}>{fmtDate(inv.invoice_date)}</td>
                <td style={{ padding: '8px 12px' }}>{inv.client_name}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{fmtYen(inv.amount)}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{inv.paid_date ? fmtDate(inv.paid_date) : '-'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{inv.status || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && <InvoiceForm onSave={load} onClose={() => setShowForm(false)} />}
    </div>
  )
}

// ============================================================
// Expenses Tab
// ============================================================

const CAT_LABELS: Record<string, string> = {
  equipment: '機材', transportation: '交通費', communication: '通信費', office: '事務所',
  outsourcing: '外注', supplies: '消耗品', insurance: '保険', tax_payment: '税金',
  subscription: 'サブスク', education: '研修', entertainment: '交際費', other: '他'
}

function ExpenseForm({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10))
  const [category, setCategory] = useState('other')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!description.trim() || !amount) return
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({ description: description.trim(), amount: parseInt(amount), expense_date: expenseDate, category, is_deductible: true })
    setSaving(false)
    if (error) { toast(`保存に失敗: ${error.message}`); return }
    toast('追加しました')
    onSave()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="経費を追加"
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={saving || !description.trim() || !amount} onClick={save}>{saving ? '保存中...' : '追加'}</button>
          <button className="btn btn-ghost" onClick={onClose}>キャンセル</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: '内容', el: <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="経費の内容" autoFocus /> },
          { label: '金額（税込）', el: <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /> },
          { label: '支払日', el: <input className="input" type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} /> },
          { label: 'カテゴリ', el: <select className="input" value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> },
        ].map(({ label, el }) => (
          <div key={label}>
            <label style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'block' }}>{label}</label>
            {el}
          </div>
        ))}
      </div>
    </Modal>
  )
}

function FinExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    const res = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    setExpenses(res.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="skeleton-card" style={{ height: 150 }} />

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const byCat: Record<string, number> = {}
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount })

  return (
    <div>
      <button className="btn btn-p btn-sm" style={{ marginBottom: 16 }} onClick={() => setShowForm(true)}>+ 経費追加</button>

      {expenses.length === 0 ? (
        <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>経費が未登録です。/invoice expense で追加してください。</div>
      ) : (
        <>
          <div style={{ marginBottom: 20, fontSize: 14 }}>
            <span style={{ color: 'var(--text3)' }}>合計: </span>
            <span style={{ fontWeight: 600, fontSize: 18 }}>{fmtYen(monthTotal)}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map(cat => (
              <div key={cat} style={{ fontSize: 12, color: 'var(--text3)' }}>
                {CAT_LABELS[cat] || cat} <span style={{ fontWeight: 500, color: 'var(--text)' }}>{fmtYen(byCat[cat])} ({monthTotal > 0 ? Math.round(byCat[cat] / monthTotal * 100) : 0}%)</span>
              </div>
            ))}
          </div>
          {expenses.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div>
                <span>{e.description}</span>
                <span style={{ color: 'var(--text3)' }}> · {CAT_LABELS[e.category] || e.category}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ color: 'var(--text3)', fontSize: 12 }}>{fmtDate(e.expense_date)}</span>
                <span style={{ fontWeight: 600 }}>{fmtYen(e.amount)}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {showForm && <ExpenseForm onSave={load} onClose={() => setShowForm(false)} />}
    </div>
  )
}

// ============================================================
// Subscriptions Tab
// ============================================================

function FinSubscriptions() {
  const [subs, setSubs] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Expense | null>(null)

  const load = async () => {
    const res = await supabase.from('expenses').select('*').eq('is_recurring', true).order('recurring_status').order('amount', { ascending: false })
    setSubs(res.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="skeleton-card" style={{ height: 150 }} />

  const intervalLabels: Record<string, string> = { monthly: '月額', quarterly: '四半期', yearly: '年額' }
  const statusColors: Record<string, string> = { active: 'var(--green)', paused: 'var(--amber)', cancelled: 'var(--text3)' }
  const statusLabels: Record<string, string> = { active: '契約中', paused: '一時停止', cancelled: '解約済み' }
  const catColors: Record<string, string> = { subscription: '#5046e5', communication: '#2563eb', equipment: '#0d9f6e', office: '#d97706', outsourcing: '#dc2626', education: '#8b5cf6', insurance: '#06b6d4', other: '#6b7280', supplies: '#f59e0b', entertainment: '#ec4899', tax_payment: '#64748b', transportation: '#14b8a6' }

  const active = subs.filter(s => s.recurring_status === 'active')
  const toMonthly = (s: Expense) => s.recurring_interval === 'yearly' ? Math.round(s.amount / 12) : s.recurring_interval === 'quarterly' ? Math.round(s.amount / 3) : s.amount
  const monthlyTotal = active.reduce((sum, s) => sum + toMonthly(s), 0)
  const monthlyDeductible = active.filter(s => s.is_deductible !== false).reduce((sum, s) => sum + toMonthly(s), 0)
  const monthlyPrivate = monthlyTotal - monthlyDeductible

  const getMonthly = (s: Expense) => s.recurring_interval === 'yearly' ? Math.round(s.amount / 12) : s.recurring_interval === 'quarterly' ? Math.round(s.amount / 3) : s.amount
  const maxMonthly = Math.max(...subs.filter(s => s.recurring_status === 'active').map(getMonthly), 1)

  const saveForm = async (payload: Partial<Expense>) => {
    if (editItem) {
      await supabase.from('expenses').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('expenses').insert({ ...payload, expense_date: new Date().toISOString().substring(0, 10), is_recurring: true })
    }
    setShowForm(false); setEditItem(null); load()
  }

  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
        {[{ l: '月額合計', v: fmtYen(monthlyTotal), c: 'var(--accent)' }, { l: '内 経費', v: fmtYen(monthlyDeductible), c: 'var(--green)' }, { l: '内 プライベート', v: fmtYen(monthlyPrivate), c: 'var(--text3)' }, { l: '年額合計', v: fmtYen(monthlyTotal * 12), c: 'var(--text)' }, { l: '契約数', v: `${active.length}件`, c: 'var(--text2)' }].map(d => (
          <div key={d.l} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{d.l}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: d.c }}>{d.v}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-p btn-sm" style={{ marginBottom: 16 }} onClick={() => { setEditItem(null); setShowForm(true) }}>+ 固定費を追加</button>

      {subs.length === 0 ? (
        <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>固定費が未登録です。</div>
      ) : subs.map(s => {
        const monthlyAmt = getMonthly(s)
        const barPct = Math.round(monthlyAmt / maxMonthly * 100)
        const isCancelled = s.recurring_status === 'cancelled'
        return (
          <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13, opacity: isCancelled ? 0.35 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[s.recurring_status || ''] || 'var(--text3)', flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{s.service_name || s.description}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: 3 }}>{CAT_LABELS[s.category] || s.category}</span>
                {s.is_deductible === false && <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: 3, border: '1px dashed var(--border)' }}>プライベート</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', fontSize: 14 }}>{fmtYen(monthlyAmt)}/月</span>
                <button className="btn btn-g btn-sm" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => { setEditItem(s); setShowForm(true) }}>編集</button>
              </div>
            </div>
            {!isCancelled && (
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: catColors[s.category] || '#6b7280', borderRadius: 3 }} />
              </div>
            )}
            {s.recurring_interval !== 'monthly' && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{intervalLabels[s.recurring_interval || ''] || ''} {fmtYen(s.amount)}</div>}
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{statusLabels[s.recurring_status || ''] || ''}</div>
          </div>
        )
      })}

      {showForm && (
        <SubsForm
          existing={editItem}
          onSave={saveForm}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onDelete={async (id) => { await supabase.from('expenses').delete().eq('id', id); setShowForm(false); setEditItem(null); load() }}
        />
      )}
    </div>
  )
}

function SubsForm({ existing, onSave, onClose, onDelete }: { existing: Expense | null; onSave: (p: Partial<Expense>) => void; onClose: () => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState(existing?.service_name || existing?.description || '')
  const [amount, setAmount] = useState(String(existing?.amount || ''))
  const [interval, setInterval] = useState(existing?.recurring_interval || 'monthly')
  const [category, setCategory] = useState(existing?.category || 'subscription')
  const [status, setStatus] = useState(existing?.recurring_status || 'active')
  const [isDeductible, setIsDeductible] = useState(existing?.is_deductible !== false)

  const save = () => {
    if (!name || !amount) return
    onSave({ service_name: name, description: name, amount: parseInt(amount), category, is_recurring: true, recurring_interval: interval, recurring_status: status, is_deductible: isDeductible })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.3)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{existing ? '固定費を編集' : '固定費を追加'}</div>
        {[
          { label: 'サービス名', el: <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="ChatGPT Plus" /> },
          { label: '金額（税込）', el: <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} /> },
          { label: '支払い間隔', el: <select className="input" value={interval} onChange={e => setInterval(e.target.value)}><option value="monthly">月額</option><option value="quarterly">四半期</option><option value="yearly">年額</option></select> },
          { label: 'カテゴリ', el: <select className="input" value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> },
          { label: 'ステータス', el: <select className="input" value={status} onChange={e => setStatus(e.target.value)}><option value="active">契約中</option><option value="paused">一時停止</option><option value="cancelled">解約済み</option></select> },
          { label: '経費として計上', el: <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0' }}><input type="checkbox" checked={isDeductible} onChange={e => setIsDeductible(e.target.checked)} />{isDeductible ? '経費（確定申告で控除）' : 'プライベート支出'}</label> },
        ].map(({ label, el }) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2, display: 'block' }}>{label}</label>
            {el}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-p" onClick={save}>{existing ? '更新' : '追加'}</button>
          <button className="btn btn-g" onClick={onClose}>キャンセル</button>
          {existing && <button className="btn" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={() => { if (confirm('削除しますか？')) onDelete(existing.id) }}>削除</button>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Projects Tab
// ============================================================

function FinProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('projects').select('*').order('status').order('created_at').then(({ data }) => { setProjects(data || []); setLoading(false) })
  }, [])

  if (loading) return <div className="skeleton-card" style={{ height: 150 }} />
  if (projects.length === 0) return <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>案件が未登録です。/invoice project add で追加してください。</div>

  const statusLabels: Record<string, string> = { active: '稼働中', completed: '完了', paused: '中断', cancelled: '中止' }
  const typeLabels: Record<string, string> = { project: 'プロジェクト', monthly: '月額', hourly: '時間制', consulting: 'コンサル' }

  return (
    <div>
      {projects.map(p => {
        const statusColor = p.status === 'active' ? '#22c55e' : p.status === 'completed' ? 'var(--text3)' : '#f59e0b'
        return (
          <div key={p.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {p.name}<span style={{ color: 'var(--text3)', fontWeight: 400 }}> · {p.client_name}</span>
              </div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${statusColor}20`, color: statusColor }}>{statusLabels[p.status] || p.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text3)' }}>
              <span>{typeLabels[p.contract_type] || p.contract_type}</span>
              {p.default_rate && <span>目標: {fmtYen(p.default_rate)}/h</span>}
              {p.budget && <span>予算: {fmtYen(p.budget)}</span>}
              {p.start_date && <span>{fmtDate(p.start_date)}〜{p.end_date ? fmtDate(p.end_date) : ''}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// Wishlist Tab
// ============================================================

function FinWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<WishlistItem | null>(null)

  const load = async () => {
    const res = await supabase.from('wishlist').select('*').order('priority').order('created_at', { ascending: false })
    setItems(res.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="skeleton-card" style={{ height: 150 }} />

  const statusLabels: Record<string, string> = { want: '欲しい', considering: '検討中', purchased: '購入済', dropped: '見送り' }
  const statusColors: Record<string, string> = { want: 'var(--accent)', considering: 'var(--amber)', purchased: 'var(--green)', dropped: 'var(--text3)' }
  const catLabels: Record<string, string> = { equipment: '機材', software: 'ソフトウェア', furniture: '家具', experience: '体験', book: '本', gadget: 'ガジェット', other: 'その他' }
  const active = items.filter(i => i.status === 'want' || i.status === 'considering')
  const totalWant = active.reduce((s, i) => s + i.amount, 0)
  const maxAmt = items.length > 0 ? Math.max(...items.map(i => i.amount), 1) : 1

  const saveWish = async (payload: Partial<WishlistItem>) => {
    if (editItem) {
      if (payload.status === 'purchased' && editItem.status !== 'purchased') payload.purchased_at = new Date().toISOString()
      await supabase.from('wishlist').update(payload).eq('id', editItem.id)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast('ログインが必要です'); return }
      await supabase.from('wishlist').insert({ ...payload, owner_id: user.id })
    }
    setShowForm(false); setEditItem(null); load()
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        {[{ l: 'ほしい物合計', v: fmtYen(totalWant), c: 'var(--accent)' }, { l: 'アイテム数', v: `${active.length}件`, c: 'var(--text)' }, { l: '購入済み', v: `${items.filter(i => i.status === 'purchased').length}件`, c: 'var(--green)' }].map(d => (
          <div key={d.l} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{d.l}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: d.c }}>{d.v}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-p btn-sm" style={{ marginBottom: 16 }} onClick={() => { setEditItem(null); setShowForm(true) }}>+ ほしい物を追加</button>
      {items.length === 0 && <div style={{ color: 'var(--text3)', padding: '40px 0', textAlign: 'center' }}>ほしい物リストが空です。</div>}
      {items.map(item => {
        const isDropped = item.status === 'dropped'
        const isPurchased = item.status === 'purchased'
        const barPct = Math.round(item.amount / maxAmt * 100)
        return (
          <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', opacity: isDropped ? 0.35 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[item.status] || 'var(--text3)', flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: 13, textDecoration: isPurchased ? 'line-through' : undefined, color: isPurchased ? 'var(--text3)' : undefined }}>{item.title}</span>
                {item.category && item.category !== 'other' && <span style={{ fontSize: 10, color: 'var(--text3)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: 3 }}>{catLabels[item.category] || item.category}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: 15, color: item.amount >= 100000 ? 'var(--red)' : item.amount >= 30000 ? 'var(--amber)' : 'var(--text)' }}>{fmtYen(item.amount)}</span>
                <button className="btn btn-g btn-sm" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => { setEditItem(item); setShowForm(true) }}>編集</button>
              </div>
            </div>
            {!isDropped && !isPurchased && (
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', marginBottom: 2 }}>
                <div style={{ height: '100%', width: `${barPct}%`, background: statusColors[item.status] || 'var(--accent)', borderRadius: 3 }} />
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>{statusLabels[item.status] || item.status}{item.url ? ' · リンクあり' : ''}</div>
          </div>
        )
      })}
      {showForm && (
        <WishForm existing={editItem} onSave={saveWish} onClose={() => { setShowForm(false); setEditItem(null) }} onDelete={async (id) => { await supabase.from('wishlist').delete().eq('id', id); setShowForm(false); setEditItem(null); load() }} catLabels={catLabels} />
      )}
    </div>
  )
}

function WishForm({ existing, onSave, onClose, onDelete, catLabels }: { existing: WishlistItem | null; onSave: (p: Partial<WishlistItem>) => void; onClose: () => void; onDelete: (id: string) => void; catLabels: Record<string, string> }) {
  const [name, setName] = useState(existing?.title || '')
  const [amount, setAmount] = useState(String(existing?.amount || ''))
  const [url, setUrl] = useState(existing?.url || '')
  const [desc, setDesc] = useState(existing?.description || '')
  const [category, setCategory] = useState(existing?.category || 'other')
  const [priority, setPriority] = useState(existing?.priority || 'normal')
  const [status, setStatus] = useState(existing?.status || 'want')

  const save = () => {
    if (!name) return
    const payload: Partial<WishlistItem> = { title: name, amount: parseInt(amount) || 0, url: url.trim() || undefined, description: desc.trim() || undefined, category, priority }
    if (existing) payload.status = status
    onSave(payload)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.3)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{existing ? 'ほしい物を編集' : 'ほしい物を追加'}</div>
        {[
          { label: 'アイテム名', el: <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="何がほしい？" /> },
          { label: '金額（税込）', el: <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} /> },
          { label: 'URL', el: <input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="商品URL（任意）" /> },
          { label: 'メモ', el: <textarea className="input" value={desc} onChange={e => setDesc(e.target.value)} style={{ minHeight: 40 }} /> },
          { label: 'カテゴリ', el: <select className="input" value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(catLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> },
          { label: '優先度', el: <select className="input" value={priority} onChange={e => setPriority(e.target.value)}><option value="high">高</option><option value="normal">中</option><option value="low">低</option></select> },
          ...(existing ? [{ label: 'ステータス', el: <select className="input" value={status} onChange={e => setStatus(e.target.value)}><option value="want">欲しい</option><option value="considering">検討中</option><option value="purchased">購入済み</option><option value="dropped">見送り</option></select> }] : []),
        ].map(({ label, el }) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2, display: 'block' }}>{label}</label>
            {el}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-p" onClick={save}>{existing ? '更新' : '追加'}</button>
          <button className="btn btn-g" onClick={onClose}>キャンセル</button>
          {existing && <button className="btn" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={() => { if (confirm('削除しますか？')) onDelete(existing.id) }}>削除</button>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Tax Tab
// ============================================================

function FinTax() {
  const year = new Date().getFullYear()
  const [projectedRevenue, setProjectedRevenue] = useState(0)
  const [actualRevQ, setActualRevQ] = useState(0)
  const [monthsWithData, setMonthsWithData] = useState(1)
  const [payments, setPayments] = useState<TaxPayment[]>([])
  const [simRev, setSimRev] = useState(0)
  const [simExp, setSimExp] = useState(0)
  const [showDetail, setShowDetail] = useState(false)
  const [showAssumptions, setShowAssumptions] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('invoices').select('amount,invoice_date').gte('invoice_date', `${year}-01-01`).lte('invoice_date', `${year}-12-31`),
      supabase.from('expenses').select('amount,expense_date').gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`),
      supabase.from('tax_payments').select('*').order('due_date'),
    ]).then(([invRes, , taxRes]) => {
      const invoices = invRes.data || []
      const rev = invoices.reduce((s: number, i: { amount: number }) => s + i.amount, 0)
      setActualRevQ(rev)
      const invMonthSet: Record<string, boolean> = {}
      invoices.forEach((i: { invoice_date: string }) => { invMonthSet[i.invoice_date.substring(0, 7)] = true })
      const mwd = Math.max(Object.keys(invMonthSet).length, 1)
      setMonthsWithData(mwd)
      const projected = Math.round(rev / mwd * 12)
      setProjectedRevenue(projected)
      setSimRev(projected)
      setPayments(taxRes.data || [])
      setLoaded(true)
    })
  }, [year])

  if (!loaded) return <div className="skeleton-card" style={{ height: 200 }} />

  const t = calcTax(simRev, simExp)
  const now = new Date()
  const ny = year + 1
  const estimatedPer = Math.round((t.incomeTax + t.reconstructionTax) / 3)
  const schedule = [
    { label: '所得税 確定申告', sub: `${year}年度分`, due: `${ny}-03-15`, amount: t.incomeTax + t.reconstructionTax, type: 'income_tax' },
    { label: '住民税 1期', sub: `${year}年度分`, due: `${ny}-06-30`, amount: Math.ceil(t.residentTax / 4), type: 'resident_tax' },
    { label: '予定納税 1期', sub: `${ny}年度前払い`, due: `${ny}-07-31`, amount: estimatedPer, type: 'estimated_tax' },
    { label: '個人事業税 1期', sub: `${year}年度分`, due: `${ny}-08-31`, amount: Math.ceil(t.businessTax / 2), type: 'business_tax' },
    { label: '住民税 2期', sub: `${year}年度分`, due: `${ny}-08-31`, amount: Math.ceil(t.residentTax / 4), type: 'resident_tax' },
    { label: '住民税 3期', sub: `${year}年度分`, due: `${ny}-10-31`, amount: Math.ceil(t.residentTax / 4), type: 'resident_tax' },
    { label: '予定納税 2期', sub: `${ny}年度前払い`, due: `${ny}-11-30`, amount: estimatedPer, type: 'estimated_tax' },
    { label: '個人事業税 2期', sub: `${year}年度分`, due: `${ny}-11-30`, amount: Math.floor(t.businessTax / 2), type: 'business_tax' },
    { label: '住民税 4期', sub: `${year}年度分`, due: `${ny + 1}-01-31`, amount: Math.floor(t.residentTax / 4), type: 'resident_tax' },
  ].filter(s => s.amount > 0)

  const paidMap: Record<string, TaxPayment> = {}
  payments.forEach(p => { if (p.status === 'paid') paidMap[`${p.tax_type}_${p.due_date}`] = p })

  const schedTotal = schedule.reduce((s, p) => s + p.amount, 0)
  let schedPaid = 0

  const typeColors: Record<string, string> = { income_tax: '#ef4444', resident_tax: '#f59e0b', business_tax: '#8b5cf6', estimated_tax: '#3b82f6' }
  const monthlyReserve = Math.ceil(t.totalTax / 12)
  const effRate = t.revenue > 0 ? (t.totalTax / t.revenue * 100).toFixed(1) : '0'

  return (
    <div>
      {/* Simulation */}
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>税金シミュレーション</h3>

      <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', marginBottom: 16 }} onClick={() => setShowAssumptions(v => !v)}>
        計算の前提条件 {showAssumptions ? '▾' : '▸'}
      </button>
      {showAssumptions && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 12, lineHeight: 1.8, color: 'var(--text2)' }}>
          {[
            ['申告区分', '個人事業主・青色申告（e-Tax）'],
            ['青色申告特別控除', '65万円'],
            ['基礎控除', '48万円'],
            ['所得税率', '累進課税 5%〜45%'],
            ['住民税', '課税所得 × 10% + 均等割 5,000円'],
            ['個人事業税', '（事業所得 - 290万円）× 5%'],
            ['年間売上の予測', `請求書データ ${monthsWithData}ヶ月分から12ヶ月に按分（${fmtYen(actualRevQ)} ÷ ${monthsWithData} × 12）`],
            ['注意', 'あくまで概算です。正確な税額は税理士にご確認ください'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ minWidth: 130, color: 'var(--text3)', flexShrink: 0, fontWeight: 500 }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Input controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: 'var(--text2)', minWidth: 120 }}>年間売上（税抜）</label>
        <input type="number" value={simRev} onChange={e => setSimRev(parseInt(e.target.value) || 0)} style={{ width: 160, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text)' }} />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>({fmtYen(projectedRevenue)} 予測)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <label style={{ fontSize: 13, color: 'var(--text2)', minWidth: 120 }}>年間経費</label>
        <input type="number" value={simExp} onChange={e => setSimExp(parseInt(e.target.value) || 0)} style={{ width: 160, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, fontFamily: 'var(--font)', background: 'var(--bg2)', color: 'var(--text)' }} />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtYen(simExp)}</span>
      </div>
      <div style={{ paddingLeft: 132, marginBottom: 4 }}>
        <input type="range" min={0} max={Math.max(simRev, 5000000)} step={10000} value={simExp} onChange={e => setSimExp(parseInt(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)', width: '100%' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, paddingLeft: 132, flexWrap: 'wrap' }}>
        {[0, 500000, 1000000, 2000000, 3000000, 5000000].map(v => (
          <button key={v} style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg2)', color: 'var(--text2)', fontSize: 11, cursor: 'pointer' }} onClick={() => setSimExp(v)}>
            {v === 0 ? '¥0' : `¥${Math.round(v / 10000)}万`}
          </button>
        ))}
      </div>

      {/* Reserve card */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>月次税金積立ガイド</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{year}年度 想定売上 {fmtYen(simRev)} / 経費 {fmtYen(simExp)}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 16, marginBottom: 20 }}>
          {[
            { l: '毎月の積立目安', v: `${fmtYen(monthlyReserve)}/月`, c: '#f59e0b', sub: `税金合計 ${fmtYen(t.totalTax)} ÷ 12` },
            { l: 'ここまでの積立目標', v: fmtYen(monthlyReserve * monthsWithData), c: '#3b82f6', sub: `売上実績 ${monthsWithData}ヶ月分` },
            { l: '月の手取り目安', v: fmtYen(Math.floor(t.takeHome / 12)), c: '#22c55e', sub: '売上 - 経費 - 税金' },
            { l: '実効税率', v: `${effRate}%`, c: '#ef4444', sub: '税金合計 ÷ 売上' },
          ].map(d => (
            <div key={d.l} style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>{d.l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: d.c }}>{d.v}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{d.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.15)', fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(245,158,11,.15)' }}>RESERVE</span>
          <span>毎月の売上から {fmtYen(monthlyReserve)} を税金用口座に確保してください。</span>
        </div>
      </div>

      {/* KPI breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: '課税所得', val: fmtYen(t.taxableIncome), color: 'var(--text)' },
          { label: '所得税+復興税', val: fmtYen(t.incomeTax + t.reconstructionTax), color: '#ef4444' },
          { label: '住民税', val: fmtYen(t.residentTax), color: '#f59e0b' },
          { label: '事業税', val: fmtYen(t.businessTax), color: '#8b5cf6' },
          { label: '税金合計', val: fmtYen(t.totalTax), color: '#ef4444' },
          { label: '手取り', val: fmtYen(t.takeHome), color: '#22c55e' },
        ].map(k => (
          <div key={k.label} style={{ padding: 14, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Collapsible detail */}
      <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: 'var(--text3)', cursor: 'pointer', marginBottom: 12 }} onClick={() => setShowDetail(v => !v)}>
        {showDetail ? '計算詳細を隠す' : '計算詳細を表示'}
      </button>
      {showDetail && (
        <div style={{ fontSize: 13, marginBottom: 24 }}>
          {[
            ['売上（税抜）', fmtYen(t.revenue), ''],
            ['経費', `- ${fmtYen(t.expense)}`, ''],
            ['事業所得', fmtYen(t.income), ''],
            ['青色申告特別控除', '- ¥650,000', ''],
            ['基礎控除', '- ¥480,000', ''],
            ['課税所得', fmtYen(t.taxableIncome), 'font-weight:600'],
            ['所得税', fmtYen(t.incomeTax), ''],
            ['復興特別所得税', fmtYen(t.reconstructionTax), ''],
            ['住民税', fmtYen(t.residentTax), ''],
            ['個人事業税', fmtYen(t.businessTax), ''],
            ['税金合計', fmtYen(t.totalTax), 'color:#ef4444;font-weight:600'],
            ['実効税率', `${effRate}%`, 'color:var(--text3)'],
            ['手取り', fmtYen(t.takeHome), 'color:#22c55e;font-weight:600'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text2)' }}>{k}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Payment schedule */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>納付スケジュール（自動計算）</h3>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>想定売上 {fmtYen(simRev)} / 想定経費 {fmtYen(simExp)} から算出。上の入力を変えると連動します。</div>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{year}年度の所得に対する税金</h4>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>合計: {fmtYen(schedTotal)}</div>
        </div>
        {schedule.map(s => {
          const isPaid = !!paidMap[`${s.type}_${s.due}`]
          if (isPaid) schedPaid += s.amount
          const daysLeft = Math.ceil((new Date(s.due).getTime() - now.getTime()) / 86400000)
          const sc = isPaid ? '#22c55e' : (new Date(s.due) < now ? '#ef4444' : typeColors[s.type] || '#3b82f6')
          const statusText = isPaid ? '支払済' : (new Date(s.due) < now ? '期限超過' : '予定')
          return (
            <div key={`${s.type}_${s.due}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{s.sub}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ color: 'var(--text3)', fontSize: 12 }}>{fmtDate(s.due)}{!isPaid && daysLeft > 0 ? ` (${daysLeft}日後)` : ''}</span>
                <span style={{ fontWeight: 600, minWidth: 100, textAlign: 'right' }}>{fmtYen(s.amount)}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${sc}20`, color: sc, minWidth: 55, textAlign: 'center' }}>{statusText}</span>
              </div>
            </div>
          )
        })}
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--text3)' }}>支払済: {fmtYen(schedPaid)} / {fmtYen(schedTotal)}</span>
          <span style={{ fontWeight: 600, color: '#ef4444' }}>残り: {fmtYen(schedTotal - schedPaid)}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Rules Tab (経費ルール・日々の処理フロー)
// ============================================================

type PaymentMethod = 'biz_card' | 'personal_card' | 'paypay' | 'cash' | 'bank_transfer'
type ReceiptForm = 'electronic' | 'paper' | 'none'
type Frequency = 'one_time' | 'recurring'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  biz_card: '事業用クレカ',
  personal_card: '個人用クレカ',
  paypay: 'PayPay',
  cash: '現金',
  bank_transfer: '銀行振込',
}
const RECEIPT_LABELS: Record<ReceiptForm, string> = {
  electronic: '電子（PDF/メール/サイトDL）',
  paper: '紙レシート',
  none: '領収書なし',
}
const FREQ_LABELS: Record<Frequency, string> = { one_time: '単発', recurring: '定期（月次/年次）' }

interface QuickRow { method: PaymentMethod; ledger: string; receipt: string; note: string }

const QUICK_TABLE: QuickRow[] = [
  { method: 'biz_card', ledger: '自動連携', receipt: '電子PDF保存', note: 'ほぼ放置OK。月次でカテゴリのみ確認' },
  { method: 'personal_card', ledger: '手動', receipt: '電子PDF保存', note: '「事業主借」で仕訳。月次まとめが楽' },
  { method: 'paypay', ledger: '連携可（要設定）', receipt: 'アプリ履歴DL + CSV保存', note: 'MFでPayPay連携を有効化。領収書はアプリから取得' },
  { method: 'cash', ledger: '手動（出納帳）', receipt: 'レシート撮影（AI-OCR）', note: '7日以内処理。原本は7年保管' },
  { method: 'bank_transfer', ledger: '自動連携', receipt: '電子明細PDF保存', note: '振込明細をMFに連携。手動入力不要' },
]

interface JudgeAction { label: string; severity: 'ok' | 'action' | 'warn' }

function judgeActions(method: PaymentMethod, receipt: ReceiptForm, freq: Frequency): JudgeAction[] {
  const a: JudgeAction[] = []

  // 帳簿入力
  if (method === 'biz_card' || method === 'bank_transfer') {
    a.push({ label: 'MFクラウドが自動取込 → カテゴリと勘定科目だけ確認', severity: 'ok' })
  } else if (method === 'personal_card') {
    a.push({ label: 'MFクラウドで「事業主借」として手動仕訳を入力', severity: 'action' })
    a.push({ label: '事業用カードに切り替えられないか都度検討', severity: 'warn' })
  } else if (method === 'paypay') {
    a.push({ label: 'MFクラウドのPayPay連携で自動取込（未設定なら設定）', severity: 'action' })
  } else if (method === 'cash') {
    a.push({ label: 'MFクラウドの現金出納帳に手動入力（日付・金額・摘要）', severity: 'action' })
  }

  // 証憑保管
  if (receipt === 'electronic') {
    a.push({ label: 'PDF/メールを証憑フォルダに保存（例: 2026-04-22_取引先_金額.pdf）', severity: 'action' })
    a.push({ label: '電帳法: 電子取引データは電子保存義務。印刷保存は不可', severity: 'warn' })
  } else if (receipt === 'paper') {
    a.push({ label: 'MFクラウドアプリでレシート撮影 → AI-OCRで自動仕訳候補', severity: 'action' })
    a.push({ label: '紙原本は7年保管（スキャナ保存の真実性要件を満たせば破棄可）', severity: 'warn' })
  } else {
    a.push({ label: '出金伝票を作成: 日付・金額・摘要・相手先を記録', severity: 'warn' })
  }

  // 定期
  if (freq === 'recurring') {
    a.push({ label: 'focus-you の「固定費」タブにも登録（月次支出を可視化）', severity: 'action' })
  }

  return a
}

function SeverityBadge({ severity }: { severity: JudgeAction['severity'] }) {
  const map = {
    ok: { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e', label: 'OK' },
    action: { bg: 'rgba(99,102,241,0.12)', fg: '#6366f1', label: 'やる' },
    warn: { bg: 'rgba(245,158,11,0.14)', fg: '#f59e0b', label: '注意' },
  } as const
  const s = map[severity]
  return (
    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.fg, letterSpacing: 0.5, minWidth: 40, textAlign: 'center' }}>
      {s.label}
    </span>
  )
}

function ChoiceRow<T extends string>({ value, setValue, options, labels }: { value: T; setValue: (v: T) => void; options: readonly T[]; labels: Record<T, string> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => setValue(opt)}
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 8,
            border: `1px solid ${value === opt ? 'var(--accent)' : 'var(--border)'}`,
            background: value === opt ? 'var(--accent)' : 'var(--surface2)',
            color: value === opt ? '#fff' : 'var(--text)',
            cursor: 'pointer',
            transition: 'all .15s',
            fontFamily: 'var(--font)',
          }}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}

function FinRules() {
  const [method, setMethod] = useState<PaymentMethod>('biz_card')
  const [receipt, setReceipt] = useState<ReceiptForm>('electronic')
  const [freq, setFreq] = useState<Frequency>('one_time')
  const actions = judgeActions(method, receipt, freq)

  const paymentOpts = ['biz_card', 'personal_card', 'paypay', 'cash', 'bank_transfer'] as const
  const receiptOpts = ['electronic', 'paper', 'none'] as const
  const freqOpts = ['one_time', 'recurring'] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. クイック早見表 */}
      <section style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>早見表: 支払い方法別にやること</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text3)' }}>基本原則 — MFクラウドをマスター帳簿に、証憑は電子で一括保管、月末に締める</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                {['支払い手段', '帳簿入力', '証憑保管', '特記事項'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QUICK_TABLE.map(row => (
                <tr key={row.method} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{PAYMENT_LABELS[row.method]}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{row.ledger}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{row.receipt}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text3)', lineHeight: 1.6 }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. 判定ウィザード */}
      <section style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>判定: いま何すべき？</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text3)' }}>条件を3つ選ぶと、今日やることが出ます</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: 0.3 }}>支払い方法</div>
            <ChoiceRow value={method} setValue={setMethod} options={paymentOpts} labels={PAYMENT_LABELS} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: 0.3 }}>領収書の形式</div>
            <ChoiceRow value={receipt} setValue={setReceipt} options={receiptOpts} labels={RECEIPT_LABELS} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: 0.3 }}>頻度</div>
            <ChoiceRow value={freq} setValue={setFreq} options={freqOpts} labels={FREQ_LABELS} />
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 10, letterSpacing: 0.3 }}>やることリスト</div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {actions.map((a, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>
                <SeverityBadge severity={a.severity} />
                <span>{a.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. 電帳法ミニガイド */}
      <section style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>電子帳簿保存法（電帳法）の最低ライン</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text3)' }}>2024年1月から完全適用。MFクラウド パーソナルプランの証憑保管機能で要件は満たせる</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { t: '電子取引は電子保存', d: 'ネット通販・クレカ明細・PayPay領収書など。印刷して紙保存は不可' },
            { t: '検索性3点セット', d: '日付・金額・取引先で検索できる状態にしておく' },
            { t: '保管期間', d: '7年間（青色で欠損金繰越する場合は10年）' },
            { t: '真実性の確保', d: 'タイムスタンプ付与 or 訂正削除履歴が残るシステムで保管（MFは対応）' },
          ].map(item => (
            <div key={item.t} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{item.t}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.55 }}>{item.d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ============================================================
// ApiCosts (embedded shortcut)
// ============================================================

import { ApiCosts } from './ApiCosts'

// ============================================================
// Main Finance Component
// ============================================================

const TABS = ['overview', 'rules', 'subscriptions', 'wishlist', 'api-costs', 'projects', 'invoices', 'expenses', 'tax'] as const
type TabId = typeof TABS[number]
const TAB_LABELS: Record<TabId, string> = { overview: '概要', rules: '経費ルール', subscriptions: '固定費', wishlist: 'ほしい物', 'api-costs': 'APIコスト', projects: '案件', invoices: '請求書', expenses: '経費', tax: '税金' }

export function Finance() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const q = qs?.get('tab')
    return (q && (TABS as readonly string[]).includes(q) ? (q as TabId) : 'overview')
  })

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <FinOverview />
      case 'rules': return <FinRules />
      case 'subscriptions': return <FinSubscriptions />
      case 'wishlist': return <FinWishlist />
      case 'api-costs': return <ApiCosts />
      case 'projects': return <FinProjects />
      case 'invoices': return <FinInvoices />
      case 'expenses': return <FinExpenses />
      case 'tax': return <FinTax />
    }
  }

  return (
    <div className="page">
      <PageHeader title="Finance" description="売上・経費・稼働時間・税金の管理" />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, margin: '24px 0 20px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            style={{ background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 500, borderBottom: tab === activeTab ? '2px solid var(--accent)' : '2px solid transparent', color: tab === activeTab ? 'var(--text)' : 'var(--text3)', transition: 'all .2s', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  )
}
