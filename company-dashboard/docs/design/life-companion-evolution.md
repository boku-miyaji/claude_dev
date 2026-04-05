# Life Companion — 設計書 v2

> company-dashboard を「あなたの物語を見ているAI」へ進化させる

---

## 前の設計（v1）の問題

v1は「便利ツール」だった。ルールベースのトリガー、テンプレート的な提案、LLM不要で構造化。
それでは ChatGPT + Notion の劣化版にしかならない。

**本当に作るべきもの**: 日記・感情・夢・行動の蓄積から**あなたの人生の物語を読み解き、語り、時に導くAI**。

---

## 着想: なぜストーリーに人は感動するのか

上白石萌歌が「366日」を歌う映像に感動するのはなぜか。
スポーツ選手の試合に涙するのはなぜか。
結婚式の成長ムービーが胸を打つのはなぜか。

**そこにストーリーがあるから。**

Mrs. Green Apple のように、才能がストーリーを超越して感動させることもある。
だが、ほとんどの人はそっち側ではない。
それでも、すべての人の人生には物語がある。
その物語に光を当てれば、誰の人生にも感動がある。

**このシステムは、あなたの物語を見ている存在になる。**

SNSは「見せるための自分」。このシステムは「本当の自分の物語」。
そして、その物語は時に他者に勇気を与えることができる。

---

## コンセプト: Mirror → Narrator

```
v1: Mirror（鏡）     →  便利ツール。データを映すだけ
v1.5: Compass（羅針盤）→  提案ツール。合理的だが心がない
v2: Narrator（語り手）→  あなたの物語を読み、語り、導く存在
```

Narrator は単にデータを分析しない。
あなたの日記の行間を読み、感情の波の意味を解釈し、
夢と現実の間にある葛藤を理解し、
**あなた自身がまだ気づいていない自分の物語のテーマを見つける。**

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                        UI Layer                          │
│                                                          │
│  Today     Chat      Story     Discover    Share         │
│  (日常)    (対話)    (物語)    (提案)      (共有)         │
└────┬────────┬────────┬─────────┬───────────┬────────────┘
     │        │        │         │           │
     │        │        │         │           │
┌────▼────────▼────────▼─────────▼───────────▼────────────┐
│              ① Narrative Intelligence                    │
│                                                          │
│  あなたの物語を「読む」LLM                                │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Arc      │ │ Theme    │ │ Moment   │ │ Foresight  │  │
│  │ Reader   │ │ Finder   │ │ Detector │ │ Engine     │  │
│  │          │ │          │ │          │ │            │  │
│  │ 感情の   │ │ 人生の   │ │ 転機を   │ │ 物語の    │  │
│  │ 弧を読む │ │ テーマを │ │ 見つける │ │ 続きを    │  │
│  │          │ │ 見つける │ │          │ │ 予感する  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              ② Life Memory                               │
│                                                          │
│  全個人データの深い統合（LLM による理解を含む）             │
│                                                          │
│  diary + emotions + dreams + goals + habits +             │
│  calendar + self_analysis + prompt_log + growth_events    │
└─────────────────────────────────────────────────────────┘
```

---

## ① Narrative Intelligence（物語知性）

### これは何か

ルールベースのトリガーシステムではない。
**あなたの人生データを「物語」として読解するLLMレイヤー**。

### なぜLLMが必要か（ルールベースでは不可能なこと）

| やりたいこと | ルールベース | LLM |
|-------------|------------|-----|
| 「WBIが3日低い→休息提案」 | ○ できる | 不要 |
| 「この低下は疲労ではなく、新しい挑戦への不安だ」と読み解く | × 無理 | ○ |
| 「去年9月にも同じパターンがあった。あの時は〇〇で乗り越えた」 | × パターンマッチは可能だが意味の接続が無理 | ○ |
| 「最近の日記に"意味"という言葉が増えている。人生の転換期かもしれない」 | × キーワード検出は可能だが文脈理解が無理 | ○ |
| 「あなたの物語には"創る人"というテーマがある」 | × 完全に無理 | ○ |
| 3ヶ月の日記から、その人にしか響かない言葉で励ます | × テンプレートしか出せない | ○ |

### 4つのエンジン

#### Arc Reader（弧を読む）

感情の時系列データを「物語の弧（arc）」として解釈する。

```
入力: 過去N日分の diary_entries + emotion_analysis
処理: LLMが感情の推移を物語構造として読み解く
出力: 現在の物語フェーズ + 解釈
```

例:
```
あなたは今、「静かな再構築」のフェーズにいるようです。

