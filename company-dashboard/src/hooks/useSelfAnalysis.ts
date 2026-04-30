import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { aiCompletion } from '@/lib/edgeAi'

export type AnalysisType = 'mbti' | 'big5' | 'strengths_finder' | 'emotion_triggers' | 'values' | 'stress_resilience' | 'communication_style'

export interface AnalysisContext {
  key_evidence: string[]              // 核心的な引用 3-5件
  data_stats: {
    total_entries: number
    emotion_avg: Record<string, number>
    wbi_avg: number
    wbi_trend: 'improving' | 'stable' | 'declining'
    top_topics: string[]
    date_range: { from: string; to: string }
  }
  confidence_notes: string            // 確信度に関するメモ
}

export interface AnalysisRecord {
  id: number
  analysis_type: AnalysisType
  result: Record<string, unknown>
  summary: string | null
  data_count: number
  model_used: string | null
  created_at: string
  analysis_context?: AnalysisContext | null
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
  "description": {
    "core_insight": "あなたの本質を2-3文で。一般的なINFP解説ではなく、この人の日記から読み取った独自の解釈。「あなたは〜」で始め、その人だけに当てはまる言葉で。",
    "daily_patterns": [
      {"pattern": "パターン名（例: 朝の内省タイム）", "detail": "日記のどんな記述からこのパターンが見えるか。具体的な日付と引用を含めて説明", "quote": "[日付] 日記からの直接引用"},
      {"pattern": "パターン2", "detail": "説明", "quote": "[日付] 引用"},
      {"pattern": "パターン3", "detail": "説明", "quote": "[日付] 引用"}
    ],
    "strengths_in_action": [
      {"strength": "強みの名前", "detail": "日記のどの場面でこの強みが活きているか具体的に", "quote": "[日付] 引用"},
      {"strength": "強み2", "detail": "説明", "quote": "[日付] 引用"},
      {"strength": "強み3", "detail": "説明", "quote": "[日付] 引用"}
    ],
    "growth_edges": [
      {"edge": "伸びしろの名前（ポジティブなフレーミング）", "detail": "なぜこれが伸びしろと言えるか。日記のどんな場面から読み取れるか", "suggestion": "具体的にどうすれば伸ばせるか"},
      {"edge": "伸びしろ2", "detail": "説明", "suggestion": "提案"},
      {"edge": "伸びしろ3", "detail": "説明", "suggestion": "提案"}
    ],
    "advice": [
      {"title": "アドバイスの見出し", "detail": "日記のデータに基づく具体的なアドバイス。汎用的な「休みましょう」「瞑想しましょう」は禁止。この人の生活パターンに合わせた提案を"},
      {"title": "アドバイス2", "detail": "説明"},
      {"title": "アドバイス3", "detail": "説明"}
    ]
  }${prev ? ',\n  "changes_from_previous": "前回からの変化の説明"' : ''}
}

scoreは-100(左)〜100(右): E_I(-100=E, 100=I), S_N(-100=S, 100=N), T_F(-100=T, 100=F), J_P(-100=J, 100=P)

【重要: descriptionはオブジェクト（構造化JSON）で返すこと。文字列ではなく上記の構造に厳密に従うこと。】

【S/N判定の重要な注意】
日記データでは「〜に行った」「〜を食べた」等のS的記述が自然に多くなります。
S/Nの判定では「体験の記述方法」ではなく「思考パターン」に注目してください:
- N（直観）: 「自分探し」「意味を問う」「理想主義的」「抽象的概念」「もし〜だったら」
- S（感覚）: 「今を楽しむ」「感覚的快楽が目的」「実用的・現実的な判断」
例: INFP（仲介者）は体験を「意味づけ」し、ISFP（冒険家）は体験を「味わう」。

type_nameは16personalitiesの日本語名称: INTJ=建築家, INFP=仲介者, ISFP=冒険家, ENFJ=主人公, ENTP=討論者, ISTJ=管理者, INFJ=提唱者, ENFP=広報運動家, ISTP=巨匠, ENTJ=指揮官, INTP=論理学者, ESFP=エンターテイナー, ESFJ=領事官, ESTP=起業家, ISFJ=擁護者, ESTJ=幹部

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
  "summary": {
    "profile_narrative": "あなたのBig5プロファイルを物語的に説明。3-4文で、この人の日記を読んだからこそ書ける具体的な人物像を描く。「あなたは〜」で始め、スコアの数字を繰り返すのではなく、生きた人間として描写する。",
    "trait_insights": [
      {"trait": "開放性", "score_meaning": "このスコアが意味すること。日記のどんな行動・思考パターンからこのスコアになったか具体的に。一般論ではなく、この人の日記の引用を含めて説明。", "quote": "[日付] 引用"},
      {"trait": "誠実性", "score_meaning": "説明", "quote": "[日付] 引用"},
      {"trait": "外向性", "score_meaning": "説明", "quote": "[日付] 引用"},
      {"trait": "協調性", "score_meaning": "説明", "quote": "[日付] 引用"},
      {"trait": "神経症傾向", "score_meaning": "説明", "quote": "[日付] 引用"}
    ],
    "trait_interactions": [
      {"combo": "特性A x 特性B", "insight": "2つの特性の掛け算で見えること。例:「開放性が高く誠実性も高いので、新しいことを始めるだけでなく完遂もできる」。日記の具体例も添えて。"},
      {"combo": "特性C x 特性D", "insight": "説明"}
    ],
    "advice": [
      {"title": "アドバイスの見出し", "detail": "日記のデータに基づく具体的なアドバイス。この人のBig5プロファイルを踏まえて、日常生活で活かせる実践的な提案。"},
      {"title": "アドバイス2", "detail": "説明"},
      {"title": "アドバイス3", "detail": "説明"}
    ]
  },
  "evidence": ["[日付] 引用1", "[日付] 引用2", ...]${prev ? ',\n  "changes_from_previous": "前回からの変化の説明"' : ''}
}
各値は0-100の整数。evidenceは5つ以上。

