#!/bin/bash
set -euo pipefail

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# デモ動画合成テンプレート（drawtext フィルタ方式）
#
# 前提:
#   - ffmpeg + jq がインストール済み
#   - output/raw/ に Playwright 録画 (.webm)
#   - output/subtitles/timeline.json に字幕タイミングデータ
#
# カスタマイズ:
#   - LABEL_COLOR: ラベル背景色（ブランドに合わせて変更）
#   - BAR_ALPHA: 下部バーの透明度
#   - LABEL_W / LABEL_H: ラベルBOXの固定サイズ
#   - FONT: 日本語フォントのパス
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEMO_DIR="$(dirname "$SCRIPT_DIR")"
RAW_DIR="$DEMO_DIR/output/raw"
FINAL_DIR="$DEMO_DIR/output/final"
TIMELINE="$DEMO_DIR/output/subtitles/timeline.json"

# TODO: 環境に合わせてフォントパスを設定
FONT="/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

mkdir -p "$FINAL_DIR"

VIDEO=$(find "$RAW_DIR" -name "*.webm" -type f | head -1)
if [ -z "$VIDEO" ]; then
  echo "ERROR: 録画ファイルが見つかりません: $RAW_DIR/"
  exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# レイアウト定数（ここを変更してカスタマイズ）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 左上ラベル
LABEL_X=15
LABEL_Y=10
LABEL_W=460         # 固定幅
LABEL_H=65          # 固定高さ
LABEL_COLOR="0x1a365d"  # 濃紺 (navy)
# 他の選択肢:
#   LABEL_COLOR="black"       # 黒（シネマティック）
#   LABEL_COLOR="0x005a2e"    # 深緑（りそな等）
#   LABEL_COLOR="0x0052cc"    # 青（テック系）
LABEL_ALPHA=0.95
LABEL_FONTSIZE=36

# 下部字幕バー
BAR_Y=830
BAR_H=70
BAR_COLOR="black"
BAR_ALPHA=0.7
BAR_FONTSIZE=28

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 字幕なし版
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "[1/2] Generating: demo-nosub.mp4"
ffmpeg -y -i "$VIDEO" \
  -c:v libx264 -preset medium -crf 23 \
  -movflags +faststart \
  "$FINAL_DIR/demo-nosub.mp4" 2>/dev/null

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# timeline.json → drawtext フィルタチェーン
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ ! -f "$TIMELINE" ]; then
  echo "WARN: timeline.json が見つかりません"
  cp "$FINAL_DIR/demo-nosub.mp4" "$FINAL_DIR/demo.mp4"
  exit 0
fi

echo "[2/2] Generating: demo.mp4 (with overlays)"

FILTERS=""

while IFS= read -r line; do
  START=$(echo "$line" | jq -r '.start')
  END=$(echo "$line" | jq -r '.end')
  TEXT=$(echo "$line" | jq -r '.text')
  KIND=$(echo "$line" | jq -r '.kind')

  ESCAPED=$(echo "$TEXT" | sed "s/:/\\\\:/g" | sed "s/'/\\\\'/g")

  if [ "$KIND" = "label" ]; then
    FILTERS="${FILTERS},drawbox=x=${LABEL_X}:y=${LABEL_Y}:w=${LABEL_W}:h=${LABEL_H}:color=${LABEL_COLOR}@${LABEL_ALPHA}:t=fill:enable='between(t,${START},${END})'"
    FILTERS="${FILTERS},drawtext=fontfile=${FONT}:text='${ESCAPED}':fontsize=${LABEL_FONTSIZE}:fontcolor=white:x=${LABEL_X}+(${LABEL_W}-text_w)/2:y=${LABEL_Y}+(${LABEL_H}-text_h)/2:enable='between(t,${START},${END})'"
  else
    FILTERS="${FILTERS},drawbox=x=0:y=${BAR_Y}:w=iw:h=${BAR_H}:color=${BAR_COLOR}@${BAR_ALPHA}:t=fill:enable='between(t,${START},${END})'"
    FILTERS="${FILTERS},drawtext=fontfile=${FONT}:text='${ESCAPED}':fontsize=${BAR_FONTSIZE}:fontcolor=white:x=(w-text_w)/2:y=${BAR_Y}+(${BAR_H}-text_h)/2:enable='between(t,${START},${END})'"
  fi
done < <(jq -c '.[]' "$TIMELINE")

FILTERS="${FILTERS#,}"

ffmpeg -y -i "$VIDEO" \
  -vf "$FILTERS" \
  -c:v libx264 -preset medium -crf 23 \
  -movflags +faststart \
  "$FINAL_DIR/demo.mp4" 2>/dev/null

echo ""
echo "Done!"
ls -lh "$FINAL_DIR/"*.mp4
