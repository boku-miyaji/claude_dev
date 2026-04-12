import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

/**
 * User Manual — 自分の取扱説明書。
 *
 * Theme Finder の出力と日記データから「自分の価値観・幸せのトリガー・失敗パターン」等を
 * 種カードとして生成し、ユーザーが自分の言葉に編集できるようにする。
 *
 * 設計思想: Layer 2 (言語化) → Layer 3 (行動) の橋渡しは、
 * ユーザーが自分の手で編集するプロセスがないと起きない。
 * AI が生成しただけだと他人事のままで、自分の言葉になった瞬間に行動が変わる。
 */

export type ManualCategory =
  | 'identity'
  | 'values'
  | 'joy_trigger'
  | 'energy_source'
  | 'failure_pattern'
  | 'recovery_style'
  | 'aspiration'
  | 'custom'

export interface ManualCard {
  id: number
  category: ManualCategory
  seed_text: string | null
  user_text: string | null
  evidence: Array<{ date?: string; quote?: string }>
  source: 'theme_finder' | 'manual' | 'diary_import'
  confidence: 'low' | 'medium' | 'high'
  pinned: boolean
  archived: boolean
  user_edited_at: string | null
  last_reviewed_at: string | null
  display_order: number
  created_at: string
  updated_at: string
}

/** 表示テキスト — ユーザー編集後の user_text を優先 */
export function displayText(card: ManualCard): string {
  return card.user_text ?? card.seed_text ?? ''
}

/** ユーザーが編集済みか */
export function isEdited(card: ManualCard): boolean {
  return card.user_edited_at !== null
}

export const CATEGORY_META: Record<ManualCategory, { label: string; description: string; order: number }> = {
  identity:        { label: '私という人',    description: '自分を一言で表すとどんな人か',        order: 1 },
  values:          { label: '大事にしているもの', description: '譲れない価値観・判断基準',          order: 2 },
  joy_trigger:     { label: '幸せを感じる瞬間',   description: '自分に喜びをもたらすトリガー',      order: 3 },
  energy_source:   { label: 'エネルギーの源',    description: '自分を充電してくれるもの',          order: 4 },
  failure_pattern: { label: 'つまずきのクセ',    description: '繰り返しがちな失敗パターン（責めるためではない）', order: 5 },
  recovery_style:  { label: '回復のしかた',      description: '疲れた時の戻し方',                  order: 6 },
  aspiration:      { label: '本当に求めているもの', description: '深層の志向・憧れ',                order: 7 },
  custom:          { label: 'その他',            description: '自分で追加したカード',              order: 8 },
}