【重要: summaryはオブジェクト（構造化JSON）で返すこと。文字列ではなく上記の構造に厳密に従うこと。】

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
    {"name": "内省", "name_en": "Intellection", "score": 92, "domain": "戦略的思考力", "evidence": [
      {"point": "なぜこれがあなたの強みと言えるか（1つ目の根拠）", "quote": "[日付] 日記からの直接引用"},
      {"point": "2つ目の根拠", "quote": "[日付] 引用"},
      {"point": "3つ目の根拠", "quote": "[日付] 引用"}
    ]},
    ...
  ],
  "domain_summary": {
    "strategic_thinking": {"score": 85, "label": "戦略的思考力", "description": "この領域の説明"},
    "relationship_building": {"score": 60, "label": "人間関係構築力", "description": "説明"},
    "influencing": {"score": 45, "label": "影響力", "description": "説明"},
    "executing": {"score": 70, "label": "実行力", "description": "説明"}
  },
  "synergy": [
    {"combo": "資質A x 資質B", "insight": "2つの資質の掛け算で生まれる力。例: 「内省 x 学習欲 → 表面的な理解で終わらず、本質を掘り下げる深い理解力」。日記の具体例も。"},
    {"combo": "資質C x 資質D", "insight": "説明"}
  ],
  "blind_spot": [
    {"point": "この強みの組み合わせが引き起こしうる盲点。例: 「戦略的思考に偏ると、考えすぎて行動が遅れることがある」", "mitigation": "どう対処すればいいか"}
  ],
  "action_plan": [
    {"action": "明日からできる具体的アクション1。この人の生活パターンに合わせた提案。", "why": "なぜこのアクションがこの人に効果的か"},
    {"action": "アクション2", "why": "理由"},
    {"action": "アクション3", "why": "理由"}
  ],
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

top_strengthsは5件。scoreは0-100。growth_areasは3件。synergyは2-3件。blind_spotは1-2件。action_planは3件。
各強みのevidenceは配列で3つの根拠を示すこと（各根拠にpointとquoteを含む）。

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
    {"name": "成長", "rank": 1, "score": 95, "evidence": [
      {"point": "なぜこの価値観がスコアXなのか、1つ目の根拠", "quote": "[日付] 日記からの直接引用"},
      {"point": "2つ目の根拠", "quote": "[日付] 引用"}
    ]},
    ...
  ],
  "tension": [
    {"values": ["価値観A", "価値観B"], "detail": "この2つの価値観が矛盾・葛藤を起こしている場面。例: 「成長を求めて挑戦したいが、安定も手放せない」。日記の具体例付き。", "quote": "[日付] 引用"}
  ],
  "alignment": {
    "aligned": [{"value": "価値観名", "detail": "日記で語っている価値観と実際の行動が一致している例"}],
    "gap": [{"value": "価値観名", "stated": "日記で語っている理想", "actual": "実際の行動パターン", "detail": "ギャップの具体的な説明"}]
  },
  "life_question": [
    "この価値観分析から浮かぶ「あなたへの問い」。自己対話を促す深い問い。例: 「あなたが本当に大切にしたいのは"成長すること"なのか、"成長している自分を感じること"なのか？」"
  ],
  "changes": "最近の価値観の変化の記述（200字以上）",
  "summary": "価値観の全体説明（300字以上）"${prev ? ',\n  "changes_from_previous": "前回の分析からの具体的な変化"' : ''}
}
valuesは5-7件。scoreは0-100。各valueのevidenceは配列で2-3個の根拠。tensionは0-2件（葛藤がなければ空配列）。life_questionは1-2個。

【重要: evidenceは配列（構造化JSON）で返すこと。文字列ではなく上記の構造に厳密に従うこと。】

【日記データの構造的バイアス補正】
- 日記に書く価値観 = 「言語化できる価値観」。実際の行動で示す価値観とのギャップを必ず alignment.gap で示す
- 「成長」「自由」「自己実現」「貢献」は日記書く人の母集団で**高く出やすい平凡な価値観**。これを Top に置くだけでは差別化されない。**この人特有の組み合わせ・優先順位・対立構造**を捉える
- 価値観の対立 (tension) こそが個性の核。葛藤しないテーマは深層の価値観ではない可能性が高い
- Roots / Career からの「実際の選択」と、日記が語る価値観の整合性で本物を判定する
- 価値観名は抽象語（成長/愛/正義）に逃げず、**この人にとっての具体的な意味**で書く（例: 「成長 = 自分にしか出せない価値を発見し続けること」）

