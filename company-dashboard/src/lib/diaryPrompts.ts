/**
 * Diary prompt library — コーチの良問いを日記プロンプトに変換する。
 *
 * 設計思想: design-philosophy.md「コーチングを超える」セクション参照。
 * ヒアリングが必要な深い問い（価値観・幸せの瞬間・失敗パターン等）を
 * 日記プロンプトとして毎日浴びる状態を作る。
 */

import type { TimeMode } from './timeMode'

/** 問いの軸。価値の3層構造 (観察 → 言語化 → 行動) の Layer 1 を網羅する。 */
export type PromptAxis =
  | 'values'           // 価値観 — 何を大事にしているか
  | 'joy'              // 幸せの瞬間 — 何に喜びを感じるか
  | 'failure_pattern'  // 失敗パターン — どう躓きがちか
  | 'action'           // 行動 — 実際にやっていること
  | 'relationships'    // 人間関係 — 誰とどう関わるか
  | 'decisions'        // 意思決定 — どう選ぶか
  | 'inner'            // 内面・感情 — 今の状態
  | 'positive'         // ポジティブ — ネガティブバイアス対策

/** 問いの深さ。浅い問いは日常、深い問いは月1で良い。 */
export type PromptDepth = 'light' | 'medium' | 'deep'

export interface DiaryPrompt {
  text: string
  axis: PromptAxis
  depth: PromptDepth
  /** Narrator Theme Finder がどのカード生成に使うか */
  feeds?: ('values' | 'joy_triggers' | 'failure_patterns' | 'energy_sources' | 'recovery_style')[]
}

/**
 * 問いライブラリ本体。
 * 各軸15〜20問を目安に、浅〜深の3段階で揃える。
 * コーチング本・ACT・ポジティブ心理学の問いを下敷きにしている。
 */
