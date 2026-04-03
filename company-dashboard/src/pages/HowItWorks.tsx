import { PageHeader } from '@/components/ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function P({ children }: { children: string }) {
  return <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 8 }}>{children}</div>
}

function MiniCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>{body}</div>
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

export function HowItWorks() {
  return (
    <div className="page">
      <PageHeader title="How it Works" description="宮路HDの仮想カンパニーシステムがどう動いているか" />

      <Section title="全体アーキテクチャ">
        <P>1人の社長が複数PJを横断管理する仮想持株会社構造。AIエージェント（Claude）が秘書として各社を運営。</P>
        <Flow steps={['/company', 'HD秘書がPJ判断', 'PJ会社のCLAUDE.md読込', 'HD共通部署で作業', '成果物をPJリポジトリに']} />
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="HD（.company/）" body="秘書室 / 人事部 / 共通6部署（AI開発・システム開発・PM・資料制作・リサーチ・情報収集）" />
          <MiniCard title="PJ会社（.company-*/）" body="PJ固有コンテキスト（クライアント情報・ドメイン知識）+ 秘書のみ。部署はHD共通を利用" />
        </div>
        <Tbl headers={['PJ会社', '説明', 'ステータス']} rows={[
          ['foundry', 'SOMPOケア Foundry移行PJT支援', 'active'],
          ['rikyu', 'りそな向け営業支援DX', 'active'],
          ['circuit', '電子回路設計DX', 'active'],
        ]} />
      </Section>

      <Section title="3層データ管理">
        <P>データはファイル（速度）× Git（履歴）× Supabase（分析・同期）の3層で管理。</P>
        <div className="g3" style={{ marginBottom: 12 }}>
          <MiniCard title="Layer 1: ファイル" body="CLAUDE.md / メモ / TODO / prep-log。エージェントが即座に読み書き" />
          <MiniCard title="Layer 2: Git" body="マルチリポジトリ。claude_dev(HD) + 各PJリポジトリ。バージョン管理・履歴保持" />
          <MiniCard title="Layer 3: Supabase" body="プロンプト履歴 / ナレッジ / タスク / 日記 / CEO分析。クラウド永続・モバイルアクセス" />
        </div>
        <P>ローカルファイルが常にマスター。Supabaseは分析・同期・モバイルアクセス用。落ちても作業は止まらない。</P>
      </Section>

      <Section title="記憶の流れ — 昇格パス">
        <P>一時的なメモ → 繰り返し出現 → ナレッジ化 → CLAUDE.mdルール化。同じ指示を2回する必要がなくなる。</P>
        <Tbl headers={['記憶タイプ', '保存先', '昇格条件']} rows={[
          ['プロンプト履歴', 'prompt_log (Supabase)', '10件超 → CEO分析トリガー'],
          ['ナレッジ', 'knowledge_base (Supabase)', 'confidence ≥ 3 → CLAUDE.md 昇格提案'],
          ['意思決定ログ', 'secretary/notes/ (ファイル)', 'パターン検出 → ルール化提案'],
          ['CLAUDE.md', '.company*/CLAUDE.md', '最も永続的。エージェントの恒久的行動指針'],
        ]} />
      </Section>

      <Section title="自動化 — Hook">
        <P>社長が何もしなくてもバックグラウンドで同期・記録が行われる。</P>
        <Tbl headers={['Hook', 'トリガー', '処理']} rows={[
          ['supabase-status.sh', 'SessionStart', 'Supabase接続確認'],
          ['config-sync.sh', 'SessionStart', '設定・MCP・プラグイン・CLAUDE.md → Supabase同期'],
          ['company-sync.sh', 'SessionStart', '.company/ の会社・部署 → Supabase同期'],
          ['artifact-sync.sh', 'SessionStart', '登録済みファイルの変更検知 → 内容を同期'],
          ['prompt-log.sh', '毎回の入力', 'プロンプト記録 + PJ自動タグ付け（非同期）'],
          ['company-pull.sh', '/company 実行時', 'git pull で最新の組織データ取得'],
          ['permission-guard.sh', '権限リクエスト時', 'full/safe/strict に基づく自動判定'],
        ]} />
      </Section>

      <Section title="情報収集 → リサーチ">
        <P>intelligence部署が自動でデータを集め、research部署が分析・構造化する。</P>
        <Flow steps={['sources.yaml', 'collect.py (09:00/21:00)', 'reports/', 'スコアリング', 'リサーチが3段構成で分析']} />
        <div className="g3" style={{ marginBottom: 12 }}>
          <MiniCard title="収集" body="キーワード検索 (DuckDuckGo) / X アカウント監視 / Webサイト監視" />
          <MiniCard title="スコアリング" body="有用 +0.2 / ノイズ -0.2 / 探索枠20% / 30日減衰" />
          <MiniCard title="3段構成出力" body="① 公知情報+URL → ② 限界の明示 → ③ 壁打ちモード" />
        </div>
      </Section>

      <Section title="保険 — フォールバック">
        <Tbl headers={['障害', 'フォールバック']} rows={[
          ['Supabase障害', 'ローカルファイルで代替。Supabaseはミラー、マスターは常にファイル'],
          ['Git push不可', 'ローカルにコミットは残る。次回pullでconflict検出→秘書が報告'],
          ['エージェント誤判断', 'permission-guard.shが破壊的操作をブロック + チェックポイント制 + git revert可能'],
        ]} />
        <P>PJリポジトリは完全独立。あるPJでミスをしても他PJや組織設定には影響しない。</P>
      </Section>

      <Section title="改善サイクル — 3つのループ">
        <div className="g3" style={{ marginBottom: 12 }}>
          <MiniCard title="Loop 1: ナレッジ蓄積（即時）" body="修正指示を検出 → knowledge_base記録 → 次回から暗黙適用 → confidence上昇 → CLAUDE.md昇格" />
          <MiniCard title="Loop 2: 組織最適化（定期）" body="5軸評価（自律完遂率/一発OK率/連携効率/目標寄与/稼働率）→ 低スコアでルール改善提案" />
          <MiniCard title="Loop 3: CEO分析（蓄積）" body="prompt_log蓄積 → 行動パターン/時間帯/好み/傾向分析 → 秘書の先回り提案" />
        </div>
      </Section>

      <Section title="準備タイミングインテリジェンス">
        <P>ミーティングごとに「いつ準備を始めるべきか」を実績データから予測。</P>
        <Tbl headers={['分類軸', '値']} rows={[
          ['audience', 'client-exec / client-working / internal-team / external-partner / personal'],
          ['purpose', 'reporting / status-update / brainstorming / decision / demo / review / knowledge-sharing'],
          ['your_role', 'presenter / co-presenter / facilitator / participant / observer'],
          ['stakes', 'critical / high / medium / low'],
        ]} />
        <Flow steps={['Phase 1: 経験則 (0-4件)', 'Phase 2: 統計 (5-9件)', 'Phase 3: 個別最適 (10-19件)', 'Phase 4: 予測 (20件〜)']} />
      </Section>

      <Section title="設計思想 — エンハンス、代替ではない">
        <div className="card" style={{ borderLeft: '3px solid var(--accent)', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>このシステムは人の仕事を完全代替するのではなく、エンハンスするもの</div>
          <P>AI出力をそのまま商談に持ち込むのは難しい。自分で説明できない内容は使えない。</P>
        </div>
        <div className="g2">
          <MiniCard title="正しい使い方" body="AI出力を壁打ちの素材として使う → 腹落ちするまで対話 → 自分の言葉で説明できる状態にする" />
          <MiniCard title="避けるべき使い方" body="AI出力をそのままコピペ → 内容を理解せず提出 → 思考プロセスをスキップ" />
        </div>
      </Section>
    </div>
  )
}
