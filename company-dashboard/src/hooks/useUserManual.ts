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

/** pending_updates row limited to Manual proposals (source='manual_seed'). */
export interface ManualPendingUpdate {
  id: number
  category: ManualCategory
  title: string
  preview: string | null
  proposed_content: {
    seeds: Array<{ text: string; evidence?: string[] }>
  }
  current_content: {
    cards: Array<{ id: number; text: string; user_edited: boolean }>
  } | null
  metadata: { diary_count?: number; roots_count?: number; generated_at?: string } | null
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed'
  created_at: string
}

/** 編集履歴 1件 (user_manual_edits 由来) */
export interface ManualEditLogEntry {
  id: number
  edit_type:
    | 'card_edit'
    | 'card_create'
    | 'card_archive'
    | 'proposal_seed_edit'
    | 'proposal_accept'
    | 'proposal_reject'
  before_text: string | null
  after_text: string | null
  edited_at: string
  seed_index: number | null
}

/** 編集履歴を記録するヘルパー（fail-soft: log 失敗で UX を壊さない） */
async function logEdit(params: {
  cardId?: number | null
  pendingUpdateId?: number | null
  seedIndex?: number | null
  editType: ManualEditLogEntry['edit_type']
  beforeText?: string | null
  afterText?: string | null
}) {
  try {
    await supabase.from('user_manual_edits').insert({
      card_id: params.cardId ?? null,
      pending_update_id: params.pendingUpdateId ?? null,
      seed_index: params.seedIndex ?? null,
      edit_type: params.editType,
      before_text: params.beforeText ?? null,
      after_text: params.afterText ?? null,
    })
  } catch (err) {
    console.warn('[useUserManual] logEdit failed', err)
  }
}