export const DIARY_PROMPTS: DiaryPrompt[] = [
  // ─── 価値観 (values) ───────────────────────────────
  { text: '今日「これは譲れない」と思った瞬間は？', axis: 'values', depth: 'medium', feeds: ['values'] },
  { text: '今の生活で一番大事にしていることは何？', axis: 'values', depth: 'deep', feeds: ['values'] },
  { text: '今日、自分の選択に「ああ、やっぱりこういう時の自分だな」と思ったことは？', axis: 'values', depth: 'deep', feeds: ['values'] },
  { text: '尊敬している人の、どんなところを尊敬している？', axis: 'values', depth: 'deep', feeds: ['values'] },
  { text: '最近「これは違う」と違和感を覚えたことは？その違和感の正体は？', axis: 'values', depth: 'medium', feeds: ['values'] },
  { text: 'お金と時間、どちらが減るのがイヤ？それはなぜ？', axis: 'values', depth: 'medium', feeds: ['values'] },
  { text: '今日、自分の中で「これは譲った」ことは？譲って良かった？', axis: 'values', depth: 'medium', feeds: ['values'] },
  { text: '「こういう人にはなりたくない」と思う像は？', axis: 'values', depth: 'deep', feeds: ['values'] },
  { text: '今年中に、何を大事にして過ごしたい？', axis: 'values', depth: 'medium', feeds: ['values'] },
  { text: '最近の自分の行動で、自分らしいと思えるのは？', axis: 'values', depth: 'medium', feeds: ['values'] },

  // ─── 幸せの瞬間 (joy) ────────────────────────────
  { text: '今日の小さな幸せは何だった？', axis: 'joy', depth: 'light', feeds: ['joy_triggers'] },
  { text: '今日「これ好きだな」と思った瞬間は？', axis: 'joy', depth: 'light', feeds: ['joy_triggers'] },
  { text: '最近、時間を忘れて没頭したことは？', axis: 'joy', depth: 'medium', feeds: ['joy_triggers', 'energy_sources'] },
  { text: 'エネルギーが湧いてきた瞬間は？逆に消耗した瞬間は？', axis: 'joy', depth: 'medium', feeds: ['energy_sources'] },
  { text: '今日一番笑った瞬間は？何がおかしかった？', axis: 'joy', depth: 'light', feeds: ['joy_triggers'] },
  { text: '最近、誰かに話したくなったことは？', axis: 'joy', depth: 'light', feeds: ['joy_triggers'] },
  { text: '今日の「ありがとう」と思った瞬間は？', axis: 'joy', depth: 'light', feeds: ['joy_triggers'] },
  { text: '最近、自分を褒めてあげたいと思ったことは？', axis: 'joy', depth: 'medium', feeds: ['joy_triggers'] },
  { text: '何もしていない時間で、満たされたのはいつ？', axis: 'joy', depth: 'deep', feeds: ['recovery_style'] },
  { text: '今週、一番エネルギーをもらえた出来事は？', axis: 'joy', depth: 'medium', feeds: ['energy_sources'] },

  // ─── 失敗パターン (failure_pattern) ──────────────────
  // 責めるのではなく観察する。「動けない日」も記録対象。
  { text: '今日、うまくいかなかったことは？なぜそうなったと思う？', axis: 'failure_pattern', depth: 'medium', feeds: ['failure_patterns'] },
  { text: '後回しにしていることはある？後回しにする理由は何？', axis: 'failure_pattern', depth: 'medium', feeds: ['failure_patterns'] },
  { text: '今日「動けなかった」時間はある？その時、何を考えていた？', axis: 'failure_pattern', depth: 'medium', feeds: ['failure_patterns'] },
  { text: '最近、同じことでつまずいたなと思うのは？', axis: 'failure_pattern', depth: 'deep', feeds: ['failure_patterns'] },
  { text: 'プレッシャーを感じた時、自分はどうなりがち？', axis: 'failure_pattern', depth: 'deep', feeds: ['failure_patterns'] },
  { text: '疲れている時の自分のクセはある？', axis: 'failure_pattern', depth: 'medium', feeds: ['failure_patterns', 'recovery_style'] },
  { text: '避けてきたことは？避ける理由は？', axis: 'failure_pattern', depth: 'deep', feeds: ['failure_patterns'] },
  { text: '最近、自分にがっかりした瞬間は？', axis: 'failure_pattern', depth: 'deep', feeds: ['failure_patterns'] },
  { text: '言い訳したくなる時、どんなことを言い訳にしがち？', axis: 'failure_pattern', depth: 'deep', feeds: ['failure_patterns'] },
  { text: '今日「先のことが気になって今が動けない」瞬間はあった？', axis: 'failure_pattern', depth: 'medium', feeds: ['failure_patterns'] },

  // ─── 行動 (action) ──────────────────────────────
  { text: '今日、一番時間を使ったことは？', axis: 'action', depth: 'light' },
  { text: '計画通りにできたこと、できなかったことは？', axis: 'action', depth: 'light' },
  { text: '今日、自分から始めたことはある？', axis: 'action', depth: 'light' },
  { text: '今日、新しく試したことはある？', axis: 'action', depth: 'light' },
  { text: '最近、誰かに頼まれて動いたことは？', axis: 'action', depth: 'light' },
  { text: '今日、無意識にやっていた行動で気づいたことは？', axis: 'action', depth: 'medium' },

  // ─── 人間関係 (relationships) ─────────────────────
  { text: '今日、誰と話した？その時どんな気持ちだった？', axis: 'relationships', depth: 'light' },
  { text: '1対1で深く話せた相手は最近いる？', axis: 'relationships', depth: 'medium' },
  { text: '今日、誰かのために何かした？', axis: 'relationships', depth: 'light' },
  { text: '最近、会って元気が出た人は？', axis: 'relationships', depth: 'medium', feeds: ['energy_sources'] },
  { text: '最近、会った後に疲れた人は？その疲れの正体は？', axis: 'relationships', depth: 'deep', feeds: ['failure_patterns'] },
  { text: '誰かと意見が合わなかった時、どう対応した？', axis: 'relationships', depth: 'medium' },
  { text: '今、一番近くにいてくれる存在は誰？', axis: 'relationships', depth: 'deep' },
  { text: '最近、人との距離感で考えたことは？', axis: 'relationships', depth: 'deep' },

  // ─── 意思決定 (decisions) ────────────────────────
  { text: '今日、迷って決めたことは？何が決め手だった？', axis: 'decisions', depth: 'medium', feeds: ['values'] },
  { text: '最近、直感で決めたことと論理で決めたこと、どちらが多い？', axis: 'decisions', depth: 'medium' },
  { text: '今日「やらない」と決めたことは？', axis: 'decisions', depth: 'medium', feeds: ['values'] },
  { text: '過去の自分の判断で、今でも正解だったと思うのは？', axis: 'decisions', depth: 'deep', feeds: ['values'] },
  { text: '今、保留にしている判断はある？何が決め手待ち？', axis: 'decisions', depth: 'medium' },

  // ─── 内面・感情 (inner) ───────────────────────────
  { text: '今の気持ちを一言で表すと？', axis: 'inner', depth: 'light' },
  { text: '今日一番印象に残ったことは何？', axis: 'inner', depth: 'light' },
  { text: '今、一番気になっていることは？', axis: 'inner', depth: 'light' },
  { text: '最近、一人の時間で何をしていた？', axis: 'inner', depth: 'medium', feeds: ['recovery_style'] },
  { text: '最近、自分の成長を感じたことは？', axis: 'inner', depth: 'medium' },
  { text: '今日、体と心どちらが疲れてる？', axis: 'inner', depth: 'light' },
  { text: '明日の自分に一言伝えるなら？', axis: 'inner', depth: 'light' },

  // ─── ポジティブ (positive) — ネガティブバイアス対策 ───
  { text: '今日うまくいったことは？（どんなに小さくてもOK）', axis: 'positive', depth: 'light' },
  { text: '最近、場の雰囲気を明るくした場面はあった？', axis: 'positive', depth: 'medium' },
  { text: '感謝したいことは？', axis: 'positive', depth: 'light' },
  { text: '今日、楽しみにしていることは？', axis: 'positive', depth: 'light' },
  { text: '最近、誰かに言われて嬉しかった言葉は？', axis: 'positive', depth: 'medium' },
]

