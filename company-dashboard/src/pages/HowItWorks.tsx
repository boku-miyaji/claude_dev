import { PageHeader } from '@/components/ui'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

function OpsHealth() {
  const [stats, setStats] = useState<{
    knowledgeCount: number
    sessionCount: number
    sessionsExtracted: number
    pendingMigrations: number
    skillCount: number
  } | null>(null)

  useEffect(() => {
    async function load() {
      const [kbRes, sessRes, sessExtRes] = await Promise.all([
        supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('prompt_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('prompt_sessions').select('id', { count: 'exact', head: true }).eq('knowledge_extracted', true),
      ])
      setStats({
        knowledgeCount: kbRes.count || 0,
        sessionCount: sessRes.count || 0,
        sessionsExtracted: sessExtRes.count || 0,
        pendingMigrations: 0,
        skillCount: 10,
      })
    }
    load()
  }, [])

  if (!stats) return <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading...</div>

  const extractionRate = stats.sessionCount > 0
    ? Math.round((stats.sessionsExtracted / stats.sessionCount) * 100)
    : 0

  return (
    <div className="g2" style={{ marginBottom: 12 }}>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Ops Health</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <div><StatusDot ok={stats.knowledgeCount > 0} /> Active Knowledge: {stats.knowledgeCount} rules</div>
          <div><StatusDot ok={stats.sessionCount > 0} /> Sessions Tracked: {stats.sessionCount}</div>
          <div><StatusDot ok={extractionRate >= 50} /> Knowledge Extraction: {extractionRate}% ({stats.sessionsExtracted}/{stats.sessionCount})</div>
          <div><StatusDot ok={true} /> Registered Skills: {stats.skillCount}</div>
        </div>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Automation Scripts</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
          <div><code style={{ fontSize: 11, color: 'var(--accent)' }}>/migrate</code> — DB migration</div>
          <div><code style={{ fontSize: 11, color: 'var(--accent)' }}>/deploy</code> — Edge Function deploy</div>
          <div><code style={{ fontSize: 11, color: 'var(--accent)' }}>sync-skills.sh</code> — Skill sync</div>
          <div><code style={{ fontSize: 11, color: 'var(--accent)' }}>sync-registry.sh</code> — Registry sync</div>
        </div>
      </div>
    </div>
  )
}

export function HowItWorks() {
  return (
    <div className="page">
      <PageHeader title="How it Works" description="なぜこの仮想カンパニーは回り続けるのか" />

      {/* === なぜ回っているか — 根幹原理 === */}
      <Section title="なぜ回っているか — 3つの原理">
        <P>このシステムが「作って終わり」にならず継続的に改善され続ける理由は、3つの原理が組み込まれているから。</P>
        <div className="g3" style={{ marginBottom: 16 }}>
          <Principle
            title="原理 1: 自動検出"
            body="手動操作、同じ修正の繰り返し、知識の散在を自動で検出する。問題が見えないと改善は始まらない。Hook・タグ・prompt_logが観察の目。"
            color="var(--accent)"
          />
          <Principle
            title="原理 2: 知識の昇格"
            body="一時メモ → ナレッジ → ルール → スキル。情報は使われるたびに格上げされ、より確実に適用される形に進化する。同じ指示を2回しなくていい。"
            color="var(--green)"
          />
          <Principle
            title="原理 3: 仕組みの仕組み"
            body="機能を作るだけでは足りない。「誰が・いつ・どう回すか」まで設計する。ops部署がメタ運用を担い、仕組み自体を改善し続ける。"
            color="var(--yellow)"
          />
        </div>
        <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--accent)', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>この3原理が噛み合うと何が起きるか</div>
          <P>社長の修正指示 → 自動検出(原理1) → ナレッジ化(原理2) → 次回から暗黙適用 → さらに仕組み自体も改善(原理3) → 修正指示が減る → より高度なタスクに集中できる</P>
        </div>
      </Section>

      <Section title="5つの自己改善ループ">
        <P>3原理を実現する5つのフィードバックループ。それぞれが独立して回り、全体として組織が賢くなり続ける。</P>
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="Loop 1: ナレッジ蓄積（即時）" body="修正指示を検出 → knowledge_base記録 → 次回から暗黙適用 → confidence上昇 → CLAUDE.md昇格。同じミスを繰り返さない。" />
          <MiniCard title="Loop 2: セッション学習（セッション単位）" body="prompt_sessionsでセッション単位にグルーピング → フィードバック含むセッションからナレッジ自動抽出 → 文脈付きで蓄積。" />
          <MiniCard title="Loop 3: 組織最適化（定期）" body="5軸評価（自律完遂率/一発OK率/連携効率/目標寄与/稼働率）→ 低スコアの部署のCLAUDE.mdルール改善。組織が自動チューニング。" />
          <MiniCard title="Loop 4: CEO分析（蓄積）" body="prompt_log蓄積 → 行動パターン/時間帯/好み/傾向分析 → 秘書が先回り提案。社長の思考パターンに適応。" />
          <MiniCard title="Loop 5: 運営改善（メタ）" body="ops部署が「仕組み自体」を監視。手動操作の検出 → スクリプト化。CLAUDE.md肥大化 → スキル分離。仕組みが仕組みを改善する。" />
        </div>
        <CycleFlow steps={['問題検出', '原因分析', '仕組みの修正', '検証', '運用定着', '次の問題を早期検出']} />
      </Section>

      {/* === 現在の運営状態 === */}
      <Section title="現在の運営状態">
        <OpsHealth />
      </Section>

      {/* === 既存セクション（構造説明） === */}
      <Section title="全体アーキテクチャ">
        <P>1人の社長が複数PJを横断管理する仮想持株会社構造。AIエージェント（Claude）が秘書として各社を運営。</P>
        <Flow steps={['/company', 'HD秘書がPJ判断', 'PJ会社のCLAUDE.md読込', 'HD共通部署で作業', '成果物をPJリポジトリに']} />
        <div className="g2" style={{ marginBottom: 12 }}>
          <MiniCard title="HD（.company/）" body="秘書室 / 人事部 / 共通部署（AI開発・システム開発・PM・資料制作・リサーチ・情報収集・セキュリティ・UX・ops）" />
          <MiniCard title="PJ会社（.company-*/）" body="PJ固有コンテキスト（クライアント情報・ドメイン知識）+ 秘書のみ。部署はHD共通を利用" />
        </div>
      </Section>

      <Section title="知識の階層 — SSOT設計">
        <P>全ての情報には「正の置き場所」が1つだけある。散在させない。</P>
        <Tbl headers={['知識の種類', '置き場所（SSOT）', '読み込みタイミング']} rows={[
          ['恒久ルール', 'CLAUDE.md / .claude/rules/', 'セッション開始時（常時）'],
          ['運用手順', 'スキル SKILL.md', '/コマンド実行時（必要時のみ）'],
          ['学習済みパターン', 'knowledge_base (Supabase)', '/company 起動時'],
          ['セッション横断の記憶', 'memory/ (auto-memory)', 'セッション開始時'],
          ['PJ会社一覧', 'registry.md', 'sync-registry.sh で派生に伝播'],
          ['スキル一覧', 'marketplace.json', 'sync-skills.sh で自動生成'],
        ]} />
        <P>原則: マスターを1つ編集 → 同期スクリプトが全派生に伝播。手動で派生を個別編集しない。</P>
      </Section>

      <Section title="3層データ管理">
        <P>データはファイル（速度）× Git（履歴）× Supabase（分析・同期）の3層で管理。</P>
        <div className="g3" style={{ marginBottom: 12 }}>
          <MiniCard title="Layer 1: ファイル" body="CLAUDE.md / メモ / TODO / prep-log。エージェントが即座に読み書き" />
          <MiniCard title="Layer 2: Git" body="マルチリポジトリ。claude_dev(HD) + 各PJリポジトリ。バージョン管理・履歴保持" />
          <MiniCard title="Layer 3: Supabase" body="プロンプト履歴 / セッション / ナレッジ / タスク / CEO分析。クラウド永続・モバイルアクセス" />
        </div>
        <P>ローカルファイルが常にマスター。Supabaseは分析・同期・モバイルアクセス用。落ちても作業は止まらない。</P>
      </Section>

      <Section title="自動化 — Hook + スキル + スクリプト">
        <P>3種類の自動化が役割分担。Hookは記録、スキルは判断、スクリプトは同期。</P>
        <Tbl headers={['種類', '代表例', '特性']} rows={[
          ['Hook', 'prompt-log.sh, config-sync.sh', '軽量・非同期・毎回自動実行。失敗しても会話をブロックしない'],
          ['スキル', '/migrate, /deploy, /company', '必要時に呼び出し。判断を伴う処理。SKILL.mdに知識を閉じ込め'],
          ['スクリプト', 'sync-skills.sh, sync-registry.sh', 'SSOT → 派生の一方向同期。手動 or スキル経由で実行'],
        ]} />
        <Tbl headers={['Hook', 'トリガー', '処理']} rows={[
          ['prompt-log.sh', '毎回の入力', 'プロンプト記録 + セッション追跡 + PJ自動タグ付け'],
          ['config-sync.sh', 'SessionStart', '設定・MCP・プラグイン・CLAUDE.md → Supabase同期'],
          ['company-sync.sh', 'SessionStart', '.company/ の会社・部署 → Supabase同期'],
          ['permission-guard.sh', '権限リクエスト', 'full/safe/strict に基づく自動判定'],
        ]} />
      </Section>

      <Section title="ops部署 — 仕組みの仕組み">
        <P>他の部署が「何をするか」を担うのに対し、opsは「どう回すか」を担う。メタ運用の専門部署。</P>
        <Tbl headers={['検出トリガー', '何が起きたか', 'opsのアクション']} rows={[
          ['手動操作の発生', '自動化されるべき作業を手でやった', 'スクリプト or スキル化'],
          ['同じ修正が2回', 'ルールが足りない', 'ルール追加を提案'],
          ['marketplace.json不整合', 'スキル追加時にsync漏れ', 'sync-skills.sh の自動実行を提案'],
          ['CLAUDE.md肥大化', '手順や知識が直書きされた', 'スキル or rules/ に分離'],
          ['知識の分散', '同じ情報がmemory/KB/rulesに', 'SSOTを決めて統合'],
        ]} />
        <CycleFlow steps={['問題検出', '原因分析', '仕組みの修正', '検証', '運用定着']} />
      </Section>

      <Section title="保険 — フォールバック">
        <Tbl headers={['障害', 'フォールバック']} rows={[
          ['Supabase障害', 'ローカルファイルで代替。マスターは常にファイル'],
          ['Git push不可', 'ローカルにコミットは残る。次回conflict検出→秘書が報告'],
          ['エージェント誤判断', 'permission-guard + チェックポイント制 + git revert'],
          ['スキル未登録', 'sync-skills.sh --check で不整合検出。ops部署が監視'],
        ]} />
      </Section>

      <Section title="コマンド体系 — 何がいつ動くか">
        <P>3つのレイヤーで動作。常時自動で動くもの、コマンドで呼ぶもの、定期実行されるもの。</P>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>常時自動（rules/ — 指示するだけで動く）</div>
        <Tbl headers={['社長の指示', '自動判定', '実行されるパイプライン']} rows={[
          ['「〇〇を作って」「新機能追加」', 'パイプライン A', 'リサーチ ∥ UXデザイン → AI開発 ∥ PM → 実装 → QA'],
          ['「バグ直して」「エラー修正」', 'パイプライン B', 'システム開発 → QA'],
          ['「資料作って」「プレゼンまとめて」', 'パイプライン C', 'リサーチ → 資料制作'],
          ['「調べて」「比較して」', 'パイプライン D', 'リサーチ（並列可） → 統合報告'],
          ['「セキュリティ監査」', 'パイプライン E', 'セキュリティ ∥ リサーチ → 修正 → QA'],
        ]} />
        <P>∥ = 並列実行。依存関係がなければ複数部署を同時に起動する。</P>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>常時自動（ハンドオフ検出）</div>
        <P>部署の成果物に「→ PM部への依頼」等が書いてあると、秘書が自動検出して次の部署を起動。人間が手動で振り分ける必要なし。</P>
        <Flow steps={['部署Aが成果物作成', 'ハンドオフ検出', '部署Bを自動起動', '完了→次のハンドオフ...', '全完了→社長に報告']} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>/company コマンド（明示的に呼ぶ機能）</div>
        <Tbl headers={['コマンド', '機能', 'いつ使う']} rows={[
          ['/company', 'HD秘書起動（ブリーフィング + タスク管理）', '朝の確認、全体把握'],
          ['/company {name}', 'PJ会社の秘書起動', '特定PJの作業時'],
          ['/company:invoice', '売上・経費・税金管理', '請求書登録、稼働同期'],
          ['/company:diary', '日記の分析・壁打ち', '振り返り、感情分析'],
          ['/company:auto-prep', 'MTG準備の自動化', 'MTG前の事前分析'],
          ['/company:weekly-digest', '週次CEOレポート', '週末の振り返り'],
          ['/company:register', '成果物をReportsに登録', 'レポート完成時'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>定期自動（cron）</div>
        <Tbl headers={['時刻', '処理', '保存先']} rows={[
          ['毎日 7:00 JST', '朝のブリーフィング生成（タスク+日記+未入金）', 'activity_log'],
          ['毎日 7:00 / 19:00', 'ニュース自動収集（GPT経由）', 'activity_log'],
        ]} />
      </Section>

      <Section title="部署連携 — パイプラインの実際の流れ">
        <P>8つの部署がどう連携するか。稼働中の部署と準備中の部署。</P>

        <div className="g2" style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--green)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--green)' }}>稼働中（自動で動く）</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              情報収集部 — cron定期実行<br/>
              リサーチ部 — 調査依頼で起動<br/>
              UXデザイン部 — 機能開発時に起動<br/>
              セキュリティ部 — 監査・スキャン
            </div>
          </div>
          <div className="card" style={{ padding: 14, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--accent)' }}>トリガー定義済み（依頼で動く）</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              PM部 — ハンドオフ検出 / 社長指示で起動<br/>
              資料制作部 — 社長指示 / PMチケットで起動<br/>
              システム開発部 — 設計完了 / チケットで起動<br/>
              AI開発部 — 機能開発パイプラインで起動
            </div>
          </div>
        </div>

        <P>パイプラインA（新機能開発）の実際の流れ:</P>
        <div className="card" style={{ padding: 14, marginBottom: 12, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`Step 1 [並列]: リサーチ ∥ UXデザイン  ← 同時起動
         ↓ 両方完了
Step 2 [並列]: AI開発(設計) ∥ PM(チケット化) ← checkpoint
         ↓ 社長レビュー承認
Step 3 [直列]: システム開発(実装) → QA(テスト)
         ↓
完了: 成果物登録 + commit + 報告`}
        </div>
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