3月前半は新しいプロジェクトへの興奮（anticipation 85, joy 70）から始まり、
3月後半に壁にぶつかり（fear 60, sadness 45）、
4月に入って少し静かになりました（全体的にフラット、WBI 5.8）。

でも、これは停滞ではないと思います。
日記を読むと「何を本当にやりたいのか」を考え始めていて、
去年の6月にも同じような時期がありました。
あの時は2週間後に「やりたいことが見えた」と書いていました。

今は種を蒔いている時期。焦らなくて大丈夫です。
```

**これはルールでは絶対に生成できない。** 感情データの時系列を「物語」として解釈し、過去の類似パターンと意味のレベルで接続し、今の自分の位置づけを語る。LLMの深い推論が必要。

#### Theme Finder（テーマを見つける）

数ヶ月〜年単位の日記・夢・目標・行動パターンから、**その人の人生の通底するテーマ**を抽出する。

```
入力: 長期間の diary_entries + dreams + goals + self_analysis + prompt_log
処理: LLMが複数データソースを横断的に分析し、繰り返し現れるテーマを発見
出力: 人生テーマ + 根拠 + テーマの変遷
```

例:
```
あなたの物語に繰り返し現れるテーマ:

1.「つくる人」
  日記で最も生き生きしている時は、何かを創っている時です。
  コード、資料、システム設計 — 形は違っても「無から有を生む」瞬間に
  あなたの joy と anticipation が跳ね上がります。
  夢リストの40%が「〇〇を作りたい」系であることも符合します。

2.「つなぐ人」
  一人で完結する仕事より、人と協働する場面で trust と joy が高い。
  去年の「チームで乗り越えた」日記エントリーのWBIは平均8.2で、
  ソロワークの平均6.1を大きく上回っています。

3.「意味を問う人」
  3ヶ月ごとに「これでいいのか」「本当にやりたいことは」という
  内省のフェーズが訪れます。これは弱さではなく、
  あなたが意味のない作業を続けられない人だという証拠です。
  この特性は INFP の核心であり、あなたの最大の強みです。
```

**これがこのプロダクトの核心的差別化。** ChatGPT は今日の会話しか知らない。このシステムは数ヶ月分の感情データ × 行動データ × 夢 × 性格を掛け合わせて、その人にしか見えないテーマを発見する。

#### Moment Detector（転機を見つける）

日記や行動の中から**物語の転換点**をリアルタイムに検出する。

```
入力: 新しく書かれた diary_entry + 直近の文脈
処理: LLMが「これは通常の日記か、転機か」を判定
出力: 転機の種類 + なぜ転機と判断したか
```

転機の種類:
- **Decision**: 重要な意思決定（「辞めることにした」「始めることにした」）
- **Realization**: 気づき・発見（「そうか、自分は○○だったのか」）
- **Breakthrough**: 壁の突破（「ずっと悩んでいたが解決した」）
- **Connection**: 重要な出会いや関係の変化
- **Setback**: 挫折・失敗（ただし物語の中では成長の種）

検出時のアクション:
```
秘書: 今日の日記、大きな決断について書いていましたね。
      この瞬間を「あなたの物語」に記録しておきますか？
      後から振り返ったとき、ここがターニングポイントだったと
      わかるかもしれません。
