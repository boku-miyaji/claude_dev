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

evidenceは日記やプロンプトログからの直接引用を5つ以上、[日付]付きで。

【日記データの構造的バイアス補正】
- E/I判定: 日記を書く行為は内向的なため、I方向にバイアスがかかる。友人との予定の頻度、人と会う記述の多さも考慮すること
- S/N判定: 前述の注意に加え、日記特有の具体的記述（〜に行った）でS判定に引っ張られない
- T/F判定: 日記は感情表現が多いためF方向にバイアスがかかる。意思決定の根拠（論理的か感情的か）で判断
- J/P判定: タスク管理データの完了率・計画性から補正

【行動データの活用】
入力にはプロンプトログ（AIへの指示履歴）、タスク管理データ、スケジュールも含まれます:
- プロンプトの指示の仕方 → コミュニケーションスタイル、リーダーシップタイプ
- 活動時間帯 → 生活リズム、集中パターン
- タスク完了率/未完了 → 実行力、先延ばし傾向
- カレンダーの人との予定頻度 → E/I補正
- タグの分布 → 関心領域の偏り
これらも性格分析の根拠として活用してください。
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
各値は0-100の整数。evidenceは5つ以上。

【日記データの構造的バイアス補正】
- 開放性: 日記に新しい体験を書くのは自然なことで、実際より高く出やすい。「新しいことを試す頻度」ではなく「未知への態度」で判断
- 誠実性: タスク完了率（done/open比率）から客観的に補正。日記の「やらなきゃ」は意図であり行動ではない
- 外向性: 日記は一人で書くものなので低く出やすい。カレンダーの人との予定頻度、友人関連の記述頻度から補正
- 協調性: 対人摩擦は日記に書かれやすいが、日常の協調行動は書かれにくい。摩擦の記述だけで低く判定しない
- 神経症傾向: 日記には悩みが集中するため高く出やすい。全日記中の悩み記述の「割合」で判断し、ポジティブ記述との比率を見る

【行動データの活用】
プロンプトログの指示パターン、タスク完了率、活動時間帯、カレンダーの予定も分析に含めてください。
JSON以外は返さないでください。`

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

top_strengthsは5件。scoreは0-100。growth_areasは3件。

【重要: 日記データの構造的バイアスを補正すること】
日記・テキストデータから資質を推定する際、以下のバイアスが系統的に発生します。必ず補正してください:

1. **戦略的思考の過大評価バイアス**: 日記を書く行為自体が内省的であるため、内省(Intellection)・学習欲(Learner)・着想(Ideation)・戦略性(Strategic)が実際より高く検出される。テキストから「考えている内容」は見えやすいが、それが本当にTop資質かは別問題。
2. **人間関係構築の過小評価バイアス**: 親密性(Relator)・ポジティブ(Positivity)・調和性(Harmony)・成長促進(Developer)は「行動」として現れるため、テキストからは検出しにくい。友人との関わり方、人を励ます行動、対立を避ける傾向などの間接的な証拠に注目すること。
3. **ネガティブバイアス**: 日記には悩みや問題が多く書かれるため、ポジティブ(Positivity)の資質が見落とされやすい。「楽しかった」「嬉しかった」等のポジティブ記述の頻度に注目。
4. **影響力ドメインの検出**: コミュニケーション(Communication)・活発性(Activator)・最上志向(Maximizer)は、他者との相互作用の記述から推定する。プロンプトログの指示の仕方（積極的か受動的か）も参考に。

【補正手順】
- まず全34資質をバイアスなしで評価し、次にバイアス1-4を適用してTop5を再ランキングする
- 特に「人間関係に関する記述の頻度」と「人と会う予定の頻度」を数え、人間関係構築ドメインの資質を適正に評価する
- 戦略的思考ドメインの資質は、日記に現れやすいため1-2段階割り引いて評価する

【行動データの活用】
プロンプトログ（AIへの指示の仕方）はコミュニケーション資質、リーダーシップスタイルの分析に有用。
タスク管理データは実行力ドメインの資質（達成欲、規律性、責任感等）の推定に直結。
カレンダーの予定パターン（人と会う頻度、1対1 vs グループ）は人間関係構築ドメインの判断材料。
JSON以外は返さないでください。`

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
valuesは5-7件。scoreは0-100。

