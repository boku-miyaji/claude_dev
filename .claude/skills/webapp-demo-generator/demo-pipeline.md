# Demo Video Generation Pipeline

ローカル実行からCI運用までの標準フロー。

## Phase 1: ローカル MVP（まずこれを動かす）

### 前提

```bash
node -v  # v20+
npx playwright --version  # installed
ffmpeg -version  # installed
```

### ディレクトリ構成

```
demo/
├── scenarios/
│   └── main-demo.spec.ts    # Playwright シナリオ
├── output/
│   ├── raw/                  # 録画された生動画
│   ├── subtitles/            # 生成された字幕 (SRT)
│   ├── narration/            # ナレーション音声 (MP3)
│   └── final/                # 合成済み最終動画
├── scripts/
│   ├── generate-subtitles.ts # 操作ログ → SRT 変換
│   ├── generate-narration.ts # TTS 生成（任意）
│   └── mux.sh                # ffmpeg 合成スクリプト
├── playwright.config.ts
├── package.json
└── .env                      # 認証情報（gitignore対象）
```

### 実行手順

```bash
# 1. セットアップ
cd demo
npm install
npx playwright install chromium

# 2. アプリ起動（別ターミナル）
cd ../server && npm run dev

# 3. デモ録画
npx playwright test scenarios/main-demo.spec.ts

# 4. 字幕生成
npx tsx scripts/generate-subtitles.ts

# 5. 動画合成
bash scripts/mux.sh
```

### ffmpeg 合成コマンド（mux.sh の中身）

```bash
#!/bin/bash
set -euo pipefail

INPUT="output/raw/demo.webm"
SUBTITLE="output/subtitles/demo.srt"
OUTPUT="output/final/demo.mp4"

mkdir -p output/final

# 字幕焼き込み + MP4変換
ffmpeg -y \
  -i "$INPUT" \
  -vf "subtitles=$SUBTITLE:force_style='FontSize=22,FontName=Noto Sans JP,PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,MarginV=40'" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  "$OUTPUT"

echo "Generated: $OUTPUT"
```

### 字幕なし版（外部字幕ファイル添付の場合）

```bash
ffmpeg -y \
  -i output/raw/demo.webm \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  output/final/demo-nosub.mp4
```

---

## Phase 2: npm scripts 統合

### package.json

```json
{
  "scripts": {
    "demo:record": "npx playwright test scenarios/main-demo.spec.ts",
    "demo:subtitles": "npx tsx scripts/generate-subtitles.ts",
    "demo:narration": "npx tsx scripts/generate-narration.ts",
    "demo:mux": "bash scripts/mux.sh",
    "demo:all": "npm run demo:record && npm run demo:subtitles && npm run demo:mux",
    "demo:clean": "rm -rf output/raw/* output/subtitles/* output/final/*"
  }
}
```

### 実行

```bash
npm run demo:all
# → output/final/demo.mp4 が生成される
```

---

## Phase 3: GitHub Actions 自動化

### .github/workflows/demo-video.yml

```yaml
name: Generate Demo Video

on:
  workflow_dispatch:
    inputs:
      scenario:
        description: 'Demo scenario to run'
        required: false
        default: 'main-demo'
  # PRごとに自動生成する場合:
  # pull_request:
  #   types: [opened, synchronize]

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd demo
          npm ci
          npx playwright install --with-deps chromium

      - name: Install ffmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Start app
        run: |
          cd server
          npm ci
          npm run build
          npm start &
          sleep 5
        env:
          NODE_ENV: production

      - name: Record demo
        run: cd demo && npm run demo:all
        env:
          DEMO_BASE_URL: http://localhost:3000
          DEMO_USERNAME: ${{ secrets.DEMO_USERNAME }}
          DEMO_PASSWORD: ${{ secrets.DEMO_PASSWORD }}

      - name: Upload video
        uses: actions/upload-artifact@v4
        with:
          name: demo-video-${{ github.sha }}
          path: demo/output/final/*.mp4
          retention-days: 30
```

### Secrets 設定

| Secret | 用途 |
|--------|------|
| `DEMO_USERNAME` | テストアカウントのユーザー名 |
| `DEMO_PASSWORD` | テストアカウントのパスワード |

---

## Phase 4: 拡張案

### 複数シナリオ対応

```
demo/scenarios/
├── 01-onboarding.spec.ts
├── 02-daily-workflow.spec.ts
├── 03-ai-features.spec.ts
└── 04-admin-tools.spec.ts
```

各シナリオに対応する字幕・ナレーションを個別生成し、最後に結合:

```bash
ffmpeg -y \
  -i output/final/01.mp4 \
  -i output/final/02.mp4 \
  -i output/final/03.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" \
  output/final/full-demo.mp4
```

### TTS ナレーション統合

```typescript
// scripts/generate-narration.ts
import OpenAI from "openai"
import fs from "fs"

const openai = new OpenAI()

async function generateNarration(text: string, outputPath: string) {
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: "nova",
    input: text,
  })
  const buffer = Buffer.from(await mp3.arrayBuffer())
  fs.writeFileSync(outputPath, buffer)
}
```

### PR コメントに動画リンクを自動投稿

```yaml
- name: Comment on PR
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: `## Demo Video\nGenerated demo: [Download](${artifactUrl})`
      })
```

---

## トラブルシューティング

| 症状 | 原因 | 対策 |
|------|------|------|
| 録画が真っ黒 | headless で GPU レンダリングが効かない | `--headed` で実行、または `--disable-gpu` フラグ |
| ローディングで止まる | `waitForLoadState` がタイムアウト | `networkidle` → `domcontentloaded` に変更 |
| 字幕がズレる | 操作速度と字幕タイミングの不一致 | `stepDelay` を調整、SRT を手動微調整 |
| ffmpeg エラー | フォント未インストール | `apt install fonts-noto-cjk` |
| 認証に失敗する | 環境変数未設定 | `.env` ファイル確認、CI では Secrets 確認 |
| 動画が大きすぎる | CRF値が低い | `-crf 28` に上げる（画質とのトレードオフ） |
