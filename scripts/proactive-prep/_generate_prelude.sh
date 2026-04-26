#!/bin/bash
# _generate_prelude.sh <DECISION_JSON>
#
# Claude CLI で proactive prelude の本文を生成する。
# kind に応じてプロンプトを切り替える。出力は JSON {body, hint, conclusion}。
#
# 設計原則 (silence-first を壊さない):
#   - 本文 (body) は 1〜2文・最大 60 文字程度。催促・命令・評価をしない
#   - hint は省略可。出すなら本文より薄く（補足・参考の位置づけ）
#   - 「がんばれ」「すべき」「した方がいい」は禁止語
#   - 主語は「あなた」より自然な無主語が望ましい
#   - 過去の自分の言葉に触れる場合は「前に書いていたこと」程度の柔らかさ

set -uo pipefail

DECISION="${1:-}"
if [ -z "$DECISION" ] || [ "$DECISION" = "{}" ]; then
  echo "{}"
  exit 0
fi

KIND=$(echo "$DECISION" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('kind') or '')
except Exception:
    print('')
")

if [ -z "$KIND" ]; then
  echo "{}"
  exit 0
fi

CTX=$(echo "$DECISION" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ctx = d.get('context') or {}
print(json.dumps(ctx, ensure_ascii=False))
")

MODEL="${PREP_CLI_MODEL:-haiku}"

# kind 別のプロンプト断片
case "$KIND" in
  silence_acknowledge)
    KIND_GUIDE='今日は「silence_acknowledge」。前回の日記から数日空いている。「居ますよ」「待ってない」と感じさせる短い前奏。催促・心配・評価をしない。空白を否定的に扱わない。'
    ;;
  schedule_softener)
    KIND_GUIDE='今日は「schedule_softener」。予定が詰まっている日への前奏。タスク追加でも応援でもなく「余白」を差し出す。「合間に深呼吸」みたいな具体動作はOKだが命令はしない。'
    ;;
  pattern_echo)
    KIND_GUIDE='今日は「pattern_echo」。前日と似たテーマが直近にあった。過去の自分の言葉に「前に書いていたこと」として触れる。引用ではなく「思い出した」程度の柔らかさで。'
    ;;
  gentle_prelude)
    KIND_GUIDE='今日は「gentle_prelude」。前夜の日記から自然に今日へ橋を架ける。前夜の感覚を1つ拾って「ここから始めますか」程度の入口を差し出す。'
    ;;
  *)
    echo "{}"
    exit 0
    ;;
esac

PROMPT=$(cat <<PROMPT_EOF
あなたは focus-you の Today 画面に表示される「前奏 (proactive prelude)」を書きます。

# 鉄則 (silence-first 維持のため絶対)
- 本文 (body) は日本語 1〜2文。最大 60文字程度
- 催促・命令・評価・心配を一切書かない
- 禁止語: 「頑張れ」「すべき」「した方がいい」「大丈夫？」「心配」「遅れている」
- 主語は無主語が好ましい。必要なら「あなた」
- 「気づいたら準備されている」差し出し型。読み手が動かなくても良い
- 装飾・絵文字・引用符は使わない
- 評価・診断はしない（「疲れているね」「忙しいね」も評価扱い）

# 種別ガイド
${KIND_GUIDE}

# 文脈 (JSON)
${CTX}

# 出力フォーマット (JSON 1行のみ。前後の説明文・コードフェンス禁止)
{"body": "本文", "hint": "補足 or null", "conclusion": "なぜ今この前奏を置いたかを1文で"}

例:
{"body": "昨日のあの感覚、もう少しだけ眺めても良いかもしれません。", "hint": null, "conclusion": "前夜の日記から自然な橋を架ける"}
PROMPT_EOF
)

# Claude CLI 呼び出し（--print = 非対話モード）
RAW=$(echo "$PROMPT" | claude --print --model "$MODEL" 2>/dev/null || echo "")

if [ -z "$RAW" ]; then
  echo "{}"
  exit 0
fi

# JSON 抽出（モデルが余計な説明を付けた場合に備えて最初の {...} を取り出す）
CLEAN=$(echo "$RAW" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
m = re.search(r'\{[^{}]*\"body\"[\s\S]*?\}', raw)
if not m:
    print('{}')
    sys.exit(0)
try:
    obj = json.loads(m.group(0))
except Exception:
    print('{}')
    sys.exit(0)
body = (obj.get('body') or '').strip()
hint = obj.get('hint')
conclusion = (obj.get('conclusion') or '').strip()
if not body or not conclusion:
    print('{}')
    sys.exit(0)
# 本文の長さガード（60字超は切る）
if len(body) > 80:
    body = body[:78] + '…'
print(json.dumps({'body': body, 'hint': hint if hint else None, 'conclusion': conclusion}, ensure_ascii=False))
")

echo "${CLEAN:-{}}"