【行動データの活用】
プロンプトのタグ分布やタスクの内容から、実際に時間を費やしている領域（＝真の価値観）を推定。
日記で語る価値観と実際の行動の乖離があればそれも指摘。
JSON以外は返さないでください。`

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

/**
 * Collect ALL available data sources for analysis.
 * Shared across all analysis types — the prompt decides what to focus on.
 * In delta mode (since != null), only fetches new entries.
 */
async function collectData(
  _type: AnalysisType,
  since: string | null,
): Promise<{ text: string; count: number }> {

  // --- 1. Diary entries (core) ---
  let diaryQ = supabase.from('diary_entries').select('body, entry_date, created_at')
  if (since) diaryQ = diaryQ.gt('created_at', since)
  const diaryRes = await diaryQ.order('entry_date', { ascending: false }).limit(80)
  const diaries = (diaryRes.data ?? []) as unknown as { body: string; entry_date: string }[]
  const diaryText = diaries.map(e => `[${e.entry_date}] ${e.body}`).join('\n\n')

  // --- 2. Prompt log (behavioral: how they think, what they ask, when) ---
  let promptQ = supabase.from('prompt_log').select('prompt, tags, created_at')
  if (since) promptQ = promptQ.gt('created_at', since)
  const promptRes = await promptQ.order('created_at', { ascending: false }).limit(200)
  const prompts = (promptRes.data ?? []) as unknown as { prompt: string; tags: string[]; created_at: string }[]

  // Behavioral summary from prompts
  const tagCounts: Record<string, number> = {}
  const hourCounts: Record<number, number> = {}
  for (const p of prompts) {
    for (const t of (p.tags ?? [])) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1
    }
    const h = new Date(p.created_at).getHours()
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([t, c]) => `${t}: ${c}回`).join(', ')
  const peakHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([h, c]) => `${h}時: ${c}回`).join(', ')
  // Sample prompts (how they give instructions — leadership/communication style)
  const samplePrompts = prompts.slice(0, 30)
    .map(p => `[${p.created_at.substring(0, 16)}] ${p.prompt.substring(0, 150)}`)
    .join('\n')

  // --- 3. Tasks (execution patterns) ---
  const taskRes = await supabase.from('tasks').select('title, status, created_at, completed_at')
    .order('created_at', { ascending: false }).limit(100)
  const tasks = (taskRes.data ?? []) as unknown as { title: string; status: string; created_at: string; completed_at: string | null }[]
  const tasksDone = tasks.filter(t => t.status === 'done').length
  const tasksOpen = tasks.filter(t => t.status === 'open').length
  const taskList = tasks.slice(0, 30)
    .map(t => `- [${t.status}] ${t.title}${t.completed_at ? ` (完了: ${t.completed_at.substring(0, 10)})` : ''}`)
    .join('\n')

  // --- 4. Calendar (time management) ---
  const calRes = await supabase.from('calendar_events').select('title, start_time, end_time, is_all_day')
    .order('start_time', { ascending: false }).limit(50)
  const events = (calRes.data ?? []) as unknown as { title: string; start_time: string; end_time: string; is_all_day: number }[]
  const calText = events.slice(0, 20)
    .map(e => `- ${e.start_time.substring(0, 16)} ${e.title}`)
    .join('\n')

  // --- 5. Dreams/Goals ---
  const dreamsRes = await supabase.from('dreams').select('title, description, category, status')
    .order('created_at', { ascending: false })
  const dreams = (dreamsRes.data ?? []) as unknown as { title: string; category: string; status: string }[]
  const dreamText = dreams.map(d => `- [${d.status}][${d.category}] ${d.title}`).join('\n')

  // --- Combine all ---
  const sections = [
    `## 日記 (${diaries.length}件)\n${diaryText}`,
    `## 行動分析: プロンプトログ (${prompts.length}件)\nよく使うタグ: ${topTags}\n活動ピーク時間帯(UTC): ${peakHours}\n\n### 指示サンプル（コミュニケーションスタイル分析用）\n${samplePrompts}`,
    `## タスク管理 (完了${tasksDone}件 / 未完了${tasksOpen}件)\n${taskList}`,
    events.length > 0 ? `## スケジュール (${events.length}件)\n${calText}` : '',
    dreams.length > 0 ? `## 夢・目標\n${dreamText}` : '',
  ].filter(Boolean).join('\n\n')

  return { text: sections, count: diaries.length + prompts.length }
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
      const { content: resultText } = await aiCompletion(userData, { source: 'self_analysis',
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