export function useUserManual() {
  const [cards, setCards] = useState<ManualCard[]>([])
  const [pending, setPending] = useState<ManualPendingUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [cardsRes, pendingRes] = await Promise.all([
      supabase
        .from('user_manual_cards')
        .select('*')
        .eq('archived', false)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('pending_updates')
        .select('id, category, title, preview, proposed_content, current_content, metadata, status, created_at')
        .eq('source', 'manual_seed')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])
    setCards((cardsRes.data as ManualCard[]) ?? [])
    setPending((pendingRes.data as ManualPendingUpdate[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** ユーザーが本文を編集 */
  const editCard = useCallback(async (id: number, userText: string) => {
    const trimmed = userText.trim()
    const oldCard = cards.find((c) => c.id === id)
    const oldDisplay = oldCard ? displayText(oldCard) : ''
    const newDisplay = trimmed.length > 0 ? trimmed : (oldCard?.seed_text ?? '')

    const { error } = await supabase
      .from('user_manual_cards')
      .update({
        user_text: trimmed.length > 0 ? trimmed : null,
        user_edited_at: trimmed.length > 0 ? new Date().toISOString() : null,
      })
      .eq('id', id)
    if (!error) {
      if (oldDisplay !== newDisplay) {
        await logEdit({
          cardId: id,
          editType: 'card_edit',
          beforeText: oldDisplay,
          afterText: newDisplay,
        })
      }
      await load()
    }
  }, [cards, load])

  /** 新規カードを手動追加 */
  const addCard = useCallback(async (category: ManualCategory, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const { data, error } = await supabase
      .from('user_manual_cards')
      .insert({
        category,
        user_text: trimmed,
        user_edited_at: new Date().toISOString(),
        source: 'manual',
        confidence: 'medium',
      })
      .select('id')
      .single()
    if (!error) {
      const newId = (data as { id: number } | null)?.id
      if (newId) {
        await logEdit({
          cardId: newId,
          editType: 'card_create',
          afterText: trimmed,
        })
      }
      await load()
    }
  }, [load])

  /** ピン留め切り替え */
  const togglePin = useCallback(async (id: number, pinned: boolean) => {
    await supabase.from('user_manual_cards').update({ pinned }).eq('id', id)
    await load()
  }, [load])

  /** アーカイブ */
  const archiveCard = useCallback(async (id: number) => {
    const oldCard = cards.find((c) => c.id === id)
    const oldDisplay = oldCard ? displayText(oldCard) : ''
    const { error } = await supabase
      .from('user_manual_cards')
      .update({ archived: true })
      .eq('id', id)
    if (!error) {
      await logEdit({
        cardId: id,
        editType: 'card_archive',
        beforeText: oldDisplay,
      })
      await load()
    }
  }, [cards, load])

  /**
   * Propose seed cards as **pending_updates** rather than writing directly.
   * Uses Opus 4.7 with diary + story_memory + Roots (life_story_entries) as input.
   * Users review the proposals and approve/reject each category.
   *
   * @param onlyCategory  If provided, the other categories are dropped from the proposals.
   */
  const generateSeedCards = useCallback(async (onlyCategory?: ManualCategory) => {
    setGenerating(true)
    try {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      const [diaryRes, themeRes, rootsRes, existingCardsRes] = await Promise.all([
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
        // Roots: life-story entries give childhood→career depth that diary alone can't cover
        supabase
          .from('life_story_entries')
          .select('stage, axis, question, answer, depth_level')
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('user_manual_cards')
          .select('id, category, seed_text, user_text, user_edited_at')
          .eq('archived', false),
      ])

      const diaryText = (diaryRes.data || [])
        .map((d) => `[${d.entry_date}] ${d.body.substring(0, 180)}`)
        .join('\n')

      const themeSummary = (themeRes.data || [])
        .map((m) => `${m.memory_type}: ${m.narrative_text}`)
        .join('\n')

      const rootsEntries = (rootsRes.data || []) as Array<{
        stage: string; axis: string; question: string; answer: string; depth_level: number
      }>
      const rootsText = rootsEntries
        .map((e) => `[${e.stage}/${e.axis}] Q:${e.question} A:${e.answer.substring(0, 160)}`)
        .join('\n')

      if (!diaryText && rootsEntries.length === 0) {
        setGenerating(false)
        return { ok: false, reason: 'insufficient_data' as const }
      }

      const result = await aiCompletion(
        `## 日記 (${(diaryRes.data || []).length}件)\n${diaryText || '(なし)'}\n\n## Theme Finder の結果\n${themeSummary || 'なし'}\n\n## Roots / 人生の棚卸し (${rootsEntries.length}件)\n${rootsText || 'まだ未着手'}`,
        {
          systemPrompt: `あなたは、ある人の日記・Theme Finder の結果・Roots（人生の棚卸し）を深く読み解き「自分の取扱説明書」の種を書く存在。
その人が自分について読んで「ああ、そうかもしれない」と腑に落ちる1〜2文を、カテゴリごとに生成する。Roots には幼少期から現在までの価値観・家庭環境・転機が含まれるので、それを根拠として織り込む。

## 出力 (JSON)
{
  "identity": { "text": "この人を一言で表すと", "evidence": ["日記またはRootsからの短い引用1", "引用2"] },
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
- evidence は日記 or Roots の生の言葉を短く引用 (20字以内)。Roots からの場合は先頭に [stage/axis] 等を付けずに本文だけ引用
- 日本語で出力
- 各配列カテゴリは最大2件まで`,
          jsonMode: true,
          model: 'claude-opus-4-7',
          temperature: 0.6,
          maxTokens: 1500,
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

      // Group proposed seeds by category
      const proposedByCategory = new Map<ManualCategory, Array<{ text: string; evidence?: string[] }>>()
      const addSeed = (category: ManualCategory, entry: { text: string; evidence?: string[] } | undefined) => {
        if (!entry?.text) return
        if (onlyCategory && onlyCategory !== category) return
        if (!proposedByCategory.has(category)) proposedByCategory.set(category, [])
        proposedByCategory.get(category)!.push(entry)
      }
      if (parsed.identity) addSeed('identity', parsed.identity)
      for (const v of parsed.values ?? []) addSeed('values', v)
      for (const v of parsed.joy_trigger ?? []) addSeed('joy_trigger', v)
      for (const v of parsed.energy_source ?? []) addSeed('energy_source', v)
      for (const v of parsed.failure_pattern ?? []) addSeed('failure_pattern', v)
      for (const v of parsed.recovery_style ?? []) addSeed('recovery_style', v)
      if (parsed.aspiration) addSeed('aspiration', parsed.aspiration)

      // Current cards grouped by category (for diff display later)
      const currentByCategory = new Map<ManualCategory, Array<{ id: number; text: string; user_edited: boolean }>>()
      for (const c of (existingCardsRes.data ?? []) as Array<{ id: number; category: ManualCategory; seed_text: string | null; user_text: string | null; user_edited_at: string | null }>) {
        if (!currentByCategory.has(c.category)) currentByCategory.set(c.category, [])
        currentByCategory.get(c.category)!.push({
          id: c.id,
          text: c.user_text ?? c.seed_text ?? '',
          user_edited: c.user_edited_at !== null,
        })
      }

      // Clear any still-pending manual proposals for the same categories, then insert new ones.
      const categoryArray = Array.from(proposedByCategory.keys())
      if (categoryArray.length > 0) {
        await supabase
          .from('pending_updates')
          .update({ status: 'dismissed', decided_at: new Date().toISOString() })
          .eq('source', 'manual_seed')
          .eq('status', 'pending')
          .in('category', categoryArray)
      }

      const metadata = {
        diary_count: (diaryRes.data ?? []).length,
        roots_count: rootsEntries.length,
        generated_at: new Date().toISOString(),
      }

      const rowsToInsert = categoryArray.map((cat) => {
        const seeds = proposedByCategory.get(cat)!
        const meta = CATEGORY_META[cat]
        return {
          source: 'manual_seed',
          category: cat,
          title: `${meta.label} の更新候補`,
          preview: seeds[0]?.text?.substring(0, 100) ?? null,
          proposed_content: { seeds },
          current_content: { cards: currentByCategory.get(cat) ?? [] },
          metadata,
        }
      })

      if (rowsToInsert.length > 0) {
        await supabase.from('pending_updates').insert(rowsToInsert)
      }

      await load()
      return { ok: true as const, proposed: rowsToInsert.length }
    } catch (err) {
      console.error('[useUserManual] generateSeedCards failed', err)
      return { ok: false as const, reason: 'error' as const }
    } finally {
      setGenerating(false)
    }
  }, [load])

  /** Approve a pending update: apply its seeds to user_manual_cards (replacing unedited seeds in that category). */
  const acceptUpdate = useCallback(async (id: number) => {
    const row = pending.find((p) => p.id === id)
    if (!row) return
    const category = row.category
    // Delete still-unedited theme_finder seeds in this category (let user-edited ones stand)
    await supabase
      .from('user_manual_cards')
      .delete()
      .eq('category', category)
      .eq('source', 'theme_finder')
      .is('user_edited_at', null)

    const seeds = row.proposed_content?.seeds ?? []
    if (seeds.length > 0) {
      await supabase.from('user_manual_cards').insert(
        seeds.map((s) => ({
          category,
          seed_text: s.text,
          evidence: (s.evidence ?? []).map((q) => ({ quote: q })),
          source: 'theme_finder',
          confidence: 'medium',
        })),
      )
    }

    await supabase
      .from('pending_updates')
      .update({ status: 'accepted', decided_at: new Date().toISOString() })
      .eq('id', id)

    await logEdit({
      pendingUpdateId: id,
      editType: 'proposal_accept',
      afterText: seeds.map((s) => s.text).join('\n'),
    })

    await load()
  }, [pending, load])

  /** Reject a pending update: mark rejected, no changes to user_manual_cards. */
  const rejectUpdate = useCallback(async (id: number) => {
    await supabase
      .from('pending_updates')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', id)
    await logEdit({
      pendingUpdateId: id,
      editType: 'proposal_reject',
    })
    await load()
  }, [load])

  /** Dismiss = hide for now, don't treat as rejected. Kept for future resurface. */
  const dismissUpdate = useCallback(async (id: number) => {
    await supabase
      .from('pending_updates')
      .update({ status: 'dismissed', decided_at: new Date().toISOString() })
      .eq('id', id)
    await load()
  }, [load])

  /**
   * 承認前に proposal の seed テキストを編集する。
   * AI の言葉のまま user_manual_cards に入る前に「自分の言葉」に書き換える経路。
   */
  const editProposalSeed = useCallback(async (
    pendingId: number,
    seedIndex: number,
    newText: string,
  ) => {
    const trimmed = newText.trim()
    if (!trimmed) return

    const row = pending.find((p) => p.id === pendingId)
    if (!row) return
    const seeds = [...(row.proposed_content?.seeds ?? [])]
    if (seedIndex < 0 || seedIndex >= seeds.length) return
    const before = seeds[seedIndex].text
    if (before === trimmed) return

    seeds[seedIndex] = { ...seeds[seedIndex], text: trimmed }

    const { error } = await supabase
      .from('pending_updates')
      .update({
        proposed_content: { ...row.proposed_content, seeds },
        preview: seeds[0]?.text?.substring(0, 100) ?? null,
      })
      .eq('id', pendingId)

    if (!error) {
      await logEdit({
        pendingUpdateId: pendingId,
        seedIndex,
        editType: 'proposal_seed_edit',
        beforeText: before,
        afterText: trimmed,
      })
      await load()
    }
  }, [pending, load])

  /** カード単位で履歴を取得（最大20件、新しい順） */
  const fetchHistory = useCallback(async (cardId: number): Promise<ManualEditLogEntry[]> => {
    const { data } = await supabase
      .from('user_manual_edits')
      .select('id, edit_type, before_text, after_text, edited_at, seed_index')
      .eq('card_id', cardId)
      .order('edited_at', { ascending: false })
      .limit(20)
    return (data as ManualEditLogEntry[]) ?? []
  }, [])

  return {
    cards,
    pending,
    loading,
    generating,
    editCard,
    addCard,
    togglePin,
    archiveCard,
    generateSeedCards,
    acceptUpdate,
    rejectUpdate,
    dismissUpdate,
    editProposalSeed,
    fetchHistory,
    refresh: load,
  }
}