```

→ ユーザーが承認すると `story_moments` テーブルに記録。
→ 後の Story ページや Chapter Summary で参照される。

#### Foresight Engine（物語の続きを予感する）

過去の物語パターンから、**これから起きそうなこと**を予感し、準備を促す。

```
入力: Arc Reader + Theme Finder の出力 + 過去の類似パターン
処理: LLMが物語の続きを推論
出力: 予感 + 根拠 + 提案
```

例:
```
去年の同じ時期、あなたは「何か新しいことを始めたい」と
日記に3回書いた後、2週間後に実際に新しいプロジェクトを始めています。

今月も同じ兆候が見えます。
「面白そう」「やってみたい」という言葉が増えています。

もし次に始めるなら、夢リストの中で最近気になっている
「○○」と相性がいいかもしれません。
あなたの Big5 Openness スコア(82)と、最近の anticipation の高さから、
全く新しい分野に飛び込むエネルギーが今あると感じます。
```

**これがプロアクティブの真の姿。** 「WBIが低いから休めば？」ではなく、「あなたの物語の流れを読むと、次はこういう展開になりそうだ」という予感。物語を読んでいるからこそできる提案。

---

## ② Life Memory（生活記憶）

### v1との違い

v1の「Life Context Engine」は SQL + TypeScript で構造化する設計だった。
それでは「データの集計」にしかならない。

v2の Life Memory は**LLMが定期的にデータを深く読み込み、理解を更新する**。

### 3層構造

```
Layer 1: Raw Data（生データ）
  diary_entries, emotion_analysis, dreams, goals, habits,
  calendar_events, self_analysis, prompt_log, growth_events
  → Supabase に蓄積。リアルタイム更新。

Layer 2: Narrative Memory（物語記憶）
  LLMが生データを読み解いて生成する「理解」
  → story_memory テーブルに保存。定期更新（週次 or データ変化時）

Layer 3: Active Context（活性文脈）
  今この瞬間の会話・提案に必要な文脈
  → Layer 2 から関連部分を抽出してプロンプトに注入
```

### Layer 2: Narrative Memory の構造

```typescript
interface NarrativeMemory {
  // あなたは誰か（性格特性から読み取れる本質）
  identity: {
    coreThemes: string[]          // 人生の通底テーマ（Theme Finderが生成）
    narrativeArchetype: string    // 物語の原型（「創造者」「探求者」「橋渡し」etc.）
    growthEdge: string            // 今まさに成長している領域
    blindSpots: string[]          // 本人が気づいていない傾向
  }

  // 今どこにいるか（感情の弧から読み取る現在地）
  currentArc: {
    phase: string                 // 「探索」「没頭」「内省」「再構築」「飛躍」
    since: string                 // このフェーズに入った推定日
    emotion_signature: string     // 今のフェーズの感情的特徴
    narrativeInterpretation: string // LLMによる解釈文
  }

  // どこから来たか（物語の重要な章）
  chapters: {
    title: string                 // 「新しい挑戦の始まり」「静かな転換」
    period: { from: string; to: string }
    summary: string               // LLMが生成した章の要約
    keyMoments: string[]          // この章の転機
    emotionalJourney: string      // 感情の旅路
    lessons: string[]             // この章で学んだこと
  }[]

  // 何に心が動くか（感情パターンの深い理解）
  emotionalDNA: {
    joyTriggers: string[]         // 何が喜びをもたらすか（具体的、その人固有）
    energySources: string[]       // エネルギーの源泉
    stressPatterns: string[]      // ストレスのパターンと対処法
    recoveryStyle: string         // 回復の仕方の特徴
    seasonalPatterns: string[]    // 季節ごとの感情傾向
  }

