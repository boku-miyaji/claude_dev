import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

export type AnalysisType = 'mbti' | 'big5' | 'strengths' | 'strengths_finder' | 'emotion_triggers' | 'values'

export interface AnalysisRecord {
  id: number
  analysis_type: AnalysisType
  result: Record<string, unknown>
  summary: string | null
  data_count: number
  model_used: string | null
  created_at: string
}

/** Prompts keyed by analysis type */
const PROMPTS: Record<AnalysisType, string> = {
  mbti: `以下の日記データからMBTIタイプを推定してください。JSON形式で返してください:
{
  "type": "INTJ",
  "type_name": "建築家",
  "confidence": "high",
  "dimensions": {
    "E_I": {"score": -50, "label": "I寄り"},
    "S_N": {"score": 30, "label": "N寄り"},
    "T_F": {"score": -20, "label": "T寄り"},
    "J_P": {"score": 40, "label": "J寄り"}
  },
  "evidence": ["日記からの引用1", "日記からの引用2"],
  "description": "あなたは〜タイプです。どう捉えればいいか、活かし方、注意点を含めて説明..."
}
scoreは-100(左)〜100(右): E_I(-100=E, 100=I), S_N(-100=S, 100=N), T_F(-100=T, 100=F), J_P(-100=J, 100=P)

【S/N判定の重要な注意】
日記データでは「〜に行った」「〜を食べた」等のS的記述（具体的体験の記録）が自然に多くなります。
S/Nの判定では「体験の記述方法」ではなく「思考パターン」に注目してください。
- N（直観）の兆候: 「自分探し」「意味を問う」「理想主義的な記述」「抽象的な概念への言及」「もし〜だったら」という仮定思考
- S（感覚）の兆候: 「今を楽しむ」「感覚的快楽が目的」「具体的描写自体が目的」「実用的・現実的な判断基準」
例: INFP（仲介者）は体験を「意味づけ」し、ISFP（冒険家）は体験を「味わう」ことに重点を置きます。

type_nameには16personalitiesの日本語名称を入れてください（例: INTJ=建築家, INFP=仲介者, ISFP=冒険家, ENFJ=主人公, ENTP=討論者, ISTJ=管理者, INFJ=提唱者, ENFP=広報運動家, ISTP=巨匠, ENTJ=指揮官, INTP=論理学者, ESFP=エンターテイナー, ESFJ=領事官, ESTP=起業家, ISFJ=擁護者, ESTJ=幹部）

descriptionには「このタイプをどう捉えればいいか」「日常での活かし方」「注意すべき点」を含めてください。
JSON以外は返さないでください。`,

  big5: `以下の日記データからBig5パーソナリティを分析してください。JSON形式で返してください:
{
  "openness": 75,
  "conscientiousness": 80,
  "extraversion": 40,
  "agreeableness": 65,
  "neuroticism": 35,
  "summary": "あなたのパーソナリティの説明",
  "evidence": ["引用1", "引用2"]
}
各値は0-100の整数。JSON以外は返さないでください。`,

  strengths: `以下のタスク実績と日記から強みを分析してください。JSON形式で返してください:
{
  "top_strengths": [
    {"name": "構造化思考", "score": 90, "evidence": "具体的な根拠"},
    {"name": "実行力", "score": 85, "evidence": "具体的な根拠"}
  ],
  "work_fit": ["設計", "要件定義", "問題分析"],
  "summary": "あなたの強みの説明"
}
top_strengthsは3-5件。scoreは0-100。JSON以外は返さないでください。`,

  strengths_finder: `以下の日記データとタスク実績から、ストレングスファインダー(CliftonStrengths)の34資質のうちTop5を推定してください。JSON形式で返してください:
{
  "top_strengths": [
    {"name": "学習欲", "score": 92, "domain": "戦略的思考力", "evidence": "日記から読み取れる具体的な根拠"},
    {"name": "内省", "score": 88, "domain": "戦略的思考力", "evidence": "具体的な根拠"},
    {"name": "個別化", "score": 85, "domain": "人間関係構築力", "evidence": "具体的な根拠"},
    {"name": "達成欲", "score": 82, "domain": "実行力", "evidence": "具体的な根拠"},
    {"name": "着想", "score": 78, "domain": "戦略的思考力", "evidence": "具体的な根拠"}
  ],
  "domain_summary": {
    "strategic_thinking": {"score": 85, "label": "戦略的思考力"},
    "relationship_building": {"score": 60, "label": "人間関係構築力"},
    "influencing": {"score": 45, "label": "影響力"},
    "executing": {"score": 70, "label": "実行力"}
  },
  "work_fit": ["適した仕事や役割1", "適した仕事や役割2"],
  "growth_areas": ["伸ばせる領域や注意点1", "伸ばせる領域や注意点2"],
  "summary": "全体的な強みの説明"
}

34資質: 達成欲,活発性,適応性,分析思考,アレンジ,信念,指令性,コミュニケーション,競争性,結合性,公平性,慎重さ,原点思考,未来志向,調和性,着想,包含,個別化,収集心,内省,学習欲,最上志向,目標志向,親密性,責任感,回復志向,自己確信,自我,戦略性,共感性,成長促進,ポジティブ,規律性,社交性

4つのドメイン:
- 戦略的思考力(strategic_thinking): 分析思考,原点思考,未来志向,着想,収集心,内省,学習欲,戦略性
- 人間関係構築力(relationship_building): 適応性,結合性,共感性,調和性,包含,個別化,ポジティブ,親密性,成長促進
- 影響力(influencing): 活発性,指令性,コミュニケーション,競争性,最上志向,自己確信,自我,社交性
- 実行力(executing): 達成欲,アレンジ,信念,公平性,慎重さ,規律性,責任感,回復志向,目標志向

scoreは0-100。domain_summaryの各scoreも0-100。growth_areasは2-3件。
JSON以外は返さないでください。`,

  emotion_triggers: `以下の日記と感情データから感情トリガーを分析してください。JSON形式で返してください:
{
  "positive_triggers": [
    {"trigger": "一人の作業時間", "emotion": "joy", "frequency": 12}
  ],
  "negative_triggers": [
    {"trigger": "MTG後", "emotion": "anxiety", "frequency": 8}
  ],
  "patterns": ["火曜に不安が高まる傾向", "朝の方がポジティブ"],
  "summary": "感情パターンの説明"
}
JSON以外は返さないでください。`,

  values: `以下の日記と夢リストから価値観を分析してください。JSON形式で返してください:
{
  "values": [
    {"name": "成長", "rank": 1, "score": 95, "evidence": "具体的な根拠"},
    {"name": "自律", "rank": 2, "score": 88, "evidence": "具体的な根拠"}
  ],
  "changes": "最近の変化の記述",
  "summary": "価値観の説明"
}
valuesは5-7件。scoreは0-100。JSON以外は返さないでください。`,
}

