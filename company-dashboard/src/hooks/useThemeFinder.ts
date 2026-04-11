import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

interface ThemeFinderResult {
  identity: string           // 通底テーマ（「意味を問う人」等）
  emotionalDNA: {
    joyTriggers: string[]    // 喜びのトリガー
    energySources: string[]  // エネルギー源
    recoveryStyle: string    // 回復スタイル
  }
  aspirations: string        // 志向性の要約
}

/**
 * Theme Finder — 長期データから人生テーマを発見するエンジン。
 *
 * 3ヶ月以上の diary + dreams + goals + self_analysis を横断分析。
 * 通底テーマ、emotionalDNA、志向性を生成。
 * 月次更新（最終更新から30日以上経過した場合のみ再生成）。
 * 日記30件以上でアンロック。
 */
export function useThemeFinder() {
  const [theme, setTheme] = useState<ThemeFinderResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  const analyze = useCallback(async (forceRefresh = false): Promise<ThemeFinderResult | null> => {
    // Check cached theme from story_memory
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('story_memory')
        .select('content, updated_at')
        .eq('memory_type', 'identity')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (cached) {
        const daysSinceUpdate = (Date.now() - new Date(cached.updated_at).getTime()) / 86400000
        if (daysSinceUpdate < 30) {
          const result = cached.content as unknown as ThemeFinderResult
          setTheme(result)
          setUnlocked(true)
          return result
        }
      }
    }

    // Check if enough data (30+ diary entries)
    const { count } = await supabase
      .from('diary_entries')
      .select('id', { count: 'exact', head: true })

    if (!count || count < 30) {
      setUnlocked(false)
      return null
    }
    setUnlocked(true)

    setLoading(true)
    try {
      // Fetch long-term data in parallel
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

      const [diaryRes, emotionRes, dreamsRes, goalsRes] = await Promise.all([
        supabase
          .from('diary_entries')
          .select('body, entry_date, wbi')
          .gte('created_at', threeMonthsAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('emotion_analysis')
          .select('joy, trust, fear, surprise, sadness, anger, anticipation, valence, wbi_score, created_at')
          .gte('created_at', threeMonthsAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('dreams')
          .select('title, description, status')
          .in('status', ['active', 'in_progress', 'achieved']),
        supabase
          .from('goals')
          .select('title, description, level, status'),
      ])

      // Build context
      const diaryText = (diaryRes.data || [])
        .map((d) => `[${d.entry_date}] ${d.body.substring(0, 150)}`)
        .join('\n')

      const emotionSummary = summarizeEmotions(emotionRes.data || [])

      const dreamsText = (dreamsRes.data || [])
        .map((d) => `${d.title} (${d.status})${d.description ? `: ${d.description.substring(0, 80)}` : ''}`)
        .join('\n')

      const goalsText = (goalsRes.data || [])
        .map((g) => `[${g.level}] ${g.title} (${g.status})`)
        .join('\n')

      const result = await aiCompletion(
        `## 日記（${(diaryRes.data || []).length}件）\n${diaryText}\n\n## 感情傾向\n${emotionSummary}\n\n## 夢\n${dreamsText || 'なし'}\n\n## ゴール\n${goalsText || 'なし'}`,
        {
          systemPrompt: `あなたは人生の通底テーマを発見する存在。長期間の日記・感情・夢・目標を横断的に分析し、この人の「核心」を言語化する。

## 出力（JSON）
{
  "identity": "この人を一言で表すテーマ。例: 「つくる人」「意味を問う人」「橋を架ける人」。抽象的すぎず、具体的すぎず。",
  "emotionalDNA": {
    "joyTriggers": ["喜びを感じるきっかけ3つ"],
    "energySources": ["エネルギーの源2-3つ"],
    "recoveryStyle": "疲れた時どう回復するかの傾向"
  },
  "aspirations": "この人が本当に求めていること。日記や夢から読み取れる深層的な志向。1-2文で。"
}

## ルール
- 表面的なラベルではなく、日記の行間から読み取る
- 「頑張り屋」「努力家」のような汎用ラベルは避ける
- 矛盾する要素があればそれも含めて言語化する（人間は矛盾する）
- 日本語で出力`,
          jsonMode: true,
          temperature: 0.6,
          maxTokens: 500,
          source: 'theme_finder',
        },
      )

      const parsed = JSON.parse(result.content) as ThemeFinderResult
      setTheme(parsed)

      // Persist to story_memory (identity + emotional_dna + aspirations)
      await upsertMemory('identity', parsed as unknown as Record<string, unknown>, parsed.identity)
      await upsertMemory('emotional_dna', parsed.emotionalDNA, JSON.stringify(parsed.emotionalDNA))
      await upsertMemory('aspirations', { aspirations: parsed.aspirations }, parsed.aspirations)

      return parsed
    } catch (err) {
      console.error('[Theme Finder] Error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    analyze()
  }, [analyze])

  return { theme, loading, unlocked, refresh: () => analyze(true) }
}

async function upsertMemory(memoryType: string, content: Record<string, unknown>, narrativeText: string) {
  const { data: existing } = await supabase
    .from('story_memory')
    .select('id')
    .eq('memory_type', memoryType)
    .limit(1)
    .single()

  if (existing) {
    await supabase
      .from('story_memory')
      .update({ content, narrative_text: narrativeText, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('story_memory')
      .insert({ memory_type: memoryType, content, narrative_text: narrativeText })
  }
}

function summarizeEmotions(data: Record<string, unknown>[]): string {
  if (data.length === 0) return 'データなし'
  const emotions = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'anger', 'anticipation'] as const
  const avg: Record<string, number> = {}
  for (const e of data) {
    for (const key of emotions) {
      avg[key] = (avg[key] ?? 0) + ((e[key] as number) ?? 0)
    }
  }
  const sorted = emotions
    .map((k) => ({ key: k, val: avg[k] / data.length }))
    .sort((a, b) => b.val - a.val)

  const wbis = data.map((e) => (e.wbi_score as number) ?? 0).filter((w) => w > 0)
  const avgWbi = wbis.length > 0 ? wbis.reduce((a, b) => a + b, 0) / wbis.length : 0

  return `主要感情: ${sorted.slice(0, 3).map((s) => `${s.key}(${Math.round(s.val)})`).join(', ')}。平均WBI: ${avgWbi.toFixed(1)}`
}