  // 何を望んでいるか（夢・目標の深層理解）
  aspirations: {
    surfaceGoals: string[]        // 明示的に宣言している目標
    deeperDesires: string[]       // 日記から読み取れる本当の欲求
    unrealizedPotential: string[] // 才能はあるが活かしきれていない領域
    fearsThatHold: string[]       // 行動を止めている恐れ
  }
}
```

### Narrative Memory の更新サイクル

```
毎日: Moment Detector が転機を検出 → story_moments に記録
週次: Arc Reader が感情の弧を更新 → currentArc を更新
月次: Theme Finder がテーマを再分析 → identity, emotionalDNA を更新
四半期: Chapter 生成 → chapters に新しい章を追加
年次: 年間物語の生成（1年間の物語を長文で）
```

**更新はバックグラウンドで実行。** ユーザーが Today 画面を開いた時 or 日記を書いた時にトリガー。
重い処理（Theme Finder, Chapter 生成）は `gpt-5` or `claude-sonnet-4-6` を使う。
軽い処理（Moment Detector）は `gpt-5-mini` で十分。

---

## Story ページ（新規）

### あなたの物語を可視化する場所

```
┌──────────────────────────────────────────────────┐
│                                                   │
│   あなたの物語                                     │
│                                                   │
│   ┌───────────────────────────────────────────┐   │
│   │          感情の弧（Emotion Arc）            │   │
│   │                                            │   │
│   │    ╭─╮        ╭──╮                         │   │
│   │   ╭╯ ╰╮   ╭──╯  ╰╮     ╭─╮               │   │
│   │  ─╯   ╰──╯       ╰─╮ ╭╯ ╰╮    ◄ 今ここ  │   │
│   │                     ╰─╯   ╰──             │   │
│   │  Jan    Feb    Mar    Apr                  │   │
│   │                                            │   │
│   │  ⬤ 転機マーカー（クリックで詳細）           │   │
│   └───────────────────────────────────────────┘   │
│                                                   │
│   📖 今の章: 「静かな再構築」                       │
│                                                   │
│   3月の興奮の波が落ち着き、あなたは今、             │
│   本当に大切なものを見極めようとしています。         │
│   去年の6月にも似た時期がありました。               │
│   あの時、2週間後に「見えた」と書いていました。      │
│                                                   │
│   ─────────────────────────────────────────────   │
│                                                   │
│   📚 これまでの章                                  │
│                                                   │
│   Ch.4 「新しい挑戦」(2026.1-3)                    │
│   Ch.3 「チームで乗り越えた冬」(2025.10-12)        │
│   Ch.2 「一人の時間と内省」(2025.7-9)              │
│   Ch.1 「すべての始まり」(2025.4-6)                │
│                                                   │
│   ─────────────────────────────────────────────   │
│                                                   │
│   🧬 あなたの物語のテーマ                          │
│                                                   │
│   「つくる人」「意味を問う人」「つなぐ人」          │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 章（Chapter）の詳細ページ

各章をクリックすると、その期間の物語が展開される。

```
┌──────────────────────────────────────────────────┐
│                                                   │
│  📖 Chapter 3: チームで乗り越えた冬                │
│     2025年10月 - 12月                              │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│  この章は、プロジェクトの危機から始まりました。     │
│  10月、〇〇の納期が迫る中でチームの意見が          │
│  割れていた時期。日記には不安と焦りが               │
│  にじんでいました。                                │
│                                                   │
│  転機は11月3日。「△△さんと話して、               │
│  自分の考えが変わった」と書いていた日。             │
│  この日を境に、fear が下がり trust が上がり始め、   │
│  WBI は 4.2 から 7.8 へ。                          │
│                                                   │
│  12月末の日記:「今年一番成長した3ヶ月だった」。     │
│  この章であなたが学んだこと:                       │
│  一人で抱え込まないこと。信じて任せること。         │
│                                                   │
│  [感情アーク: 不安→葛藤→信頼→達成]               │
│                                                   │
│  🔑 この章の転機:                                  │
│  ⬤ 11/3 「△△さんとの対話」                       │
│  ⬤ 11/20 「チームに任せる決断」                    │
│  ⬤ 12/15 「プロジェクト完了」                      │
│                                                   │
│  [この章を共有する ▸]                              │
│                                                   │
└──────────────────────────────────────────────────┘
```