export function useUserManual() {
  const [cards, setCards] = useState<ManualCard[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('user_manual_cards')
      .select('*')
      .eq('archived', false)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
    setCards((data as ManualCard[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** ユーザーが本文を編集 */
  const editCard = useCallback(async (id: number, userText: string) => {
    const trimmed = userText.trim()
    const { error } = await supabase
      .from('user_manual_cards')
      .update({
        user_text: trimmed.length > 0 ? trimmed : null,
        user_edited_at: trimmed.length > 0 ? new Date().toISOString() : null,
      })
      .eq('id', id)
    if (!error) await load()
  }, [load])

  /** 新規カードを手動追加 */
  const addCard = useCallback(async (category: ManualCategory, text: string) => {
    if (!text.trim()) return
    const { error } = await supabase
      .from('user_manual_cards')
      .insert({
        category,
        user_text: text.trim(),
        user_edited_at: new Date().toISOString(),
        source: 'manual',
        confidence: 'medium',
      })
    if (!error) await load()
  }, [load])

  /** ピン留め切り替え */
  const togglePin = useCallback(async (id: number, pinned: boolean) => {
    await supabase.from('user_manual_cards').update({ pinned }).eq('id', id)
    await load()
  }, [load])

  /** アーカイブ */
  const archiveCard = useCallback(async (id: number) => {
    await supabase.from('user_manual_cards').update({ archived: true }).eq('id', id)
    await load()
  }, [load])

  /**
   * Theme Finder を呼び出して種カードを生成。
   * 既存の user_edited_at があるカードは上書きしない。
   * 新規の種のみ挿入する。
   */
  const generateSeedCards = useCallback(async () => {
    setGenerating(true)
    try {
      // Fetch recent diary + story_memory で AI に depth ある材料を渡す
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      const [diaryRes, themeRes] = await Promise.all([
        supabase
          .from('diary_entries')
          .select('body, entry_date')
          .gte('created_at', threeMonthsAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('story_memory')
          .select('memory_type, content, narrative_text')
          .in('memory_type', ['identity', 'emotional_dna', 'aspirations']),
      ])

      const diaryText = (diaryRes.data || [])
        .map((d) => `[${d.entry_date}] ${d.body.substring(0, 180)}`)
        .join('\n')

      const themeSummary = (themeRes.data || [])
        .map((m) => `${m.memory_type}: ${m.narrative_text}`)
        .join('\n')

      if (!diaryText) {
        setGenerating(false)
        return { ok: false, reason: 'insufficient_data' as const }
      }

      const result = await aiCompletion(
        `## 日記 (${(diaryRes.data || []).length}件)\n${diaryText}\n\n## Theme Finder の結果\n${themeSummary || 'なし'}`,
        {
          systemPrompt: `あなたは、ある人の日記を深く読み解き「自分の取扱説明書」の種を書く存在。
その人が自分について読んで「ああ、そうかもしれない」と腑に落ちる1〜2文を、カテゴリごとに生成する。

## 出力 (JSON)
{
  "identity": { "text": "この人を一言で表すと", "evidence": ["日記からの短い引用1", "引用2"] },
  "values": [
    { "text": "価値観カード1", "evidence": ["引用"] },
    { "text": "価値観カード2", "evidence": ["引用"] }
  ],
  "joy_trigger": [
    { "text": "幸せを感じる瞬間の傾向", "evidence": ["引用"] }
  ],
  "energy_source": [
    { "text": "エネルギーの源", "evidence": ["引用"] }
  ],
  "failure_pattern": [
    { "text": "つまずきのクセ（責めない語り方で）", "evidence": ["引用"] }
  ],
  "recovery_style": [
    { "text": "回復のしかた", "evidence": ["引用"] }
  ],
  "aspiration": { "text": "本当に求めているもの", "evidence": ["引用"] }
}

## ルール
- 1カードは1〜2文、80字以内
- 「頑張り屋」「努力家」等の汎用ラベルは禁止
- failure_pattern は評価せず観察する語り方で書く。「◯◯しがち」「◯◯の時に止まる傾向がある」など
- 日記の生の言葉を evidence に含める (20字以内の短い引用)
- 日本語で出力
- 各配列カテゴリは最大2件まで`,
          jsonMode: true,
          temperature: 0.6,
          maxTokens: 1200,
          source: 'user_manual_seed',
        },
      )

      const parsed = JSON.parse(result.content) as {
        identity?: { text: string; evidence?: string[] }
        values?: Array<{ text: string; evidence?: string[] }>
        joy_trigger?: Array<{ text: string; evidence?: string[] }>
        energy_source?: Array<{ text: string; evidence?: string[] }>
        failure_pattern?: Array<{ text: string; evidence?: string[] }>
        recovery_style?: Array<{ text: string; evidence?: string[] }>
        aspiration?: { text: string; evidence?: string[] }
      }

      // 既存のカードを取得。user_edited_at がセットされているものは上書き禁止。
      const { data: existing } = await supabase
        .from('user_manual_cards')
        .select('id, category, user_edited_at')
      const editedCategories = new Set(
        (existing ?? [])
          .filter((c) => c.user_edited_at !== null)
          .map((c) => c.category as ManualCategory),
      )

      // 古い種 (source='theme_finder' かつ 未編集) は削除してから insert
      const rowsToInsert: Array<{
        category: ManualCategory
        seed_text: string
        evidence: Array<{ quote: string }>
        source: 'theme_finder'
        confidence: 'medium'
      }> = []

      const addRow = (
        category: ManualCategory,
        entry: { text: string; evidence?: string[] },
      ) => {
        if (editedCategories.has(category)) return
        if (!entry?.text) return
        rowsToInsert.push({
          category,
          seed_text: entry.text,
          evidence: (entry.evidence ?? []).map((q) => ({ quote: q })),
          source: 'theme_finder',
          confidence: 'medium',
        })
      }

      if (parsed.identity) addRow('identity', parsed.identity)
      for (const v of parsed.values ?? []) addRow('values', v)
      for (const v of parsed.joy_trigger ?? []) addRow('joy_trigger', v)
      for (const v of parsed.energy_source ?? []) addRow('energy_source', v)
      for (const v of parsed.failure_pattern ?? []) addRow('failure_pattern', v)
      for (const v of parsed.recovery_style ?? []) addRow('recovery_style', v)
      if (parsed.aspiration) addRow('aspiration', parsed.aspiration)

      // 未編集の theme_finder 種を一旦削除
      await supabase
        .from('user_manual_cards')
        .delete()
        .eq('source', 'theme_finder')
        .is('user_edited_at', null)

      if (rowsToInsert.length > 0) {
        await supabase.from('user_manual_cards').insert(rowsToInsert)
      }

      await load()
      return { ok: true as const, generated: rowsToInsert.length }
    } catch (err) {
      console.error('[useUserManual] generateSeedCards failed', err)
      return { ok: false as const, reason: 'error' as const }
    } finally {
      setGenerating(false)
    }
  }, [load])

  return {
    cards,
    loading,
    generating,
    editCard,
    addCard,
    togglePin,
    archiveCard,
    generateSeedCards,
    refresh: load,
  }
}
