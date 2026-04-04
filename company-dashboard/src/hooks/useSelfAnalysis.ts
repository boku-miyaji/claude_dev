import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

export type AnalysisType = 'mbti' | 'big5' | 'strengths_finder' | 'emotion_triggers' | 'values'

export interface AnalysisRecord {
  id: number
  analysis_type: AnalysisType
  result: Record<string, unknown>
  summary: string | null
  data_count: number
  model_used: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Prompts — initial (no previous result) and delta (with previous result)
// ---------------------------------------------------------------------------

function mbtiPrompt(prev: Record<string, unknown> | null): string {
  const base = `以下の日記データからMBTIタイプを推定してください。JSON形式で返してください:
{
  "type": "INFP",
  "type_name": "仲介者",
  "confidence": "high",
  "dimensions": {
    "E_I": {"score": 35, "label": "I寄り"},
    "S_N": {"score": 30, "label": "N寄り"},
    "T_F": {"score": 55, "label": "F寄り"},
    "J_P": {"score": 50, "label": "P寄り"}
  },
  "evidence": ["[日付] 日記からの具体的な引用1", "[日付] 引用2", ...],
  "description": "タイプの詳細説明。16personalitiesの日本語名称、特徴、どう捉えればいいか、活かし方（3つ）、注意点（3つ）を含む。500字以上で。"${prev ? ',\n  "changes_from_previous": "前回からの変化の説明"' : ''}
}

scoreは-100(左)〜100(右): E_I(-100=E, 100=I), S_N(-100=S, 100=N), T_F(-100=T, 100=F), J_P(-100=J, 100=P)

【S/N判定の重要な注意】
日記データでは「〜に行った」「〜を食べた」等のS的記述が自然に多くなります。
S/Nの判定では「体験の記述方法」ではなく「思考パターン」に注目してください:
- N（直観）: 「自分探し」「意味を問う」「理想主義的」「抽象的概念」「もし〜だったら」
- S（感覚）: 「今を楽しむ」「感覚的快楽が目的」「実用的・現実的な判断」
例: INFP（仲介者）は体験を「意味づけ」し、ISFP（冒険家）は体験を「味わう」。

type_nameは16personalitiesの日本語名称: INTJ=建築家, INFP=仲介者, ISFP=冒険家, ENFJ=主人公, ENTP=討論者, ISTJ=管理者, INFJ=提唱者, ENFP=広報運動家, ISTP=巨匠, ENTJ=指揮官, INTP=論理学者, ESFP=エンターテイナー, ESFJ=領事官, ESTP=起業家, ISFJ=擁護者, ESTJ=幹部

descriptionには以下を必ず含めてください（500字以上）:
1. このタイプの核心的な特徴（3-4文）
2. 日記から見える具体的な行動パターン
3. 「どう捉えればいいか」（このタイプの人生哲学）
4. 「活かし方」3つ（具体的なアクション）
5. 「注意点」3つ（具体的な落とし穴）

evidenceは日記からの直接引用を5つ以上、[日付]付きで。
JSON以外は返さないでください。`

  if (prev) {
    return base + `\n\n【前回の分析結果】\n前回のタイプ: ${prev.type} (${prev.type_name})\n前回のスコア: E_I=${(prev.dimensions as Record<string, {score:number}>)?.E_I?.score}, S_N=${(prev.dimensions as Record<string, {score:number}>)?.S_N?.score}, T_F=${(prev.dimensions as Record<string, {score:number}>)?.T_F?.score}, J_P=${(prev.dimensions as Record<string, {score:number}>)?.J_P?.score}\n\n新しい日記データから、前回からの変化があればchanges_from_previousに記載してください。タイプが変わった場合はその理由も。変化がなければ「大きな変化なし」と記載。`
  }
  return base
}

function big5Prompt(prev: Record<string, unknown> | null): string {
  const base = `以下の日記データからBig5パーソナリティを分析してください。JSON形式で返してください:
{
  "openness": 75,
  "conscientiousness": 80,
  "extraversion": 40,
  "agreeableness": 65,
  "neuroticism": 35,
  "summary": "各因子の詳細な説明。日記の具体的な行動パターンに基づいて500字以上で記述。各因子がどう日常に現れているか、因子間の関係性も。",
  "evidence": ["[日付] 引用1", "[日付] 引用2", ...]${prev ? ',\n  "changes_from_previous": "前回からの変化の説明"' : ''}
}
各値は0-100の整数。evidenceは5つ以上。JSON以外は返さないでください。`

  if (prev) {
    return base + `\n\n【前回の分析結果】\nO=${prev.openness} C=${prev.conscientiousness} E=${prev.extraversion} A=${prev.agreeableness} N=${prev.neuroticism}\n\n新しい日記から前回と比べてスコアに変動があればchanges_from_previousに記載。`
  }
  return base
}

function strengthsFinderPrompt(prev: Record<string, unknown> | null): string {
  const base = `以下の日記データとタスク実績から、ストレングスファインダー(CliftonStrengths)の34資質のうちTop5を推定してください。JSON形式で返してください:
{
  "top_strengths": [
    {"name": "内省", "name_en": "Intellection", "score": 92, "domain": "戦略的思考力", "evidence": "日記から読み取れる具体的な根拠（100字以上）"},
    ...
  ],
  "domain_summary": {
    "strategic_thinking": {"score": 85, "label": "戦略的思考力", "description": "この領域の説明"},
    "relationship_building": {"score": 60, "label": "人間関係構築力", "description": "説明"},
    "influencing": {"score": 45, "label": "影響力", "description": "説明"},
    "executing": {"score": 70, "label": "実行力", "description": "説明"}
  },
  "work_fit": ["適した仕事や役割1", "適した仕事や役割2", ...],
  "growth_areas": ["伸ばせる領域1", "伸ばせる領域2", "伸ばせる領域3"],
  "summary": "全体的な強みの説明と活かし方（300字以上）"${prev ? ',\n  "changes_from_previous": "前回からの変化の説明"' : ''}
}

34資質: 達成欲,活発性,適応性,分析思考,アレンジ,信念,指令性,コミュニケーション,競争性,結合性,公平性,慎重さ,原点思考,未来志向,調和性,着想,包含,個別化,収集心,内省,学習欲,最上志向,目標志向,親密性,責任感,回復志向,自己確信,自我,戦略性,共感性,成長促進,ポジティブ,規律性,社交性

4ドメイン:
- 戦略的思考力: 分析思考,原点思考,未来志向,着想,収集心,内省,学習欲,戦略性
- 人間関係構築力: 適応性,結合性,共感性,調和性,包含,個別化,ポジティブ,親密性,成長促進
- 影響力: 活発性,指令性,コミュニケーション,競争性,最上志向,自己確信,自我,社交性
- 実行力: 達成欲,アレンジ,信念,公平性,慎重さ,規律性,責任感,回復志向,目標志向

top_strengthsは5件。scoreは0-100。growth_areasは3件。JSON以外は返さないでください。`

  if (prev) {
    const prevTop = (prev.top_strengths as {name:string;score:number}[])?.map(s => `${s.name}(${s.score})`).join(', ')
    return base + `\n\n【前回の分析結果】\nTop5: ${prevTop}\n\n新しいデータからTop5の順位やスコアに変動があればchanges_from_previousに記載。`
  }
  return base
}

function emotionTriggersPrompt(prev: Record<string, unknown> | null): string {
  const base = `以下の日記と感情データから感情トリガーを分析してください。JSON形式で返してください:
{
  "positive_triggers": [
    {"trigger": "一人の作業時間", "emotion": "joy", "frequency": 12}
  ],
  "negative_triggers": [
    {"trigger": "MTG後", "emotion": "anxiety", "frequency": 8}
  ],
  "patterns": ["火曜に不安が高まる傾向", "朝の方がポジティブ"],
  "summary": "感情パターンの詳細説明（300字以上）"${prev ? ',\n  "changes_from_previous": "前回からの変化の説明"' : ''}
}
JSON以外は返さないでください。`

  if (prev) {
    return base + `\n\n【前回の分析結果のパターン】\n${(prev.patterns as string[])?.join(', ')}\n\n新しいデータから変化があればchanges_from_previousに記載。`
  }
  return base
}

function valuesPrompt(prev: Record<string, unknown> | null): string {
  const base = `以下の日記と夢リストから価値観を分析してください。JSON形式で返してください:
{
  "values": [
    {"name": "成長", "rank": 1, "score": 95, "evidence": "具体的な根拠（100字以上）"},
    ...
  ],
  "changes": "最近の価値観の変化の記述（200字以上）",
  "summary": "価値観の全体説明（300字以上）"${prev ? ',\n  "changes_from_previous": "前回の分析からの具体的な変化"' : ''}
}
valuesは5-7件。scoreは0-100。JSON以外は返さないでください。`

  if (prev) {
    const prevVals = (prev.values as {name:string;rank:number;score:number}[])?.map(v => `#${v.rank} ${v.name}(${v.score})`).join(', ')
    return base + `\n\n【前回の分析結果】\n${prevVals}\n\n新しい日記から優先順位やスコアの変動があればchanges_from_previousに記載。`
  }
  return base
}

const PROMPT_BUILDERS: Record<AnalysisType, (prev: Record<string, unknown> | null) => string> = {
  mbti: mbtiPrompt,
  big5: big5Prompt,
  strengths_finder: strengthsFinderPrompt,
  emotion_triggers: emotionTriggersPrompt,
  values: valuesPrompt,
}

// ---------------------------------------------------------------------------
// Data collection — only new entries since last analysis (delta mode)
// ---------------------------------------------------------------------------

async function getPreviousAnalysis(type: AnalysisType): Promise<AnalysisRecord | null> {
  const { data } = await supabase
    .from('self_analysis')
    .select('*')
    .eq('analysis_type', type)
    .order('created_at', { ascending: false })
    .limit(1)
  return (data?.[0] as AnalysisRecord) ?? null
}

async function collectData(
  type: AnalysisType,
  since: string | null,
): Promise<{ text: string; count: number }> {
  // Build date filter: only new entries since last analysis
  const addDateFilter = (query: ReturnType<typeof supabase.from>) => {
    if (since) return query.gt('created_at', since)
    return query
  }

  switch (type) {
    case 'mbti': {
      let query = supabase
        .from('diary_entries')
        .select('body, entry_date, created_at')
        .order('entry_date', { ascending: false })
        .limit(80)
      query = addDateFilter(query) as typeof query
      const { data } = await query
      const entries = data ?? []
      const text = entries
        .map((e: { body: string; entry_date: string }) => `[${e.entry_date}] ${e.body}`)
        .join('\n\n')
      return { text, count: entries.length }
    }
    case 'big5': {
      let query = supabase
        .from('diary_entries')
        .select('body, entry_date, created_at')
        .order('entry_date', { ascending: false })
        .limit(80)
      query = addDateFilter(query) as typeof query
      const { data } = await query
      const entries = data ?? []
      const text = entries
        .map((e: { body: string; entry_date: string }) => `[${e.entry_date}] ${e.body}`)
        .join('\n\n')
      return { text, count: entries.length }
    }
    case 'strengths_finder': {
      let diaryQuery = supabase
        .from('diary_entries')
        .select('body, entry_date, created_at')
        .order('entry_date', { ascending: false })
        .limit(80)
      diaryQuery = addDateFilter(diaryQuery) as typeof diaryQuery

      const [taskRes, diaryRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('title, status, priority, completed_at')
          .order('created_at', { ascending: false })
          .limit(100),
        diaryQuery,
      ])
      const tasks = taskRes.data ?? []
      const diaries = diaryRes.data ?? []
      const taskText = tasks
        .map((t: { title: string; status: string; priority: string }) => `- [${t.status}][${t.priority}] ${t.title}`)
        .join('\n')
      const diaryText = diaries
        .map((e: { body: string; entry_date: string }) => `[${e.entry_date}] ${e.body}`)
        .join('\n\n')
      return { text: `## タスク実績\n${taskText}\n\n## 日記\n${diaryText}`, count: diaries.length }
    }
    case 'emotion_triggers': {
      let diaryQuery = supabase
        .from('diary_entries')
        .select('id, body, entry_date, created_at')
        .order('entry_date', { ascending: false })
        .limit(60)
      diaryQuery = addDateFilter(diaryQuery) as typeof diaryQuery

      const [diaryRes, emotionRes] = await Promise.all([
        diaryQuery,
        supabase
          .from('emotion_analysis')
          .select('diary_entry_id, joy, trust, fear, surprise, sadness, disgust, anger, anticipation, valence, arousal, wbi_score, created_at')
          .order('created_at', { ascending: false })
          .limit(60),
      ])
      const diaries = diaryRes.data ?? []
      const emotions = emotionRes.data ?? []
      const emotionMap = new Map<string, Record<string, unknown>>()
      for (const e of emotions) {
        emotionMap.set((e as Record<string, string>).diary_entry_id, e as Record<string, unknown>)
      }
      const lines = diaries.map((d: { id: string; body: string; entry_date: string }) => {
        const emo = emotionMap.get(d.id)
        const emoStr = emo
          ? ` | joy=${emo.joy} trust=${emo.trust} fear=${emo.fear} sadness=${emo.sadness} anger=${emo.anger} anticipation=${emo.anticipation} valence=${emo.valence}`
          : ''
        return `[${d.entry_date}] ${d.body}${emoStr}`
      })
      return { text: lines.join('\n\n'), count: diaries.length }
    }
    case 'values': {
      let diaryQuery = supabase
        .from('diary_entries')
        .select('body, entry_date, created_at')
        .order('entry_date', { ascending: false })
        .limit(80)
      diaryQuery = addDateFilter(diaryQuery) as typeof diaryQuery

      const [diaryRes, dreamsRes] = await Promise.all([
        diaryQuery,
        supabase
          .from('dreams')
          .select('title, description, category, status')
          .order('created_at', { ascending: false }),
      ])
      const diaries = diaryRes.data ?? []
      const dreams = dreamsRes.data ?? []
      const diaryText = diaries
        .map((e: { body: string; entry_date: string }) => `[${e.entry_date}] ${e.body}`)
        .join('\n\n')
      const dreamText = dreams
        .map((d: { title: string; category: string; status: string }) => `- [${d.status}][${d.category}] ${d.title}`)
        .join('\n')
      return { text: `## 日記\n${diaryText}\n\n## 夢リスト\n${dreamText}`, count: diaries.length }
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseSelfAnalysisReturn {
  runAnalysis: (type: AnalysisType) => Promise<AnalysisRecord | null>
  running: boolean
  runningType: AnalysisType | null
  error: string | null
}

/**
 * Hook to execute self-analysis using OpenAI API via Edge Function.
 * Delta mode: only analyzes new diary entries since last analysis.
 * Includes previous result context so the AI can track changes.
 */
export function useSelfAnalysis(): UseSelfAnalysisReturn {
  const [running, setRunning] = useState(false)
  const [runningType, setRunningType] = useState<AnalysisType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = useCallback(async (type: AnalysisType): Promise<AnalysisRecord | null> => {
    setRunning(true)
    setRunningType(type)
    setError(null)

    try {
      // Get previous analysis for delta mode
      const prevAnalysis = await getPreviousAnalysis(type)
      const prevResult = prevAnalysis?.result ?? null
      const since = prevAnalysis?.created_at ?? null

      // Collect data (only new entries if previous exists)
      const { text: userData, count } = await collectData(type, since)

      if (!userData.trim()) {
        setError('前回の分析以降、新しいデータがありません。')
        setRunning(false)
        setRunningType(null)
        return null
      }

      // Build prompt with previous context
      const prompt = PROMPT_BUILDERS[type](prevResult)

      // Call AI via Edge Function (OpenAI)
      const { content: resultText } = await aiCompletion(userData, {
        systemPrompt: prompt,
        jsonMode: true,
        temperature: 0.4,
        maxTokens: 3000,
      })
      if (!resultText) throw new Error('Empty response from AI')

      const result = JSON.parse(resultText)
      const summary = result.summary || result.description || null

      // Save to self_analysis
      const { data: inserted, error: insertErr } = await supabase
        .from('self_analysis')
        .insert({
          analysis_type: type,
          result,
          summary,
          data_count: count,
          model_used: 'gpt-5-nano',
        })
        .select()
        .single()

      if (insertErr) throw new Error(insertErr.message)

      setRunning(false)
      setRunningType(null)
      return inserted as AnalysisRecord
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      setRunning(false)
      setRunningType(null)
      return null
    }
  }, [])

  return { runAnalysis, running, runningType, error }
}