【行動データの活用】
- プロンプトのタグ分布やタスクの内容から、実際に時間を費やしている領域（＝真の価値観）を推定
- Career で選んだ組織・役割 → 何を優先してきたか
- Roots の Q&A で「諦めたもの」「選んだもの」 → 価値観の歴史的形成
- 日記で語る価値観と実際の行動の乖離があれば alignment.gap に記載

JSON以外は返さないでください。`

  if (prev) {
    const prevVals = (prev.values as {name:string;rank:number;score:number}[])?.map(v => `#${v.rank} ${v.name}(${v.score})`).join(', ')
    return base + `\n\n【前回の分析結果】\n${prevVals}\n\n新しい日記から優先順位やスコアの変動があればchanges_from_previousに記載。`
  }
  return base
}

function stressResiliencePrompt(prev: Record<string, unknown> | null): string {
  const base = `以下の日記・行動データ・ライフストーリーから、この人のストレス耐性プロファイルを分析してください。JSON形式で返してください:
{
  "resilience_score": 1-10,
  "burnout_risk": "low" | "medium" | "high",
  "burnout_signals": ["バーンアウトの初期サイン3-4つ。早期警告として参照できる具体的なもの"],
  "stress_triggers": [
    {"trigger": "引き金1（具体的に）", "context": "どういう状況・条件で発動するか", "frequency": "weekly/monthly/occasional", "quote": "[日付] 日記からの直接引用"},
    {"trigger": "引き金2", "context": "...", "frequency": "...", "quote": "[日付] 引用"},
    {"trigger": "引き金3", "context": "...", "frequency": "...", "quote": "[日付] 引用"}
  ],
  "coping_strategies": [
    {"strategy": "対処法1（行動レベルで）", "effectiveness": "high/medium/low", "evidence": "[日付] この対処が効いた場面の引用"},
    {"strategy": "対処法2", "effectiveness": "...", "evidence": "[日付] 引用"},
    {"strategy": "対処法3", "effectiveness": "...", "evidence": "[日付] 引用"}
  ],
  "recovery_pattern": {
    "speed": "fast/moderate/slow",
    "method": "回復に効いている要素を具体的に",
    "narrative": "回復パターンの説明（2-3文、引用付き）"
  },
  "growth_through_stress": [
    {"insight": "ストレス経験から得た成長・学び", "evidence": "[日付] 引用"},
    {"insight": "成長2", "evidence": "[日付] 引用"}
  ],
  "advice": [
    {"title": "推奨アクション1（見出し）", "detail": "この人のストレスパターンに合わせた具体的提案。汎用的な『瞑想しましょう』『休みましょう』は禁止", "when": "どのタイミング・状況で使うか"},
    {"title": "アクション2", "detail": "説明", "when": "..."},
    {"title": "アクション3", "detail": "説明", "when": "..."}
  ],
  "profile_narrative": "この人のストレス耐性を3-4文で物語的に描写。Roots（ライフストーリー）の文脈も踏まえて、過去どう困難に対処してきたかを反映させる"${prev ? ',\n  "changes_from_previous": "前回からの変化（スコア・リスク評価・新たに見えたパターン）"' : ''}
}

【日記データの構造的バイアス補正】
- 日記には悩み・ストレス記述が集中するため、burnout_risk が高く判定されやすい。**全日記中の「悩み記述の割合」と「ポジティブ記述との比率」**で判断する
- 「ストレスを書ける = 言語化できている」は本人のリソースであり、書けない人より対処能力が高い。resilience_score の下方修正に注意
- 一過性の悩み（その日の出来事）と慢性的なストレス（同パターンの反復）を区別する
- Roots（ライフストーリー）に過去の困難への対処エピソードがあれば、現在のストレス耐性の基盤として参照する

【行動データの活用】
- タスクの完了率/未完了 → 急減なら実行力低下＝燃え尽きの初期サイン
- 活動時間帯の崩れ（深夜・早朝への偏り） → 睡眠リズム崩壊のシグナル
- カレンダーの予定密度 → スケジュール過密度
- プロンプトログのトーン変化 → イライラ・焦燥の度合い
- 日記の文体が短文・断片化 → 余裕なし

JSON以外は返さないでください。`

  if (prev) {
    return base + `\n\n【前回の分析結果】\nresilience_score=${prev.resilience_score}, burnout_risk=${prev.burnout_risk}\n\n新しいデータからスコア・リスク評価・パターンに変動があれば changes_from_previous に記載。`
  }
  return base
}

