import { PageHeader, Card } from '@/components/ui'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ========== Shared UI primitives ==========

function P({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 8 }}>{children}</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>{body}</div>
    </div>
  )
}

function Principle({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div className="card" style={{ padding: 14, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{body}</div>
    </div>
  )
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
      {steps.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'var(--accent)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{s}</span>
          {i < steps.length - 1 && <span style={{ color: 'var(--text3)' }}>→</span>}
        </span>
      ))}
    </div>
  )
}

function CycleFlow({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
      {steps.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{s}</span>
          <span style={{ color: 'var(--text3)' }}>{i < steps.length - 1 ? '→' : '↩'}</span>
        </span>
      ))}
    </div>
  )
}

function Tbl({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--accent)', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--green)' : 'var(--red)', marginRight: 6 }} />
}

// ========== Tab: Vision ==========

function TabVision() {
  return (
    <>
      <Section title="このシステムは何か">
        <Principle title="あなたの人生には、あなたがまだ気づいていない物語がある。" body="このシステムは、日記・感情・夢・目標・習慣・行動のすべてを蓄積し、AIがあなたの人生を「物語」として読み解く。データの集計ではない。あなたの感情の波の意味を解釈し、夢と現実の間にある葛藤を理解し、あなた自身がまだ気づいていない人生のテーマを見つける。" color="var(--accent)" />
      </Section>

      <Section title="なぜストーリーなのか">
        <P>上白石萌歌が「366日」を歌う映像に感動するのはなぜか。スポーツ選手の試合に涙するのはなぜか。結婚式の成長ムービーが胸を打つのはなぜか。</P>
        <P><strong>そこにストーリーがあるから。</strong></P>
        <P>Mrs. Green Apple のように、才能がストーリーを超越して感動させることもある。だが、ほとんどの人はそっち側ではない。それでも、すべての人の人生には物語がある。その物語に光を当てれば、誰の人生にも感動がある。</P>
        <div className="g2" style={{ marginBottom: 12, marginTop: 16 }}>
          <MiniCard title="SNS = 見せるための自分" body="他者の視線を意識した編集された人生。いいね数で測られる価値。比較と消耗のループ。" />
          <MiniCard title="このシステム = 本当の自分の物語" body="誰にも見せなくていい。でも確かにそこにある、あなただけの成長と葛藤と発見の記録。" />
        </div>
      </Section>

      <Section title="3段階の進化">
        <Tbl headers={['段階', '名前', '何をするか', '限界']} rows={[
          ['Stage 1', 'Mirror（鏡）', 'データを映す。「今日の感情はこうです」「WBIは5.2です」', '数字を見せるだけ。意味を解釈しない'],
          ['Stage 2', 'Compass（羅針盤）', 'ルールベースで提案。「WBIが低いから休みましょう」', '機械的。誰にでも同じことを言う。心に響かない'],
          ['Stage 3', 'Narrator（語り手）', '物語を読み、語り、導く。「あなたの物語では、こういう静かな時期の後にいつも新しい何かが始まっています」', '目指す姿'],
        ]} />
        <Principle title="Narrator が目標" body="Stage 2（ルールベース提案）で妥協しない。LLMの深い推論で、その人にしか言えない言葉を、その人の物語の文脈で語る。安直なソリューションに落ち着かない。" color="var(--green)" />
      </Section>

      <Section title="Narrative Intelligence — 4つのエンジン">
        <P>あなたの人生データを「物語」として読解するAIレイヤー。ルールベースでは不可能なことだけをLLMにやらせる。</P>
        <div className="g2" style={{ marginBottom: 12 }}>
          <Principle title="Arc Reader（弧を読む）" body="感情の時系列を物語の弧として解釈する。「この低下は疲労ではなく、新しい挑戦への不安だ」と読み解く。去年の同じパターンとの意味の接続もする。" color="var(--accent)" />
          <Principle title="Theme Finder（テーマを見つける）" body="数ヶ月の日記×夢×行動から、人生の通底テーマを発見する。「つくる人」「意味を問う人」「つなぐ人」。自分では気づけない自分の本質。" color="var(--green)" />
          <Principle title="Moment Detector（転機を見つける）" body="日記の中から物語の転換点をリアルタイムに検出する。決断、気づき、突破、出会い、挫折。その瞬間を記録し、後から振り返れるようにする。" color="var(--amber)" />
          <Principle title="Foresight Engine（物語の続きを予感する）" body="過去のパターンから次の展開を予感する。「去年も同じ兆候の後に新しいプロジェクトを始めている。今のあなたなら○○が合うかもしれない」。" color="var(--blue)" />
        </div>
        <P>これらはすべて、ルールベースのif文では実現できない。感情データの時系列を「物語」として解釈し、過去の類似パターンと意味のレベルで接続し、今の自分の位置づけを語る — LLMの深い推論が必要。</P>
      </Section>

      <Section title="物語ベースの提案 vs ルールベースの提案">
        <Tbl headers={['場面', 'ルールベース（やらない）', '物語ベース（やる）']} rows={[
          ['調子が悪い', '「最近お疲れのようです。休息を取りましょう」', '「去年の秋にも同じ波がありました。あの時あなたは○○で乗り越えました。今回は少し違う — 最近"意味"という言葉が増えていて、新しい何かを探しているのかもしれません」'],
          ['旅行の相談', '「内向型×openness高 → 直島、屋久島がおすすめ」', '「夢リストの"南阿蘇に行きたい"、今の"再構築期"に響く場所だと思います。あなたは"つくる人"なので、ただ休むより何かを持ち帰れる旅が充電になるはずです」'],
          ['目標が止まっている', '「2週間更新がありません。小さな一歩から始めましょう」', '「あなたの物語では、こういう静かな時期の後にいつも跳躍があります。焦らなくて大丈夫です。答えはたぶん、あなたの中にもうあります」'],
        ]} />
      </Section>

      <Section title="共有のビジョン: Courage Board">
        <P>このシステムで蓄積された物語は、自分のためだけではない。</P>
        <div className="g3" style={{ marginBottom: 12 }}>
          <Principle title="Story Card" body="人生の章や転機を美しいカードに。LLMが匿名化し、個人が特定されない形で、あなたの成長物語を1枚のカードに凝縮する。" color="var(--accent)" />
          <Principle title="Courage Board" body="匿名の成長物語が並ぶ場所。SNSとは逆 — 評価されない、コメントされない、フォロワーもない。リアクションは「共感した」だけ。自分の物語が誰かの勇気になる。" color="var(--green)" />
          <Principle title="Growth Story" body="結婚式の成長ムービーを、日常に。年末に1年の物語を長文で生成。全ての章と転機とテーマの変遷が、1つの物語になる。" color="var(--amber)" />
        </div>
      </Section>

      <Section title="なぜ他にないのか">
        <Tbl headers={['競合', '何をしているか', 'うちとの違い']} rows={[
          ['ChatGPT / Claude', '今日の会話だけ。あなたを知らない', '数ヶ月分の感情×行動×夢×性格の掛け算。物語として読む'],
          ['Day One 等のジャーナリング', '記録するだけ。書いた後は放置', '記録を「物語」に変える。転機を検出し、章を生成し、テーマを発見する'],
          ['コーチングアプリ', '汎用的なアドバイス。テンプレート', 'あなた固有の物語に基づく、あなたにしか言えない言葉'],
          ['性格診断アプリ', '一時点のスナップショット', '継続的に変化を追い、成長を物語る。前回との差分分析'],
          ['SNS', '見せるための自分。比較と消耗', '本当の自分の物語。勇気のための共有'],
        ]} />
      </Section>

      <Section title="コーチングを超える — 連続データという固有の強み">
        <P>「自分に向き合うだけのアプリは虚しいのでは？」という問いへの回答。コーチングと比較することで、このアプリにしかできないことの輪郭がはっきりする。</P>
        <Tbl headers={['軸', 'コーチング', 'このアプリ']} rows={[
          ['時間構造', '点（月1〜週1のセッション）', '線（365日連続）'],
          ['データの粒度', 'ユーザーが思い出せる範囲', 'ユーザーが忘れた範囲まで'],
          ['取れる発話', 'きれいに話そうとする加工後', '加工前のノイズ込みの本音'],
          ['アクセス', 'コーチがいる時だけ', '感情のピーク時にいつでも'],
          ['関係性のコスト', '気を遣う、評価される不安', '気を遣わない'],
          ['鋭い問い', 'コーチの専門性に依存', '良問いライブラリで再現可能'],
          ['沈黙・人格の存在感', 'コーチが優れる', '原理的にできない（あえて目指さない）'],
        ]} />
        <Principle title="差別化の核 — ユーザーが忘れた自己" body="コーチが引き出せるのは「思い出せる範囲」の自己。このアプリが提示できるのは「忘れていた範囲」の自己。『3月の第2週、A社の打ち合わせの翌日は必ずスコアが落ちている』みたいな、人間には観測不可能なパターン。これはコーチには絶対できない。" color="var(--accent)" />
        <Principle title="設計指針 — コーチの良問いを日記プロンプトに変換" body="ヒアリングが必要なこと（価値観・幸せの瞬間・失敗パターンの掘り下げ）は、すべて日記の質問例として設計に組み込む。コーチング本の良問いを構造化して、適切な文脈で毎日浴びる状態を作る。1回のセッションより遅いが、深さでは超える。" color="var(--green)" />
      </Section>

      <Section title="価値の3層構造">
        <P>このアプリが目指す深さ。多くのジャーナリングアプリは Layer 1 で止まる。コーチングは Layer 2 まで届く。このアプリは Layer 3 まで届くことを目指す。</P>
        <Tbl headers={['層', '何をするか', '到達するアプリ']} rows={[
          ['Layer 1: 観察', '価値観・幸せの瞬間・失敗パターンの生データを集める', 'ジャーナリングアプリ全般'],
          ['Layer 2: 言語化', 'パターンが「腑に落ちる言葉」になる', 'コーチング'],
          ['Layer 3: 行動', '言語化を使って自己制御・前向きさに繋げる', 'このアプリが目指す場所'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>各層の機能実装</div>
        <Tbl headers={['層', '実装機能', '狙い']} rows={[
          ['Layer 1: 観察', '良問いライブラリ（diaryPrompts.ts 7軸構造化）', 'コーチの良問いを日記プロンプトとして毎日浴びる。価値観・幸せ・失敗パターンの生データを意図的に集める'],
          ['Layer 1→2: 橋渡し', '過去の自分カード（useSimilarPastEntry）', 'ユーザーが忘れた範囲の過去の自分を提示。embedding検索、LLM不要、14日以上前のエントリのみ'],
          ['Layer 2: 言語化', 'Theme Finder（識別）→ 自分の取扱説明書の種カード', '数ヶ月分の日記から「この人の核心」を言語化。腑に落ちる言葉を提案'],
          ['Layer 2→3: 橋渡し', '自分の取扱説明書の手編集（Manual ページ）', 'AI の言葉を自分の言葉に書き換えるプロセスがないと行動は変わらない。編集した瞬間にそれが「自分のもの」になる'],
          ['Layer 3: 行動', '取扱説明書を日々参照する（設計中）', '判断・選択・自己制御の土台として手元に置く'],
        ]} />
      </Section>

      <Section title="「動けてない日」を責めない設計（必須原則）">
        <Principle title="生産性アプリの顔をしない" body="「今日もタスク0件です」と言うアプリは、止まっている人を一番苦しめる相手になる。フリーズの本当の苦しさは、フリーズしていること自体への自己嫌悪。動けていない日も「記録された一日」として扱い、未達を罪悪感のトリガーにしない。" color="var(--amber)" />
        <div className="g2" style={{ marginTop: 12 }}>
          <MiniCard title="やらないこと" body="❌ フリーズ検知して詰める / ❌ タスク未達で罪悪感を煽る / ❌「もっと頑張りましょう」系 / ❌ 局所的な気分上げ工夫" />
          <MiniCard title="やること" body="✅ 価値観・幸せの瞬間・失敗パターンの連続観察 / ✅ 忘れた範囲のパターン提示 / ✅ 良問いの継続投入 / ✅「自分の取扱説明書」を更新する感覚" />
        </div>
      </Section>

      <Section title="ビジネスモデル">
        <Tbl headers={['プラン', '内容', '価格感']} rows={[
          ['Free', '日記 + 基本感情分析 + 週次ナラティブ', '¥0'],
          ['Plus', '全Narrative Intelligence + Story ページ + プロアクティブ提案', '¥980/月'],
          ['Pro', '上記 + Courage Board + Growth Story + 優先モデル(gpt-5.4)', '¥1,980/月'],
        ]} />
        <P>フリーミアム。日記を書くだけで価値がある → 書くほどAIが賢くなる → 手放せなくなる。</P>
      </Section>

      <Section title="プライバシーの原則">
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="全データはユーザー所有" body="Supabase RLS で厳密に分離。他のユーザーのデータは物理的にアクセス不可。" />
          <MiniCard title="LLMへの送信は最小限" body="Narrative Memory の要約のみ送信。生の日記全文は送らない。" />
          <MiniCard title="いつでもエクスポート・削除" body="JSON/CSV でダウンロード可能。アカウント削除で全データ完全消去。" />
          <MiniCard title="共有は完全にオプトイン" body="Courage Board への公開は明示的な許可が必要。デフォルトは非公開。" />
        </div>
      </Section>

      <Section title="設計書">
        <P>詳細な技術設計・テーブル設計・実装フェーズは以下を参照:</P>
        <div className="card" style={{ padding: 14, fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
          <div><strong>設計書:</strong> docs/design/life-companion-evolution.md</div>
          <div><strong>実装タスク:</strong> docs/design/narrator-implementation-tasks.md</div>
          <div><strong>設計思想:</strong> .company/design-philosophy.md（Narrator セクション）</div>
        </div>
      </Section>
    </>
  )
}

// ========== Tab: Overview ==========

function TabOverview() {
  const [stats, setStats] = useState<{
    knowledgeCount: number; sessionCount: number; sessionsExtracted: number;
    memoryCount: number; growthCount: number; diaryCount: number;
    pipelineRunsCount: number; correctionLogCount: number;
  } | null>(null)

  useEffect(() => {
    async function load() {
      const [kbRes, sessRes, sessExtRes, growthRes, diaryRes, pipelineRes, correctionRes] = await Promise.all([
        supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('prompt_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('prompt_sessions').select('id', { count: 'exact', head: true }).eq('knowledge_extracted', true),
        supabase.from('growth_events').select('id', { count: 'exact', head: true }),
        supabase.from('diary_entries').select('id', { count: 'exact', head: true }),
        supabase.from('pipeline_runs').select('id', { count: 'exact', head: true }),
        supabase.from('correction_log').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        knowledgeCount: kbRes.count || 0,
        sessionCount: sessRes.count || 0,
        sessionsExtracted: sessExtRes.count || 0,
        memoryCount: 0,
        growthCount: growthRes.count || 0,
        diaryCount: diaryRes.count || 0,
        pipelineRunsCount: pipelineRes.count || 0,
        correctionLogCount: correctionRes.count || 0,
      })
    }
    load()
  }, [])

  return (
    <>
      <Section title="なぜ回っているか — 3つの原理">
        <P>このシステムが「作って終わり」にならず改善され続ける理由。</P>
        <div className="g3" style={{ marginBottom: 16 }}>
          <Principle title="原理 1: 自動検出" body="手動操作、同じ修正の繰り返し、知識の散在を自動で検出する。問題が見えないと改善は始まらない。" color="var(--accent)" />
          <Principle title="原理 2: 知識の昇格" body="一時メモ → ナレッジ → ルール → スキル。同じ指示を2回しなくていい。" color="var(--green)" />
          <Principle title="原理 3: 仕組みの仕組み" body="機能を作るだけでなく「誰が・いつ・どう回すか」まで設計。ops部署がメタ運用。" color="var(--yellow)" />
        </div>
      </Section>

      <Section title="5つの自己改善ループ">
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="1. ナレッジ蓄積" body="修正指示を検出 → knowledge_base記録 → confidence上昇 → CLAUDE.md昇格" />
          <MiniCard title="2. セッション学習" body="prompt_sessionsでグルーピング → フィードバック含むセッションからナレッジ抽出" />
          <MiniCard title="3. 組織最適化" body="5軸評価 → 低スコア部署のCLAUDE.mdルール改善。組織が自動チューニング" />
          <MiniCard title="4. CEO分析" body="prompt_log → 行動パターン/時間帯/傾向分析 → 秘書が先回り提案" />
          <MiniCard title="5. 日記→自己理解" body="書く → 感情分析 → WBI可視化 → パターン発見 → もっと書きたくなる → データ増 → AI精度↑" />
        </div>
        <CycleFlow steps={['問題検出', '原因分析', '仕組みの修正', '検証', '運用定着']} />
      </Section>

      <Section title="進化ループ — AlphaEvolve着想">
        <P>AlphaEvolveの思想: 評価関数（フィットネス）を定義し、実績データで変異と選択を繰り返す。このシステムは同じ原理で自己進化する。</P>
        <div className="g3" style={{ marginBottom: 16 }}>
          <Principle title="Record First, Evolve Later" body="進化させるなら、まず評価できる状態を作れ。pipeline_runs / correction_log にすべての実行結果を記録。記録がないところに改善はない。" color="var(--accent)" />
          <Principle title="Fitness-Driven Selection" body="人間の直感ではなく実績データで判断。一発OK率、差し戻し回数、実行時間の実績がルール改善の根拠になる。" color="var(--green)" />
          <Principle title="Volatility-Adaptive Autonomy" body="安定しているところは自動化を深め、不安定なところは人間の判断を入れる。全部自動でも全部手動でもない。" color="var(--yellow)" />
        </div>
        <CycleFlow steps={['記録', '評価', '変異提案', '社長承認', '適用']} />
        <div className="g2" style={{ marginTop: 12 }}>
          <MiniCard title="Pipeline Runs" body="パイプライン実行ごとに所要時間・結果・差し戻しを記録" />
          <MiniCard title="Correction Log" body="修正指示の種類・重症度を構造化記録。何度も同じ修正→ルール自動進化のトリガー" />
          <MiniCard title="First-Time OK Rate" body="部署×タスク種別ごとの一発OK率。フィットネス関数の核" />
          <MiniCard title="Volatility Score" body="直近5回の実績の標準偏差。パイプライン自動度の推奨に使用" />
        </div>
      </Section>

      <Section title="システム健全性">
        {stats ? (
          <div className="g2">
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Data Health</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div><StatusDot ok={stats.knowledgeCount > 0} /> Knowledge Rules: {stats.knowledgeCount}</div>
                <div><StatusDot ok={stats.sessionCount > 0} /> Sessions Tracked: {stats.sessionCount}</div>
                <div><StatusDot ok={stats.growthCount > 0} /> Growth Events: {stats.growthCount}</div>
                <div><StatusDot ok={stats.diaryCount > 0} /> Diary Entries: {stats.diaryCount}</div>
                <div><StatusDot ok={stats.pipelineRunsCount > 0} /> Pipeline Runs: {stats.pipelineRunsCount}</div>
                <div><StatusDot ok={stats.correctionLogCount > 0} /> Correction Log: {stats.correctionLogCount}</div>
                <div><StatusDot ok={stats.correctionLogCount > 0} /> First-Time OK Rate: {stats.correctionLogCount > 0 ? '算出可能' : 'データ不足'}</div>
              </div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Knowledge Pipeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div>memory/ → knowledge_base → CLAUDE.md</div>
                <div><StatusDot ok={stats.sessionsExtracted > 0} /> Knowledge Extraction: {stats.sessionsExtracted}/{stats.sessionCount} sessions</div>
              </div>
            </Card>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading...</div>
        )}
      </Section>

      <Section title="データ鮮度マップ — いつ・何が・なぜ更新されるか">
        <P>全データの更新タイミングと連鎖関係。ブラックボックス化を防ぐために全フローを可視化。</P>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--green)' }}>自動更新（人間の操作不要）</div>
        <Tbl headers={['データ', '更新タイミング', '仕組み', '連鎖先']} rows={[
          ['prompt_log', '毎回のユーザー入力', 'Hook (UserPromptSubmit) — キーワード分類のみ、LLM分類はバッチ', 'CEO分析の材料、生活リズム分析'],
          ['設定/MCP/CLAUDE.md同期', 'セッション開始', 'Hook (SessionStart, async)', 'ダッシュボードSettings反映'],
          ['git pull (最新コード)', 'セッション開始', 'Hook (SessionStart, async)', '全ファイルが最新に'],
          ['git push', 'セッション終了', 'Hook (SessionStop)', '他サーバーに変更が伝播'],
          ['セッション状態保存', 'Context Compaction直前', 'Hook (PreCompact)', '.session-state.json に退避'],
          ['コンテキスト再注入', 'Context Compaction直後', 'Hook (PostCompact)', 'additionalContext で重要情報を再注入'],
          ['CLAUDE.md肥大化警告', 'CLAUDE.mdへの書き込み後', 'Hook (PostToolUse)', '200行超で自動警告。60行以下推奨'],
          ['Hook実行ログ', '全ツール実行後', 'Hook (PostToolUse)', '~/.claude/logs/hook-executions.jsonl に記録'],
          ['危険コマンド監査', 'Bash実行前', 'Hook (PreToolUse)', 'ブロック時に blocked-commands.jsonl に記録'],
          ['部署稼働ログ', 'Agent起動時', 'Hook (PostToolUse) — Supabase activity_log INSERT', 'dept_dispatch + metadata.dept で集計可能'],
          ['部署評価リマインド', 'セッション開始', 'Hook (SessionStart) — 14日超で警告', '評価サイクルの自動維持'],
          ['Session Log (Managed Agents)', 'Agent起動時', 'Hook (PostToolUse) → agent_sessions INSERT', 'append-only イベントログ。パイプライン復旧の基盤'],
          ['Pipeline State', 'パイプライン開始/完了時', 'pipeline_state テーブル更新', 'DAG進捗の永続化。セッション復旧可能に'],
          ['パイプライン復旧検出', 'セッション開始', 'Hook (SessionStart) — pipeline_state チェック', '中断パイプラインを自動検出・復旧提案'],
          ['感情ベクトル検索', '日記投稿後', 'pgvector + emotion_vector(8) on emotion_analysis', '類似感情パターンの自動発見'],
          ['日本語全文検索', '検索実行時', 'PGroonga on diary_entries.body', '日記キーワード検索（形態素解析対応）'],
          ['Hybrid Search + Reranking', '検索実行時', 'emotion vector + PGroonga → gpt-nano rerank', '関連日記をスコア付きでLLMコンテキストに注入'],
          ['emotion_analysis', '日記投稿直後', 'useEmotionAnalysis (自動)', 'diary_entries.wbi更新 → Journal可視化。AI Partner再生成はしない（同じこと言うリスクを避けるため）'],
          ['AI Partnerコメント', '時間帯変更(朝/昼/夕/夜) + リロード', 'useMorningBriefing (キャッシュキー time_mode)', '日記投稿では再生成しない。直近3件の出力をプロンプトに注入して表現の重複を避ける'],
          ['夢進捗検出', '毎朝9時JST（週1スパン）', 'narrator-update runDreamDetection (GitHub Actions cron)', 'activity_log.action=dream_detected に記録 → Dreams画面「最近の気づき」で表示'],
          ['天気', '1時間ごと(TTL)', 'useTodayWeather (localStorage)', 'Today画面表示'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--green)' }}>ユーザー作業マップ（何をすべきか・できるか）</div>
        <P>focus-you は「日記を書く + 最小のチェック」でほぼ全ての分析が回る設計。手動操作は常に残しつつ、日記から自動抽出できる部分は自動化する。精度が低い可能性があるので、自動記録されたものは必ず UI で見える化し、1クリックで戻せる。</P>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600 }}>A. 毎日の必須作業</div>
        <Tbl headers={['作業', '画面', '手間', '効く分析']} rows={[
          ['日記を書く', 'Today', '主作業（1日1〜2回）', '全分析の主燃料'],
          ['タスク完了チェック', 'Today（チェックボックス or 日記で言及→自動）', '5秒 or ゼロ', 'Weekly Narrative / Self-Analysis'],
          ['習慣チェック', 'Today（チェック or 日記で言及→自動）', '5秒 or ゼロ', 'Weekly Narrative（達成率）'],
        ]} />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, marginTop: 12, fontWeight: 600 }}>B. 随時の作業（気が向いたら）</div>
        <Tbl headers={['作業', '画面', '頻度', '効く分析']} rows={[
          ['新タスク追加', 'Today + ボタン / 日記から提案採用', '随時', 'Weekly'],
          ['新習慣追加', 'Habits + ボタン', '月1〜', 'Weekly'],
          ['夢・目標の登録', 'Dreams', '月1〜四半期1', 'Dream検出 / Theme / Chapter'],
          ['ほしい物の登録', 'Dreams（Wishlist）', '随時', '欲望ログ（現状分析対象外）'],
          ['カレンダー予定の作成/編集', 'Calendar + 予定ボタン / 予定クリック', '随時', '時間帯別メッセージ / Weekly に反映'],
          ['AI Partner の👍/違う', 'Today（briefing直下）', '気になった時', 'Partner精度向上（フィードバック蒸留）'],
          ['Roots セッション（人生の棚卸し）', 'Roots（Understand配下）', 'Quick 5分 / Medium 20分 / Deep じっくり — いつでも', 'ステージ×軸の埋まり具合をAIが把握し、手薄な領域・深掘り候補から質問。日記では補えない過去・価値観・家庭環境・仕事歴を言語化。再実行するほど未着手エリアを優先'],
        ]} />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, marginTop: 12, fontWeight: 600 }}>C. 初期セットアップ（一度だけ）</div>
        <Tbl headers={['作業', '画面', '内容']} rows={[
          ['Google Calendar 連携', 'Settings', '認証1回 → 以後全予定自動取得。focus-you内でCRUDも可'],
          ['Google Tasks 連携', 'Settings', '認証1回 → focus-you でタスク作ると Google にも反映'],
          ['既存の夢・目標の登録', 'Dreams', '初期インベントリ（5-10件あると Dream検出が意味ある結果を返す）'],
          ['既存の習慣の登録', 'Habits', '走っている習慣（筋トレ・読書等）の登録'],
        ]} />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, marginTop: 12, fontWeight: 600 }}>D. 完全自動（ユーザー操作不要）</div>
        <Tbl headers={['処理', 'タイミング', 'モデル']} rows={[
          ['感情分析（Plutchik8次元 + PERMA+V）', '日記投稿時（自動）', 'gpt-5.4-mini'],
          ['日記自動抽出（タスク/習慣 done + 新規提案）', '日記投稿時（自動、結果はUIで要確認）', 'claude-opus-4-7'],
          ['時間帯別メッセージ', '朝/昼/夕/夜の切替で自動（日記投稿では再生成しない）', 'claude-opus-4-7'],
          ['過去日記類似検索', '書いてる最中リアルタイム', 'text-embedding-3-small'],
          ['週間ナラティブ', 'Weeklyページ初回表示で先週分未生成なら自動', 'claude-opus-4-7'],
          ['Self-Analysis 再分析', 'SelfAnalysisページ表示時にTTL超過タイプを順次自動', 'claude-opus-4-7'],
          ['Arc / Theme / Chapter', '毎朝9時JST（条件満たせば）', 'claude-opus-4-7'],
          ['Dream検出', '毎朝9時JST（過去7日スキャン）', 'claude-opus-4-7'],
          ['カレンダー予定取得', '常時（ページ表示時）', 'なし（proxy経由）'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--accent)' }}>ユーザー操作トリガー</div>
        <Tbl headers={['データ', '更新タイミング', 'トリガー', '連鎖先']} rows={[
          ['diary_entries', 'Today画面で「記録する」', 'ユーザー入力', '→ emotion_analysis → 日記自動抽出(tasks/habits) → embedding → Moment Detector（並列自動連鎖）'],
          ['tasks (自動完了検出)', '日記投稿時', 'useDiaryExtraction (Opus 4.7)', 'オープンなタスクと日記を照合。confidence=high は自動 status=done + source="auto:diary-extract"、medium は提案表示。誤検出は1クリックで戻せる'],
          ['habit_logs (自動記録)', '日記投稿時', 'useDiaryExtraction (Opus 4.7)', 'アクティブな習慣と日記を照合。confidence=high は habit_logs に INSERT (note=[auto])、medium は提案表示。重複記録は防止'],
          ['tasks (新規提案)', '日記投稿時', 'useDiaryExtraction', '日記に「〜しないと」「明日〜する」等の将来アクションを検出。ユーザー「追加」クリックで作成（自動作成はしない）'],
          ['tasks (完了)', 'Today画面でチェックボックス', 'インラインCRUD', 'status=done + 取り消し線。→ Google Tasks同期(completed)。再クリックで戻す(needsAction)'],
          ['tasks (追加)', 'Today画面の + ボタン / 秘書(自然言語)', 'インラインCRUD', 'due_date/scheduled_at/deadline_at で3ゾーン振り分け。日付あり→Google Tasks自動作成(google_task_id保存)'],
          ['tasks (編集)', 'Today画面でタイトルクリック', 'インライン編集', 'タイトル・期限・優先度変更。google_task_idあれば→Google Tasks自動更新'],
          ['habits (完了)', 'Today画面でチェック', 'ユーザータップ', '→ 統合プログレスバーに即反映'],
          ['habits (追加)', 'Today画面の + ボタン → Enter', 'インラインCRUD', '即追加。Habitsページで詳細編集'],
          ['weekly_narratives', '週1 自動（Weeklyページ初回表示時に先週分が無ければ自動生成）', 'フロント auto-trigger', 'DB保存。手動「生成」ボタンは再生成用に残存。model=claude-opus-4-7'],
          ['self_analysis', 'タイプ別に自動再分析（MBTI/Big5/ストレス=30日、ストレングス/コミュ=60日、価値観=90日）', 'フロント auto-trigger（SelfAnalysis初回表示時にstale検出→順次バックグラウンド実行）', 'ハイブリッド方式: 初回=全データ分析→analysis_context保存、更新=前回context+差分データで効率的更新。model=claude-opus-4-7。手動「再分析」ボタンも維持'],
          ['dream_detected', '毎朝9時（narrator-update cron内、前回から7日未満ならskip）', 'GitHub Actions → Edge Function', '過去7日の日記と active dreams を Opus 4.7 で照合→ activity_log にINSERT → Dreams画面「最近の気づき」に表示'],
          ['narrator (Arc/Theme/Chapter)', '毎朝9時（週/月/四半期スパンで内部スキップ判定）', 'GitHub Actions → narrator-update Edge Function', 'Arc=週1、Theme=月1、Chapter=四半期1。model=claude-opus-4-7。Storyページで表示'],
          ['ai_partner (時間帯別メッセージ)', '朝/昼/夕/夜の時間帯変化でキャッシュ再生成', 'useMorningBriefing（ページ表示時）', '日記投稿では再生成しない（冗長回避）。model=claude-opus-4-7。過去3件の出力をプロンプト注入して同じ表現を避ける'],
          ['news_items', 'Today/Reportsで「収集」ボタン', 'Edge Function news-collect（4ソース並列）+ news-enrich（LLM日本語要約）', 'Google News RSS + arXiv API + Hacker News API + 公式ブログRSS → DB保存 + クリック追跡。news-enrich は title_ja/summary を gpt-5.4-nano で生成（バッチ + POST{id}で手動再翻訳可、Today/Reports の各記事に「日本語訳」ボタン）'],
          ['calendar_events (読み取り)', 'Calendar/Todayページ', 'Edge Function proxy (GET /events)', 'google-calendar-proxy経由。Authorization Code Flow + 暗号化refresh token。maxResults=250 + nextPageTokenページングで取りこぼし防止、失敗カレンダーは failed_calendars[] で警告バッジ表示'],
          ['calendar_events (作成/編集/削除)', 'Calendarページ「+ 予定」ボタン or 既存予定クリック', 'Edge Function proxy (POST/PATCH/DELETE /events)', 'focus-you内で完結。Googleカレンダー画面を別で開く必要なし。EventModalでsummary/日付/開始終了/calendarId編集可能。ドラッグ移動も PATCH で Google に反映'],
          ['life_story_entries', 'Rootsページで質問に答える', 'Edge Function life-story (POST next_question/answer/summarize/coverage)', 'Opus 4.7で過去回答を踏まえて質問生成→ステージ×軸(幼少期/小/中/高/大学/社会人初期/中期/最近 × 価値観/家庭/嬉しかった/苦しかった/転機/仕事/人間関係)のカバレッジをDBに蓄積。再実行ほど手薄エリアを聞く。セッション終了でsummarize→テーマ/言語化/次回候補を返す'],
          ['google_tasks', 'タスク作成/更新/完了時', 'data.ts → syncTaskToGoogle', 'Supabase tasks→Google Tasks一方向同期。日付ありタスクのみ。google_task_idでリンク。lib/googleTasksApi.ts'],
          ['goals / dreams', '各ページで追加・更新', 'ユーザー操作', 'goal完了 → dream statusの自動更新連鎖'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--green)' }}>自動メンテナンス（/company 起動時に検出→修復）</div>
        <P>freshness-policy.yaml で定義（14データソース）。stale検出→人間の操作なしでClaude Codeが自動修復。</P>
        <Tbl headers={['データ', '検出条件', '自動修復アクション']} rows={[
          ['harness_research', '最終調査7日超', '情報収集部(最新記事) ∥ 運営改善部(GAP分析) → 改善提案更新'],
          ['dept_knowledge_refresh', '最終更新14日超', 'ローテーションで2部署選定 → 情報収集(調査) ∥ ops(GAP分析) → 社長承認で更新'],
          ['growth_events', '失敗シグナル蓄積', 'growth-detector.sh（キーワード検出）→ ファイル蓄積 → daily-analysis-batch.sh（Claude CLI）で要約・INSERT'],
          ['knowledge昇格', 'confidence ≥ 3 の未昇格ルール', 'daily-analysis-batch.sh で検出 → 社長に提示 → 承認後に rules/ 追記'],
          ['CLAUDE.md サイズ', '200行超', '手順的記述をrules/に分離 → CLAUDE.md縮小（Hook でも警告）'],
          ['design-philosophy / Blueprint', '14日未更新 + AI機能変更あり', 'git diff分析 → 該当セクション自動追記'],
          ['docs/knowledge/', '14日未更新', '新しいドキュメントがあれば追記'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: '#8b5cf6' }}>日次バッチ分析（daily-analysis-batch.sh）</div>
        <P>/company 起動時 or セッション開始時に24h経過で自動実行。Task 1-5はClaude CLI、Task 6 (CEOインサイト) はgpt-5.4-mini (Edge Function)。</P>
        <Tbl headers={['タスク', '内容', '頻度', '出力先']} rows={[
          ['プロンプト分類', '未分類のClaude Codeプロンプトにpj/intent/dept/catタグ付与', '毎日', 'prompt_log.tags'],
          ['失敗シグナル要約', 'キーワード検出した失敗シグナルをLLMで要約', '毎日', 'growth_events'],
          ['スキル進化', 'prompt_logからパターン検出→候補蓄積→count≥3で提案', '毎日', 'skill_candidates'],
          ['部署評価', 'activity_log + growth_eventsから5軸評価', '7日間隔', '.company/hr/evaluations/'],
          ['ナレッジ昇格チェック', 'confidence≥3の未昇格ルールを検出→社長に提案', '毎日', '/tmp（ブリーフィングで提示）'],
          ['CEOインサイト (3層)', 'L1:日記下処理(日次) → L2:週次分析(生データ+prompt) → L3:月次深掘り(仮説検証)', '日次/週次/月次', 'diary_entries, diary_analysis, ceo_insights'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--text3)' }}>コスト分離の原則</div>
        <Tbl headers={['処理場所', '使用モデル', 'コスト', '用途']} rows={[
          ['ダッシュボード（構造化/タグ付け系）', 'gpt-5.4-nano / gpt-5.4-mini', 'OpenAI API従量課金（低）', '感情分析(mini)、夢分類(nano)、検索rerank(nano)、ルーティング判定(nano)、Moment Detector(nano)'],
          ['ダッシュボード（自己理解系）', 'claude-opus-4-7', 'Anthropic API従量課金（高精度）', '時間帯別メッセージ、Self-Analysis(MBTI/Big5/等)、Weekly Narrative'],
          ['Edge Function（バッチ・narrator-update）', 'claude-opus-4-7', 'Anthropic API従量課金', 'Arc Reader(週1) / Theme Finder(月1) / Chapter Generator(四半期) / Dream Detection(週1)。毎朝9時JST GitHub Actions cron で起動'],
          ['Claude Code（バッチ）', 'Claude CLI opus', 'サブスク内（追加費用なし）', 'プロンプト分類、成長分析、スキル進化、部署評価'],
          ['Edge Function（バッチ分析）', 'gpt-5.4-mini', 'OpenAI API（月$0.1以下）', 'CEOインサイト3層分析（日記+prompt_log）、フィードバック蒸留'],
          ['Claude Code（Hook）', 'なし（キーワードのみ）', 'ゼロ', 'prompt-log タグ付け、growth-detector シグナル検出'],
        ]} />
      </Section>

      <Section title="更新連鎖マップ（1つの操作が何を動かすか）">
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2.2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`日記を書く
  ├→ diary_entries INSERT
  ├→ emotion_analysis 自動生成（感情スコア+WBI）
  │    └→ diary_entries.wbi UPDATE → Journal 感情カレンダー更新
  ├→ AI Partner コメント再生成（invalidate → 日記[主役]+天気[空気]+予定/タスク[補足] → LLM生成）
  └→ 夢進捗検出（diary × dreams照合 → 一致あれば toast 通知）

Today画面でタスク操作
  ├→ チェックボックス → status=done + 取り消し線（再クリックで戻す）
  │    └→ google_task_idあり → Google Tasks API PATCH (completed)
  ├→ + ボタン → テキスト入力 → Enter → tasks INSERT
  │    └→ 日付あり → Google Tasks API POST → google_task_id保存
  ├→ タイトルクリック → インライン編集（タイトル/期限/優先度）→ Save
  │    └→ google_task_idあり → Google Tasks API PATCH (更新)
  └→ 「今日の予定」内 3ブロック振り分け:
       ├→ scheduled_at/deadline_at(時刻付き) → 「時間指定」ブロック (30分スロット)
       ├→ due_date(日付のみ、今日) → 「時間未定」ブロック
       └→ due_date(未来7日) → 「近日（明日〜今週）」ブロック

Today画面で習慣操作
  ├→ チェックボックス → habit_logs INSERT/DELETE（トグル）
  ├→ + ボタン → テキスト入力 → Enter → habits INSERT
  └→ 統合プログレスバー即更新（タスク+習慣の合算）

セッション開始（並列実行）
  ├→ git pull（async — 最新コード取得）
  ├→ session-start-marker.sh（sync — タイムライン記録）
  ├→ supabase-status.sh（async — DB接続確認）
  └→ config-sync.sh（async — settings/MCP/CLAUDE.md → Supabase）

Context Compaction 発生時
  ├→ PreCompact: セッション状態を .session-state.json に退避
  └→ PostCompact: additionalContext で重要情報を再注入

/company 起動
  ├→ knowledge_base 読み込み（active ルール取得）
  ├→ 未処理コメント確認
  ├→ カレンダー取得（今日+明日）
  └→ データ鮮度チェック（14データソース, freshness-policy.yaml）
       └→ harness_research 7日超? → 情報収集部 ∥ 運営改善部 → 改善提案更新

/company 起動時の自動メンテナンス
  ├→ growth_events: git log分析 → パターン検出 → 自動INSERT
  ├→ knowledge昇格: confidence≥3 → 社長に提示 → 承認後にrules/追記（自動昇格禁止）
  ├→ CLAUDE.md: 200行超 → 手順をrules/に分離（PostToolUse Hookでも常時警告）
  └→ design-philosophy / Blueprint: 14日超 + 変更あり → 自動追記

CLAUDE.mdを編集
  └→ PostToolUse Hook: claude-md-size-guard.sh
       └→ 200行超 → additionalContext で警告（60行以下推奨）

危険コマンド実行
  └→ PreToolUse Hook: bash-guard.sh
       ├→ rm -rf / / force push / reset --hard / DROP → ブロック (exit 2)
       └→ ブロック時 → blocked-commands.jsonl に監査ログ記録

実装ファイルを変更
  └→ PostToolUse Hook: docs-sync-guard.sh
       └→ 対象ファイル？ → additionalContext で警告
            ai-agent/index.ts → "AI Features タブ更新必要"
            .claude/hooks/*.sh → "Overview + Harness タブ更新必要"
            .claude/rules/*.md → "Operations タブ更新必要"
            departments/*/CLAUDE.md → "Operations タブ更新必要"
       └→ commit-rules.md にも同期チェック義務化
       └→ freshness-policy: impl_docs_sync で git log 日付比較

Edge Function (ai-agent/index.ts) を編集
  └→ PostToolUse Hook: edge-function-deploy.sh
       └→ パスが ai-agent/index.ts にマッチ？
            └→ YES: 自動デプロイ（10秒デバウンス）
                 └→ "Edge Function ai-agent を自動デプロイしました"
            └→ NO: スキップ

部署Agent を起動
  └→ PostToolUse Hook: agent-activity-log.sh
       └→ Agent tool を検出 → dept, model, description を記録
            ├→ ~/.claude/logs/agent-activity.jsonl（ローカル）
            └→ Supabase activity_log INSERT（action=dept_dispatch, metadata.dept）

プロンプトを入力
  └→ UserPromptSubmit Hook（3つ並列実行）:
       ├→ prompt-log.sh: LLM分類（gpt-5.4-nano）→ pj/intent/dept/cat タグ → prompt_log INSERT
       ├→ growth-detector.sh: 失敗シグナル検出（キーワードベース、LLM不要）
       │    └→ bug_report/correction/frustration/missed/repeated をキーワードで検出
       │    └→ ~/.claude/logs/growth-signals.jsonl に永続保存
       │    └→ 3件以上 → growth-summarize.sh（ファイル保存のみ、要約はバッチ）
       └→ session-summary-periodic.sh: 10プロンプトごとにサマリ更新
            └→ SessionStop依存を排除（クラッシュでもサマリが残る）

/company 起動時 or セッション開始時（24h経過の場合）
  └→ daily-analysis-batch.sh
       ├→ [1] プロンプト分類: 未タグの prompt_log にLLMタグ付与（Claude CLI）
       ├→ [2] 失敗シグナル要約: growth-signals.jsonl → growth_events INSERT（Claude CLI）
       ├→ [3] スキル進化: パターン検出 → skill_candidates 蓄積（Claude CLI）
       ├→ [4] 部署評価: activity_log分析 → evaluations（7日間隔）（Claude CLI）
       ├→ [5] ナレッジ昇格: confidence≥3 検出 → ブリーフィングで提案（Claude CLI）
       └→ [6] CEOインサイト 3層分析（gpt-5.4-mini via Edge Function）
            ├→ L1 日次: 未処理日記にtopics/ai_summary付与 → diary_entries UPDATE
            ├→ L2 週次: 日記生テキスト全件+prompt_log → 週次パターン → diary_analysis + ceo_insights
            └→ L3 月次: 全件+週次要約 → 仮説生成 → 過去データで検証 → diary_analysis + ceo_insights`}
        </div>
      </Section>
    </>
  )
}

// ========== Tab: Experience Design ==========

function TabExperienceDesign() {
  return (
    <>
      <Section title="解きたい課題 — 4層構造">
        <P>課題にはレイヤーがある。表面的な現象だけ見ると「日記アプリでよくない?」になる。根本まで掘ると、既存のどのプロダクトも解けていない。</P>
        <Tbl headers={['層', '課題', '具体的な声']} rows={[
          ['L1: 現象', '毎日が断片で、意味のある流れとして見えない', '「今日も1日終わった。なんか忙しかった」'],
          ['L2: 原因', '記録しても「読み解いてくれる存在」がいない', '日記を書いても、分析も解釈もない。データが溜まるだけ'],
          ['L3: 既存解の限界', '既存のどのプロダクトも「あなたの物語」を語れない', 'SNS=他人の物語 / 日記アプリ=放置 / ChatGPT=あなたを知らない'],
          ['L4: 本質的欲求', '自分の人生に意味を見出したい', '「自分って何がしたいんだろう」「自分はどういう人間なんだろう」'],
        ]} />
        <div className="g2" style={{ marginBottom: 16, marginTop: 12 }}>
          <MiniCard title="Before（L1-L4）" body="毎日が断片 → 読み解く存在がない → SNSは他人の物語 → 自分の人生の意味がわからない" />
          <MiniCard title="After（focus-youがある世界）" body={'書いた直後にAIが共感 → 感情を分析し物語の文脈で語る → 「自分は"意味を問う人"だ」と気づく'} />
        </div>
      </Section>

      <Section title="ユーザーに体験してほしい5つのこと">
        <P>設計の全判断は、この5つを実現するために行う。5つが満たされていれば機能の多寡は問わない。</P>
        <Tbl headers={['#', '体験', '具体的な瞬間', '設計への影響']} rows={[
          ['E1', '「覚えてくれている」', 'AIが昨日の日記に触れる。先月の転機を引用する', '記憶設計（4層）、Narrative Memory'],
          ['E2', '「自分でも気づかなかった」', '3ヶ月の日記から人生テーマを発見される', 'Theme Finder、データ蓄積→体験変化'],
          ['E3', '「今の自分の位置がわかる」', '感情の弧で「今は沈黙期、でもいつも跳躍の前」と知る', 'Arc Reader、Foresight Engine'],
          ['E4', '「書いたら反応がある」', '日記を書いた直後にAIが共感してくれる', 'フィードバックループ、即時性'],
          ['E5', '「この場所は安全だ」', '本音を書いても評価されない。データは自分だけのもの', 'プライバシー設計、トーン設計'],
        ]} />
      </Section>

      <Section title="語り手の人格 & 設計原則">
        <div className="g2" style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--accent)' }}>語り手（Narrator）の人格</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div>あなたの物語を長く見てきた、信頼できる語り手。</div>
              <div>友人のような親しみ、だが軽すぎない。核心を突く。</div>
              <div style={{ marginTop: 8 }}><strong>する:</strong> 物語として語る / 問いを投げる / 本人の言葉を引用する</div>
              <div><strong>しない:</strong> 指示する / 評価する / 断定する / 数字を読み上げる</div>
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>立ち位置: 何であり、何でないか</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div>○ 物語の「語り手」 / 自分を理解する「鏡」 / 長く付き合う「伴走者」</div>
              <div>× データの「集計ツール」 / 他人と比較する「SNS」 / 仕事の「効率化ツール」</div>
              <div style={{ marginTop: 8, color: 'var(--text3)', fontSize: 11 }}>商用化の軸は「仕事効率化」ではなく「自己理解・幸せ・物語」</div>
            </div>
          </div>
        </div>
        <Tbl headers={['#', '原則', '意味', '違反の例']} rows={[
          ['P1', '意図の先読み', 'ユーザーが考える前に欲しいものが手に届く', '夜に「朝のスケジュール」を見せる'],
          ['P2', '認知負荷の最小化', '疲れている時にも使える', '一度に10個の感情スコアを表示'],
          ['P3', 'フィードバックループ', '書いたら反応がある。使うほど賢くなる', '日記を書いても翌日まで何も起きない'],
          ['P4', 'エラー回復の人間化', 'AIが間違えても信頼を壊さない', '「エラーが発生しました」の無機質な画面'],
          ['P5', 'フロー状態の保護', '内省の流れを遮断しない', '日記を書いている最中にポップアップ'],
        ]} />
      </Section>

      <Section title="体験設計フレームワーク — 10領域">
        <P>LLMベースシステムの体験設計で考えるべき全領域。汎用フレームワーク（他PJにも再利用可能）+ focus-youへの具体適用。</P>
        <Tbl headers={['#', '領域', '汎用の問い', 'LLM特有の考慮']} rows={[
          ['1', '行動文脈設計', 'Who/When/Where/Why（JTBD）', 'LLMへの入力時の精神状態、出力をどの注意力で受け取るか'],
          ['2', '感情ジャーニー', 'First Touch → 探索 → 日常化 → 深化 → 伝播', '「AIが自分を理解している」瞬間=定着、「的外れ」=離脱'],
          ['3', 'LLMインタラクション', '応答速度・トーン・記憶・幻覚対策・信頼構築', '信頼性4レベル: 事実→分析→洞察→予測'],
          ['4', 'バッチ vs リアルタイム', '鮮度要求/入力トリガー/コスト感度', '高コスト・高レイテンシのLLM処理をいつ走らせるか'],
          ['5', 'プライバシー&信頼', '技術的/意図的/能力的信頼の3層', '日記・感情データは最もセンシティブ。学習に使わないことの明示'],
          ['6', 'コールドスタート', 'Day 0から価値を感じさせる', 'LLMはゼロデータでも会話可能だが「あなた向け」ではない'],
          ['7', '定着設計', 'Hook Model: Trigger→Action→Variable Reward→Investment', '蓄積価値（使うほどAIが賢くなる）がLLM最大のレバー'],
          ['8', 'エラー&回復', 'LLMエラー5分類と回復パターン', '幻覚/的外れ/トーン違反/API障害/レイテンシ超過'],
          ['9', '段階的開示', 'データ量/時間/行動の3トリガー', 'データ不足で高度な分析を動かすと的外れ→信頼崩壊'],
          ['10', 'パフォーマンス体験', 'レイテンシ閾値とストリーミング戦略', 'TTFT（Time To First Token）が体感速度を決める'],
        ]} />
      </Section>

      <Section title="行動文脈 — 時間帯別の精神状態">
        <P>ユーザーは「機能が欲しい」のではなく「状況を解決したい」。同じ画面を24時間出さない。</P>
        <Tbl headers={['時間帯', '精神状態', '達成したいこと', '許容できる認知負荷']} rows={[
          ['朝 5-11', '覚醒途中、受動的', '今日の全体像を30秒で掴む', '低。情報は「読む」ではなく「受け取る」'],
          ['昼 11-17', '活動中、断片的な空き時間', '忘れる前にメモ、残タスク確認', '中。短時間の集中は可能'],
          ['夜 17-5', '疲労、内省的', '一日を穏やかに閉じる、達成感を感じる', '低。罪悪感を刺激しない'],
        ]} />
      </Section>

      <Section title="感情ジャーニー — 5フェーズ">
        <Tbl headers={['フェーズ', '期間', '支配的感情', '設計目標']} rows={[
          ['First Touch', '初回-3日', '期待+不安+懐疑', '「これは自分に価値がある」と確信させる'],
          ['Exploration', '1-2週', '好奇心+手探り感', '機能を段階的に発見させ、小さな成功体験を積ませる'],
          ['Routine', '2週-2ヶ月', '安定+やや退屈', '習慣化トリガーを埋め込む、飽きさせない変化を仕込む'],
          ['Deepening', '2ヶ月-', '信頼+驚き+愛着', 'データ蓄積による体験の質的変化を見せる'],
          ['Advocacy', '不定', '誇り+共感', '物語の共有機能、他者への推薦動機'],
        ]} />
        <Principle title="Deepeningフェーズの鍵" body="2ヶ月目にTheme Finderが初めて動くタイミング。「このアプリは他のどのツールとも違う」と確信する瞬間。データ蓄積が体験の質を変える瞬間をデザインする。" color="var(--accent)" />
      </Section>

      <Section title="LLMインタラクション — トーン&記憶&信頼性">
        <P>ブランドパーソナリティ: 「あなたの物語を長く見てきた、信頼できる語り手」</P>
        <Tbl headers={['時間帯', 'トーン', '例']} rows={[
          ['朝', '静かに寄り添う', '「おはよう。今日は○○があるね」'],
          ['昼', '軽く承認', '「午前中、お疲れさま」'],
          ['夜', '深い共感', '「今日はこんな一日だったんだね」'],
          ['深夜', '心配', '「遅くまでお疲れさま。体、大事にしてね」'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>記憶設計 — 4層</div>
        <Tbl headers={['記憶層', 'データソース', 'ユーザー体験']} rows={[
          ['短期（今日）', '今日の日記、直近の会話 → プロンプト直接注入', '「昨日の日記の話をしたら覚えてた」→ 当然'],
          ['中期（今週）', '今週の感情推移、最近の転機 → Active Context', '「先月の転機に触れてきた」→ 嬉しい驚き'],
          ['長期（数ヶ月）', '人生テーマ、物語の章 → Narrative Memory', '「去年の同じ時期の話を持ち出してきた」→ 深い感動'],
          ['永久', '性格特性、価値観 → self_analysis', '「自分の性格をわかった上で話してくる」→ 信頼'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>幻覚対策</div>
        <Tbl headers={['対策', '具体策']} rows={[
          ['事実はコードで生成', '「今日の予定は3件」はテンプレートリテラルで注入。LLMに言わせない'],
          ['日記引用は原文参照', '「先月こう書いていました」→ diary_entry から引用。LLMの記憶に頼らない'],
          ['分析には根拠を添える', '「anticipationが高まっています（直近7日: 62→78）」と数値を添える'],
          ['洞察は一人称で語る', '「あなたは○○です」ではなく「私は○○と感じています」'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>信頼性レベル</div>
        <Tbl headers={['レベル', '性質', '扱い']} rows={[
          ['事実', '検証可能（予定、タスク数、日付）', 'データソースから直接取得。LLMに生成させない'],
          ['分析', 'データに基づく解釈（感情傾向）', 'LLMが生成するが、根拠データへのリンクを添える'],
          ['洞察', '深い推論（テーマ発見、物語解釈）', 'LLMの核心的価値。「私はこう読みました」と一人称で'],
          ['予測', '未来の推論（Foresight）', '必ず「予感」「かもしれません」の語調。断言しない'],
        ]} />
      </Section>

      <Section title="バッチ vs リアルタイム — 判断フレームワーク">
        <P>LLMの処理は高コスト・高レイテンシ。「いつ処理するか」がUXとコストの両方を左右する。</P>
        <Tbl headers={['判断軸', 'リアルタイム向き', 'バッチ向き']} rows={[
          ['鮮度要求', 'ユーザーが「今」の情報を期待', '昨日/先週のデータで十分'],
          ['入力トリガー', 'ユーザーのアクション（日記投稿、質問）', '時刻（朝7時）、蓄積量（日記N件）'],
          ['出力の消費', '入力直後（チャット応答）', '次にアプリを開いた時'],
          ['処理の重さ', '軽い（1-2秒）', '重い（10秒以上、複数データソース）'],
          ['失敗の影響', 'ユーザーが待っているので致命的', 'リトライ可能、ユーザーは気づかない'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>focus-you バッチ設計</div>
        <Tbl headers={['処理', 'タイミング', '種別', '判断根拠']} rows={[
          ['朝ブリーフィング', 'pg_cron 7:00', 'バッチ', 'Predictive Batch。起床前に事前生成'],
          ['ニュース収集', 'pg_cron 7:00/19:00', 'バッチ', 'ユーザーアクション不要'],
          ['感情分析', '日記投稿後', 'リアルタイム', '投稿直後にフィードバックが欲しい'],
          ['AIコメント', '日記投稿後', 'リアルタイム', 'フィードバックループの核'],
          ['Moment Detector', '日記投稿後', 'リアルタイム', '書いた直後に転機確認。翌朝では温度差が出る'],
          ['Arc Reader', '週次（日曜深夜）', 'バッチ', '感情の弧は「線」。1日分では見えない。週次レビューで消費'],
          ['Theme Finder', '月次（月末深夜）', 'バッチ', '大量データ横断分析。コスト大。月1回で十分'],
          ['Foresight Engine', '週次（Arc Reader後）', 'バッチ', 'Arc Readerの出力に依存。即座に不要'],
          ['Chapter生成', '四半期', 'バッチ', '長期的な物語。急がない'],
          ['Weekly Narrative', '月曜早朝', 'バッチ', '月曜朝に先週の物語を読む体験'],
          ['習慣ストリーク', '毎日深夜0:05', 'バッチ', '日付変更直後に確定。日付境界問題を回避'],
          ['WBI集計', '毎日深夜0:10', 'バッチ', '日次集計。リアルタイム不要'],
        ]} />
      </Section>

      <Section title="Narrator体験 — 4エンジンがユーザーにどう見えるか">
        <Principle title="エンジン名はユーザーに見せない" body="「Arc Readerが分析しました」は技術者の自己満足。ユーザーには「あなたの感情の流れ」「あなたの物語のテーマ」として見せる。技術はブランド名ではなく、体験の質で語る。" color="var(--accent)" />
        <Tbl headers={['ユーザーが体験すること', 'エンジン', '表示場所']} rows={[
          ['「先月と今月で気分の流れが全然違う」と気づく', 'Arc Reader', 'Story: 感情の弧ビジュアル'],
          ['「自分はこういう人間なんだ」という発見', 'Theme Finder', 'Self Analysis: テーマバッジ（3つまで）'],
          ['日記を書いた直後に「これは大きな出来事ですね」', 'Moment Detector', 'Today: インラインカード（モーダルではない）'],
          ['「去年の同じ時期にも...」と過去との接続', 'Foresight Engine', 'AIコメント / チャット内に自然に溶け込む'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>Moment Detector — 転機の確認UI</div>
        <div className="card" style={{ padding: 16, fontSize: 12, color: 'var(--text2)', lineHeight: 1.8, borderLeft: '3px solid var(--amber)' }}>
          <div style={{ marginBottom: 8 }}>今日の日記に、大きな決断について書いていましたね。</div>
          <div style={{ marginBottom: 12 }}>この瞬間を、あなたの物語に記録しておきますか? 後から振り返った時、ここがターニングポイントだったとわかるかもしれません。</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: 'var(--accent)', color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>記録する</span>
            <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '4px 12px', borderRadius: 6, fontSize: 11 }}>今はいい</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8 }}>表示: 日記投稿後 / インラインカード / 1日最大1回</div>
        </div>
      </Section>

      <Section title="時間帯別の完全体験フロー">
        <div className="g3" style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--amber)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--amber)' }}>朝（5-11時）受動的インプット</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div>1. 挨拶 + 天気 + AIコメント（バッチ生成済み）</div>
              <div>2. スケジュール概要（3件のみ）</div>
              <div>3. フォーカスタスク（今日期限+高優先 最大3件）</div>
              <div>4. 日記エリア（下部。朝は書かない人が多い）</div>
              <div>5. 習慣チェック（朝ルーティンのみ）</div>
              <div style={{ marginTop: 8, color: 'var(--text3)', fontSize: 11 }}>所要時間: 30秒-2分</div>
            </div>
          </div>
          <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--accent)' }}>昼（11-17時）能動的アウトプット</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div>1. 日記入力エリアが上部に来る</div>
              <div>2. プロンプト:「{'{'}直前MTG名{'}'}の後、何か思ったこと?」</div>
              <div>3. 残りスケジュール（午後のみ）</div>
              <div>4. AIコメント（投稿後に即反応）</div>
              <div style={{ marginTop: 8, color: 'var(--text3)', fontSize: 11 }}>所要時間: 1-5分</div>
            </div>
          </div>
          <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--green)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--green)' }}>夜（17-翌5時）内省と安息</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div>1. 完了サマリー（達成ファースト）</div>
              <div>2. 日記入力 + 分析質問（日替わり）</div>
              <div>3. AIコメント（深い共感トーン）</div>
              <div>4. 明日の予告（軽く。重荷を見せない）</div>
              <div>5. Moment Detector（転機があれば）</div>
              <div style={{ marginTop: 8, color: 'var(--text3)', fontSize: 11 }}>所要時間: 3-10分 / ピーク: AIの共感 / エンド: 穏やか</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="リズム設計 — 日次〜年次">
        <Tbl headers={['粒度', '体験', '感情ピーク', 'バッチタイミング']} rows={[
          ['毎日', 'AIコメント + 日記 + 感情分析', '「今日も見てくれている」安心感', '05:00 WBI集計 / 07:00 ブリーフィング'],
          ['毎週', 'Weekly Narrative + Arc Reader更新', '「自分の1週間にこんな意味があったのか」驚き', '日曜深夜 Arc Reader / 月曜早朝 Narrative'],
          ['毎月', 'Theme Finder更新 + 月次振り返り', '「自分の人生のテーマが見えた」感動', '月末深夜 Theme Finder'],
          ['四半期', 'Chapter生成', '「物語の章が増えた」達成感', '四半期末 Chapter生成'],
          ['毎年', '年間物語 + Growth Chronicle', '「1年間の自分の成長物語」深い感動', '12月下旬 年間物語生成'],
        ]} />
      </Section>

      <Section title="定着設計 — Hook Model">
        <div className="g2" style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>日次Hook</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div><strong>Trigger:</strong> 朝の通知 / 「書き留めたい」衝動</div>
              <div><strong>Action:</strong> Today画面 → 日記（最小1行でOK）</div>
              <div><strong>Variable Reward:</strong> AIコメントが毎回異なる / 感情分析の意外な発見 / ストリーク更新 / Moment Detector（不定期サプライズ）</div>
              <div><strong>Investment:</strong> Narrative Memory蓄積 → AI精度向上 → スイッチングコスト</div>
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>週次/月次/年次Hook</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div><strong>週次:</strong> Weekly Narrative → 自分の1週間が「物語」として語られる驚き</div>
              <div><strong>月次:</strong> Theme Finder更新 → 人生テーマの発見・更新</div>
              <div><strong>年次:</strong> 年間物語生成 → 「1年前の自分はこうだったのか」という感動</div>
              <div style={{ marginTop: 8 }}><strong>共通Investment:</strong> データが増えるほど分析が深化。複利で効く。</div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="コールドスタート — Day 0 からの体験設計">
        <P>データがゼロの初日から価値を感じさせなければ、2日目はない。</P>
        <Tbl headers={['データ蓄積量', '解放される体験', 'ユーザーへの告知']} rows={[
          ['日記 1件', '感情分析、AIコメント', '（告知不要、即座に体験）'],
          ['日記 7件', '週次の感情推移グラフ', '「1週間分のデータが揃いました」'],
          ['日記 14件', 'Weekly Narrative', '「2週間書き続けてくれましたね。最初の物語をお届けします」'],
          ['日記 30件', 'Arc Reader（感情の弧）', '「1ヶ月分の物語が見えてきました」'],
          ['日記 90件', 'Theme Finder', '「3ヶ月のデータから、あなたの人生のテーマが浮かび上がりました」'],
          ['日記 180件', 'Foresight Engine', '「あなたの物語のパターンから、次の展開が見え始めます」'],
        ]} />
        <Principle title="Day 0 の最重要ポイント" body="日記を1行書いたら即座にAIが反応する。白紙に書いて放置される日記帳ではないと伝える。翌日、AIが昨日の日記に触れる — 「覚えている」ことがDay 1の定着トリガー。" color="var(--green)" />
      </Section>

      <Section title="エラー&回復設計">
        <Tbl headers={['エラー', '深刻度', '回復設計']} rows={[
          ['幻覚（存在しない日記に言及）', '高', '根拠データへのリンクで検証可能に'],
          ['的外れ（意図と異なる解釈）', '中', '「違います」フィードバック→即座に再生成'],
          ['トーン違反（疲れている時に元気）', '低-中', '時間帯・感情データでトーンを事前制御'],
          ['API障害', '高', 'フォールバック（キャッシュ or ルールベース応答）'],
          ['レイテンシ超過（10秒+）', '中', 'ストリーミング + スケルトンUI'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>AIコメント障害時のフォールバック</div>
        <Flow steps={['5秒以内', '通常表示']} />
        <Flow steps={['5秒超過', '「考え中...」表示']} />
        <Flow steps={['15秒超過', '前回コメント表示 + 「整理中です」']} />
        <Flow steps={['API障害', '時間帯別の定型メッセージ（定型であることを隠さない）']} />

        <Principle title="日記入力は絶対に失わない" body="ネットワーク障害 → localStorageに自動保存 → 再送信ボタン表示。ユーザーの入力を消すことは許されない。" color="var(--red)" />
      </Section>

      <Section title="パフォーマンス体験 — Today画面のローディング">
        <Tbl headers={['Step', '時間', '表示内容']} rows={[
          ['1. HTMLシェル', '< 100ms', 'ナビゲーション、セクション骨格'],
          ['2. ローカルデータ', '< 300ms', 'Zustandキャッシュ、時間帯挨拶（ローカル計算）'],
          ['3. 軽量API', '< 1s', '天気、カレンダー、タスク → スケルトンから実データへ'],
          ['4. 重量API', '1-3s', 'AIコメント（バッチ済みならキャッシュヒット）、感情分析'],
          ['5. バックグラウンド', 'ユーザー閲覧中', 'AIコメント鮮度チェック→staleなら再生成'],
        ]} />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="楽観的UI" body="日記投稿→即座に「投稿済み」表示→裏で感情分析。習慣チェック→即チェックマーク→裏でAPI保存。" />
          <MiniCard title="タイプライター演出" body="バッチ生成済みのAIコメントもあえて0.5秒かけて表示。「AIが考えて書いた」感覚を演出。即座に出ると機械的。" />
        </div>
      </Section>

      <Section title="実装ロードマップ（体験設計観点）">
        <Tbl headers={['Tier', '時期', '施策', '理由']} rows={[
          ['1', '今すぐ', 'フィードバックループ強化、時間帯別セクション順序、エラーフォールバック、日記ローカル保存', '日次の体験品質に直結。新機能より既存の磨き込みが先'],
          ['2', '1ヶ月', 'Weekly Narrative改善、Moment Detector、習慣マイクロインタラクション、感情バッジ強化', 'Moment Detectorのデータ蓄積は複利で効く。早く始めるほど将来の精度が上がる'],
          ['3', '3ヶ月', 'Arc Reader、Storyページ、Theme Finder', '3ヶ月分のデータで初回の感動を最大化。Theme Finderは待つことで質を担保'],
          ['4', '6ヶ月', 'Foresight Engine、Chapter生成、Narrative Memoryチャット注入', '全エンジン出力が揃ってから。部分的注入は中途半端'],
          ['5', '一般公開時', 'コールドスタート完全設計、段階的開示ナビ、Courage Board、プッシュ通知', '現在は唯一のユーザーが十分なデータを持っているため不要'],
        ]} />
        <Principle title="なぜTier 1が「フィードバックループ強化」なのか" body="日記を書く→AIが反応する→もっと書きたくなる。このループがfocus-youの生命線。ループが途切れる瞬間（AI応答失敗、遅延、的外れ）は致命的。既に動いている核心的ループの品質を磨くことが、新機能追加より価値が高い。" color="var(--accent)" />
      </Section>

      <Section title="設計判断ログ">
        <Tbl headers={['判断', '理由']} rows={[
          ['時間帯でセクション順序を変える', '朝と夜でユーザーの目的が根本的に異なる'],
          ['AIコメントを2-3文、100字以内', '疲れている時に長文は読めない。一番響く1つに絞る'],
          ['Moment Detectorをインラインカードで', 'モーダルはフロー状態を遮断する'],
          ['エンジン名をユーザーに見せない', '技術名は認知負荷。体験の質で語る'],
          ['Theme Finderを3ヶ月後に解放', 'データ不足での的外れは信頼を壊す。待つ方が初回の感動が大きい'],
          ['夜は完了タスクを先に表示', 'ピーク・エンドの法則。一日をポジティブに閉じる'],
          ['Foresightは「予感」「かもしれません」の語調', '予測の断言は幻覚と同じリスク。修辞で緩衝する'],
          ['バッチ結果にタイプライター演出', '即座に出ると機械的。「考えた」感を演出して信頼を高める'],
        ]} />
        <P>詳細: <code>.company/departments/ux/experience-design-focus-you.md</code></P>
      </Section>

      <Section title="モデル選定 — 誰が待っているかで決める">
        <Principle title="判断原則" body="ユーザーが画面を見つめて待っている → OpenAI API（速度優先）。誰も待っていない + CLI可能 → Claude CLI（品質優先・無料）。誰も待っていない + pg_cron内 → OpenAI API最安モデル。" color="var(--accent)" />
        <Tbl headers={['機能', 'ユーザーの状態', 'モデル', 'API', '理由']} rows={[
          ['感情分析', '投稿後、画面を見ている', 'gpt-5.4-mini', 'OpenAI', '3秒以内。mini精度で十分'],
          ['AIコメント', 'Today画面を見ている', 'gpt-5.4', 'OpenAI', '自然な日本語が必要。品質重視'],
          ['Moment Detector', '投稿後、画面を見ている', 'gpt-5.4-nano', 'OpenAI', '感情分析直後。軽い判定'],
          ['チャット応答', '送信後、待っている', '6段階ルーティング', 'OpenAI', 'SSEストリーミングで体感確保'],
          ['自己分析', 'ボタン押下後、待っている', 'gpt-5.4', 'OpenAI', '深い分析。品質重視'],
          ['ニュース収集', '誰も待っていない(バッチ)', 'gpt-5.4-mini', 'OpenAI (pg_cron)', 'web_searchにmini必要'],
          ['Arc Reader', '誰も待っていない(週次)', 'gpt-5.4', 'OpenAI (Edge Function)', '物語解釈。品質重視'],
          ['Theme Finder', '誰も待っていない(月次)', 'gpt-5.4', 'OpenAI (Edge Function)', '人生テーマ検出。品質重視'],
          ['Foresight Engine', '誰も待っていない(週次)', 'gpt-5.4', 'OpenAI', 'Arc Reader出力の解釈。深い推論'],
          ['Chapter生成', '誰も待っていない(四半期)', 'Claude CLI', 'Claude (無料)', '最長・最深の分析'],
          ['Weekly Narrative', '誰も待っていない(月曜早朝)', 'Claude CLI', 'Claude (無料)', '物語生成。品質重視'],
          ['WBI集計/ストリーク', '誰も待っていない', 'LLM不要(SQL)', '—', '数値計算にLLMは使わない'],
        ]} />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="コスト構造" body="OpenAI API: $3-5/月（nano中心）+ Claude CLI: $0（サブスク内）= 合計$3-5/月。バッチ処理をCLIに寄せることでAPI費用を最小化。" />
          <MiniCard title="一般公開時の変化" body="Claude CLI → OpenAI Batch API に移行（ユーザー数に比例するため）。移行を容易にするため、プロンプト設計はAPI呼び出しでも動く形に。" />
        </div>
      </Section>

      <Section title="速度要件 — レイテンシ予算">
        <Tbl headers={['カテゴリ', '時間', '設計パターン', '該当機能']} rows={[
          ['即座', '< 300ms', '楽観的UI更新。サーバー応答を待たない', '習慣チェック、タスク完了、日記投稿ボタン'],
          ['快適', '300ms-3s', 'スケルトンUI or スピナー', '感情分析、AIコメント、Moment Detector'],
          ['待てる', '3-15s', 'プログレスバー + 段階的表示', '自己分析、週次ナラティブ（手動）'],
          ['バックグラウンド', '15s-数分', '次回表示時にキャッシュ', 'Arc Reader、朝ブリーフィング'],
          ['夜間処理', '数分-数十分', 'Claude CLI。翌朝に反映', 'Chapter生成、年間物語'],
        ]} />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="ストリーミング判断" body="チャット: ✅必須（会話の自然さ）。AIコメント: ❌不要→タイプライター演出。感情分析: ❌不要（JSON応答）。自己分析: 🔶検討（分析種別ごとに段階表示）。" />
          <MiniCard title="体感速度の演出" body="バッチ生成済みのAIコメントもあえて0.5秒かける。「AIが考えて書いた」感覚。即座に出ると機械的に感じる。" />
        </div>
      </Section>

      <Section title="動線設計 — 欲しいときに欲しいものが手に届く">
        <Principle title="Today画面が宇宙の中心" body="全ての体験はTodayから始まりTodayに帰る。他ページへの遷移は「Todayの情報を深掘りする」行為。Todayに十分な入口を配置する。" color="var(--accent)" />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>現状の問題点</div>
        <Tbl headers={['問題', '詳細']} rows={[
          ['ナビゲーション過多', '21ルート×13セクション。初見はどこに何があるかわからない'],
          ['Todayからの動線が弱い', 'Journal/SelfAnalysis/Weeklyへは直接行けない。サイドバーを探す必要'],
          ['時間帯で動線が変わらない', '朝はCalendarへの動線、夜はJournal/Weeklyへの動線が欲しいが、常に同じ'],
          ['データ蓄積の通知がない', '日記30件でArc Reader解放されてもユーザーは気づかない'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>動線の3原則</div>
        <div className="g3" style={{ marginBottom: 16 }}>
          <MiniCard title="1. Todayが中心" body="全ページへの入口をTodayに配置。感情バッジ→Journal、Moment確認→Story、スケジュール→Calendar。" />
          <MiniCard title="2. 時間帯が動線を変える" body="朝: Today→Calendar。昼: Today→日記→感情分析。夜: Today→Journal→Weekly。時間帯コンテキストリンクを動的表示。" />
          <MiniCard title="3. データが動線を作る" body="日記7件→「感情推移が見えます」→Journal。30件→「物語の弧が…」→Story。マイルストーン通知で新体験への誘導。" />
        </div>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>サイドバー再構成案</div>
        <Tbl headers={['カテゴリ', '項目', '表示条件']} rows={[
          ['常時表示', 'Home / AI Chat / Journal / Tasks', '常に表示（4項目）'],
          ['Discover', 'Weekly / Self Analysis / Story', 'データ蓄積で段階的出現（日記14件/20件/30件）'],
          ['Plan', 'Dreams & Goals / Habits / Calendar', '常に表示（3項目）'],
          ['More（折りたたみ）', 'Finance / News / Growth / Organization / Knowledge 等', '折りたたみ内（使用頻度低）'],
        ]} />
        <P>初日は7項目、3ヶ月後は10項目。現状の21項目から大幅削減。</P>
      </Section>
    </>
  )
}

// ========== Tab: Architecture ==========

function TabArchitecture() {
  return (
    <>
      <Section title="全体アーキテクチャ">
        <P>1人の社長が複数PJを横断管理する仮想持株会社構造。AIエージェント（Claude）が秘書として各社を運営。</P>
        <Flow steps={['/company', 'HD秘書がPJ判断', 'PJ会社のCLAUDE.md読込', 'HD共通部署で作業', '成果物をPJリポジトリに']} />
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="HD（.company/）" body="秘書室 / 人事部 / 共通部署（AI開発・システム開発・PM・資料制作・リサーチ・情報収集・セキュリティ・UX・ops）" />
          <MiniCard title="PJ会社（.company-*/）" body="PJ固有コンテキスト（クライアント情報・ドメイン知識）+ 秘書のみ。部署はHD共通を利用" />
        </div>
      </Section>

      <Section title="知識の階層 — SSOT設計">
        <Tbl headers={['知識の種類', '置き場所（SSOT）', '読み込みタイミング']} rows={[
          ['恒久ルール', 'CLAUDE.md / .claude/rules/', 'セッション開始時（常時）'],
          ['運用手順', 'スキル SKILL.md', '/コマンド実行時（必要時のみ）'],
          ['学習済みパターン', 'knowledge_base (Supabase)', '/company 起動時'],
          ['セッション横断の記憶', 'memory/ (auto-memory)', 'セッション開始時'],
          ['設計思想', '.company/design-philosophy.md', '設計判断時に参照・追記'],
          ['体系知識', 'docs/knowledge/', '学習・調査時に参照・追記'],
        ]} />
      </Section>

      <Section title="LLM Wiki 思想 — 知識コンパイラとしてのAI">
        <Principle title="Karpathy LLM Wiki (2026-04)" body="RAGの根本的限界「毎回ゼロから発見し直す」を克服するアーキテクチャ。LLMを検索エンジンではなく知識コンパイラとして使い、Markdownファイル群を生きた百科事典として育てる。focus-youは約80%一致済み。" color="var(--accent)" />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>3つのキーファイルとfocus-youの対応</div>
        <Tbl headers={['Karpathyの概念', '役割', 'focus-youの対応物']} rows={[
          ['index.md（横断目録）', '全ナレッジの1行サマリー付き目録。LLMが「どこに何があるか」を即判断', 'memory/knowledge-index.md（新設）'],
          ['log.md（追記型年表）', 'ingest・昇格・Lintの全履歴。append-only', 'memory/knowledge-log.md（新設）'],
          ['schema.md（行動規範）', 'LLMを「規律ある知識維持者」として動作させる指示書', 'CLAUDE.md + .claude/rules/（既存・一致）'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>3つのワークフローと実装状況</div>
        <Tbl headers={['ワークフロー', '内容', '実装状況']} rows={[
          ['Ingest（取り込み）', '新情報投入 → LLMが分析 → wikiページ作成 → index更新 → log記録', 'knowledge_base + memory/ で実装済み。index/logは新設'],
          ['Query（検索回答）', 'index参照 → 対象ページ読み → 引用付き回答 → 良い回答はwikiに還流', '回答の還流は未実装（P1-3として予定）'],
          ['Lint（品質チェック）', '矛盾・古さ・孤立ページを定期検出', 'SessionStart Hook で日次実行。30日超=stale、参照0=orphaned、100行超=largeを検出'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>Knowledge Lint（日次品質チェック）</div>
        <P>SessionStart Hook <code>knowledge-lint.sh</code> が24時間ごとに自動実行。</P>
        <Tbl headers={['検出項目', '条件', 'アクション']} rows={[
          ['STALE（古い）', '最終更新から30日超', '内容を更新 or secretary/archive/ にアーカイブ'],
          ['ORPHANED（孤立）', '他のファイルから参照されていない', 'knowledge-index.md に追記 or 削除'],
          ['LARGE（肥大化）', 'CLAUDE.md が100行超', 'rules/ に分離してスリム化'],
        ]} />
      </Section>

      <Section title="3層データ管理">
        <div className="g3" style={{ marginBottom: 12 }}>
          <MiniCard title="Layer 1: ファイル" body="CLAUDE.md / メモ / TODO。エージェントが即座に読み書き" />
          <MiniCard title="Layer 2: Git" body="マルチリポジトリ。claude_dev(HD) + 各PJリポジトリ" />
          <MiniCard title="Layer 3: Supabase" body="プロンプト / ナレッジ / タスク / 日記 / 感情分析。クラウド永続" />
        </div>
        <P>ローカルファイルが常にマスター。Supabaseは分析・同期・モバイルアクセス用。</P>
      </Section>

      <Section title="自動化 — Hook + スキル + スクリプト">
        <Tbl headers={['種類', '代表例', '特性']} rows={[
          ['Hook (32個)', 'prompt-log(LLM分類), growth-detector(LLM検出), session-summary-periodic, bash-guard, claude-md-size-guard, pre/post-compact, docs-sync-guard, knowledge-lint, edge-function-deploy', '決定論的制御。SessionStop依存を排除し、クラッシュ耐性を確保'],
          ['スキル', '/company, /diary, /deploy', '必要時に呼び出し。判断を伴う処理'],
          ['スクリプト', 'sync-skills.sh, sync-registry.sh', 'SSOT → 派生の一方向同期'],
          ['スキル同期', 'sync-slash-commands.sh', 'SessionStart時にSKILL.md全文をslash_commandsに同期（skill_content含む）'],
          ['スキル進化', 'skill-evolution-batch.sh', '/company起動時（24h間隔）にprompt_logからパターン検出→候補蓄積'],
        ]} />
      </Section>
    </>
  )
}

// ========== Tab: Design Philosophy ==========

function TabDesignPhilosophy() {
  return (
    <>
      <Section title="体験設計">
        <Principle title="Today = コマンドセンター" body="Todayページから一歩も出ずに日常の全操作が完結する設計。タスク完了/追加/編集、習慣チェック/追加、日記記録がすべてインライン。別ページへの遷移=離脱。" color="var(--accent)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="今日の予定 = 1画面完結 (2026-04-15)" body="GCalイベント + タスクを全て「今日の予定」に集約。3ブロック構成: 時間指定(時刻付き、完了済みも同ブロック内に残る) / 時間未定(日付のみ) / 近日(明日〜7日、明日のGCalイベントも統合)。旧「今日やること」「近日の締切」「明日の予定」の独立セクションは廃止。重複表示がなくなり1画面で意思決定できる。useTodayTimeline hook。" />
          <MiniCard title="今日の習慣" body="Today画面では習慣のみを別セクションで分離。タスクとは情報性質が違う(タスク=1回限りの予定、習慣=反復)ため統合せず並置。習慣全完了時は「All done!」。" />
          <MiniCard title="時間帯適応型UI" body="朝=全件フラット / 午後=未完了を上に+「あとX件」 / 夜=やり残し表示+明日の予定。同じ画面を24時間出さない。" />
          <MiniCard title="インラインCRUD" body="タスク: チェック→完了(取り消し線で残る、再クリックで戻す)。+ →即追加(期限=今日)。タイトルクリック→編集。習慣: + →即追加。" />
          <MiniCard title="期限ソート" body="超過(赤) → 今日(赤) → 明日(amber) → 日付順(gray) → 期限なし。同日内は優先度順。期限が最も重要なソート軸。" />
          <MiniCard title="GCal Tasks同期" body="Supabase tasks(scheduled_at/deadline_at付き)をGoogle Tasks APIへ一方向同期。OAuthスコープ: calendar.events + tasks。Edge Function google-calendar-proxy経由。" />
          <MiniCard title="ナビゲーション整理" body="20タブ→8+More構成。毎日使うもの(Today/Journal/Tasks/Chat)だけトップ。月1回以下はMore(折りたたみ)に退避。" />
        </div>
      </Section>

      <Section title="キーボードショートカット設計">
        <Principle title="3層設計: Global → Common → Page-specific" body="lib/shortcuts.ts にSingle Source of Truth。Cmd+Shift+{文字}=アクション、Cmd+{数字}=ナビ、Cmd+Enter=確定、Escape=取消。ChatGPT準拠のキーバインド。" color="var(--blue)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="Global" body="Cmd+K(パレット), Cmd+Shift+O(新チャット), Cmd+Shift+S(サイドバー), Cmd+/(ヘルプ), Cmd+1~9(ページ移動)" />
          <MiniCard title="Page-specific" body="Chat: Cmd+Shift+C(コピー)/Del(削除)/↑↓(切替)。Today: Cmd+Shift+T(タスク追加)/D(日記フォーカス)。Calendar: ←→(期間)/T(今日)" />
          <MiniCard title="アーキテクチャ" body="CustomEventで疎結合。useKeyboardShortcuts(App) → window.dispatchEvent → 各ページがaddEventListenerで受信。定義追加はshortcuts.ts一箇所。" />
        </div>
      </Section>

      <Section title="AI設計">
        <Principle title="ディープパーソナライズ" body="10のデータソース（日記感情・WBI推移・生活リズム・カレンダー・CEO分析等）から「この人だからこそ」のコメント。汎用的な「頑張りましょう」は禁止。" color="var(--green)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="LLM指示の5教訓" body="①出力形式を厳密に ②禁止リスト明記 ③時間帯分岐はコードで ④文字数はプロンプト+max_tokens両方で ⑤reasoningモデルのtoken配分に注意" />
          <MiniCard title="API呼び出しパターン" body="ブラウザからOpenAI直叩き禁止。必ずEdge Function経由。共通ヘルパーedgeAi.tsを使う。自動処理はcompletion mode。" />
        </div>
      </Section>

      <Section title="データ設計">
        <Tbl headers={['データ', 'キャッシュ', '無効化トリガー']} rows={[
          ['天気', 'localStorage 1時間', 'TTL切れ'],
          ['AIコメント', 'Zustand in-memory', '日記投稿 / 時間帯変更 / リロード'],
          ['タスク/習慣', 'Zustand 5分', 'ミューテーション'],
        ]} />
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="タイムゾーン" body="全レイヤーでJST統一。Calendar API: timeZone指定、JS: toLocaleString、Supabase: at time zone。部分修正は新バグを生む。" />
          <MiniCard title="RLSポリシー" body="新テーブル作成時に必ずRLSも同時に。6回忘れて6回fixした教訓。" />
        </div>
      </Section>

      <Section title="アーキテクチャ判断">
        <Principle title="YAGNI原則の徹底" body="マルチテナント→撤回、Anthropic対応→削除、会社セレクター→削除、Polaris子会社→統合。「使うかもしれない」は作らない。" color="var(--red)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="1ファイル→分離パターン" body="最初は1ファイルSPA。8000行超で限界 → React+TS。最初から完璧な構造を作ろうとしない。" />
          <MiniCard title="エンハンス、代替ではない" body="AI出力をそのまま使わない。壁打ちの素材→腹落ちまで対話→自分の言葉で説明できる状態に。" />
        </div>
      </Section>

      <Section title="継続改善のメタ設計">
        <P>このシステム自体が改善され続けるための仕組み。</P>
        <Tbl headers={['ループ', '仕組み', 'データの場所']} rows={[
          ['日記ループ', '書く→分析→可視化→もっと書きたくなる→データ増→AI精度↑', 'diary_entries + emotion_analysis'],
          ['ナレッジ昇格', '修正指示→memory→2回目でKB→confidence≥3で社長承認→CLAUDE.md/rules/', 'memory/ → knowledge_base → 社長承認 → CLAUDE.md or rules/（自動昇格禁止）'],
          ['Growth Chronicle', '失敗をLLMが自動検出→シグナル蓄積→3件で自動要約→growth_events INSERT→パターン→ルール化', 'growth_events（自動）+ ~/.claude/logs/growth-signals.jsonl（永続）'],
          ['人事部サイクル', '部署作業→評価→CLAUDE.md改善→精度↑', '.company/hr/evaluations/'],
          ['設計思想蓄積', '判断→design-philosophy.md追記→次の判断の土台', '.company/design-philosophy.md'],
        ]} />
        <Principle title="知識の3層構造" body="Layer1: docs/knowledge/（体系的学習ノート）→ Layer2: knowledge_base（行動ルール）→ Layer3: CLAUDE.md（全セッション自動適用）。下に行くほど影響範囲が広く、昇格には実績が必要。" color="var(--accent)" />
      </Section>
    </>
  )
}

// ========== Tab: Operations ==========

function TabOperations() {
  return (
    <>
      <Section title="コマンド体系">
        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>常時自動（パイプライン）</div>
        <Tbl headers={['社長の指示', '判定', 'パイプライン']} rows={[
          ['「作って」「新機能」', 'A', 'リサーチ ∥ UX → AI開発 ∥ PM → 実装 → QA'],
          ['「直して」「バグ」', 'B', 'システム開発 → QA'],
          ['「資料作って」', 'C', 'リサーチ → 資料制作'],
          ['「調べて」', 'D', 'リサーチ → 統合報告'],
          ['「セキュリティ監査」', 'E', 'セキュリティ ∥ リサーチ → 修正 → QA'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>/company コマンド</div>
        <Tbl headers={['コマンド', '機能']} rows={[
          ['/company', 'HD秘書起動（ブリーフィング + タスク管理）'],
          ['/company {name}', 'PJ会社の秘書起動'],
          ['/company:diary', '日記の分析・壁打ち'],
          ['/company:auto-prep', 'MTG準備の自動化'],
          ['/company:weekly-digest', '週次CEOレポート'],
        ]} />
      </Section>

      <Section title="部署サイクル設計 — いきなり実行しない">
        <Principle title="全部署に「設計→チェック→実行→評価→学習」サイクルを定義" body="直線的フロー（→→→完了）ではなく、チェックポイントで品質を確認し、評価結果を次の設計にフィードバックするループ。ハーネスエンジニアリングでは Sub-agent のプロンプト品質 = 出力品質。サイクル定義のない部署は出力が不安定になる。" color="var(--accent)" />

        <P>各部署のサイクルは統一テンプレートではなく、部署の特性に最適化されている:</P>
        <Tbl headers={['部署', 'サイクル構造', '特徴的なチェックポイント', '仕様レベル']} rows={[
          ['AI開発', '仮説→設計→[設計レビュー]→実装→評価→[品質判定]→学習', '設計レビュー（成功基準が定量的か）+ 品質判定（合格/不合格/部分合格の3分岐）', 'HIGH'],
          ['システム開発', 'トリガー→実装→QA→[QA判定]→報告', 'API仕様確認ゲート + QA承認ゲート（2重）', 'HIGH'],
          ['PM', '計画→分解・割当→[確認]→追跡→報告→[振り返り]→改善', '週次振り返り（見積もりvs実績のギャップ分析）', 'HIGH'],
          ['資料制作', 'draft→writing→review→[CEO確認]→完了', 'CEO確認必須（「自分の言葉で説明できる」が基準）', 'HIGH'],
          ['リサーチ', 'planning→in-progress→[3段構成チェック]→completed', '公知情報+限界+壁打ち導線の3段構成が必須', 'HIGH'],
          ['UXデザイン', 'シナリオ→感情曲線→摩擦分析→状態遷移→[5原則チェック]→実装仕様', 'HCI法則(Fitts/Hick/Miller)+Nielsen 10項目で検証', 'VERY HIGH'],
          ['情報収集', '収集→スコアリング→[フィードバック反映]→次回収集', 'いいね/クリックの暗黙的FB + スコア減衰で過学習防止', 'VERY HIGH'],
          ['セキュリティ', '日次監視→週次スキャン→月次監査→[SLA追跡]', 'Critical 24h / High 7d / Medium 30d / Low 90d のSLA', 'VERY HIGH'],
          ['マーケ', '仮説→施策実行→計測→[判定]→学習→ピボット or 強化', '仮説検証ループ（成功→強化、失敗→ピボット、不明→計測改善）', 'MEDIUM-HIGH'],
          ['運営改善', 'ヘルスチェック→問題検出→修正→検証→定着', 'CLAUDE.md行数/スキル同期/マイグレーション/ナレッジ重複の4点チェック', 'MEDIUM-HIGH'],
          ['リファクタリング', '重複検出→影響分析→共通化設計→[設計確認]→実装→型チェック→学習', 'Rule of Two（2箇所目で共通化）+ Service Layer強制 + AI生成コード重複チェック', 'HIGH'],
        ]} />

        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="スキップルールの明示" body="全ステップ毎回必須ではない。AI開発部の例: 1行修正→実装+動作確認のみ、新機能→全ステップ必須、アーキテクチャ変更→全ステップ+社長レビュー。省略条件を事前定義することで「省略していい判断」と「省略してはいけない判断」を分離。" />
          <MiniCard title="学習ステップの義務化" body="全部署のサイクル末尾に「学習」がある。成功/失敗に関わらず知見を記録（成果物末尾の「学習メモ」or growth_events）。これがナレッジ昇格パイプラインの入口になり、繰り返しの失敗を構造的に防止する。" />
          <MiniCard title="部署知識ローテーション" body="各部署のCLAUDE.mdは作成時点で固定されがち。14日サイクルで2部署ずつ最新ベストプラクティスを調査→GAP分析→社長承認で更新。5ローテーション（約5週）で全11部署を一巡。情報収集部が調査、ops部がGAP分析。CLAUDE.md直接更新は禁止（社長承認必須）。" />
        </div>
      </Section>

      <Section title="部署連携">
        <P>パイプラインA（新機能開発）の流れ:</P>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`Step 1 [並列]: リサーチ ∥ UXデザイン
Step 2 [並列]: AI開発(設計) ∥ PM(チケット) ← checkpoint
Step 3 [直列]: システム開発(実装) → QA(テスト)
完了: 成果物登録 + commit + 報告`}
        </div>
        <P>ハンドオフ: 部署の成果物末尾にYAMLブロックで記述。秘書がパースして次の部署を自動起動。重複実行防止機能付き。（旧Markdown形式も後方互換で検出）</P>
      </Section>

      <Section title="ops部署 — 仕組みの仕組み + ドキュメント管理">
        <P>ops部は「仕組みを改善する部署」であると同時に、<strong>How It Worksの品質管理者</strong>。HD管理ファイルが変更されるたびにドキュメントの最新性を確認・更新する。</P>
        <Tbl headers={['検出トリガー', 'opsのアクション']} rows={[
          ['HD管理ファイルの変更', 'How It Works の該当セクションを確認・更新（最重要）'],
          ['手動操作の発生', 'スクリプト or スキル化'],
          ['同じ修正が2回', 'ルール追加を提案'],
          ['CLAUDE.md肥大化', 'スキル or rules/ に分離'],
          ['知識の分散', 'SSOTを決めて統合'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>How It Works 品質管理（週次チェック）</div>
        <Tbl headers={['チェック項目', '基準', 'アクション']} rows={[
          ['重複', '同じ内容が2タブ以上に記載', '片方削除、参照に置き換え'],
          ['肥大化', '1タブが画面3スクロール以上', 'サブセクションに分割 or 詳細を折りたたみ'],
          ['陳腐化', '記述が現在の実装と矛盾', '実装に合わせて更新'],
          ['欠落', '実装済みだが未記載の機能', 'セクション追加'],
          ['数値の不一致', 'Hook数、テーブル行数等が古い', '実態に合わせて更新'],
        ]} />
      </Section>

      <Section title="実装 ↔ ドキュメント同期 — How It Works が古くならない仕組み">
        <Principle title="問題: 実装を変えてもドキュメントが追従しない" body="ai-agent/index.ts のモデルルーティングを3段階→6段階に変更しても、How It Works には古い3段階の記述が残る。手動同期は忘れる。全セッションで「あとで更新しよう」は運用に乗らない。" color="var(--red)" />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>3層の強制メカニズム</div>

        <Tbl headers={['層', '仕組み', 'タイミング', '強制力']} rows={[
          ['Layer 1: Hook', 'docs-sync-guard.sh（PostToolUse）', '対象ファイル編集時にリアルタイム警告', '高（additionalContext で即座に通知）'],
          ['Layer 2: Freshness', 'impl_docs_sync（freshness-policy）', '/company 起動時に git log 日付比較', '中（ブリーフィングで報告）'],
          ['Layer 3: Commit Rules', 'commit-rules.md の同期チェック表', 'コミット・PR作成時', '低（ルールベース、人間の判断）'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>Layer 1: PostToolUse Hook（リアルタイム検出）</div>
        <P><code>.claude/hooks/docs-sync-guard.sh</code> — Edit/Write の PostToolUse で発火。対象ファイルを編集すると、additionalContext で「How It Works の〇〇タブ更新必要」と警告。</P>
        <Tbl headers={['変更ファイル', '警告メッセージ（更新先セクション）']} rows={[
          ['supabase/functions/ai-agent/index.ts', 'AI Features タブ（モデル設定、ルーティング、ツール一覧）'],
          ['src/hooks/useSelfAnalysis.ts', 'AI Features タブ（自己分析カード）+ Design Philosophy タブ（ハイブリッド分析）'],
          ['src/hooks/useEmotionAnalysis.ts', 'AI Features タブ（感情分析カード）+ Overview タブ（更新連鎖マップ）'],
          ['src/hooks/useMorningBriefing.ts', 'AI Features タブ（AI Partnerカード）'],
          ['src/hooks/useWeeklyNarrative.ts', 'AI Features タブ（週次ナラティブカード）'],
          ['src/lib/aiPartner.ts', 'AI Features タブ（AI Partner）+ Vision タブ（Narrative Intelligence）'],
          ['src/pages/SelfAnalysis.tsx', 'AI Features タブ（自己分析カード: 出力/可視化）'],
          ['src/pages/Today.tsx', 'Design Philosophy タブ（体験設計セクション）'],
          ['.claude/hooks/*.sh', 'Overview + Harness + Operations タブ（同期メカニズム含む）'],
          ['.claude/rules/*.md', 'Operations タブ + Harness Engineering タブ'],
          ['.company/departments/*/CLAUDE.md', 'Operations タブ（部署サイクル設計テーブル）'],
          ['.company/freshness-policy.yaml', 'Overview タブ（自動メンテナンスセクション）'],
          ['.company/design-philosophy.md', 'Design Philosophy タブ（同期確認）'],
          ['src/hooks/useDreamDetection.ts', 'AI Features タブ（3. 夢進捗検出カード）'],
          ['src/lib/fileExtract.ts', 'AI Features タブ（ファイル抽出対応形式）'],
          ['supabase-migration-*.sql', 'AI Features タブ（データ構造テーブル一覧）'],
          ['src/hooks/useTodayTimeline.ts', 'Design Philosophy タブ（統合タイムライン）+ Overview タブ（更新連鎖マップ）'],
          ['src/lib/googleTasksApi.ts', 'Overview タブ（Google Tasks同期フロー）+ Design Philosophy タブ（GCal Tasks同期）'],
        ]} />
        <Principle title="教訓: 2026-04-06 useSelfAnalysis.ts 改修時" body="ハイブリッド分析方式を実装したが、対応表に useSelfAnalysis.ts がなかったため Hook が発火せず、社長に指摘されるまで Blueprint が古いまま残った。対応表を7→14ファイルに拡充。新しいAI機能フックを追加したら必ずこの表にも追加すること。" color="var(--amber)" />
        <P>この Hook はハーネスエンジニアリングの「決定論的制御」にあたる。CLAUDE.md に「ドキュメントを更新して」と書いても無視される可能性があるが、Hook は確実に発火する。</P>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>Layer 2: Freshness Policy（起動時チェック）</div>
        <P><code>impl_docs_sync</code>（priority 1.5）— /company 起動時に実行。git log の最終更新日時を比較し、実装ファイルが Blueprint.tsx より新しければ STALE と報告する。</P>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)', marginTop: 8 }}>
{`/company 起動
  └→ freshness-check: impl_docs_sync
       └→ git log で比較:
            ai-agent/index.ts  最終変更: 4/5 16:00
            Blueprint.tsx     最終変更: 4/5 15:00
            → STALE: ai-agent が1時間新しい → ブリーフィングで報告`}
        </div>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>Layer 3: Commit Rules（コミット時チェック）</div>
        <P><code>.claude/rules/commit-rules.md</code> に対応表を記載。PRチェックリスト #4: 「実装変更に対応する How It Works の更新があるか」を確認義務化。</P>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>なぜ3層必要か</div>
        <div className="g3" style={{ marginBottom: 12 }}>
          <MiniCard title="Hook だけでは不足" body="Warning を出しても、そのセッション内で更新せずにコミットできてしまう。次のセッションでは警告が出ない。" />
          <MiniCard title="Freshness だけでは不足" body="/company を起動しないセッションでは検出されない。また検出しても修正は手動。" />
          <MiniCard title="Commit Rules だけでは不足" body="ルールを読んでいなければ素通り。助言的（CLAUDE.md と同じ弱さ）。3層の組み合わせで漏れを最小化。" />
        </div>
      </Section>

      <Section title="フォールバック">
        <Tbl headers={['障害', 'フォールバック']} rows={[
          ['Supabase障害', 'ローカルファイルで代替。マスターは常にファイル'],
          ['Git push不可', 'ローカルにコミット残る。次回conflict検出'],
          ['エージェント誤判断', 'permission-guard + checkpoint + git revert'],
        ]} />
      </Section>
    </>
  )
}

// ========== Tab: AI Features ==========

function AiFeatureCard({ name, trigger, input, model, pipeline, output, storage, hook }: {
  name: string; trigger: string; input: string; model: string; pipeline: string; output: string; storage: string; hook: string
}) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--accent)' }}>{name}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '4px 12px', fontSize: 12, lineHeight: 1.6 }}>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>トリガー</span><span style={{ color: 'var(--text2)' }}>{trigger}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Input</span><span style={{ color: 'var(--text2)' }}>{input}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>モデル</span><span style={{ color: 'var(--text2)' }}>{model}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>パイプライン</span><span style={{ color: 'var(--text2)' }}>{pipeline}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Output</span><span style={{ color: 'var(--text2)' }}>{output}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>保存先</span><span style={{ color: 'var(--text2)' }}>{storage}</span>
        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>コード</span><span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{hook}</span>
      </div>
    </div>
  )
}

function TabAiFeatures() {
  return (
    <>
      <Section title="共通アーキテクチャ">
        <P>全AI機能は同じパイプラインを通る。ブラウザからOpenAI APIを直接叩かない。</P>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`ブラウザ (React hook)
  → aiCompletion() [src/lib/edgeAi.ts]
    → POST /functions/v1/ai-agent  mode=completion
      → Edge Function [supabase/functions/ai-agent/index.ts]
        → OpenAI API (gpt-5.4-nano, reasoning_effort=low)
          → JSON response
            → ブラウザで処理・表示・DB保存`}
        </div>
        <Tbl headers={['設定', '値', '理由']} rows={[
          ['モデル', 'gpt-5.4-nano', 'コスト最小。reasoning model なので分析系に強い'],
          ['reasoning_effort', 'low', 'minimal だと出力が空になるケースがあった'],
          ['max_completion_tokens', '8000', 'reasoning + output の合計。少ないとreasoning に消費されて出力空に'],
          ['temperature', '(デフォルト1)', 'gpt-5.4-nano は temperature カスタム非対応'],
        ]} />
      </Section>

      <Section title="AI Chat ツール一覧（Edge Function: ai-agent）">
        <P>AI チャットの LLM が自律的に呼び出せるツール群。Supabase クエリまたは安全な HTTP fetch のみ。シェル実行なし。</P>
        <Tbl headers={['ツール名', '機能', '検索方式', '用途']} rows={[
          ['tasks_search', 'タスク検索', 'Supabase filter (status/company/keyword)', 'タスク状況の確認・一覧表示'],
          ['tasks_create', 'タスク作成', '—', '会話からタスクを直接作成'],
          ['diary_search', '日記検索（Hybrid）', 'PGroonga キーワード + pgvector 感情類似 + gpt-nano reranking', '関連する過去の日記を発見しLLMコンテキストに注入'],
          ['artifacts_read', '成果物読み取り', 'Supabase (id/path)', '保存された成果物の内容取得'],
          ['artifacts_list', '成果物一覧', 'Supabase filter', '成果物の一覧表示'],
          ['knowledge_search', 'ナレッジ検索', 'Supabase filter (category/scope)', 'ルール・ガイドライン・学習の検索'],
          ['company_info', 'PJ会社情報', 'Supabase query', '会社情報・部署構成の取得'],
          ['prompt_history', 'プロンプト履歴', 'Supabase filter', '最近の作業内容の把握'],
          ['insights_read', 'CEOインサイト', 'Supabase filter (category)', '行動パターン・傾向・仕事リズムの参照'],
          ['activity_search', 'アクティビティ検索', 'Supabase filter', '最近の操作・イベントの検索'],
          ['intelligence_read', '情報レポート', 'Supabase query', '最新の情報収集レポート取得'],
          ['web_search', 'Web検索', 'DuckDuckGo HTML', '最新情報・ドキュメントの検索'],
        ]} />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.6 }}>
          diary_search のパイプライン: PGroonga キーワード検索 → pgvector 感情ベクトル cosine 類似検索 → 結果マージ・重複排除 → gpt-nano でリランキング → 上位K件をメイン LLM に注入
        </div>
      </Section>

      <Section title="AI機能一覧（7機能）">
        <AiFeatureCard
          name="1. 感情分析"
          trigger="日記を投稿したとき（自動）"
          input="日記本文テキスト"
          model="gpt-5.4-nano (completion mode)"
          pipeline="日記テキスト → system: Plutchik 8感情+Russell+PERMA+V の分析指示 → JSON応答 → パース → DB保存"
          output="Plutchik 8感情(0-100), Russell valence/arousal(-1~1), PERMA+V(0-10), WBI(0-10), summary(1文)"
          storage="emotion_analysis テーブル + diary_entries.wbi を更新"
          hook="useEmotionAnalysis.ts"
        />

        <AiFeatureCard
          name="2. AI Partner コメント（日記中心パーソナライズ）"
          trigger="Today画面表示時 + 日記投稿後に自動再生成"
          input="【主役】日記(3件,生テキスト) + 感情傾向 + WBI推移 → 【空気】天気・時刻 → 【補足(直接言及しない)】カレンダー, タスク → 【傾向】CEOインサイト, 夢, 連続記録"
          model="gpt-5.4-nano (completion mode)"
          pipeline="データ並列取得 → 日記を最重要、予定・タスクは補足として構造化 → 時間帯別プロンプト(朝/昼/夜) → AI生成 → 表示"
          output="1-2文、80字以内。「わかってる人がボソッと言う一言」。行動指示・数字・データ読み上げ・汎用語は禁止"
          storage="Zustand in-memory（キャッシュキー: 日付_timeMode、日記投稿で無効化）"
          hook="useMorningBriefing.ts"
        />

        <AiFeatureCard
          name="3. 夢進捗検出"
          trigger="日記投稿後（自動、バックグラウンド）"
          input="日記テキスト + アクティブな夢リスト(dreams テーブル)"
          model="gpt-5.4-nano (completion mode, jsonMode)"
          pipeline="日記テキスト+夢リスト → system: 夢との照合指示 → JSON応答 → confidence medium以上をフィルタ → toast通知"
          output='[{dream_id, confidence: "high"|"medium", reason}]'
          storage="表示のみ（toast通知）。DBには保存しない"
          hook="useDreamDetection.ts"
        />

        <AiFeatureCard
          name="4. 週次ナラティブ"
          trigger="Weeklyページで「生成」ボタン押下"
          input="1週間分の日記, 感情分析, 完了タスク, ゴール進捗, 習慣達成率"
          model="gpt-5.4-nano (completion mode)"
          pipeline="週の全データ並列取得 → 統計算出(平均WBI, 優勢感情, 習慣達成率) → AI生成(200-300字ナラティブ) → DB保存"
          output="200-300字の振り返りナラティブ + stats(diary_count, task_count, avg_wbi, dominant_emotion)"
          storage="weekly_narratives テーブル"
          hook="useWeeklyNarrative.ts"
        />

        <AiFeatureCard
          name="5. 自己分析（5種類 + 統合まとめ）"
          trigger="Self Analysisページで再分析ボタン押下（日記20件以上でアンロック）"
          input="ハイブリッド方式: 初回=全データ / 更新=前回結果+核心引用+統計スナップショット+新データのみ。データソース5種（日記=本音, AIチャット=自然な会話, Claude Code指示=関心テーマのみ, タスク/スケジュール, 夢リスト）。各ソースにデータ文脈ガイド付き"
          model="gpt-5.4-nano (completion mode, jsonMode)"
          pipeline="ハイブリッド収集(前回analysis_context+差分データ) → データソース文脈プリアンブル → 初回/更新モード切替 → 構造化プロンプト → JSON応答 → analysis_context生成・保存 → 統合まとめタブ + 個別タブ"
          output="MBTI(core_insight/daily_patterns/strengths_in_action/growth_edges/advice), Big5(profile_narrative/trait_insights/trait_interactions/advice), SF(synergy/blind_spot/action_plan), Values(tension/alignment/life_question) + 統合まとめ"
          storage="self_analysis テーブル(analysis_type, result JSON, summary, data_count, analysis_context JSONB)"
          hook="useSelfAnalysis.ts"
        />

        <AiFeatureCard
          name="6. AI チャット（エージェントループ）"
          trigger="AI Chatページでメッセージ送信"
          input="ユーザーメッセージ + 会話履歴(50件) + パーソナライゼーション(KB,日記,インサイト) + ファイル抽出テキスト"
          model="6段階自動ルーティング（casual→nano, factual→nano, lookup→mini, creative→mini, analytical→mini, strategic→gpt-5）。Precision ONで gpt-5+high固定"
          pipeline="SSEストリーミング。while(tool_call)ループ: LLM応答→ツール実行→結果をLLMに返す→繰り返し。中間assistant(tool_calls)もDB保存"
          output="ストリーミングテキスト + ツール実行結果（タスク検索/作成, ナレッジ検索, Web検索 等）"
          storage="conversations + messages テーブル。cost_tracking でトークン消費記録"
          hook="pages/Chat.tsx (React) → ai-agent Edge Function (agentLoop)"
        />

        <AiFeatureCard
          name="7. ニュース収集"
          trigger="Today画面「最新を取得」ボタン / Reportsページ「手動収集」ボタン"
          input="トピックリスト(AI/LLM, Claude, OpenAI等) + ユーザー関心度(news_preferences.interest_score)"
          model="gpt-5.4-mini (agent mode + web_search)"
          pipeline="関心度高いトピック抽出 → agent mode で web_search 実行 → JSON配列パース → news_items テーブルに保存"
          output="[{title, summary, url, source, topic, date}] の配列"
          storage="news_items テーブル（Single Source of Truth）"
          hook="lib/newsCollect.ts（共通モジュール）← Today.tsx / Reports.tsx から呼び出し"
        />

        <AiFeatureCard
          name="8. 過去の自分カード（類似検索）"
          trigger="Today画面の日記入力欄で20字以上タイプ後、1.5秒後に自動検索"
          input="今入力中の日記テキスト"
          model="text-embedding-3-small (1536次元)"
          pipeline="入力テキスト → Edge Function diary-embed → OpenAI embedding → Supabase RPC match_similar_diary_entries (pgvector cosine) → 14日以上前のエントリから上位2件 → UI表示"
          output="過去の似た日記2件（date + body抜粋）"
          storage="diary_entries.embedding列（vector(1536)、ivfflat index）。新規エントリ書き込み時に自動 persist"
          hook="useSimilarPastEntry.ts / Edge Function: diary-embed"
        />

        <AiFeatureCard
          name="9. 自分の取扱説明書（種カード生成）"
          trigger="Manual ページで「日記から生成する」押下"
          input="直近3ヶ月の日記60件 + story_memory（Theme Finder 既存結果）"
          model="gpt-5.4-nano (completion mode, jsonMode)"
          pipeline="日記+story_memory → system: 取扱説明書の種を生成（identity / values / joy_trigger / energy_source / failure_pattern / recovery_style / aspiration） → JSON → user_edited_at=null の既存種だけ削除して挿入"
          output="カテゴリ別カード（各1〜2件）。本文 + evidence（日記引用）"
          storage="user_manual_cards テーブル。user_edited_at がセットされたカードは AI が上書きしない"
          hook="useUserManual.ts / src/pages/Manual.tsx"
        />

        <AiFeatureCard
          name="10. Requests 画像添付（マルチモーダル基盤）"
          trigger="Requests ページで drag&drop / Cmd+V paste / 編集モーダルから追加"
          input="画像ファイル（PNG/JPEG/WebP/GIF）→ Supabase Storage: request-attachments バケット（RLS: owner のみ）"
          model="—（保存・表示のみ。Claude Vision 連携は次フェーズ）"
          pipeline="アップロード → Storage に保存 → tasks.attachments(JSONB) にメタ配列追記（AttachmentMeta: path, mime, size, width, height, original_name, uploaded_at） → サムネイルプレビュー表示 → 編集モーダルで追加/削除/拡大"
          output="タスクカード上のサムネイル + 編集モーダルでのフル表示"
          storage="Supabase Storage: request-attachments（バイナリ）+ tasks.attachments JSONB（メタ）。migration 062 で追加"
          hook="src/lib/requestAttachments.ts / src/components/RequestAttachmentThumb.tsx / src/pages/Requests.tsx / src/stores/data.ts / src/types/tasks.ts (AttachmentMeta)"
        />
      </Section>

      <Section title="Narrative Intelligence（計画中）">
        <Principle title="Mirror → Narrator" body="現在のシステムはデータを映す「鏡」。次の進化は、あなたの人生データを「物語」として読み解き、語り、導く「語り手」になること。ルールベースの提案（WBI低い→休めば？）ではなく、LLMの深い推論で物語の弧を読む。" color="var(--accent)" />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>4つのエンジン</div>
        <Tbl headers={['エンジン', '役割', 'モデル', '更新頻度']} rows={[
          ['Arc Reader', '感情の時系列を「物語の弧」として解釈。今のフェーズを読み取る', 'gpt-5.4', '週次'],
          ['Theme Finder', '数ヶ月の日記×夢×行動から人生の通底テーマを発見', 'gpt-5.4', '月次'],
          ['Moment Detector', '日記から転機（決断/気づき/突破/挫折）をリアルタイム検出', 'gpt-5.4-nano', '日記書き込み毎'],
          ['Foresight Engine', '過去のパターンから物語の続きを予感し、提案する', 'gpt-5.4', '随時'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>Narrative Memory（3層構造）</div>
        <Tbl headers={['層', '内容', '更新']} rows={[
          ['Layer 1: Raw Data', 'diary, emotions, dreams, goals, habits（既存）', 'リアルタイム'],
          ['Layer 2: Narrative Memory', 'LLMがデータを「理解」した結果: identity, currentArc, chapters, emotionalDNA, aspirations', '日次〜月次'],
          ['Layer 3: Active Context', '今の会話/提案に必要な物語文脈をLayer2から抽出', '会話開始時'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>ルールベース vs 物語ベースの提案</div>
        <Tbl headers={['場面', 'ルールベース（v1）', '物語ベース（v2）']} rows={[
          ['WBIが低い', '「少し休みましょう」', '「去年の同じ時期にも似た波がありました。あの時は2週間後に"見えた"と書いていました」'],
          ['旅行の相談', '「性格に合う: 直島、屋久島…」', '「夢リストの南阿蘇、今の"再構築期"に響く場所だと思います」'],
          ['目標が停滞', '「小さな一歩から始めましょう」', '「あなたの物語では、こういう沈黙の後にいつも跳躍があります」'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>共有機能: Courage Board</div>
        <P>SNSとは逆の設計。評価されない、コメントされない、フォロワーなし。匿名の成長物語が並ぶ場所。リアクションは「共感した」だけ。自分の物語が誰かの勇気になる。</P>
        <div className="g2" style={{ marginBottom: 12, marginTop: 8 }}>
          <MiniCard title="Story Card" body="Chapterや転機を美しいカードに。LLMが匿名化+テキスト生成。画像出力対応" />
          <MiniCard title="Growth Story" body="四半期/年間の物語を1つの文章に。結婚式の成長ムービーを日常に" />
        </div>

        <Principle title="詳細設計" body="docs/design/life-companion-evolution.md に全体設計書。story_memory / story_moments / shared_stories テーブル設計、コスト見積もり、実装フェーズを含む。" color="var(--green)" />
      </Section>

      <Section title="AIチャットのツール一覧">
        <P>エージェントループで使えるツール。LLMが自律的に選択・実行する。</P>
        <Tbl headers={['ツール', '機能', 'データソース']} rows={[
          ['tasks_search', 'タスク検索（status, company, keyword）', 'tasks テーブル'],
          ['tasks_create', 'タスク新規作成', 'tasks テーブル'],
          ['artifacts_read', '成果物の内容取得', 'artifacts テーブル'],
          ['artifacts_list', '成果物一覧', 'artifacts テーブル'],
          ['knowledge_search', 'ナレッジ検索（カテゴリ, scope）', 'knowledge_base テーブル'],
          ['company_info', 'PJ会社情報・部署構成', 'companies + departments テーブル'],
          ['prompt_history', '直近のプロンプト履歴検索', 'prompt_log テーブル'],
          ['insights_read', 'CEOインサイト（日記ベース内面分析+prompt_log関心分析）', 'ceo_insights テーブル'],
          ['activity_search', 'アクティビティログ検索', 'activity_log テーブル'],
          ['intelligence_read', '最新ニュース/レポート', 'news_items テーブル'],
          ['web_search', 'Web検索（外部API）', 'Brave Search API'],
        ]} />
        <P>安全設計: web_search 使用後は write系ツール(tasks_create)をブロック。間接プロンプトインジェクション対策。</P>
      </Section>

      <Section title="AIチャット — 6段階自動ルーティング">
        <P>ユーザーのメッセージをgpt-5.4-nanoで分類し、質問の種類に最適なモデルとreasoning effortを自動選択する。</P>
        <Tbl headers={['分類', 'モデル', '推論レベル', '質問の例']} rows={[
          ['casual（雑談）', 'gpt-5.4-nano', 'none', '「こんにちは」「ありがとう」「はい」'],
          ['factual（事実）', 'gpt-5.4-nano', 'none', '「東京タワーの高さは？」「Pythonの最新バージョンは？」'],
          ['lookup（検索）', 'gpt-5.4-mini', 'low', '「今日の天気は？」「オープンのタスク何件？」「最新ニュースは？」'],
          ['creative（創作）', 'gpt-5.4-mini', 'low', '「メールの文面を考えて」「この文を要約して」「名前を提案して」'],
          ['analytical（分析）', 'gpt-5.4-mini', 'medium', '「このコードのバグを直して」「AとBの違いは？」「PDFの内容を分析して」'],
          ['strategic（戦略）', 'gpt-5.4', 'high', '「事業計画を立てて」「アーキテクチャを設計して」「競合分析して」'],
        ]} />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="Precision Mode" body="ONにすると分類を無視して gpt-5 + reasoning: high + 最大20ステップ に固定。コスト上限 $0.50/リクエスト。最高品質だがコストも最大。" />
          <MiniCard title="コスト目安" body="casual: ~0.02円, lookup: ~0.2円, analytical: ~0.5円, strategic: ~2円, precision: ~5円。月100メッセージで約50-200円。" />
        </div>
      </Section>

      <Section title="ナレッジ体系 — データ・ナレッジ・暗黙知">
        <P>rikyuプロジェクトのナレッジ分類モデルをfocus-youに適用。全ての知識を「形式化度」と「機能（How/What）」の2軸で整理。</P>

        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)', marginBottom: 16 }}>
{`┌─────────────────────────────────────────────────────────────────┐
│                      スキル（How）                              │
│           判断・進め方の「型」。プロンプト/ルールに組み込む        │
│                                                                 │
│   認識           評価           判断           実行              │
│   どう見るか     どう測るか     どうするか     どうやるか          │
│                                                                 │
│   時間帯適応UI    感情分析       ナレッジ昇格    パイプライン      │
│   行動文脈推定    Plutchik/WBI  判断ルール      自動実行          │
│                                                                 │
├──── 参照 → ──────────────────────────────────────────────────────┤
│                                                                 │
│                   ナレッジベース（What）                          │
│            蓄積・検索する知識資産。使うほど賢くなる                 │
│                                                                 │
│   マスタ ─── 抽象化された参照知識（design-philosophy, rules/）   │
│       ↑ パターン抽出・昇格                                       │
│   事例 ──── 個別経験の蓄積（growth_events, diary+emotion）       │
│       ↑ 構造化・蓄積                                             │
│   コンテキスト ── 現在の事実（tasks, calendar, prompt_log）      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘`}
        </div>

        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>形式化度の3段階</div>
        <Tbl headers={['レベル', '名称', '状態', 'focus-youでの例', '蓄積場所']} rows={[
          ['C1 形式知', 'コードとして計算可能', 'ルール化・自動実行される', 'CLAUDE.md, rules/, Hooks, Edge Function', 'Git + 全セッション自動適用'],
          ['C2 言語知', '言語化済みだが未構造化', '記録されているが手動適用', 'knowledge_base, memory/, design-philosophy.md', 'Supabase + ファイル'],
          ['C3 暗黙知', '言語化困難、経験的', '社長の頭の中にしかない', '下記 TK-001〜008 参照', '日記・行動ログから間接抽出'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>暗黙知（TK）の一覧 — 形式化の状態</div>
        <P>社長の頭の中にある知識のうち、システムがまだ完全には捕捉できていないもの。日記・行動ログから間接的に抽出を試みている。</P>
        <Tbl headers={['ID', '暗黙知', '現在の捕捉方法', '形式化状態']} rows={[
          ['TK-001', '「今日は調子がいい/悪い」の身体感覚', 'diary + emotion_analysis → WBI推移', '部分捕捉。気分ログ(Level 0)で改善予定'],
          ['TK-002', '「このPJは今が勝負時」の事業判断', 'prompt_log focus/shift + diary value分析', '間接推定。CEOインサイト3層で検出'],
          ['TK-003', '「この人との関係性」の対人感覚', 'diary の人名・感情パターンから抽出', '間接推定。diary trigger/correlation分析'],
          ['TK-004', '「朝型/夜型」「集中できる時間帯」', 'prompt_log timestamps + diary mood_cycle', 'CEOインサイト3層（L2週次/L3月次）で相関分析'],
          ['TK-005', '「この技術は将来有望」の技術直感', 'diary + prompt_log の技術キーワード', '未捕捉。トピック分析で改善可能'],
          ['TK-006', '「このやり方は自分に合う」の作業スタイル', 'knowledge_base feedback カテゴリ', '部分捕捉。2回同じフィードバック→ルール化'],
          ['TK-007', '設計判断の美意識・好み', 'design-philosophy.md への蓄積', '言語知(C2)まで昇格済み。形式知化は困難'],
          ['TK-008', '「いつかやりたい」の漠然とした願望', 'dreams テーブル + diary からの夢検出', '部分捕捉。書き出す→検出→意識化のループ'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>ナレッジの成長パス</div>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`暗黙知(TK)                    言語知(C2)                     形式知(C1)
社長の頭の中            →     記録・言語化              →     コード・ルール化

日記を書く              →  diary_entries              →  emotion_analysis (自動)
「調子悪い」と感じる     →  WBI 4.2 と数値化           →  AI Partner が日記ベースで状態を反映

修正指示を出す          →  memory/ に feedback記録    →  knowledge_base (confidence↑)
「pytest使って」         →  KB: "テストはpytest"        →  CLAUDE.md に昇格 (自動適用)

失敗する               →  growth_events に記録       →  design-philosophy.md に教訓
「RLS忘れた」           →  パターン検出               →  rules/ にチェックリスト化

夢を思いつく            →  dreams テーブル             →  goal分解 → weekly task化
「本を出版したい」       →  夢進捗検出が日記を照合      →  「この経験が夢に近づいている」`}
        </div>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>データ・ナレッジ・暗黙知の定義</div>
        <Tbl headers={['区分', '定義', '特徴', 'focus-youでの例']} rows={[
          ['データ', '事実の記録。解釈を含まない生のログ', '量が多い、自動蓄積、そのままでは意味がない', 'prompt_log, habit_logs, activity_log, calendar events'],
          ['ナレッジ', 'データから抽出された意味のある知見。再利用可能', '構造化されている、文脈依存、陳腐化する', 'knowledge_base, ceo_insights, emotion_analysis, design-philosophy.md'],
          ['暗黙知', '言語化困難な経験的知識。身体感覚・直感・美意識', '個人に属する、伝達困難、最も価値が高い', '事業判断の勘、対人感覚、作業スタイルの好み、設計の美意識'],
        ]} />
        <P>重要: 暗黙知は「別の層」ではなく、同じナレッジの未形式化部分。日記を書くことで暗黙知が言語知に、感情分析で形式知に、少しずつ形式化が進む。</P>
      </Section>

      <Section title="データ構造（テーブル一覧）">
        <Tbl headers={['テーブル', 'カラム（主要）', '知識区分']} rows={[
          ['diary_entries', 'body, entry_type, entry_date, wbi', 'データ → ナレッジ（分析後）'],
          ['emotion_analysis', 'plutchik 8感情, russell, perma_v, wbi_score', 'ナレッジ（データから自動生成）'],
          ['self_analysis', 'analysis_type, result(JSON), summary, analysis_context(JSONB)', 'ナレッジ（ハイブリッド分析。analysis_contextに中間根拠を保存し次回の更新分析に活用）'],
          ['weekly_narratives', 'narrative, stats(JSON)', 'ナレッジ（週次集約）'],
          ['knowledge_base', 'category, rule, reason, confidence', 'ナレッジ → 形式知（昇格時）'],
          ['ceo_insights', 'category, insight, evidence, confidence', 'ナレッジ（日記ベース: mood_cycle/trigger/correlation/disconnect/value/drift/fading、prompt_logベース: focus/recurring/shift/blind_spot）'],
          ['diary_analysis', 'period_type(weekly/monthly), ai_insights, highlights(JSONB)', 'ナレッジ（週次/月次の中間分析結果。3層分析のL2/L3出力）'],
          ['growth_events', 'what_happened, root_cause, countermeasure', 'ナレッジ（事例パターン）'],
          ['prompt_log', 'prompt, context, tags, created_at', 'データ（生ログ）'],
          ['tasks', 'title, status, priority, due_date, scheduled_at, deadline_at, estimated_minutes, time_slot, google_task_id, completed_at, attachments(JSONB)', 'データ（行動記録）。日付あり→Google Tasks同期。Today「今日の予定」3ブロック: 時間指定(時刻付き)/時間未定(日付のみ)/近日(未来7日)。attachments は Requests ページの画像添付メタ配列（Storage: request-attachments）'],
          ['dreams', 'title, category, status, priority', 'ナレッジ（暗黙知の言語化）'],
          ['goals', 'title, level, progress, dream_id', 'ナレッジ（夢の形式化）'],
          ['conversations / messages', 'role, content, tool_calls', 'データ（対話ログ）'],
          ['cost_tracking', 'model, tokens, total_cost', 'データ（運用メトリクス）'],
        ]} />
      </Section>
    </>
  )
}

// ========== Tab: Harness Engineering ==========

function TabHarness() {
  return (
    <>
      <Section title="ハーネスエンジニアリングとは何か">
        <P>AIの出力品質は「プロンプトの書き方」ではなく「AIを取り巻く環境（=ハーネス）の設計」で決まる。Claude Code は公式に "agentic harness" と位置づけられている。</P>

        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>3つの進化段階</div>
        <P>AI協業の技術は入れ子構造で進化してきた。外側の層が内側を包含する。</P>
        <Tbl headers={['段階', '時期', '問い', '操作対象', '品質への影響']} rows={[
          ['Prompt Engineering', '2022-2023', '「どう聞けばいい？」', 'プロンプト文字列', '品質 +3% 未満（Stanford HAI, 2025）'],
          ['Context Engineering', '2023-2024', '「AIは何を知る必要がある？」', 'RAG, Few-shot, システムプロンプト', '品質 +10-15%'],
          ['Harness Engineering', '2025-現在', '「どんな環境を構築すべき？」', 'ツール, Hook, 権限, サブエージェント', '品質 +28-47%（Stanford HAI, 2025）'],
        ]} />
        <Principle
          title="Stanford HAI 調査結果（2025年後半）"
          body="12の本番ユースケースでの比較: プロンプト改善は出力品質を3%未満しか向上させなかったのに対し、ハーネスレベルの変更（検索追加、ツールアクセス拡張、構造化バリデーション導入）は 28-47% の品質向上をもたらした。品質のボトルネックはモデルの能力ではなく、モデルが動作する環境にある。"
          color="var(--accent)"
        />
        <P>つまり「プロンプトをどう書くか」に時間を費やすより、「どんなツールを渡すか」「どんな制約を設けるか」「どんなフィードバックループを作るか」に注力すべき。OpenAI が自社の API ではなく Claude Code にプラグインを出荷した事実も、堀（moat）がモデルではなくハーネスにあることを示唆する。</P>
      </Section>

      <Section title="「ハーネス」の3つの比喩">
        <div className="g3" style={{ marginBottom: 12 }}>
          <Principle title="馬具 (Horse Harness)" body="AIの能力を正確に制御された方向へ導く。暴走を防ぎ、力を目的に集中させる。→ CLAUDE.md, Permission" color="var(--accent)" />
          <Principle title="安全帯 (Safety Harness)" body="失敗を封じ込め、回復可能にする。Permission deny, sandbox, git revert。→ Hooks (PreToolUse), Permissions" color="var(--green)" />
          <Principle title="テストハーネス (Test Harness)" body="デバッグ、可観測性、ツールセットを備えた実行環境。→ MCP, Tool Search, Sub-agents" color="var(--amber)" />
        </div>
      </Section>

      <Section title="ハーネスの6構成要素">
        <P>Claude Code のハーネスは6つの構成要素から成る。それぞれの性質の違いが重要。</P>
        <Tbl headers={['構成要素', '役割', '性質', '遵守保証', 'focus-youでの実装']} rows={[
          ['CLAUDE.md', '方針・規約の宣言', '助言的（読んでも無視されうる）', '低〜中', '.claude/CLAUDE.md + .company/CLAUDE.md + 部署CLAUDE.md'],
          ['Hooks', 'ライフサイクル制御', '決定論的（確実に実行される）', '高', '.claude/hooks/ に25スクリプト'],
          ['Permissions', '安全制御', '強制的（bypass不可）', '最高', 'settings.json の allow/deny リスト'],
          ['MCP', 'ツール拡張', '外部サービス接続', '—', 'Google Calendar, Supabase, Serena, Context7'],
          ['Sub-agents', 'コンテキスト分離', '独立メモリ・最小権限', '—', 'Agent tool で10部署を委譲'],
          ['Skills', 'ナレッジ注入', 'オンデマンドロード', '—', '/company, /diary 等のスキル'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>CLAUDE.md vs Hooks — 「助言」vs「強制」</div>
        <P>CLAUDE.md に「QAを通さずリリースしない」と書いても、モデルが無視する可能性がある。一方、PreToolUse Hook で <code>git push</code> 前にテスト通過を確認すれば、物理的にスキップできない。重要なルールほど Hooks に移すべき。</P>
        <Tbl headers={['ルール', '現在の配置', '理想の配置', '理由']} rows={[
          ['コミット規約', 'CLAUDE.md', 'CLAUDE.md（OK）', '助言で十分。フォーマット違反は致命的でない'],
          ['ハンドオフ検出', 'CLAUDE.md（正規表現）', 'PostToolUse Hook', '見逃すと部署間連携が壊れる'],
          ['QA未通過防止', 'CLAUDE.md', 'PreToolUse Hook (Bash)', 'テスト未通過のpushは本番障害に直結'],
          ['成果物登録', 'CLAUDE.md（手動）', 'PostToolUse Hook (Write)', 'リアルタイム登録で漏れ防止'],
          ['CLAUDE.md肥大化', 'ops部CLAUDE.md', 'PostToolUse Hook (Edit)', '200行超で自動警告'],
        ]} />
      </Section>

      <Section title="CLAUDE.md の設計原則">
        <Principle title="60行以下が理想" body="全てを1ファイルに詰め込むと指示が埋もれ、遵守率が下がる。Claudeのコンテキスト消費も増加。手順的な内容は rules/ やスキルに分離する。" color="var(--red)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="書くべきもの" body="Claudeが推測できないBashコマンド、デフォルトと異なるスタイル、テスト実行指示、PJ固有のアーキテクチャ決定、IMPORTANT/YOU MUST で強調" />
          <MiniCard title="書くべきでないもの" body="コードを読めばわかること、標準的な言語慣習、詳細なAPIドキュメント、頻繁に変わる情報。@path/to/file でインポート可能" />
        </div>
        <P>配置階層: <code>~/.claude/CLAUDE.md</code>（全PJ共通）→ <code>./CLAUDE.md</code>（プロジェクト、Git共有可）→ <code>./CLAUDE.local.md</code>（個人）→ 子ディレクトリ（オンデマンド読込）</P>
      </Section>

      <Section title="Hooks 詳細 — 決定論的制御">
        <P>Hooks はコンテキストウィンドウの外で実行される。つまりコンテキストを消費せず、確実に動作する。</P>

        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>利用可能なフックイベント</div>
        <Tbl headers={['イベント', 'タイミング', '用途', 'focus-youでの活用']} rows={[
          ['SessionStart', 'セッション開始 / compact後', 'コンテキスト再注入、環境セットアップ', 'auto-pull, config-sync, supabase-status, knowledge-lint(日次)'],
          ['SessionStop', 'セッション終了', 'クリーンアップ、レポート', 'auto-push, session-summary'],
          ['UserPromptSubmit', 'ユーザー入力時', 'LLM分類+ログ記録', 'prompt-log（gpt-5.4-nanoでタグ自動分類→Supabase記録）'],
          ['PreToolUse', 'ツール実行前', 'ブロック / 入力書き換え / ポリシーガード', 'bash-guard（危険コマンドのブロック+監査ログ）'],
          ['PostToolUse', 'ツール実行後', 'バリデーション、自動デプロイ、ログ', 'docs-sync-guard, edge-function-deploy(即時), agent-activity-log, tool-collector'],
          ['Stop', 'エージェント応答完了', 'タスク完了確認、自動テスト', 'タスク完了時の品質検証（IMP-007）'],
          ['PreCompact', 'コンテキスト圧縮前', '重要情報の保存', 'pre-compact-save.sh（セッション状態を.session-state.jsonに退避）'],
          ['PostCompact', '圧縮後', '重要コンテキストの再注入', 'post-compact-restore.sh（重要コンテキスト再注入）'],
          ['PermissionRequest', '許可ダイアログ表示時', '自動承認 / 条件付き承認', 'permission-guard.sh（許可判断を記録）'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>4つのフックタイプ</div>
        <Tbl headers={['タイプ', '仕組み', '用途']} rows={[
          ['command', 'シェルコマンド実行。exit code + stdout で制御', 'ファイル操作、Git操作、外部API呼び出し'],
          ['http', 'HTTP POST 送信。レスポンスで制御', 'Webhook、外部サービス連携'],
          ['prompt', '単発LLM評価。テキスト返却', '出力の品質チェック（軽量）'],
          ['agent', 'マルチターンサブエージェント検証', '複雑な検証ロジック（重い）'],
        ]} />

        <P><strong>重要</strong>: PreToolUse Hook は <code>bypassPermissions</code> モードでも deny を強制可能。つまり、どんな権限設定でもHookによるブロックは覆せない。最も強い制御メカニズム。</P>
        <P>v2.0.10以降、PreToolUse はツール入力の書き換えが可能（ブロック+リトライではなく、入力を修正して続行）。</P>
      </Section>

      <Section title="Sub-agents — コンテキスト分離の設計">
        <P>Sub-agent は「異なるプロンプト」ではなく「異なる作業メモリ」。親の会話を参照できず、プロンプト文字列だけで動作する。</P>
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="設計原則" body="1段落で説明可能 / 「完了」の定義が明確 / 出力フォーマットが記述可能 / 冗長な出力がメインコンテキストを圧迫しない（要約のみ返却）" />
          <MiniCard title="最小権限の原則" body="各エージェントに必要なツールだけ提供。リサーチには読取系のみ、実装には書込系も。モデル選択: リサーチ=opus（高精度）、定型=haiku（高速・安価）" />
        </div>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>focus-you部署 = Sub-agent としての設計</div>
        <P>各部署は Agent tool で起動される Sub-agent。この視点で見ると、部署設計の良し悪しは Sub-agent のプロンプト品質に直結する。</P>
        <Tbl headers={['部署', '仕様レベル', '完了条件', '課題']} rows={[
          ['UXデザイン部', '最高（5原則+心理学）', '明確', '良好。他部署の模範'],
          ['セキュリティ部', '最高（8ルール+SLA）', '明確', 'SLA追跡の自動化なし'],
          ['AI開発部', '中（柔軟フロー）', 'やや曖昧', 'QAバイパス条件が不明確'],
          ['システム開発部', '中（QAゲートあり）', '明確', 'コードレビュープロトコル未記載'],
          ['リサーチ部', '高（3段構成+URL必須）', '明確', 'フィードバックループなし'],
          ['PM部', '低（基本ワークフロー）', '曖昧', 'ハンドオフ検出が手動パース'],
          ['資料制作部', '中（10原則）', '曖昧', '品質ルーブリック不在'],
          ['情報収集部', '高（スコアリング）', '明確', 'キーワード抽出スクリプト未実装'],
          ['マーケティング部', '低（3柱）', '曖昧', '分類ゲートなし'],
          ['運営改善部', '高（メタ観察）', '明確', '閾値未定義'],
        ]} />
      </Section>

      <Section title="Managed Agents パターン（Anthropic Engineering 2026）">
        <P>OS仮想化に着想を得た3層分離アーキテクチャ。Session（append-only log）+ Harness（stateless brain）+ Sandbox（disposable hands）。focus-youではパイプラインの永続化と復旧に適用。</P>
        <Tbl headers={['層', '役割', 'focus-you 実装']} rows={[
          ['Session (append-only log)', '全イベントの永続記録。クラッシュ復旧の基盤', 'agent_sessions テーブル（event_type + payload JSONB）'],
          ['Harness (stateless brain)', 'ステートレスなオーケストレーション', 'pipeline_state テーブル（DAG + 進捗状態）'],
          ['Sandbox (disposable hands)', '使い捨ての実行環境', 'Agent tool のサブエージェント（元から対応済み）'],
        ]} />
        <Tbl headers={['機能', '実装状態', '技術']} rows={[
          ['Session Log 記録', '実装済み', 'PostToolUse Hook → agent_sessions INSERT'],
          ['Pipeline State 永続化', '実装済み', 'pipeline_state テーブル（DAG + status）'],
          ['セッション復旧検出', '実装済み', 'SessionStart Hook → pipeline_state チェック'],
          ['部署 Input 標準化', '実装済み', 'prompt に {task, context_events[], constraints} 構造'],
          ['Hybrid Search', '実装済み', 'pgvector + PGroonga + gpt-nano reranking → LLMコンテキスト注入'],
        ]} />
      </Section>

      <Section title="Agentic Loop — Claude Code の動作原理">
        <P>Claude Code は3フェーズのループを繰り返す。各ターンでAPIにメッセージを送り、ツール呼び出しを実行し、結果を次のターンに渡す。</P>
        <CycleFlow steps={['Context Gather', 'Take Action (tool_use)', 'Verify Results']} />
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="Context Loading" body="モデル呼び出し前にシステムプロンプトを組み立て: 日付、Git状態、CLAUDE.md階層、ツールリスト。これがハーネスの「コンテキスト層」" />
          <MiniCard title="Tool Dispatch" body="tool_useブロックをハンドラに振り分け。PreToolUse Hook → 実行 → PostToolUse Hook。5カテゴリ: File / Search / Execution / Web / Code Intelligence" />
        </div>
        <P>セキュリティ: Bash実行に対して23のチェック（ゼロ幅文字インジェクション検出、パストラバーサルブロック等）が内蔵されている。</P>
      </Section>

      <Section title="長時間エージェントのハーネス（Anthropic公式パターン）">
        <P>Anthropic Engineering が提唱する、セッションを跨ぐマルチターンエージェントの設計パターン。focus-youの /company + session-summary + Supabase に相当。</P>
        <Tbl headers={['構成要素', '役割', 'focus-youの対応物']} rows={[
          ['Initializer Agent', '環境セットアップ、進捗ファイル作成', '/company 起動時のブリーフィング + freshness-check'],
          ['Progress File', 'セッション間の状態引き継ぎ（構造化JSON）', 'session-summary.sh + Supabase 各テーブル'],
          ['Feature List', '離散的要件の追跡・ステータス管理', 'tasks テーブル + TodoWrite'],
          ['Coding Agent', '進捗ファイル+Git履歴を読み込み1機能ずつ作業', '部署Agent（Sub-agent）'],
        ]} />
        <Principle title="Context Compaction 対策" body="長時間セッションでは Compaction（コンテキスト圧縮）が発生し、情報が失われる。重要な決定は即座にファイルに永続化すべき。PreCompact Hook（pre-compact-save.sh）でセッション状態を保存し、PostCompact Hook（post-compact-restore.sh）で重要コンテキストを再注入する仕組みを実装済み。" color="var(--green)" />
      </Section>

      <Section title="focus-youシステムへの適用状況">
        <P>現在のシステムをハーネスエンジニアリングの観点から評価すると、「先進的だが未完成」。約70%のカバレッジ。</P>

        <div className="section-title" style={{ fontSize: 13, marginBottom: 8 }}>実装済み（強み）</div>
        <Tbl headers={['領域', '実装内容']} rows={[
          ['Hook活用（25スクリプト）', 'prompt-log, config-sync, freshness-check, auto-pull/push, bash-guard, tool-collector, docs-sync-guard, pre/post-compact, permission-guard 等'],
          ['Freshness Policy', '14データソースの鮮度管理。stale検出→自動修復'],
          ['部署CLAUDE.md分離', '10部署 × 独立仕様書。Sub-agent に近い設計'],
          ['ナレッジ昇格パイプライン', 'memory → knowledge_base → CLAUDE.md。confidence による自動昇格'],
          ['3層データ管理', 'ファイル（即時）→ Git（バージョン管理）→ Supabase（永続・分析）'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>改善済み（IMP実行結果）</div>
        <Tbl headers={['領域', '改善前', '改善後']} rows={[
          ['重要ルールのHooks化', 'CLAUDE.mdに記載のみ', '✅ PreToolUse(Bash) + PostToolUse(Write/Edit) で強制'],
          ['Sub-agentの最小権限', '全部署が全ツールアクセス可能', '✅ 部署ごとにツール・モデルを制限'],
          ['Compaction対策', 'session-summaryのみ', '✅ pre-compact-save.sh + post-compact-restore.sh'],
          ['ハンドオフの構造化', '正規表現でテキスト検索', '✅ YAMLベースの構造化フォーマット'],
          ['知識昇格のゲート', 'confidence≥3で自動昇格', '✅ ops部レビュー→社長承認→昇格（自動昇格禁止）'],
          ['Stop Hook活用', '未使用', '✅ タスク完了時の品質検証'],
        ]} />
      </Section>

      <Section title="Sources">
        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 2 }}>
          <div><a href="https://code.claude.com/docs/en/how-claude-code-works" target="_blank" rel="noopener noreferrer">How Claude Code works (公式)</a></div>
          <div><a href="https://code.claude.com/docs/en/best-practices" target="_blank" rel="noopener noreferrer">Best Practices for Claude Code (公式)</a></div>
          <div><a href="https://code.claude.com/docs/en/hooks-guide" target="_blank" rel="noopener noreferrer">Automate workflows with hooks (公式)</a></div>
          <div><a href="https://code.claude.com/docs/en/sub-agents" target="_blank" rel="noopener noreferrer">Create custom subagents (公式)</a></div>
          <div><a href="https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents" target="_blank" rel="noopener noreferrer">Effective harnesses for long-running agents (Anthropic Engineering)</a></div>
          <div><a href="https://dev.to/wonderlab/from-prompt-engineer-to-harness-engineer-three-evolutions-in-ai-collaboration-5bgp" target="_blank" rel="noopener noreferrer">From Prompt Engineer to Harness Engineer (DEV)</a></div>
          <div><a href="https://wavespeed.ai/blog/posts/claude-code-agent-harness-architecture/" target="_blank" rel="noopener noreferrer">Claude Code Agent Harness Architecture (WaveSpeedAI)</a></div>
          <div><a href="https://www.louisbouchard.ai/harness-engineering/" target="_blank" rel="noopener noreferrer">Harness Engineering: The Missing Layer (Louis Bouchard)</a></div>
          <div>Stanford HAI Survey on LLM Deployment Patterns, 2025 H2 (12 production use cases)</div>
        </div>
      </Section>
    </>
  )
}

// ========== Tab: Improvement Proposals ==========

interface Proposal {
  id: string
  priority: 'P0' | 'P1' | 'P2'
  title: string
  problem: string
  solution: string
  harnessPart: string
  effort: string
  impact: string
  status: 'proposed' | 'in_progress' | 'done'
}

const PROPOSALS: Proposal[] = [
  {
    id: 'IMP-001',
    priority: 'P0',
    title: 'CLAUDE.md の60行以下への剪定',
    problem: 'HD CLAUDE.md 208行（200行閾値超え済み）。公式推奨は60行以下。部署CLAUDE.mdは計1,004行（UXデザイン237行が最大、AI開発30行が最小）。指示が埋もれ遵守率が低下。freshness-policyのclaude_md_sizeチェックが blocking: false で警告止まり。',
    solution: '即時: Hook責務分離表(15行)をrules/hook-responsibilities.mdに移動、MCPプロファイル管理(4行)をrules/に移動。部署は完了条件+入出力仕様に圧縮。claude_md_sizeのblocking: trueに変更し200行超で強制分離。',
    harnessPart: 'CLAUDE.md',
    effort: '2時間',
    impact: '指示遵守率の向上、コンテキスト消費削減。Stanford HAI によれば構造改善は品質+28-47%。',
    status: 'done',
  },
  {
    id: 'IMP-002',
    priority: 'P0',
    title: 'ハンドオフ検出の構造化（正規表現→YAML）',
    problem: '部署間ハンドオフが正規表現でテキストマッチ。フォーマットのずれで見逃す。ネストしたハンドオフに対応不可。',
    solution: '成果物末尾に構造化YAMLブロックを書く形式に統一。PostToolUse(Write) Hook でYAMLパース→次部署を自動起動。handoff_id で重複防止。',
    harnessPart: 'Hooks (PostToolUse)',
    effort: '4時間',
    impact: 'ハンドオフ漏れゼロ化。部署間連携の信頼性が根本的に改善。',
    status: 'done',
  },
  {
    id: 'IMP-003',
    priority: 'P0',
    title: '重要ルールのHooks化（助言→強制）',
    problem: '「QA未通過でリリースしない」「成果物は登録する」等がCLAUDE.md記載のみ。モデルが無視するリスク。',
    solution: 'PreToolUse(Bash) で git push 前にテスト通過を確認。PostToolUse(Write) で成果物を自動登録。PostToolUse(Edit) でCLAUDE.md行数チェック。',
    harnessPart: 'Hooks (PreToolUse/PostToolUse)',
    effort: '3時間',
    impact: '品質ゲートの確実な実行。「助言が無視される」問題の根本解決。',
    status: 'done',
  },
  {
    id: 'IMP-004',
    priority: 'P1',
    title: 'Context Compaction 対策（PostCompact Hook）',
    problem: '長時間セッションでContext Compactionが発生し、重要な決定事項が失われる。現在は対策なし。',
    solution: 'PreCompact Hook で重要コンテキスト（現在のタスク、決定事項、パイプライン状態）をファイルに保存。PostCompact Hook で再注入。進捗ファイルを構造化JSONで管理。',
    harnessPart: 'Hooks (PreCompact/PostCompact)',
    effort: '3時間',
    impact: '長時間セッション（1時間超）での情報損失防止。Anthropic公式パターンの適用。',
    status: 'done',
  },
  {
    id: 'IMP-005',
    priority: 'P1',
    title: 'Sub-agent への最小権限適用',
    problem: '全部署（Sub-agent）が全ツールにアクセス可能。リサーチ部が Write を使えたり、資料制作部が Bash を叩ける。',
    solution: 'Agent tool 起動時に部署ごとのツール制限を設定。リサーチ = Read/Web系のみ。資料制作 = Read/Write のみ。セキュリティ部 = 全ツール。モデルも使い分け（リサーチ=opus, 定型=haiku）。',
    harnessPart: 'Sub-agents',
    effort: '2時間',
    impact: '安全性向上+コスト最適化。haiku活用で月額30-50%削減の可能性。',
    status: 'done',
  },
  {
    id: 'IMP-006',
    priority: 'P1',
    title: 'ナレッジ昇格にレビューゲート追加',
    problem: 'confidence≥3で自動昇格。誤ったルールが CLAUDE.md に入るリスク。一度昇格すると降格されない。',
    solution: '昇格候補をops部が検証→社長承認→昇格のフロー。降格条件を追加（60日間未使用 or 例外3回超で自動降格提案）。knowledge_base に last_validation, promotion_count カラム追加。',
    harnessPart: 'CLAUDE.md + Hooks',
    effort: '4時間',
    impact: 'ルールの品質担保。「間違ったルールが永久に適用される」リスク排除。',
    status: 'done',
  },
  {
    id: 'IMP-007',
    priority: 'P1',
    title: 'Stop Hook でタスク完了検証',
    problem: 'エージェントが「完了」と言っても、テストが通っていない・ファイルが保存されていない等のケースがある。',
    solution: 'Stop Hook（agent タイプ）で完了条件を自動検証。コード変更ならテスト実行確認、ドキュメントなら必須セクション確認、成果物ならartifacts登録確認。',
    harnessPart: 'Hooks (Stop)',
    effort: '3時間',
    impact: '「完了したのに実は未完了」問題の解消。やり直しコスト削減。',
    status: 'done',
  },
  {
    id: 'IMP-008',
    priority: 'P2',
    title: 'Hook 実行の可観測性ダッシュボード',
    problem: 'Hookが || exit 0 で静かに失敗する。prompt-log が落ちてもログが欠落するだけで気づけない。',
    solution: 'hook_execution テーブルに全実行ログ（timestamp, hook名, status, duration, error）を記録。ダッシュボードに「Hook Health」ウィジェット追加。失敗率5%超でアラート。',
    harnessPart: 'Hooks + Dashboard',
    effort: '5時間',
    impact: 'サイレント障害の検出。システムの信頼性向上。',
    status: 'done',
  },
  {
    id: 'IMP-009',
    priority: 'P2',
    title: '部署仕様レベルの均一化',
    problem: 'UXデザイン部・セキュリティ部は仕様が詳細（5原則+心理学/8ルール+SLA）だが、PM部・マーケ部は基本ワークフローのみ。Sub-agentのプロンプト品質がバラバラ。',
    solution: '全部署に統一テンプレート適用: ① 役割（1文）② 完了条件（チェックリスト）③ 入力/出力仕様 ④ 品質基準 ⑤ エスカレーション条件。仕様レベル低い部署から順に改善。',
    harnessPart: 'Sub-agents (CLAUDE.md)',
    effort: '6時間',
    impact: '部署アウトプットの品質安定化。「PMの出力が曖昧」等の問題解消。',
    status: 'done',
  },
  {
    id: 'IMP-010',
    priority: 'P2',
    title: 'ハーネス設計の継続的最新化（自動調査）',
    problem: 'Claude Code は頻繁にアップデートされる。新しいHook、新しいSub-agentパターン等を見逃す。',
    solution: 'freshness-policy.yaml に harness_research を追加（max_age_days: 7）。/company 起動時に情報収集部が最新記事を調査→ops部がギャップ分析→改善提案を自動更新。',
    harnessPart: 'Freshness Policy + Intelligence',
    effort: '2時間',
    impact: 'システムが常に最新のベストプラクティスに追従。「知らなくて使えなかった」を防止。',
    status: 'done',
  },
  {
    id: 'IMP-011',
    priority: 'P0',
    title: 'SessionStart Hook の並列化',
    problem: 'SessionStart に3つの sync hook が直列実行: auto-pull.sh → session-start-marker.sh → supabase-status.sh。セッション起動が遅延。各hookは独立しており待つ必要がない。',
    solution: 'auto-pull.sh と supabase-status.sh を async: true に変更。session-start-marker.sh のみ sync 維持（タイムライン記録のため）。起動時間が約3分の1に。',
    harnessPart: 'Hooks (SessionStart)',
    effort: '30分',
    impact: 'セッション起動の高速化。ユーザー体験の即座の改善。',
    status: 'done',
  },
  {
    id: 'IMP-012',
    priority: 'P1',
    title: 'skipDangerousModePermissionPrompt の無効化',
    problem: 'settings.json で skipDangerousModePermissionPrompt: true。rm -rf、git reset --hard、docker compose down 等の破壊的操作が確認なしで実行される。bash-guard がブロックするのは4パターンのみ。',
    solution: 'skipDangerousModePermissionPrompt: false に変更。PermissionRequest Hook で permission-log.sh を追加し全許可判断を記録。bash-guard のブロックパターンも拡充。',
    harnessPart: 'Permissions + Hooks',
    effort: '1時間',
    impact: '破壊的操作の事前確認が復活。監査証跡の確保。セキュリティリスクの大幅低減。',
    status: 'done',
  },
  {
    id: 'IMP-013',
    priority: 'P1',
    title: 'bash-guard の監査ログ追加',
    problem: 'bash-guard.sh がコマンドをブロック（exit 2）した際、ログが残らない。いつ何がブロックされたか追跡不可。',
    solution: 'ブロック時に ~/.claude/logs/blocked-commands.jsonl に {timestamp, command, reason} を書き込み。ダッシュボードのHook Healthウィジェットで可視化。',
    harnessPart: 'Hooks (PreToolUse)',
    effort: '30分',
    impact: 'セキュリティ監査の実現。ブロックパターンの改善材料。',
    status: 'done',
  },
  {
    id: 'IMP-014',
    priority: 'P2',
    title: 'freshness-policy の priority 重複修正',
    problem: 'growth_events と intelligence_reports が両方 priority: 9。両方 stale の場合に実行順が不定。',
    solution: 'intelligence_reports を priority 8.5 に変更（レポートはデータ入力、growth分析は洞察出力なのでレポートが先）。ceo_insights と knowledge_base を blocking: true に変更（全エージェントの判断品質に影響）。',
    harnessPart: 'Freshness Policy',
    effort: '15分',
    impact: '更新順序の確定。重要データの鮮度保証。',
    status: 'done',
  },
]

const PRIORITY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  P0: { color: 'var(--red)', bg: 'var(--red-bg)', border: 'var(--red-border)' },
  P1: { color: 'var(--amber)', bg: 'var(--amber-bg)', border: 'var(--amber-border)' },
  P2: { color: 'var(--blue)', bg: 'var(--blue-bg)', border: 'var(--blue-border)' },
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  proposed: { text: '提案', color: 'var(--text3)' },
  in_progress: { text: '進行中', color: 'var(--blue)' },
  done: { text: '完了', color: 'var(--green)' },
}

function TabProposals() {
  const [filterPriority, setFilterPriority] = useState<string>('')

  const filtered = filterPriority ? PROPOSALS.filter((p) => p.priority === filterPriority) : PROPOSALS
  const p0Count = PROPOSALS.filter((p) => p.priority === 'P0').length
  const p1Count = PROPOSALS.filter((p) => p.priority === 'P1').length
  const p2Count = PROPOSALS.filter((p) => p.priority === 'P2').length
  const doneCount = PROPOSALS.filter((p) => p.status === 'done').length

  return (
    <>
      <Section title="改善提案サマリー">
        <P>情報収集部（最新ハーネス記事調査）× 運営改善部（現行システム分析）の協議結果。全提案はハーネスエンジニアリングの6構成要素に紐づく。HD CLAUDE.md: 208行 / 部署CLAUDE.md合計: 1,004行 / Hook: 25スクリプト / Freshness Policy: 13データソース。最終調査日: 2026-04-06</P>
        <div className="g3" style={{ marginBottom: 16 }}>
          <Principle title={`P0: Critical — ${p0Count}件`} body="やらないと品質・信頼性に直結するリスク。CLAUDE.md肥大化、ハンドオフ漏れ、ルール無視。" color="var(--red)" />
          <Principle title={`P1: Important — ${p1Count}件`} body="やると品質・効率が大幅に向上。Compaction対策、最小権限、昇格ゲート。" color="var(--amber)" />
          <Principle title={`P2: Nice-to-have — ${p2Count}件`} body="運用が成熟してから取り組む。可観測性、部署仕様均一化、自動調査。" color="var(--blue)" />
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
          <span>全 <strong>{PROPOSALS.length}</strong> 件</span>
          <span>完了 <strong style={{ color: 'var(--green)' }}>{doneCount}</strong>/{PROPOSALS.length}</span>
          <span>推定工数合計 <strong style={{ fontFamily: 'var(--mono)' }}>{PROPOSALS.reduce((s, p) => s + parseInt(p.effort), 0)}h</strong></span>
        </div>
      </Section>

      <Section title="提案一覧">
        {/* Priority filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[
            { key: '', label: `全て (${PROPOSALS.length})` },
            { key: 'P0', label: `P0 (${p0Count})` },
            { key: 'P1', label: `P1 (${p1Count})` },
            { key: 'P2', label: `P2 (${p2Count})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterPriority(f.key)}
              className="btn btn-g btn-sm"
              style={{
                fontSize: 11, padding: '4px 10px',
                background: filterPriority === f.key ? 'var(--accent-bg)' : undefined,
                color: filterPriority === f.key ? 'var(--accent)' : undefined,
                borderColor: filterPriority === f.key ? 'var(--accent-border)' : undefined,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.map((p) => {
          const ps = PRIORITY_STYLE[p.priority] || PRIORITY_STYLE.P2
          const st = STATUS_LABEL[p.status] || STATUS_LABEL.proposed
          return (
            <div key={p.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: ps.color, background: ps.bg, border: `1px solid ${ps.border}`, fontFamily: 'var(--mono)' }}>{p.priority}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{p.id}</span>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{p.title}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: st.color }}>{st.text}</span>
              </div>
              {/* Body */}
              <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '6px 12px', fontSize: 12, lineHeight: 1.7 }}>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Problem</span>
                <span style={{ color: 'var(--text2)' }}>{p.problem}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Solution</span>
                <span style={{ color: 'var(--text2)' }}>{p.solution}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>対象</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent2)' }}>{p.harnessPart}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>工数</span>
                <span style={{ color: 'var(--text2)' }}>{p.effort}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Impact</span>
                <span style={{ color: 'var(--text2)' }}>{p.impact}</span>
              </div>
            </div>
          )
        })}
      </Section>

      <Section title="継続調査の仕組み">
        <P>この提案リストは自動的に最新化される。</P>
        <Tbl headers={['トリガー', '実行内容', '頻度']} rows={[
          ['/company 起動時', 'freshness-policy.yaml で harness_research の鮮度チェック', '毎回（14日超で調査起動）'],
          ['自動調査', '情報収集部: 最新Claude Code記事・リリースノート調査', '14日ごと'],
          ['ギャップ分析', '運営改善部: 現行システムと最新ベストプラクティスの差分分析', '調査完了後に自動'],
          ['提案更新', 'Blueprint 改善提案タブの更新提案を社長に提示', 'ギャップ発見時'],
          ['手動トリガー', '/company → 「ハーネス最新化」で即時調査起動', '任意'],
        ]} />
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)', marginTop: 12 }}>
{`/company 起動
  └→ freshness-check.sh
       └→ harness_research: 最終調査 14日超?
            ├→ YES: 情報収集部(最新記事) ∥ 運営改善部(GAP分析) 並列起動
            │        └→ 統合 → 改善提案更新 → 社長に提示
            └→ NO:  スキップ（鮮度OK）`}
        </div>
      </Section>
    </>
  )
}

// ========== Tab: Roadmap ==========

function TabRoadmap() {
  return (
    <>
      <Section title="Focus You — 商用化ロードマップ">
        <P>このダッシュボードを「Focus You」として商用プロダクト化する。日記×感情分析×ナラティブ知性で「記録を物語に変える」AIライフパートナー。</P>
        <Principle title="キラーフレーズ" body="毎日30分、他人のストーリーを見ている。その30分で、自分のストーリーを見つけませんか。" color="var(--accent)" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '12px 0' }}>
          <MiniCard title="ターゲット" body="セルフリフレクション型: 言語化が得意で情報は足りてる。他人に相談しづらい／日記・メモ習慣がある／決断は自分でしたい人" />
          <MiniCard title="市場" body="日本語ファースト → すぐにグローバル展開。AIジャーナリング市場 CAGR 11.5%、感情AI市場 CAGR 22-27%" />
          <MiniCard title="形態" body="PWA対応 Web SaaS（Phase 1）→ React Native モバイルアプリ（Phase 2）" />
          <MiniCard title="収益" body="日数制限トライアル + 機能制限Free + 有料プラン（$9.99-14.99/月帯）" />
        </div>
      </Section>

      <Section title="ターゲット解像度: セルフリフレクション型">
        <P>「ユーザー像」をキャラ/職業で切らない。共通するのは<strong>状態と習慣</strong>。経営者・研究者・クリエイター・一人で意思決定する専門職・メンタル回復期など、業種は横断する。</P>
        <Tbl
          headers={['条件', '意味', 'なぜ刺さるか']}
          rows={[
            ['言語化が得意・情報は足りてる', '調べる力・考える力は十分。足りないのは整理じゃなく承認と立ち位置', 'コーチング的な「問いかけ」は不要。"既に知ってることを思い出させる"役割が効く'],
            ['他人に相談しづらい', '重すぎる/軽すぎる/利害が絡む相手しかいない', 'SNSでも友人でもセラピストでもない、中間領域の空白'],
            ['言語化する習慣がある', '日記・メモ・独り言で自分の感情を外に出す', '文脈を渡せる＝AIが具体的に返せる。蓄積が価値になる'],
            ['決断は自分でしたい', '押し付けは嫌う。でも壁打ち相手は欲しい', '"答えを出す存在"ではなく"隣で同意してくれる存在"としての未来のあなた'],
          ]}
        />
        <Principle title="切る層: コーチ/メンターが必要な人" body="「転職すべきか分からない」「何をすればいいか教えてほしい」層はコーチングアプリの領域。LLMで薄く返すと逆に不信感。ここは狙わない。" color="var(--text3)" />
      </Section>

      <Section title="「背中を押してほしい」は2種類ある">
        <P>プロダクトとしてどちらを狙うかは明確に切り分ける。</P>
        <Tbl
          headers={['種類', '状態', 'Focus Youの立場']}
          rows={[
            ['① 行動が分からない', '転職すべきか？副業すべきか？何から始めれば？', '狙わない。業界知識・利害判断が必要でLLMでは勝てない'],
            ['② 行動は分かってる、一歩が出ない', '連絡すべき相手がいる／書きかけの原稿がある／断るべき案件がある', '★ 主戦場。必要なのは指示じゃなく「日記の決意・過去の似た場面・本人の価値観」を静かに差し出すこと'],
          ]}
        />
        <P>②を解くには、汎用アドバイスではなく<strong>本人の記録から答えを呼び起こす</strong>設計が必要。未来のあなたプロンプトの「本人の生活文脈・日記に紐づかない提案は出さない」制約はここに効いている。</P>
      </Section>

      <Section title="利用シーン: 開くタイミング5種">
        <P>1つのシーンに絞らず全部狙う。共通するのは<strong>「他人に話すほどじゃないけど自分の中だけで抱えるには重い」</strong>瞬間。この中間領域はSNS・日記アプリ・コーチングアプリのどれもカバーできていない空白地帯。</P>
        <Tbl
          headers={['シーン', '状態', '未来のあなたの役割']}
          rows={[
            ['朝の立ち上がり', '今日何から手をつけるか決めきれない', '昨日までの文脈を踏まえ、今日の軸を静かに提示'],
            ['夜の自己嫌悪', 'やり切れなかった日に自分を責めている', '日記から進んでいる事実を引き出し、承認する'],
            ['決断の前', '大きな意思決定を控えて整理したい', '過去の日記にある本人の価値観・判断軸を思い出させる'],
            ['良いことがあった直後', '誰かに言いたいけど言いにくい', '「見ていた存在」として静かに祝う。SNSの代替'],
            ['モヤッとした後', '「気にしすぎ？」と確認したい出来事', '客観化を助ける。決めつけず事実を並べる'],
          ]}
        />
        <P>オンボーディングではこの5シーンを紹介し、本人が「あ、あの時のやつだ」と思い出せる状態を作る。通知・導線もこの5点に紐づけて設計する。</P>
      </Section>

      <Section title="ポジション: ブルーオーシャン">
        <P>「感情分析 × ナラティブ知性 × 長期記憶」を統合した競合はゼロ。Mindsera（Plutchik+Big5）が最も近いが「物語」軸を持たない。</P>
        <Tbl
          headers={['カテゴリ', '代表的プロダクト', 'Narratorレベル']}
          rows={[
            ['AIジャーナリング', 'Rosebud ($12.99/月), Mindsera ($14.99/月)', '低〜中低: 感情分析あるが物語なし'],
            ['メンタルヘルス', 'Woebot, Wysa (FDA認定)', 'なし: 治療ツール'],
            ['ライフログ', 'Daylio, Exist.io', 'なし: 記録・相関分析のみ'],
            ['ナラティブ系', 'StoriedLife, Life Story AI', '中: 過去の回顧録のみ。進行中の物語ではない'],
            ['Focus You', '—', '唯一: 感情分析×ナラティブ×長期記憶×リアルタイム×未来予見'],
          ]}
        />
      </Section>

      <Section title="フェーズ別ロードマップ">
        <Principle title="Phase 0: 今（自分用ダッシュボード）" body="現在の開発。すべての新機能はFocus Youのコア資産になる前提で設計する。" color="var(--green)" />
        <P>重点: Narrative Intelligence 4エンジン実装、感情分析の精度向上、時間帯適応UI の磨き込み</P>

        <Principle title="Phase 1: MVP（PWA Web SaaS）" body="マルチテナント化、認証強化、PWA対応。既存Next.js資産を活用。" color="var(--blue)" />
        <P>必須: ユーザー認証 / org_id + RLS / 3問オンボーディング / 段階的アンロックUI / プッシュ通知</P>

        <Principle title="Phase 2: モバイル最適化" body="React Native アプリで入力体験を最適化。夜×ベッド×スマホのシナリオに特化。" color="var(--purple)" />
        <P>入力はモバイル、深い物語閲覧はWeb。同じSupabaseバックエンドを共有。</P>

        <Principle title="Phase 3: グロース" body="英語対応、Apple Watch連携、LINE Bot入力チャネル、チーム版。" color="var(--amber)" />
      </Section>

      <Section title="開発判断ガイド: 3分類チェック">
        <P>新機能を作る時、必ずこの3分類で判定する。コア比率60%以上を目指す。</P>
        <Tbl
          headers={['分類', '意味', '判断基準', '例']}
          rows={[
            ['コア (Universal)', '設定なしで全ユーザーに価値', 'Focus Youの有料ユーザーが喜ぶか？', '感情分析、ブリーフィング、Weekly Narrative、Arc Reader'],
            ['拡張 (Configurable)', '設定・プラグインで対応', '一部ユーザーが設定で使いたいか？', 'Google Calendar連携、通知時間カスタマイズ'],
            ['個人用 (Personal)', '自分だけの機能', 'Focus Youには不要。自分用に留める', '仮想カンパニー管理、HD秘書、PJ会社'],
          ]}
        />
      </Section>

      <Section title="20日間のコールドスタート設計">
        <P>Narrator体験には日記20件が必要。そこまで「普通の日記アプリ」と区別できないと離脱する。毎日「小さな驚き」を段階的にアンロック。</P>
        <Tbl
          headers={['Day', 'イベント', '提供価値']}
          rows={[
            ['Day 1', '感情分析 + Russell空間プロット', '「たった3行でここまで？」の驚き'],
            ['Day 3', 'マイクロ洞察', '「あなたは火曜日にエネルギッシュ」'],
            ['Day 5', '感情トレンドグラフ', '5日分の自分の波が見える'],
            ['Day 7', '★ Weekly Narrative', '最初の物語。1週間を物語として要約'],
            ['Day 14', '★ Self-Analysis解禁', 'MBTI/Big5/Values が日記から自動解析'],
            ['Day 20', '★★ Story ページ', 'Arc Reader初回実行。「あなたの物語」フルアンロック'],
            ['Day 30', 'Theme Finder', '人生に繰り返し現れるテーマを発見'],
            ['Day 90', '第1章の完成', '四半期の物語が自動生成'],
          ]}
        />
        <P>ストリーク途切れは「お帰りなさい。あなたの物語は待っていました」。罪悪感ゼロ設計。</P>
      </Section>

      <Section title="MVP機能リスト">
        <P><strong>Must Have</strong>: 日記入力(時間帯適応) / 感情分析(Plutchik+Russell+PERMA+V) / 感情カレンダー / AIパートナーの一言 / Weekly Narrative / Arc Reader / Storyページ / ユーザー認証+RLS / PWA / 段階的アンロック / 通知</P>
        <P><strong>Should Have</strong>: Theme Finder / Moment Detector / Self-Analysis / Foresight Engine / 夢リスト+進捗検出 / Chapter自動生成 / データエクスポート</P>
        <P><strong>Won't (MVP外)</strong>: Apple Watch / 家族版 / セラピスト連携 / ネイティブアプリ(Phase 2) / リアルタイム生体データ</P>
      </Section>

      <Section title="技術的な移行計画">
        <Tbl
          headers={['既存資産', '判定', '方針']}
          rows={[
            ['company-dashboard (Next.js/React)', '流用', 'マルチテナント化 + Supabase Auth強化'],
            ['Supabase スキーマ', '流用', 'org_id追加 + RLSポリシー全テーブル'],
            ['AI秘書プロンプト / aiPartner.ts', '流用', 'コア資産。パーソナライズ調整'],
            ['パイプライン定義 (.claude/rules/)', '変換', 'DB化してUI設定可能に'],
            ['部署CLAUDE.md', '変換', 'テンプレートとしてDB化'],
            ['Hook/MCP連携', '再設計', 'サーバーサイド(Edge Functions)で実行'],
          ]}
        />
      </Section>

      <Section title="意思決定ログ">
        <Tbl
          headers={['日付', '決定', '理由']}
          rows={[
            ['2026-04-07', 'プロダクト名: Focus You（仮）', '「外じゃなくて自分にフォーカス」が即伝わる'],
            ['2026-04-07', 'ターゲット: 20-30代 SNS世代', '社長自身がこの層。自分ごと化できる'],
            ['2026-04-07', '日本語ファースト → すぐグローバル', '日本語AIジャーナリング競合ほぼなし'],
            ['2026-04-07', 'Narrator表現は平易に', '「静かな再構築のフェーズ」は×。友達が言う自然さ'],
            ['2026-04-07', 'LP: パターンA（SNSとの対比）', '「他人のストーリー30分→自分のストーリー」'],
            ['2026-04-13', 'キャラクター切替UIは作らない', 'カウンセラー/コーチ/メンター等のモード選択は「どれも中途半端」を生むだけ。Linear/Notionと同じ思想'],
            ['2026-04-13', 'ターゲット再定義: セルフリフレクション型', '年齢/職業ではなく"状態と習慣"で切る。言語化が得意・他人に相談しづらい・日記習慣あり・決断は自分でしたい層'],
            ['2026-04-13', '「背中を押してほしい」は②のみ狙う', '①行動不明 はコーチング領域で勝てない。②一歩が出ない を主戦場にする。本人の記録から答えを呼び起こす設計'],
            ['2026-04-13', '利用シーン5種すべて狙う', '朝/夜/決断前/良いことの後/モヤッと後。単一シーン特化ではなく"他人に話すには重い中間領域"として統合'],
            ['2026-04-13', '未来のあなたプロンプト: 汎用アドバイス禁止', '「1つだけ書く」「散歩して整理」等の誰もやらないテンプレ提案を明示的に禁止。本人の文脈に紐づかない示唆は出さない'],
          ]}
        />
      </Section>
    </>
  )
}

// ========== Main ==========

const TABS = [
  { key: 'vision', label: 'Vision' },
  { key: 'experience', label: 'Experience Design' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'ai', label: 'AI Features' },
  { key: 'philosophy', label: 'Design Philosophy' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'harness', label: 'Harness Engineering' },
  { key: 'overview', label: 'Overview' },
  { key: 'operations', label: 'Operations' },
  { key: 'proposals', label: 'Improvement Proposals' },
] as const

type TabKey = typeof TABS[number]['key']

export function Blueprint() {
  const [tab, setTab] = useState<TabKey>('vision')

  return (
    <div className="page">
      <PageHeader title="Blueprint" description="Focus You — 設計図とロードマップ" />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--accent)' : 'var(--text3)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all .15s',
              fontFamily: 'var(--font)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vision' && <TabVision />}
      {tab === 'experience' && <TabExperienceDesign />}
      {tab === 'roadmap' && <TabRoadmap />}
      {tab === 'ai' && <TabAiFeatures />}
      {tab === 'philosophy' && <TabDesignPhilosophy />}
      {tab === 'architecture' && <TabArchitecture />}
      {tab === 'harness' && <TabHarness />}
      {tab === 'overview' && <TabOverview />}
      {tab === 'operations' && <TabOperations />}
      {tab === 'proposals' && <TabProposals />}
    </div>
  )
}