/** 時間帯ごとに優先して出す軸 */
const TIME_MODE_AXES: Record<TimeMode, PromptAxis[]> = {
  morning:   ['action', 'values', 'decisions'],
  afternoon: ['inner', 'joy', 'relationships'],
  evening:   ['positive', 'joy', 'values', 'inner', 'failure_pattern'],
}

/**
 * 入力用の短いプロンプト（日記入力欄のplaceholder相当）。
 * 時間帯と直近MTG名で最適化する。軽めの問いを返す。
 */
export function getDiaryPrompt(mode: TimeMode, recentEventName?: string): string {
  if (mode === 'afternoon' && recentEventName) {
    return `${recentEventName}の後、何か思ったことは？`
  }
  const axes = TIME_MODE_AXES[mode]
  const candidates = DIARY_PROMPTS.filter(
    (p) => axes.includes(p.axis) && p.depth === 'light',
  )
  if (candidates.length === 0) {
    return mode === 'morning' ? '今日やりたいことは？' : '今、頭に浮かんでいることは？'
  }
  // 日付ベースの決定的ローテーション
  const seed = new Date().getDate() + new Date().getMonth() * 31
  return candidates[seed % candidates.length].text
}

/**
 * Today画面の「今日の問い」カード用。浅い問いに加えて、
 * 数日に一度は深い問いを混ぜる設計。Layer 2 (言語化) を狙う。
 */
export function getTodayQuestions(todayStr: string): DiaryPrompt[] {
  // 決定的シード
  const seed = todayStr.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0)

  // 軸を2つ選択。日付でローテーション。
  const allAxes: PromptAxis[] = [
    'values', 'joy', 'failure_pattern', 'action',
    'relationships', 'decisions', 'inner', 'positive',
  ]
  const axis1 = allAxes[seed % allAxes.length]
  const axis2 = allAxes[(seed + 3) % allAxes.length]

  // 週に1回くらい、深い問いを混ぜる
  const injectDeep = seed % 7 === 0

  function pickFromAxis(axis: PromptAxis, preferDeep: boolean): DiaryPrompt | null {
    const pool = DIARY_PROMPTS.filter(
      (p) => p.axis === axis && (preferDeep ? p.depth !== 'light' : true),
    )
    if (pool.length === 0) return null
    return pool[seed % pool.length]
  }

  const q1 = pickFromAxis(axis1, injectDeep)
  const q2 = pickFromAxis(axis2, false)

  const result: DiaryPrompt[] = []
  if (q1) result.push(q1)
  if (q2 && q2.text !== q1?.text) result.push(q2)
  return result
}

/** Narrator (Theme Finder) が特定のカード生成に使える問い一覧を返す */
export function getPromptsFeedingCard(
  card: 'values' | 'joy_triggers' | 'failure_patterns' | 'energy_sources' | 'recovery_style',
): DiaryPrompt[] {
  return DIARY_PROMPTS.filter((p) => p.feeds?.includes(card))
}