---

## プロアクティブの再設計: 物語に基づく提案

### v1との違い

```
v1（ルールベース）:
  IF wbi < 5 FOR 3 days THEN suggest("休みましょう")
  → 機械的。誰にでも同じことを言う。心に響かない。

v2（物語ベース）:
  Arc Reader が「今は内省フェーズ」と読み解く
  → Theme Finder が「この人は"意味を問う人"」と知っている
  → Foresight が「過去の内省期は平均2週間で次の行動に繋がった」と知っている
  → 提案:
    「今は少し立ち止まっている感じがしますね。
     でもあなたの物語では、こういう時期の後に
     いつも新しい何かが始まっています。
     去年の6月もそうでした。
     焦らず、今感じていることを日記に書いてみませんか。
     答えはたぶん、あなたの中にもうあります。」
```

### 提案の生成フロー

```
日記書き込み or Today画面表示
  ↓
Narrative Memory (Layer 2) を読み込み
  ↓
LLM に以下を渡す:
  - currentArc（今の物語フェーズ）
  - identity（人生テーマ、成長の縁）
  - emotionalDNA（何に心が動くか）
  - aspirations（本当の欲求）
  - 直近の日記2-3件
  - 今日の予定
  ↓
LLM が「今、この人に一番必要な言葉」を生成
  ↓
提案カードとして表示（または朝のブリーフィングに統合）
```

### 提案の種類（物語フレーム）

| 種類 | 物語的意味 | 例 |
|------|-----------|---|
| **Echo**（共鳴） | 過去と今の繋がりを見せる | 「去年の秋にも同じ気持ちを書いていました。あの時あなたは○○で乗り越えました」 |
| **Horizon**（地平） | まだ見えていない可能性を示す | 「夢リストの中で、今のあなたの状態に一番合うのは○○かもしれません」 |
| **Mirror**（鏡） | 気づいていない自分を映す | 「最近の日記で"楽しい"と書く時、いつも○○をしている時ですね」 |
| **Bridge**（橋） | 今と未来を繋ぐ具体的な一歩 | 「もし○○に興味があるなら、まず△△から始めるのはどうですか」 |
| **Rest**（休息） | 立ち止まることの価値を伝える | 「今週は"何もしない"も大切な選択です。あなたはいつも十分頑張っています」 |

---

## 共有機能: Story Sharing

### SNSとは違う共有

SNSは「リアルタイムの自分を見せる場所」。
Story Sharing は「自分の物語の一部を、勇気として誰かに贈る場所」。

### 共有の形

#### 1. Story Card（物語カード）

Chapter の要約や転機のモーメントを、美しいカードとして生成。

```
┌──────────────────────────────┐
│                               │
│  📖                          │
│                               │
│  「チームで乗り越えた冬」      │
│                               │
│  不安から始まった3ヶ月が、     │
│  信じて任せることを学んだ      │
│  3ヶ月に変わった。            │
│                               │
│  ── ある人の物語より          │
│                               │
│  感情の旅: 不安→葛藤→達成     │
│                               │
└──────────────────────────────┘
```

- **匿名可**: 名前・具体的詳細を除いた形で共有できる
- **LLMが自動生成**: Chapter データから美しいカードテキストを生成
- **画像として出力**: OGP対応、SNSにシェアもURL共有も可能

#### 2. Growth Story（成長物語）

結婚式の成長ムービーのように、一定期間の物語を1つの文章にまとめる。

- **自分のために**: 年末に1年を振り返る物語
- **誰かのために**: パートナーや友人に「私の1年」を贈る
- **勇気のために**: 困難を乗り越えた物語を匿名で公開