/**
 * Collect data required for a given analysis type.
 * Returns the data as formatted text for the LLM prompt.
 */
async function collectData(type: AnalysisType): Promise<{ text: string; count: number }> {
  switch (type) {
    case 'mbti': {
      const { data } = await supabase
        .from('diary_entries')
        .select('body, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      const entries = data ?? []
      const text = entries
        .map((e: { body: string; created_at: string }) => `[${e.created_at.substring(0, 10)}] ${e.body}`)
        .join('\n\n')
      return { text, count: entries.length }
    }
    case 'big5': {
      const { data } = await supabase
        .from('diary_entries')
        .select('body, created_at')
        .order('created_at', { ascending: false })
        .limit(60)
      const entries = data ?? []
      const text = entries
        .map((e: { body: string; created_at: string }) => `[${e.created_at.substring(0, 10)}] ${e.body}`)
        .join('\n\n')
      return { text, count: entries.length }
    }
    case 'strengths': {
      const [taskRes, diaryRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('title, status, priority, completed_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('diary_entries')
          .select('body, created_at')
          .order('created_at', { ascending: false })
          .limit(30),
      ])
      const tasks = taskRes.data ?? []
      const diaries = diaryRes.data ?? []
      const taskText = tasks
        .map((t: { title: string; status: string; priority: string }) => `- [${t.status}][${t.priority}] ${t.title}`)
        .join('\n')
      const diaryText = diaries
        .map((e: { body: string; created_at: string }) => `[${e.created_at.substring(0, 10)}] ${e.body}`)
        .join('\n\n')
      return { text: `## タスク実績\n${taskText}\n\n## 日記\n${diaryText}`, count: tasks.length }
    }
    case 'strengths_finder': {
      const [taskRes, diaryRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('title, status, priority, completed_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('diary_entries')
          .select('body, created_at')
          .order('created_at', { ascending: false })
          .limit(80),
      ])
      const tasks = taskRes.data ?? []
      const diaries = diaryRes.data ?? []
      const taskText = tasks
        .map((t: { title: string; status: string; priority: string }) => `- [${t.status}][${t.priority}] ${t.title}`)
        .join('\n')
      const diaryText = diaries
        .map((e: { body: string; created_at: string }) => `[${e.created_at.substring(0, 10)}] ${e.body}`)
        .join('\n\n')
      return { text: `## タスク実績\n${taskText}\n\n## 日記\n${diaryText}`, count: diaries.length }
    }
    case 'emotion_triggers': {
      const [diaryRes, emotionRes] = await Promise.all([
        supabase
          .from('diary_entries')
          .select('id, body, created_at')
          .order('created_at', { ascending: false })
          .limit(60),
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
      const lines = diaries.map((d: { id: string; body: string; created_at: string }) => {
        const emo = emotionMap.get(d.id)
        const emoStr = emo
          ? ` | joy=${emo.joy} trust=${emo.trust} fear=${emo.fear} sadness=${emo.sadness} anger=${emo.anger} anticipation=${emo.anticipation} valence=${emo.valence}`
          : ''
        return `[${d.created_at.substring(0, 10)}] ${d.body}${emoStr}`
      })
      return { text: lines.join('\n\n'), count: diaries.length }
    }
    case 'values': {
      const [diaryRes, dreamsRes] = await Promise.all([
        supabase
          .from('diary_entries')
          .select('body, created_at')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('dreams')
          .select('title, description, category, status')
          .order('created_at', { ascending: false }),
      ])
      const diaries = diaryRes.data ?? []
      const dreams = dreamsRes.data ?? []
      const diaryText = diaries
        .map((e: { body: string; created_at: string }) => `[${e.created_at.substring(0, 10)}] ${e.body}`)
        .join('\n\n')
      const dreamText = dreams
        .map((d: { title: string; category: string; status: string }) => `- [${d.status}][${d.category}] ${d.title}`)
        .join('\n')
      return { text: `## 日記\n${diaryText}\n\n## 夢リスト\n${dreamText}`, count: diaries.length }
    }
  }
}

interface UseSelfAnalysisReturn {
  runAnalysis: (type: AnalysisType) => Promise<AnalysisRecord | null>
  running: boolean
  runningType: AnalysisType | null
  error: string | null
}

// NOTE: API key is sent from client for simplicity in personal use.
// For production/multi-user, move to Supabase Edge Function.

/**
 * Hook to execute self-analysis using OpenAI API.
 * Collects relevant data, sends to LLM, saves results to self_analysis table.
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
      // Collect data
      const { text: userData, count } = await collectData(type)

      if (!userData.trim()) {
        setError('分析に必要なデータが不足しています。')
        setRunning(false)
        setRunningType(null)
        return null
      }

      // Call AI via Edge Function
      const { content: resultText } = await aiCompletion(userData, {
        systemPrompt: PROMPTS[type],
        jsonMode: true,
        temperature: 0.4,
        maxTokens: 1500,
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
