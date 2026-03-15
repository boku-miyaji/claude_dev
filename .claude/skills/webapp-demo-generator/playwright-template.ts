/**
 * Playwright デモ録画テンプレート
 *
 * 使い方:
 *   1. TODO コメントの箇所を実際の値に置き換える
 *   2. npx playwright test demo-record.spec.ts --headed で実行確認
 *   3. 録画を有効にして npx playwright test demo-record.spec.ts で録画
 *
 * 前提:
 *   - @playwright/test がインストール済み
 *   - 対象アプリがローカルまたはステージングで起動済み
 */

import { test, expect, type Page } from "@playwright/test"

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 設定
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONFIG = {
  /** 対象アプリのベースURL */
  baseUrl: process.env.DEMO_BASE_URL || "http://localhost:3000", // TODO: 実際のURLに置換

  /** ログイン情報（環境変数から取得） */
  username: process.env.DEMO_USERNAME || "", // TODO: テストアカウント設定
  password: process.env.DEMO_PASSWORD || "", // TODO: テストアカウント設定

  /** 画面サイズ */
  viewport: { width: 1440, height: 900 },

  /** 操作間の待機時間（視聴者が画面を追えるように） */
  stepDelay: 1500,

  /** アニメーション/ローディング待機の最大時間 */
  maxWait: 30_000,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 操作ログ（字幕生成用） */
const operationLog: Array<{ timestamp: number; action: string; description: string }> = []
let recordingStartTime = 0

/** 操作を記録しつつ待機 */
async function step(page: Page, description: string, action: () => Promise<void>) {
  const elapsed = Date.now() - recordingStartTime
  operationLog.push({ timestamp: elapsed, action: "step", description })

  await action()
  await page.waitForLoadState("networkidle").catch(() => {})
  await page.waitForTimeout(CONFIG.stepDelay)
}

/** 字幕ファイル (SRT) を生成 */
function generateSrt(): string {
  return operationLog
    .map((entry, i) => {
      const start = formatSrtTime(entry.timestamp)
      const end = formatSrtTime(
        i + 1 < operationLog.length
          ? operationLog[i + 1].timestamp
          : entry.timestamp + 5000
      )
      return `${i + 1}\n${start} --> ${end}\n${entry.description}\n`
    })
    .join("\n")
}

function formatSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const msRem = ms % 1000
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(msRem)}`
}

function pad(n: number): string { return n.toString().padStart(2, "0") }
function pad3(n: number): string { return n.toString().padStart(3, "0") }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// デモシナリオ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test.describe("Demo Recording", () => {
  test.use({
    viewport: CONFIG.viewport,
    video: { mode: "on", size: CONFIG.viewport },
    launchOptions: { slowMo: 200 },
  })

  test("Full demo scenario", async ({ page }) => {
    recordingStartTime = Date.now()

    // ── Step 1: ログイン ──
    await step(page, "アプリにログインします", async () => {
      await page.goto(CONFIG.baseUrl)
      // TODO: ログインフォームのセレクタを実際のものに置換
      // await page.fill('[name="username"]', CONFIG.username)
      // await page.fill('[name="password"]', CONFIG.password)
      // await page.click('button[type="submit"]')
      await page.waitForLoadState("networkidle")
    })

    // ── Step 2: メイン画面表示 ──
    await step(page, "メイン画面が表示されます", async () => {
      // TODO: メイン画面のロード完了を確認するセレクタ
      // await page.locator('[data-testid="main-content"]').waitFor()
      await page.waitForTimeout(1000)
    })

    // ── Step 3: 機能操作 ──
    await step(page, "機能Aを操作します", async () => {
      // TODO: 実際の操作に置換
      // await page.click('[data-testid="feature-a-button"]')
      // await page.locator('[data-testid="feature-a-result"]').waitFor()
    })

    // ── Step 4: 結果確認 ──
    await step(page, "結果を確認します", async () => {
      // TODO: 結果画面の確認
    })

    // ── 字幕ファイル出力 ──
    const srt = generateSrt()
    const fs = await import("fs")
    fs.writeFileSync("output/demo-subtitles.srt", srt, "utf-8")
    console.log("SRT file generated: output/demo-subtitles.srt")
    console.log("Operation log:", JSON.stringify(operationLog, null, 2))
  })
})