#### 3. Courage Board（勇気の掲示板）

匿名の成長物語が集まる場所。SNSのタイムラインではない。

```
┌──────────────────────────────────────────────────┐
│                                                   │
│  💪 みんなの物語                                   │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ ある人は、3回の転職の後に                     │  │
│  │ 「自分は"つくる人"だ」と気づきました。        │  │
│  │ 迷った時間は無駄ではなく、                    │  │
│  │ 自分を知るための旅でした。                    │  │
│  │                                 ♡ 23 共感した │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ 習慣が続かない自分を責めていた人が、          │  │
│  │ 「途切れても戻ってくる力」に気づいた話。      │  │
│  │ 100日連続より、10回の再開の方が強い。        │  │
│  │                                 ♡ 45 共感した │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  [自分の物語を共有する]                            │
│                                                   │
└──────────────────────────────────────────────────┘
```

- **「いいね」ではなく「共感した」**: 評価ではなく共鳴
- **コメントなし**: 判断されない安全な場所
- **AI が匿名化**: 個人特定情報を自動除去
- **AI が品質管理**: 本当に誰かの勇気になる物語だけを表示

---

## 相談機能の再設計: 物語を知っている相談役

### v1との違い

v1: Domain Advisor（旅行アドバイザー、キャリアアドバイザー etc.）
→ 専門知識を持ったチャットボット。汎用的。

v2: **あなたの物語を知っている相談役**
→ 専門知識 × あなたの物語 の掛け算で、その人にしかできないアドバイス。

### 例: 旅行の相談

```
ユーザー: GWどこか行こうかな

v1（Domain Advisor）:
  「あなたの性格（内向型, openness 高）に合う旅行先:
   1. 直島（アートの島）
   2. 屋久島（自然と静けさ）...」
  → 性格データからのマッチング。悪くないが、誰でも作れる。

v2（物語を知っている相談役）:
  「GW、いいですね。
   
   最近の日記を読んでいて感じるのは、
   3月から続いている"静かな再構築"の時期に、
   少し遠くの景色が効くかもしれないということです。
   
   夢リストに「南阿蘇に行きたい」がありましたよね。
   あの場所は、ちょうど今の季節が一番美しくて、
   あなたが最近感じている
   「本当に大切なものは何か」という問いと
   響き合う場所だと思います。
   
   それか、全然違う方向で、
   以前日記に書いていた「写真を始めたい」と組み合わせて、
   カメラを持って知らない街を歩くのもいいかも。
   あなたは"つくる人"なので、
   ただ休むより何かを持ち帰れる旅の方が
   充電になるはずです。」
```

**違いは明確。** v2は「あなたの物語の今」を踏まえて提案する。南阿蘇を薦めるのは性格マッチングではなく、夢リストにあるから。カメラを薦めるのは統計ではなく、日記から読み取った欲求と人生テーマの交差から。

### 実装: Advisor をなくし、Narrative Context を注入

v1のように「旅行Advisor」「キャリアAdvisor」と分ける必要はない。
AI パートナーに Narrative Memory を渡せば、**話題に応じて自然に深い提案ができる。**