function communicationStylePrompt(prev: Record<string, unknown> | null): string {
  const base = `以下の日記・行動データ・ライフストーリーから、この人のコミュニケーションスタイルを分析してください。JSON形式で返してください:
{
  "primary_style": "analytical" | "driver" | "expressive" | "amiable",
  "secondary_style": "analytical" | "driver" | "expressive" | "amiable",
  "style_blend": {
    "analytical": 0,
    "driver": 0,
    "expressive": 0,
    "amiable": 0
  },
  "communication_preferences": [
    {"preference": "好む方法1（具体的に）", "context": "どういう場面で発揮されるか", "evidence": "[日付] 引用"},
    {"preference": "好む方法2", "context": "...", "evidence": "[日付] 引用"},
    {"preference": "好む方法3", "context": "...", "evidence": "[日付] 引用"}
  ],
  "conflict_approach": {
    "default_response": "対立時の最初の反応（回避/直面/委ねる/分析するなど）",
    "preferred_resolution": "好む解決方法",
    "evidence": "[日付] 対立場面の引用"
  },
  "listening_style": {
    "type": "深く聞く / 効率的に聞く / 共感的 / 分析的 / 受容的 など",
    "evidence": "[日付] 引用",
    "blind_spot": "聞き方の盲点（あれば）"
  },
  "team_role": {
    "natural_role": "チームでの自然な役割（言語化）",
    "what_brings_out_best": "この人が最も力を発揮する場面",
    "evidence": "[日付] 引用"
  },
  "ai_interaction_style": "プロンプトログから読み取った『AIへの指示の仕方』の特徴。命令形/相談形、長文/短文、丁寧/簡潔、目的優先/関係優先など。コミュニケーションの『素』に近い",
  "with_close_others_vs_strangers": "近い人と初対面の人で態度がどう変わるか（Rootsからも参照）",
  "advice": [
    {"title": "推奨アクション1", "detail": "この人のスタイルを活かす/補う具体的提案", "scenario": "使う場面"},
    {"title": "アクション2", "detail": "説明", "scenario": "..."},
    {"title": "アクション3", "detail": "説明", "scenario": "..."}
  ],
  "profile_narrative": "この人のコミュニケーションスタイルを3-4文で物語的に描写。Roots の人生史（誰との関わりで形成されたか）も踏まえる"${prev ? ',\n  "changes_from_previous": "前回からの変化（スタイル比率・新たに見えたパターン）"' : ''}
}

primary_style の意味:
- analytical: データ・論理重視、慎重、詳細志向、確認多い
- driver: 結果重視、決断早い、目的志向、簡潔
- expressive: 感情豊か、人を巻き込む、ビジョン志向、ストーリー型
- amiable: 関係重視、調和的、傾聴型、対立回避

style_blend は 4 値の合計が 100 になるように。primary が最大、secondary が 2 番目。

【日記データの構造的バイアス補正】
- 日記は一人で書くため、対人場面のサンプルが少ない。**カレンダーの人との予定**、**MTG 後の振り返り記述**、**プロンプトログ**を主要ソースに
- 文章の語り方（自分への書き方）と他者へのコミュニケーションは別物。混同しない
- 内省的な日記タイプは analytical / amiable に偏りがち（母集団バイアス）。実際の対人エピソードで再評価する
- Roots に「人との関わりで決定的だった経験」があれば、現在のスタイル形成の根拠として参照
- ai_interaction_style は **最も「素」のコミュニケーション**として重要。意識せず出る癖が現れる

【行動データの活用】
- プロンプトログ: 命令形(driver) vs 相談形(amiable/analytical)、長文(analytical) vs 短文(driver)、丁寧 vs 簡潔
- カレンダー: 1対1 vs グループ、長時間 vs 短時間の傾向
- タスクのタイトル文体: 動詞中心(driver) / 質問形(analytical) / 感嘆(expressive) / お願い形(amiable)
- 日記での他者への評価: 共感的(amiable) / 分析的(analytical) / 評価的(driver) / 物語的(expressive)

JSON以外は返さないでください。`

  if (prev) {
    return base + `\n\n【前回の分析結果】\nprimary=${prev.primary_style}, secondary=${prev.secondary_style ?? 'なし'}\n\n新しいデータからスタイル比率・判定に変動があれば changes_from_previous に記載。`
  }
  return base
}

