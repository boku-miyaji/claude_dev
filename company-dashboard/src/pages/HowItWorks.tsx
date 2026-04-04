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

// ========== Tab: Overview ==========

function TabOverview() {
  const [stats, setStats] = useState<{
    knowledgeCount: number; sessionCount: number; sessionsExtracted: number;
    memoryCount: number; growthCount: number; diaryCount: number;
  } | null>(null)

  useEffect(() => {
    async function load() {
      const [kbRes, sessRes, sessExtRes, growthRes, diaryRes] = await Promise.all([
        supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('prompt_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('prompt_sessions').select('id', { count: 'exact', head: true }).eq('knowledge_extracted', true),
        supabase.from('growth_events').select('id', { count: 'exact', head: true }),
        supabase.from('diary_entries').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        knowledgeCount: kbRes.count || 0,
        sessionCount: sessRes.count || 0,
        sessionsExtracted: sessExtRes.count || 0,
        memoryCount: 0,
        growthCount: growthRes.count || 0,
        diaryCount: diaryRes.count || 0,
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
          ['prompt_log', '毎回のユーザー入力', 'Hook (UserPromptSubmit)', 'CEO分析の材料、生活リズム分析'],
          ['設定/MCP/CLAUDE.md同期', 'セッション開始', 'Hook (SessionStart)', 'ダッシュボードSettings反映'],
          ['git pull (最新コード)', 'セッション開始', 'Hook (SessionStart)', '全ファイルが最新に'],
          ['git push', 'セッション終了', 'Hook (SessionStop)', '他サーバーに変更が伝播'],
          ['emotion_analysis', '日記投稿直後', 'useEmotionAnalysis (自動)', 'diary_entries.wbi更新 → Journal可視化 → AI Partner再生成'],
          ['AI Partnerコメント', '日記投稿後 + 時間帯変更 + リロード', 'useMorningBriefing (invalidate)', '表示のみ（DB保存なし）'],
          ['夢進捗検出', '日記投稿後', 'useDreamDetection (自動)', 'toast通知のみ'],
          ['天気', '1時間ごと(TTL)', 'useTodayWeather (localStorage)', 'Today画面表示'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--accent)' }}>ユーザー操作トリガー</div>
        <Tbl headers={['データ', '更新タイミング', 'トリガー', '連鎖先']} rows={[
          ['diary_entries', 'Today画面で「記録する」', 'ユーザー入力', '→ emotion_analysis → AI Partner → 夢検出（3つが自動連鎖）'],
          ['tasks', 'Todayまたはタスクページで操作', 'ユーザー操作', '→ AI Partnerコメントの文脈に反映（次回生成時）'],
          ['habits / habit_logs', 'Today画面でチェック', 'ユーザータップ', '→ Today画面のサマリーに即反映'],
          ['weekly_narratives', 'Weeklyページで「生成」ボタン', 'ユーザー操作', 'DB保存。過去の週は再生成可能'],
          ['self_analysis', 'Self Analysisで分析ボタン', 'ユーザー操作', 'DB保存。日記件数でアンロック'],
          ['news_items', 'Reportsで「収集」ボタン', 'ユーザー操作', 'activity_logにも記録'],
          ['goals / dreams', '各ページで追加・更新', 'ユーザー操作', 'goal完了 → dream statusの自動更新連鎖'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8, color: 'var(--yellow)' }}>手動更新が必要（陳腐化リスクあり）</div>
        <Tbl headers={['データ', '更新タイミング', '陳腐化リスク', '対策']} rows={[
          ['HowItWorks AI Features', 'AI機能追加・変更時', '新機能が未記載になる', 'memoryルール: 機能変更時に更新必須'],
          ['design-philosophy.md', '設計判断時', '新しい教訓が反映されない', 'memoryルール: 設計判断時に追記必須'],
          ['growth_events', '失敗・改善発生時', '最近の成長が未記録', '/company起動時にリマインド検討'],
          ['knowledge_base → CLAUDE.md昇格', 'confidence ≥ 3 到達時', '昇格候補が放置される', '月次で棚卸し。ブリーフィングでリマインド'],
          ['CLAUDE.md サイズ', '常時', '200行超でコンテキスト圧迫', '週次でサイズチェック'],
          ['docs/knowledge/', '新知見発見時', '古い情報のまま', '体系知識は調査のたびに追記'],
        ]} />
      </Section>

      <Section title="更新連鎖マップ（1つの操作が何を動かすか）">
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2.2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`日記を書く
  ├→ diary_entries INSERT
  ├→ emotion_analysis 自動生成（感情スコア+WBI）
  │    └→ diary_entries.wbi UPDATE
  │         └→ Journal ページの感情カレンダー更新
  ├→ AI Partner コメント再生成（invalidate → fetch）
  │    └→ 10データソース再収集 → LLM生成
  └→ 夢進捗検出（diary × dreams照合）
       └→ 一致あれば toast 通知

セッション開始
  ├→ git pull（最新コード取得）
  ├→ config-sync.sh（settings/MCP/CLAUDE.md → Supabase）
  ├→ company-sync.sh（.company/ → Supabase companies/departments）
  └→ prompt-log.sh 初期化

/company 起動
  ├→ knowledge_base 読み込み（active ルール取得）
  ├→ 未処理コメント確認
  ├→ カレンダー取得（今日+明日）
  └→ データ鮮度チェック（freshness-policy.yaml）

AI機能を追加・変更
  ├→ Edge Function 修正 → supabase functions deploy
  ├→ HowItWorks AI Features タブ更新（手動・必須）
  └→ design-philosophy.md に教訓追記（手動・必須）`}
        </div>
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
          ['Hook', 'prompt-log.sh, config-sync.sh', '軽量・非同期・毎回自動実行'],
          ['スキル', '/migrate, /deploy, /company', '必要時に呼び出し。判断を伴う処理'],
          ['スクリプト', 'sync-skills.sh, sync-registry.sh', 'SSOT → 派生の一方向同期'],
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
        <Principle title="時間帯適応型UI" body="朝=計画（スケジュール先頭）、昼=実行（メモ先頭）、夜=振り返り（達成感先頭）。同じ画面を24時間出さない。" color="var(--accent)" />
        <div className="g2" style={{ marginBottom: 12, marginTop: 12 }}>
          <MiniCard title="ブランクページ問題" body="白紙のテキストエリアは書けない。時間帯+カレンダーから文脈プロンプトを動的生成。白紙より3-5倍の入力完了率。" />
          <MiniCard title="ポジティブファースト" body="夜は完了タスクを先に見せる。未完了は「明日に持ち越す?」と穏やかに。ピーク・エンドの法則。" />
          <MiniCard title="ファーストビュー3セクション" body="モバイルでスクロールなしに最重要情報だけ。8セクション全表示はスクロール疲れ。" />
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
          ['ナレッジ昇格', '修正指示→memory→2回目でKB→3回目でCLAUDE.md', 'memory/ → knowledge_base → CLAUDE.md'],
          ['Growth Chronicle', '失敗→記録→パターン→ルール化→再発防止', 'growth_events'],
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

      <Section title="部署連携">
        <P>パイプラインA（新機能開発）の流れ:</P>
        <div className="card" style={{ padding: 14, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 2, whiteSpace: 'pre', overflowX: 'auto', color: 'var(--text2)' }}>
{`Step 1 [並列]: リサーチ ∥ UXデザイン
Step 2 [並列]: AI開発(設計) ∥ PM(チケット) ← checkpoint
Step 3 [直列]: システム開発(実装) → QA(テスト)
完了: 成果物登録 + commit + 報告`}
        </div>
        <P>ハンドオフ: 部署の成果物に「→ PM部への依頼」等があると秘書が自動検出して次の部署を起動。</P>
      </Section>

      <Section title="ops部署 — 仕組みの仕組み">
        <Tbl headers={['検出トリガー', 'opsのアクション']} rows={[
          ['手動操作の発生', 'スクリプト or スキル化'],
          ['同じ修正が2回', 'ルール追加を提案'],
          ['CLAUDE.md肥大化', 'スキル or rules/ に分離'],
          ['知識の分散', 'SSOTを決めて統合'],
        ]} />
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
        → OpenAI API (gpt-5-nano, reasoning_effort=low)
          → JSON response
            → ブラウザで処理・表示・DB保存`}
        </div>
        <Tbl headers={['設定', '値', '理由']} rows={[
          ['モデル', 'gpt-5-nano', 'コスト最小。reasoning model なので分析系に強い'],
          ['reasoning_effort', 'low', 'minimal だと出力が空になるケースがあった'],
          ['max_completion_tokens', '8000', 'reasoning + output の合計。少ないとreasoning に消費されて出力空に'],
          ['temperature', '(デフォルト1)', 'gpt-5-nano は temperature カスタム非対応'],
        ]} />
      </Section>

      <Section title="AI機能一覧（7機能）">
        <AiFeatureCard
          name="1. 感情分析"
          trigger="日記を投稿したとき（自動）"
          input="日記本文テキスト"
          model="gpt-5-nano (completion mode)"
          pipeline="日記テキスト → system: Plutchik 8感情+Russell+PERMA+V の分析指示 → JSON応答 → パース → DB保存"
          output="Plutchik 8感情(0-100), Russell valence/arousal(-1~1), PERMA+V(0-10), WBI(0-10), summary(1文)"
          storage="emotion_analysis テーブル + diary_entries.wbi を更新"
          hook="useEmotionAnalysis.ts"
        />

        <AiFeatureCard
          name="2. AI Partner コメント（ディープパーソナライズ）"
          trigger="Today画面表示時 + 日記投稿後に自動再生成"
          input="直近日記(5件), 感情分析(10件), WBI推移, カレンダー(今日+明日), タスク(完了+未完了), CEOインサイト, 生活リズム(prompt_log), 連続記録, 夢リスト"
          model="gpt-5-nano (completion mode)"
          pipeline="10データソース並列取得 → コンテキスト組み立て → 時間帯別プロンプト(朝/昼/夜) → AI生成 → 表示"
          output="2-3文、100字以内のパーソナライズコメント"
          storage="Zustand in-memory（キャッシュキー: 日付_timeMode、日記投稿で無効化）"
          hook="useMorningBriefing.ts"
        />

        <AiFeatureCard
          name="3. 夢進捗検出"
          trigger="日記投稿後（自動、バックグラウンド）"
          input="日記テキスト + アクティブな夢リスト(dreams テーブル)"
          model="gpt-5-nano (completion mode, jsonMode)"
          pipeline="日記テキスト+夢リスト → system: 夢との照合指示 → JSON応答 → confidence medium以上をフィルタ → toast通知"
          output='[{dream_id, confidence: "high"|"medium", reason}]'
          storage="表示のみ（toast通知）。DBには保存しない"
          hook="useDreamDetection.ts"
        />

        <AiFeatureCard
          name="4. 週次ナラティブ"
          trigger="Weeklyページで「生成」ボタン押下"
          input="1週間分の日記, 感情分析, 完了タスク, ゴール進捗, 習慣達成率"
          model="gpt-5-nano (completion mode)"
          pipeline="週の全データ並列取得 → 統計算出(平均WBI, 優勢感情, 習慣達成率) → AI生成(200-300字ナラティブ) → DB保存"
          output="200-300字の振り返りナラティブ + stats(diary_count, task_count, avg_wbi, dominant_emotion)"
          storage="weekly_narratives テーブル"
          hook="useWeeklyNarrative.ts"
        />

        <AiFeatureCard
          name="5. 自己分析（6種類）"
          trigger="Self Analysisページで分析ボタン押下（日記件数でアンロック）"
          input="日記(30-80件), タスク実績, 感情分析データ, 夢リスト（分析タイプにより異なる）"
          model="gpt-5-nano (completion mode, jsonMode)"
          pipeline="分析タイプ別にデータ収集 → タイプ別プロンプト → JSON応答 → DB保存 → 可視化"
          output="MBTI推定, Big5スコア, 強み分析, ストレングスファインダーTop5, 感情トリガー, 価値観分析"
          storage="self_analysis テーブル(analysis_type, result JSON, summary, data_count)"
          hook="useSelfAnalysis.ts"
        />

        <AiFeatureCard
          name="6. AI チャット（エージェントループ）"
          trigger="AI Chatページでメッセージ送信"
          input="ユーザーメッセージ + 会話履歴(20件) + パーソナライゼーション(KB,日記,インサイト)"
          model="gpt-5-nano / gpt-5-mini / gpt-5（自動 or ユーザー選択）"
          pipeline="SSEストリーミング。while(tool_call)ループ: LLM応答→ツール実行→結果をLLMに返す→繰り返し"
          output="ストリーミングテキスト + ツール実行結果（タスク検索/作成, ナレッジ検索, Web検索 等）"
          storage="conversations + messages テーブル。cost_tracking でトークン消費記録"
          hook="legacy.ts (renderChat) → ai-agent Edge Function (agentLoop)"
        />

        <AiFeatureCard
          name="7. ニュース収集"
          trigger="Reportsページで収集ボタン / HOME画面の一言生成"
          input="トピックリスト(AI/LLM, Snowflake等) + ユーザー関心度(interest_score)"
          model="gpt-5-nano (completion mode)"
          pipeline="関心度高いトピック抽出 → AI にニュース生成依頼 → JSON配列パース → news_items テーブルに保存"
          output="[{title, summary, url, source, topic, date}] の配列"
          storage="news_items テーブル + activity_log"
          hook="legacy.ts (collectNews) / Reports.tsx"
        />
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
          ['insights_read', 'CEOインサイト（行動パターン等）', 'ceo_insights テーブル'],
          ['activity_search', 'アクティビティログ検索', 'activity_log テーブル'],
          ['intelligence_read', '最新ニュース/レポート', 'news_items テーブル'],
          ['web_search', 'Web検索（外部API）', 'Brave Search API'],
        ]} />
        <P>安全設計: web_search 使用後は write系ツール(tasks_create)をブロック。間接プロンプトインジェクション対策。</P>
      </Section>

      <Section title="ナレッジ体系 — データ・ナレッジ・暗黙知">
        <P>rikyuプロジェクトのナレッジ分類モデルを宮路HDに適用。全ての知識を「形式化度」と「機能（How/What）」の2軸で整理。</P>

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
        <Tbl headers={['レベル', '名称', '状態', '宮路HDでの例', '蓄積場所']} rows={[
          ['C1 形式知', 'コードとして計算可能', 'ルール化・自動実行される', 'CLAUDE.md, rules/, Hooks, Edge Function', 'Git + 全セッション自動適用'],
          ['C2 言語知', '言語化済みだが未構造化', '記録されているが手動適用', 'knowledge_base, memory/, design-philosophy.md', 'Supabase + ファイル'],
          ['C3 暗黙知', '言語化困難、経験的', '社長の頭の中にしかない', '下記 TK-001〜008 参照', '日記・行動ログから間接抽出'],
        ]} />

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>暗黙知（TK）の一覧 — 形式化の状態</div>
        <P>社長の頭の中にある知識のうち、システムがまだ完全には捕捉できていないもの。日記・行動ログから間接的に抽出を試みている。</P>
        <Tbl headers={['ID', '暗黙知', '現在の捕捉方法', '形式化状態']} rows={[
          ['TK-001', '「今日は調子がいい/悪い」の身体感覚', 'diary + emotion_analysis → WBI推移', '部分捕捉。気分ログ(Level 0)で改善予定'],
          ['TK-002', '「このPJは今が勝負時」の事業判断', 'prompt_log の頻度・集中度から推定', '間接推定。CEOインサイトで検出'],
          ['TK-003', '「この人との関係性」の対人感覚', 'diary の人名・感情パターンから抽出', '間接推定。emotion_triggers分析'],
          ['TK-004', '「朝型/夜型」「集中できる時間帯」', 'prompt_log timestamps → 生活リズム分析', '定量化済み。AI Partner コメントに反映'],
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
「調子悪い」と感じる     →  WBI 4.2 と数値化           →  AI Partner が体調に言及

修正指示を出す          →  memory/ に feedback記録    →  knowledge_base (confidence↑)
「pytest使って」         →  KB: "テストはpytest"        →  CLAUDE.md に昇格 (自動適用)

失敗する               →  growth_events に記録       →  design-philosophy.md に教訓
「RLS忘れた」           →  パターン検出               →  rules/ にチェックリスト化

夢を思いつく            →  dreams テーブル             →  goal分解 → weekly task化
「本を出版したい」       →  夢進捗検出が日記を照合      →  「この経験が夢に近づいている」`}
        </div>

        <div className="section-title" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>データ・ナレッジ・暗黙知の定義</div>
        <Tbl headers={['区分', '定義', '特徴', '宮路HDでの例']} rows={[
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
          ['self_analysis', 'analysis_type, result(JSON), summary', 'ナレッジ（蓄積データから生成）'],
          ['weekly_narratives', 'narrative, stats(JSON)', 'ナレッジ（週次集約）'],
          ['knowledge_base', 'category, rule, reason, confidence', 'ナレッジ → 形式知（昇格時）'],
          ['ceo_insights', 'category, insight, evidence', 'ナレッジ（暗黙知の間接抽出）'],
          ['growth_events', 'what_happened, root_cause, countermeasure', 'ナレッジ（事例パターン）'],
          ['prompt_log', 'prompt, context, tags, created_at', 'データ（生ログ）'],
          ['tasks', 'title, status, priority, completed_at', 'データ（行動記録）'],
          ['dreams', 'title, category, status, priority', 'ナレッジ（暗黙知の言語化）'],
          ['goals', 'title, level, progress, dream_id', 'ナレッジ（夢の形式化）'],
          ['conversations / messages', 'role, content, tool_calls', 'データ（対話ログ）'],
          ['cost_tracking', 'model, tokens, total_cost', 'データ（運用メトリクス）'],
        ]} />
      </Section>
    </>
  )
}

// ========== Main ==========

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'ai', label: 'AI Features' },
  { key: 'philosophy', label: 'Design Philosophy' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'operations', label: 'Operations' },
] as const

type TabKey = typeof TABS[number]['key']

export function HowItWorks() {
  const [tab, setTab] = useState<TabKey>('overview')

  return (
    <div className="page">
      <PageHeader title="How it Works" description="なぜこの仮想カンパニーは回り続けるのか" />

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

      {tab === 'overview' && <TabOverview />}
      {tab === 'ai' && <TabAiFeatures />}
      {tab === 'philosophy' && <TabDesignPhilosophy />}
      {tab === 'architecture' && <TabArchitecture />}
      {tab === 'operations' && <TabOperations />}
    </div>
  )
}