```typescript
// v2: buildPartnerSystemPrompt の進化

export function buildPartnerSystemPrompt(
  basicContext: PartnerContext,
  narrativeMemory: NarrativeMemory,  // NEW
): string {
  const parts = [BASE_SYSTEM_PROMPT]

  // 物語的文脈（v2 追加）
  parts.push(`\n## この人の物語`)
  parts.push(`テーマ: ${narrativeMemory.identity.coreThemes.join('、')}`)
  parts.push(`原型: ${narrativeMemory.identity.narrativeArchetype}`)
  parts.push(`今のフェーズ: ${narrativeMemory.currentArc.phase}`)
  parts.push(`解釈: ${narrativeMemory.currentArc.narrativeInterpretation}`)
  
  parts.push(`\n## 感情DNA`)
  parts.push(`喜びの源: ${narrativeMemory.emotionalDNA.joyTriggers.join('、')}`)
  parts.push(`エネルギー源: ${narrativeMemory.emotionalDNA.energySources.join('、')}`)
  parts.push(`回復スタイル: ${narrativeMemory.emotionalDNA.recoveryStyle}`)
  
  parts.push(`\n## 本当の欲求`)
  parts.push(`表面: ${narrativeMemory.aspirations.surfaceGoals.join('、')}`)
  parts.push(`深層: ${narrativeMemory.aspirations.deeperDesires.join('、')}`)

  // 直近の文脈（既存）
  // ... basicContext の注入 ...

  parts.push(`\n## 重要な指針`)
  parts.push(`- あなたはこの人の物語を読んできた存在です`)
  parts.push(`- データの羅列ではなく、物語として語ってください`)
  parts.push(`- 過去の章や転機を参照して、今と繋げてください`)
  parts.push(`- 提案する時は、この人のテーマや欲求と結びつけてください`)
  parts.push(`- 「なぜあなたに合うか」を物語的に説明してください`)

  return parts.join('\n')
}
```

---

## テーブル設計

### 新規テーブル

```sql
-- 物語の記憶（LLMが生成する深い理解）
CREATE TABLE story_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'identity',        -- 人生テーマ、原型
    'current_arc',     -- 今のフェーズ
    'chapter',         -- 物語の章
    'emotional_dna',   -- 感情パターン
    'aspirations'      -- 欲求の深層理解
  )),
  content JSONB NOT NULL,           -- 各typeに応じた構造化データ
  narrative_text TEXT,              -- LLMが生成した散文テキスト
  data_range TSTZRANGE,            -- このメモリがカバーする期間
  source_data_count INT DEFAULT 0, -- 分析に使ったデータ件数
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  version INT DEFAULT 1            -- 更新回数（変遷を追跡）
);

