import { useEffect, useState } from 'react'
import { Card, PageHeader, toast } from '@/components/ui'
import { supabase } from '@/lib/supabase'

/**
 * Basic profile page. All fields are optional, but the more you fill in,
 * the more specific the AI's suggestions become (trip ideas, transit lookup,
 * food recommendations, etc.). The card at the top explains this trade-off.
 *
 * Stored in the same `user_settings` row as AI chat preferences.
 */

interface ProfileForm {
  home_station: string
  home_area: string
  home_address: string
  birth_year: string
  family_structure: string
  chat_occupation: string
  hobbies: string
  travel_style: string
  food_preferences: string
  budget_note: string
  health_notes: string
  basic_info_freetext: string
}

const EMPTY: ProfileForm = {
  home_station: '',
  home_area: '',
  home_address: '',
  birth_year: '',
  family_structure: '',
  chat_occupation: '',
  hobbies: '',
  travel_style: '',
  food_preferences: '',
  budget_note: '',
  health_notes: '',
  basic_info_freetext: '',
}

export function BasicInfo() {
  const [form, setForm] = useState<ProfileForm>(EMPTY)
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      setUserId(session.user.id)
      const { data } = await supabase
        .from('user_settings')
        .select('home_station, home_area, home_address, birth_year, family_structure, chat_occupation, hobbies, travel_style, food_preferences, budget_note, health_notes, basic_info_freetext')
        .eq('user_id', session.user.id)
        .single()
      if (data) {
        setForm({
          home_station: data.home_station ?? '',
          home_area: data.home_area ?? '',
          home_address: data.home_address ?? '',
          birth_year: data.birth_year ? String(data.birth_year) : '',
          family_structure: data.family_structure ?? '',
          chat_occupation: data.chat_occupation ?? '',
          hobbies: data.hobbies ?? '',
          travel_style: data.travel_style ?? '',
          food_preferences: data.food_preferences ?? '',
          budget_note: data.budget_note ?? '',
          health_notes: data.health_notes ?? '',
          basic_info_freetext: data.basic_info_freetext ?? '',
        })
      }
      setLoading(false)
    })()
  }, [])

  const update = (key: keyof ProfileForm, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const save = async () => {
    if (!userId || saving) return
    setSaving(true)
    const payload: Record<string, unknown> = { ...form }
    // birth_year is stored as integer; convert or null
    if (form.birth_year && /^\d{4}$/.test(form.birth_year.trim())) {
      payload.birth_year = parseInt(form.birth_year.trim(), 10)
    } else {
      payload.birth_year = null
    }
    const { error } = await supabase.from('user_settings').update(payload).eq('user_id', userId)
    setSaving(false)
    if (error) {
      toast('保存に失敗しました')
      return
    }
    toast('基本情報を保存しました')
  }

  const filledCount = Object.values(form).filter((v) => v.trim()).length
  const totalCount = Object.keys(form).length
  const suggestionQuality = filledCount === 0 ? 'ざっくり' : filledCount < 4 ? '標準' : filledCount < 8 ? '具体的' : 'パーソナル'

  if (loading) return <div className="page"><PageHeader title="基本情報" /></div>

  return (
    <div className="page">
      <PageHeader title="基本情報" />

      <Card style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>
          すべて任意です。入力すればするほど、AIの提案（旅行先、乗換、ランチ、作業時間の推論など）があなた向けに具体化されます。
        </p>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text3)' }}>
          <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(filledCount / totalCount) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width .3s' }} />
          </div>
          <span>{filledCount}/{totalCount} 入力</span>
          <span style={{ fontWeight: 600, color: 'var(--text2)' }}>→ 提案の粒度: {suggestionQuality}</span>
        </div>
      </Card>

      <Section title="拠点・住所" hint="乗換検索や近場/遠出の判定に使います。最寄り駅だけでも十分機能します。">
        <Field label="最寄り駅" value={form.home_station} onChange={(v) => update('home_station', v)} placeholder="例: 渋谷、東京、品川" />
        <Field label="エリア" value={form.home_area} onChange={(v) => update('home_area', v)} placeholder="例: 東京都、大阪府、札幌" />
        <Field label="詳細住所（任意）" value={form.home_address} onChange={(v) => update('home_address', v)} placeholder="徒歩圏の提案に使います。番地までは不要" />
      </Section>

      <Section title="自分について" hint="年齢層や家族構成から、タスクの優先度や時間帯の提案が変わります。">
        <Field label="生まれ年" value={form.birth_year} onChange={(v) => update('birth_year', v)} placeholder="例: 1990" />
        <Field label="職業・役割" value={form.chat_occupation} onChange={(v) => update('chat_occupation', v)} placeholder="例: AI開発者、フリーランス、経営者" />
        <Field label="家族構成" value={form.family_structure} onChange={(v) => update('family_structure', v)} placeholder="例: 独身、夫婦+子1（5歳）、実家暮らし" />
      </Section>

      <Section title="好み・スタイル" hint="旅行先やランチの候補、予算の目安に使われます。">
        <Field label="趣味・好きなこと" value={form.hobbies} onChange={(v) => update('hobbies', v)} placeholder="例: 釣り、登山、料理、AI、温泉、読書" textarea />
        <Field label="旅行スタイル" value={form.travel_style} onChange={(v) => update('travel_style', v)} placeholder="例: 自然でゆっくり / アクティブに観光 / グルメ重視" />
        <Field label="食の好み・制限" value={form.food_preferences} onChange={(v) => update('food_preferences', v)} placeholder="例: アレルギーなし、辛いもの苦手、魚介好き" />
        <Field label="予算感" value={form.budget_note} onChange={(v) => update('budget_note', v)} placeholder="例: 週末旅行は3万、ランチは1500円まで" />
      </Section>

      <Section title="その他" hint="AIに伝えておきたい個人的な事情があればここに。">
        <Field label="健康・体調メモ" value={form.health_notes} onChange={(v) => update('health_notes', v)} placeholder="例: 朝型、夜は集中できない、腰痛あり" textarea />
        <Field label="自由記述" value={form.basic_info_freetext} onChange={(v) => update('basic_info_freetext', v)} placeholder="AIに知っておいてほしいその他のこと" textarea />
      </Section>

      <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving || !userId}>
          {saving ? '保存中...' : '保存'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          一部だけ入力して保存してもOK。後から追記できます。
        </span>
      </div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="section-title" style={{ marginTop: 16 }}>{title}</div>
      <Card style={{ marginBottom: 16 }}>
        {hint && <p style={{ fontSize: 11, color: 'var(--text3)', margin: '0 0 12px', lineHeight: 1.6 }}>{hint}</p>}
        {children}
      </Card>
    </>
  )
}

function Field({ label, value, onChange, placeholder, textarea }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  const Tag = textarea ? 'textarea' : 'input'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{label}</div>
      <Tag
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ fontSize: 13, width: '100%', ...(textarea ? { minHeight: 60, resize: 'vertical' as const } : {}) }}
      />
    </div>
  )
}