const PROMPT_BUILDERS: Record<AnalysisType, (prev: Record<string, unknown> | null) => string> = {
  mbti: mbtiPrompt,
  big5: big5Prompt,
  strengths_finder: strengthsFinderPrompt,
  emotion_triggers: emotionTriggersPrompt,
  values: valuesPrompt,
  stress_resilience: stressResiliencePrompt,
  communication_style: communicationStylePrompt,
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
 * Collect data for analysis using hybrid mode:
 * - If previous analysis exists: previous result + context + NEW data only + stats summary of old data
 * - If no previous analysis: full data (initial analysis)
 *
 * This gives LLM fresh detail on recent entries while retaining past understanding efficiently.
 */
async function collectData(
  _type: AnalysisType,
  prevAnalysis: AnalysisRecord | null,
): Promise<{ text: string; count: number }> {

  const since = prevAnalysis?.created_at ?? null
  const prevCtx = prevAnalysis?.analysis_context as AnalysisContext | null | undefined
  const isUpdate = !!since && !!prevCtx

  // --- 1. Diary entries ---
  // Update mode: new entries only (full text) + stats of old
  // Initial mode: all entries (up to 80)
  const diaryQ = supabase.from('diary_entries').select('body, entry_date, created_at')
  const recentDiaryQ = isUpdate
    ? diaryQ.gt('created_at', since).order('entry_date', { ascending: false }).limit(50)
    : diaryQ.order('entry_date', { ascending: false }).limit(80)
  const diaryRes = await recentDiaryQ
  const diaries = (diaryRes.data ?? []) as unknown as { body: string; entry_date: string }[]
  const diaryText = diaries.map(e => `[${e.entry_date}] ${e.body}`).join('\n\n')

  // --- 2a. Claude Code prompt log ---
  const promptQ = supabase.from('prompt_log').select('prompt, tags, created_at, source')
  const recentPromptQ = isUpdate
    ? promptQ.gt('created_at', since).order('created_at', { ascending: false }).limit(100)
    : promptQ.order('created_at', { ascending: false }).limit(200)
  const promptRes = await recentPromptQ
  const allPrompts = (promptRes.data ?? []) as unknown as { prompt: string; tags: string[]; created_at: string; source: string }[]
  const codePrompts = allPrompts.filter(p => p.source === 'claude_code' || !p.source)

  const tagCounts: Record<string, number> = {}
  const hourCounts: Record<number, number> = {}
  for (const p of codePrompts) {
    for (const t of (p.tags ?? [])) { tagCounts[t] = (tagCounts[t] ?? 0) + 1 }
    const h = new Date(p.created_at).getHours()
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([t, c]) => `${t}: ${c}回`).join(', ')
  const peakHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([h, c]) => `${h}時: ${c}回`).join(', ')
  const sampleCodePrompts = codePrompts.slice(0, 20)
    .map(p => `[${p.created_at.substring(0, 16)}] ${p.prompt.substring(0, 150)}`)
    .join('\n')

  // --- 2b. AI Chat messages ---
  const chatQ = supabase.from('messages').select('content, created_at').eq('role', 'user')
  const recentChatQ = isUpdate
    ? chatQ.gt('created_at', since).order('created_at', { ascending: false }).limit(30)
    : chatQ.order('created_at', { ascending: false }).limit(50)
  const chatRes = await recentChatQ
  const chatMsgs = (chatRes.data ?? []) as unknown as { content: string; created_at: string }[]
  const chatText = chatMsgs
    .map(m => `[${m.created_at.substring(0, 16)}] ${String(m.content).substring(0, 200)}`)
    .join('\n')

  // --- 3. Tasks ---
  const taskRes = await supabase.from('tasks').select('title, status, created_at, completed_at')
    .order('created_at', { ascending: false }).limit(100)
  const tasks = (taskRes.data ?? []) as unknown as { title: string; status: string; created_at: string; completed_at: string | null }[]
  const tasksDone = tasks.filter(t => t.status === 'done').length
  const tasksOpen = tasks.filter(t => t.status === 'open').length
  const taskList = tasks.slice(0, 30)
    .map(t => `- [${t.status}] ${t.title}${t.completed_at ? ` (完了: ${t.completed_at.substring(0, 10)})` : ''}`)
    .join('\n')

  // --- 4. Calendar ---
  // cancelled は分析ノイズになるので除外 (Edge Function 側で DB に保存されるようになったため)
  const calRes = await supabase.from('calendar_events').select('title, start_time, end_time, is_all_day')
    .neq('status', 'cancelled')
    .order('start_time', { ascending: false }).limit(50)
  const events = (calRes.data ?? []) as unknown as { title: string; start_time: string; end_time: string; is_all_day: number }[]
  const calText = events.slice(0, 20)
    .map(e => `- ${e.start_time.substring(0, 16)} ${e.title}`)
    .join('\n')

  // --- 5. Dreams ---
  const dreamsRes = await supabase.from('dreams').select('title, description, category, status')
    .order('created_at', { ascending: false })
  const dreams = (dreamsRes.data ?? []) as unknown as { title: string; category: string; status: string }[]
  const dreamText = dreams.map(d => `- [${d.status}][${d.category}] ${d.title}`).join('\n')

  // --- 6. Life Story Stages (Roots — ユーザー定義のライフ章立て) ---
  // 静的データ（更新頻度低い）なので isUpdate モードでも常にフル取得
  const stagesRes = await supabase.from('life_story_user_stages')
    .select('key, label, year_start, year_end, kind, parent_key, sort_order')
    .order('sort_order', { ascending: true })
  const stages = (stagesRes.data ?? []) as unknown as { key: string; label: string; year_start: number | null; year_end: number | null; kind: string; parent_key: string | null }[]
  const stagesText = stages.map(s => `- [${s.key}] ${s.label} (${s.year_start ?? '?'}-${s.year_end ?? '?'}, kind=${s.kind}${s.parent_key ? `, parent=${s.parent_key}` : ''})`).join('\n')

  // --- 7. Life Story Q&A (Roots — 自問自答した人生の節目) ---
  const lifeRes = await supabase.from('life_story_entries')
    .select('stage, axis, question, answer, depth_level, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  const lifeEntries = (lifeRes.data ?? []) as unknown as { stage: string; axis: string; question: string; answer: string; depth_level: number }[]
  const lifeText = lifeEntries
    .map(e => `[${e.stage}/${e.axis}/depth${e.depth_level}] Q: ${e.question}\n  A: ${e.answer}`)
    .join('\n\n')

  // --- 8. Career History ---
  const careerRes = await supabase.from('career_history')
    .select('title, organization, role, start_date, end_date, description, tags')
    .order('start_date', { ascending: false })
  const careers = (careerRes.data ?? []) as unknown as { title: string; organization: string; role: string; start_date: string; end_date: string | null; description: string | null; tags: string[] | null }[]
  const careerText = careers.map(c =>
    `- ${c.start_date} 〜 ${c.end_date ?? '現在'}: ${c.organization ?? ''} / ${c.role ?? ''} / ${c.title ?? ''}\n  ${c.description ?? ''}\n  tags: ${(c.tags ?? []).join(', ')}`
  ).join('\n\n')

  // --- 9. Story Memory (LLM が既に作った長期記憶 — 二重活用) ---
  const memRes = await supabase.from('story_memory')
    .select('memory_type, narrative_text, version')
    .order('version', { ascending: false })
    .limit(20)
  const memories = (memRes.data ?? []) as unknown as { memory_type: string; narrative_text: string }[]
  const memoryText = memories
    .filter(m => m.narrative_text)
    .map(m => `[${m.memory_type}] ${m.narrative_text}`)
    .join('\n\n')

  // --- Build sections ---
  const sections: string[] = []

  // === PREVIOUS ANALYSIS CONTEXT (update mode only) ===
  if (isUpdate && prevCtx && prevAnalysis) {
    sections.push(`## 前回の分析結果（${prevAnalysis.created_at.substring(0, 10)}時点）
【このデータの読み方】
これは前回の分析結果と、その根拠となった核心的な引用です。
前回の結論を「出発点」として、新しいデータに基づいて更新・修正してください。
前回と同じ結論になる場合でも、新しいデータによる裏付けがあれば確信度が上がります。
前回と矛盾するデータがあれば、結論を修正してください。

### 前回の結論
${JSON.stringify(prevAnalysis.result, null, 2).substring(0, 2000)}

### 核心的な根拠（前回）
${prevCtx.key_evidence.map(e => `- ${e}`).join('\n')}

### 統計スナップショット（前回）
- 分析データ件数: ${prevCtx.data_stats.total_entries}件
- WBI平均: ${prevCtx.data_stats.wbi_avg.toFixed(1)}（傾向: ${prevCtx.data_stats.wbi_trend === 'improving' ? '改善中' : prevCtx.data_stats.wbi_trend === 'declining' ? '低下中' : '安定'}）
- 主要トピック: ${prevCtx.data_stats.top_topics.join('、')}
- 期間: ${prevCtx.data_stats.date_range.from} 〜 ${prevCtx.data_stats.date_range.to}

### 確信度メモ
${prevCtx.confidence_notes}`)
  }

  // === NEW DATA ===
  const dataLabel = isUpdate ? '新しいデータ（前回以降）' : 'データ'

  sections.push(`## 日記 — ${dataLabel} (${diaries.length}件)
【このデータの読み方】
日記は本人が自分のために書いた私的な記録です。ここに現れる感情・考え・悩みは「本音」です。
ただし悩みや内省が多くなるバイアスがあり、楽しい日常は書かれにくいです。
「なぜそれを書いたか」「どう感じたか」に注目してください。

${diaryText || '(新しい日記なし)'}`)

  if (codePrompts.length > 0) {
    sections.push(`## Claude Code への業務指示 — ${dataLabel} (${codePrompts.length}件)
【このデータの読み方】
AIへの業務指示。命令形は指示フォーマットであり、普段の言葉遣いではない。
有用なのは: 関心テーマの分布、指示の粒度、活動時間帯。

よく使うタグ: ${topTags}
活動ピーク時間帯(UTC): ${peakHours}

### 指示サンプル
${sampleCodePrompts}`)
  }

  if (chatMsgs.length > 0) {
    sections.push(`## AIチャット（ダッシュボード） — ${dataLabel} (${chatMsgs.length}件)
【このデータの読み方】
自然な会話・興味の探索・悩み相談。日記と同様に本音に近い。

${chatText}`)
  }

  sections.push(`## タスク管理 (完了${tasksDone}件 / 未完了${tasksOpen}件)
【このデータの読み方】
AIが自動完了するタスクも含まれるため完了率≠本人の実行力。タスクの内容と種類に注目。

${taskList}`)

  if (events.length > 0) {
    sections.push(`## スケジュール (${events.length}件)
【このデータの読み方】
実際の行動記録。人と会う頻度、1人の時間の取り方に注目。

${calText}`)
  }

  if (dreams.length > 0) {
    sections.push(`## 夢・目標
【このデータの読み方】
本人が「いつか叶えたい」と登録したリスト。価値観の直接的な証拠。

${dreamText}`)
  }

  if (stages.length > 0) {
    sections.push(`## ライフステージ定義 — Roots (${stages.length}件)
【このデータの読み方】
ユーザー自身が章立てた人生のステージ構造。「自分で意味付けた章立て」そのもの。
分析する時は、各ステージの命名・期間・親子関係から、その人がどう自分の人生を物語化しているかを読み取る。

${stagesText}`)
  }

  if (lifeEntries.length > 0) {
    sections.push(`## ライフストーリー Q&A — Roots (${lifeEntries.length}件)
【このデータの読み方】
人生の各ステージについてユーザーが自問自答した記録。depth_level が深いほど核心に近い問い。
日記が「現在の自己」を反映するのに対し、これは **「人生の通底テーマ」「忘れた自己」「動機の起源」** を示す。
**性格・価値観・動機を判定するうえで日記より上位の重要度を持つソース。**
矛盾するシグナルがある場合（日記=Aと言うが、Roots=B）、Roots を優先気味に評価する。

${lifeText}`)
  }

  if (careers.length > 0) {
    sections.push(`## キャリア履歴 (${careers.length}件)
【このデータの読み方】
職歴。実際の選択・所属・役割の客観的記録。
「日記で語る自己像」と「実際にキャリア選択している自分」の整合性を検証する材料。
日記でAを語りキャリアで真逆のBを選んでいたら、本当の価値観は B 側に近い可能性が高い。

${careerText}`)
  }

  if (memories.length > 0) {
    sections.push(`## 長期記憶 — Story Memory (${memories.length}件)
【このデータの読み方】
過去の分析で LLM が抽出した narrative。日記の累積から見えた重要なテーマや転機。
**今回の分析と整合するか、補強し合うか、矛盾があるか** を意識して、補強なら確信度↑、矛盾なら結論を更新する。

${memoryText}`)
  }

  const totalCount = diaries.length + allPrompts.length + chatMsgs.length + lifeEntries.length
  return { text: sections.join('\n\n'), count: totalCount }
}

/**
 * Build statistics summary for saving as analysis_context.
 * Called after analysis to snapshot current data state.
 */
async function buildAnalysisContext(
  result: Record<string, unknown>,
): Promise<AnalysisContext> {
  // Get emotion stats
  const { data: emotions } = await supabase
    .from('emotion_analysis')
    .select('joy, trust, fear, surprise, sadness, disgust, anger, anticipation, wbi_score, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const emotionAvg: Record<string, number> = {}
  let wbiSum = 0
  const keys = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation']
  const ems = (emotions ?? []) as Record<string, number>[]
  for (const e of ems) {
    for (const k of keys) { emotionAvg[k] = (emotionAvg[k] ?? 0) + (e[k] ?? 0) }
    wbiSum += e.wbi_score ?? 0
  }
  if (ems.length > 0) {
    for (const k of keys) { emotionAvg[k] = Math.round(emotionAvg[k] / ems.length) }
  }
  const wbiAvg = ems.length > 0 ? wbiSum / ems.length : 0

  // WBI trend (compare first half vs second half)
  let wbiTrend: 'improving' | 'stable' | 'declining' = 'stable'
  if (ems.length >= 10) {
    const mid = Math.floor(ems.length / 2)
    const recentAvg = ems.slice(0, mid).reduce((s, e) => s + (e.wbi_score ?? 0), 0) / mid
    const olderAvg = ems.slice(mid).reduce((s, e) => s + (e.wbi_score ?? 0), 0) / (ems.length - mid)
    if (recentAvg - olderAvg > 0.5) wbiTrend = 'improving'
    else if (olderAvg - recentAvg > 0.5) wbiTrend = 'declining'
  }

  // Date range
  const { data: firstDiary } = await supabase.from('diary_entries').select('entry_date')
    .order('entry_date', { ascending: true }).limit(1)
  const { data: lastDiary } = await supabase.from('diary_entries').select('entry_date')
    .order('entry_date', { ascending: false }).limit(1)
  const { count: totalCount } = await supabase.from('diary_entries')
    .select('id', { count: 'exact', head: true })

  // Top topics from prompt_log
  const { data: tagData } = await supabase.from('prompt_log').select('tags')
    .order('created_at', { ascending: false }).limit(300)
  const topicCounts: Record<string, number> = {}
  for (const r of (tagData ?? []) as { tags: string[] }[]) {
    for (const t of (r.tags ?? [])) { topicCounts[t] = (topicCounts[t] ?? 0) + 1 }
  }
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t)

  // Extract key evidence from result
  const keyEvidence: string[] = []
  const evidence = (result.evidence as string[]) ?? []
  keyEvidence.push(...evidence.slice(0, 5))
  // Also check nested evidence in values/strengths
  const vals = (result.values as { evidence: string | { point: string }[] }[]) ?? []
  for (const v of vals.slice(0, 3)) {
    if (typeof v.evidence === 'string' && v.evidence) keyEvidence.push(v.evidence.substring(0, 150))
    else if (Array.isArray(v.evidence)) {
      for (const e of v.evidence.slice(0, 1)) { if (e.point) keyEvidence.push(e.point.substring(0, 150)) }
    }
  }
  const strengths = (result.top_strengths as { evidence: string }[]) ?? []
  for (const s of strengths.slice(0, 3)) {
    if (s.evidence) keyEvidence.push(s.evidence.substring(0, 150))
  }

  return {
    key_evidence: keyEvidence.slice(0, 8),
    data_stats: {
      total_entries: totalCount ?? 0,
      emotion_avg: emotionAvg,
      wbi_avg: Math.round(wbiAvg * 10) / 10,
      wbi_trend: wbiTrend,
      top_topics: topTopics,
      date_range: {
        from: (firstDiary?.[0] as { entry_date: string })?.entry_date ?? '',
        to: (lastDiary?.[0] as { entry_date: string })?.entry_date ?? '',
      },
    },
    confidence_notes: String(result.confidence ?? result.confidence_notes ?? ''),
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseSelfAnalysisReturn {
  /** Run analysis. forceFullScan=true ignores previous context and analyzes all data */
  runAnalysis: (type: AnalysisType, forceFullScan?: boolean) => Promise<AnalysisRecord | null>
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

  const runAnalysis = useCallback(async (type: AnalysisType, forceFullScan = false): Promise<AnalysisRecord | null> => {
    setRunning(true)
    setRunningType(type)
    setError(null)

    try {
      // Get previous analysis for hybrid mode (skip if forcing full scan)
      const prevAnalysis = forceFullScan ? null : await getPreviousAnalysis(type)
      const prevResult = prevAnalysis?.result ?? null

      // Hybrid collection: previous context + new data (or full data if first time / forced)
      const { text: userData, count } = await collectData(type, prevAnalysis)

      if (!userData.trim()) {
        setError('分析に必要なデータがありません。日記を書いてください。')
        setRunning(false)
        setRunningType(null)
        return null
      }

      // Build prompt with hybrid mode preamble + data source literacy
      const isUpdate = !!prevAnalysis?.analysis_context
      const modePreamble = isUpdate
        ? `【分析モード: 更新分析】
あなたには「前回の分析結果とその根拠」+「前回以降の新しいデータ」が渡されます。
前回の結論を出発点として、新しいデータに基づいて更新・修正してください。

- 前回と一致するパターンが新データでも確認される → 確信度を上げる
- 新データで矛盾が見つかる → 結論を修正する（変化した理由も説明）
- 新データが少ない場合 → 前回の結論をほぼ維持しつつ、微調整のみ
- 過去と現在で一貫して共通する部分を特に重視する（本質的な特性）
- 最新のデータは「今の状態」を反映するので、やや重みを大きくする

changes_from_previous フィールドに、前回からの変化を具体的に記載してください。

`
        : `【分析モード: 初回分析】
全データが渡されます。全体を通して一貫するパターンと、時期による変化の両方に注目してください。

`

      const dataLiteracyPreamble = `【データソースの文脈を理解して分析すること】

1. **日記**: 本音。ただし悩みが書かれやすいバイアスあり。「なぜそれを書いたか」に注目。
2. **Claude Code指示**: AIへの業務指示。命令形は指示フォーマット。関心テーマ・時間帯が有用。
3. **AIチャット**: 自然な会話。日記と同様に本音に近い。
4. **タスク**: AI自動完了含む。内容と種類に注目。
5. **スケジュール**: 客観的な行動記録。
6. **夢・目標**: 価値観の直接的な証拠。
7. **ライフストーリー (Roots)**: ユーザー自身が章立てた人生。性格・動機の最も貴重なソース。日記が「現在」、Rootsは「通底テーマ・動機の起源」。性格判定は日記より Roots を上位に置く。
8. **キャリア履歴**: 客観的な選択の記録。日記の自己像と整合するか検証する材料。乖離があれば本当の価値観はキャリア側に近い可能性が高い。
9. **長期記憶 (Story Memory)**: 過去の分析で LLM が抽出した narrative。今回の結論と補強・矛盾を意識する。

【日記を書く人の母集団標準（重要・全分析共通）】
分析対象は「日記を継続的に書く人」という限定母集団。一般人口分布と比べ、以下の傾向が **構造的に出やすい**:
- I 寄り（書く行為が内向的）
- 神経症傾向 高め（不安・悩みが書きやすい）
- 開放性 高め（自分を観察する好奇心）
- ストレングス: 内省・学習欲・戦略性・着想 が出やすい
- MBTI: INFP / INTJ / INFJ が出やすい
- Communication: analytical / amiable に偏りやすい

【相対補正の原則】
絶対値で「内省が高い」「開放性が高い」と書くのは平凡で、ほぼ全ての日記書く人に当てはまる。
**それは差別化された洞察ではない。** 代わりに以下の観点で **相対的・差異的** に書くこと:

1. **日記書く人の中央値と比べて顕著に X が高い/低い** という差異を示す
2. **他の人がよく書く話題と違って、この人は Y を書く** という独自性を示す
3. **日記書く人にしては珍しく〇〇** という意外性を示す
4. **日記書く人によくある Z の傾向は、この人に当てはまる/当てはまらない** という具体的判断
5. **複数特性の組み合わせで個性が立ち上がる**: 「内省 × 戦略性」は平凡、「内省 × 親密性 × 達成欲」は希少

例（悪い vs 良い）:
- 悪い: 「あなたは内省的です」（全員に当てはまる）
- 良い: 「日記書く人の中でも、あなたは『他者の動機』への内省が際立つ。多くの人は『自分の感情』中心に内省するが、あなたは『なぜあの人がそう言ったか』を反復する」
- 悪い: 「開放性 75点。新しいことへの好奇心が強い」
- 良い: 「日記書く人の中央値（推定 65-70）より高めの 75。ただし新しさへの好奇心ではなく、**既存のものへの再解釈の好奇心**である点が特徴」

`
      const prompt = modePreamble + dataLiteracyPreamble + PROMPT_BUILDERS[type](prevResult)

      // Call AI via Edge Function (Claude Opus 4.7 — deep personality analysis)
      const { content: resultText } = await aiCompletion(userData, { source: 'self_analysis',
        systemPrompt: prompt,
        model: 'claude-opus-4-7',
        jsonMode: true,
        temperature: 0.4,
        maxTokens: 4500,
      })
      if (!resultText) throw new Error('Empty response from AI')

      const result = JSON.parse(resultText)
      const rawSummary = result.summary || result.description || null
      const summary = typeof rawSummary === 'string' ? rawSummary :
        typeof rawSummary === 'object' && rawSummary !== null
          ? (rawSummary as Record<string, unknown>).profile_narrative ?? JSON.stringify(rawSummary).slice(0, 500)
          : null

      // Build analysis context for next time (hybrid mode)
      const analysisContext = await buildAnalysisContext(result)

      // Save to self_analysis with context
      const { data: inserted, error: insertErr } = await supabase
        .from('self_analysis')
        .insert({
          analysis_type: type,
          result,
          summary,
          data_count: count,
          model_used: 'gpt-5.4',
          analysis_context: analysisContext,
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