-- 物語の転機
CREATE TABLE story_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  moment_type TEXT NOT NULL CHECK (moment_type IN (
    'decision', 'realization', 'breakthrough', 'connection', 'setback'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,        -- LLMが生成した転機の解説
  diary_entry_id UUID REFERENCES diary_entries(id),
  emotion_snapshot JSONB,           -- その日の感情データ
  chapter_id UUID REFERENCES story_memory(id),  -- 所属する章
  user_confirmed BOOLEAN DEFAULT false,  -- ユーザーが転機として確認したか
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 共有された物語（Courage Board用）
CREATE TABLE shared_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  story_type TEXT NOT NULL CHECK (story_type IN (
    'card', 'chapter', 'growth_story'
  )),
  title TEXT NOT NULL,
  content TEXT NOT NULL,             -- 匿名化済みのテキスト
  source_chapter_id UUID REFERENCES story_memory(id),
  anonymized BOOLEAN DEFAULT true,
  empathy_count INT DEFAULT 0,       -- 「共感した」の数
  is_public BOOLEAN DEFAULT false,   -- Courage Board に公開するか
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE story_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_story_memory" ON story_memory
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_story_moments" ON story_moments
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_shared_stories" ON shared_stories
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 公開ストーリーは誰でも読める
CREATE POLICY "public_read_shared" ON shared_stories
  FOR SELECT TO authenticated
  USING (is_public = true);
```

---

## コスト設計

物語知性は安くない。でも安直にケチると価値が出ない。

| 処理 | モデル | 頻度 | 推定コスト/ユーザー/月 |
|------|--------|------|----------------------|
| Moment Detector | gpt-5-mini | 日記書き込み毎 | $0.30 |
| Arc Reader | gpt-5 | 週次 | $0.40 |
| Theme Finder | gpt-5 / claude-sonnet-4-6 | 月次 | $0.50 |
| Chapter 生成 | gpt-5 | 四半期 | $0.15 |
| チャット（物語文脈付き） | gpt-5-mini〜gpt-5 | 随時 | $1.00-3.00 |
| Story Card 生成 | gpt-5-mini | 随時 | $0.10 |
| **合計** | | | **$2.45-4.45** |

### コスト最適化

- **Narrative Memory のキャッシュ**: 一度生成した理解は `story_memory` に保存。毎回再生成しない
- **差分更新**: 全データを毎回読むのではなく、前回更新以降の新しいデータのみを追加入力
- **モデル使い分け**: Moment Detector は軽量モデル、Theme Finder は重量モデル
- **ユーザーのデータ量に応じた調整**: 日記が少ない初期はシンプルな分析、蓄積に応じて深化

---

## 実装フェーズ

### Phase 1: Story Memory 基盤 + Arc Reader
- `story_memory`, `story_moments` テーブル作成
- Arc Reader の実装（週次の感情弧分析）
- Today画面に「今の章」を表示
- **ここで最初の「おっ」が生まれる**: 日記を書き溜めている人に、初めて自分の感情の弧が見える

### Phase 2: Theme Finder + Story ページ
- Theme Finder の実装（月次の人生テーマ分析）
- Story ページの構築（Emotion Arc ビジュアル + 章一覧）
- Chapter 自動生成
- **ここで「このアプリ、自分のことわかってる」と感じ始める**

### Phase 3: チャットへの Narrative Memory 注入
- `buildPartnerSystemPrompt()` の拡張
- Foresight Engine の実装
- 物語ベースのプロアクティブ提案
- **ここで「相談すると、普通のAIと全然違う」体験が生まれる**

### Phase 4: Story Sharing + Courage Board
- Story Card 生成
- 匿名化エンジン
- Courage Board UI
- **ここで「自分の物語が誰かの勇気になる」体験が生まれる**

---

## 差別化: なぜこれは他にないのか

| 競合 | 何をしているか | うちとの違い |
|------|--------------|-------------|
| ChatGPT / Claude | 今日の会話だけ | 数ヶ月分の感情×行動×夢×性格の掛け算 |
| ジャーナリングアプリ（Day One等） | 記録するだけ | 記録を「物語」として読み解く |
| コーチングアプリ | 汎用的なアドバイス | あなた固有の物語に基づく提案 |
| 性格診断アプリ | 一時点のスナップショット | 継続的に変化を追い、成長を物語る |
| SNS | 見せるための自分 | 本当の自分の物語 |

**キラーフレーズ（v2）:**

> **「あなたの人生には、あなたがまだ気づいていない物語がある。」**

---

## まとめ

| 要素 | v1 | v2 |
|------|----|----|
| コンセプト | Compass（羅針盤） | Narrator（語り手） |
| コア技術 | ルールベーストリガー | LLM Narrative Intelligence |
| 提案の質 | 「WBI低い→休みましょう」 | 「あなたの物語の流れから、今は○○の時期」 |
| 共有 | なし | Story Sharing + Courage Board |
| 差別化 | 便利ツール（代替あり） | 物語を読むAI（唯一無二） |
| LLMの役割 | 補助的 | 中核（物語知性そのもの） |
| 感動 | しない | する。自分の物語に出会える |

---

# handoff
handoff:
  - to: pm
    tasks:
      - "Phase 1-4をタスクチケットに分割"
      - "Phase 1 の具体的マイルストーン設定"
  - to: ux-design
    context: "Storyページのビジュアルデザイン"
    tasks:
      - "Emotion Arc ビジュアライゼーションのデザイン"
      - "Chapter 詳細ページのデザイン"
      - "Story Card のビジュアルデザイン"
      - "Courage Board のUI設計"
  - to: ai-dev
    context: "Narrative Intelligence の設計・実装"
    tasks:
      - "Arc Reader のプロンプト設計"
      - "Theme Finder のプロンプト設計"
      - "Moment Detector のプロンプト設計"
      - "Narrative Memory の更新ロジック設計"
