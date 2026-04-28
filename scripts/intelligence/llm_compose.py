"""Claude CLI (opus) を使って情報収集レポートの本体を生成するモジュール。

設計:
  - 入力: フィルタ済みアイテムリスト + 動的キーワード + 対象期間ラベル
  - 出力: CLAUDE.md 準拠の Markdown（TL;DR / 各社レポート / 注目論文 / focus-you 示唆 / hd-ops 示唆 / yaml suggestions）
  - LLM は要約・示唆生成のみ担当。事実（URL, 日付, タイトル）は呼び出し側で固定し、
    LLM がハルシで日付や URL を捏造しないようにする。
  - 呼び出しは subprocess で claude CLI（CLAUDE_CODE_OAUTH_TOKEN 経由、定額プラン）

コスト原則: API 直叩きは禁止。Claude CLI のみ（CLAUDE.md コスト分離原則）。
"""
from __future__ import annotations

import json
import logging
import subprocess
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

CLAUDE_MODEL_DEFAULT = "claude-opus-4-7"
CLAUDE_TIMEOUT_SEC = 600

SYSTEM_PROMPT = """あなたは focus-you / claude_dev / polaris-circuit を運営する個人事業主のCEO向け情報収集部です。

【最重要原則】
- 入力で渡される「収集済みアイテム」の URL・タイトル・日付は変更禁止。あなたの知識から URL や日付を補完してはいけない。
- 入力に含まれない論文・記事・リリースを追加してはいけない。
- 該当アイテムが少ない場合は無理に膨らませず、「特筆すべき新規情報なし」と書いてよい。

【出力形式】（必ずこの構造で Markdown を出力）

# 情報収集レポート - {date} ({day_of_week})

**対象期間**: {window_label}
**収集アイテム数**: {n_items}

---

## TL;DR
（最重要トピック 3 つを 1 行ずつ。提供されたアイテムの中から選ぶ）

---

## 🏢 各社レポート・発表
（official_blog アイテムを企業別にグルーピング。各エントリは: タイトル(リンク)、公開日、要約2-3行、So-What 1行）

## 📄 注目論文
（arxiv アイテム。各エントリ: タイトル(リンク)、(arxiv_id, 公開日)、背景・手法・主要結果、focus-you / hd-ops への示唆 1行）

## 🎯 あなたの関心から（プロンプト分析）
（直近のプロンプトキーワードに関連する内容があればここで触れる。なければセクションごと省略）

---

## 💡 focus-you への示唆

### 取り入れるべき
（具体・対象ファイル・工数）

### 検討に値する

### 既にやっていることの裏付け

## 💡 宮路HD 運営への示唆

### 取り入れるべき
### 検討に値する
### 既にやっていることの裏付け

---

```yaml
# suggestions
suggestions:
  - title: "..."
    description: "..."
    priority: high|medium|low
    effort: small|medium|large
    category: algorithm|architecture|ux|cost|competition|design|other
    target: focus-you|hd-ops|both
    source_urls:
      - https://...
```

【出力時の禁止事項】
- 入力にない URL を生成しない
- 入力にない日付を生成しない
- 推測で「〜と思われる」とは書かない（推測する場合は明示）
- 絵文字を本文中で過剰に使わない（セクション見出しの🏢📄🎯💡のみ）
"""


def _items_to_context(items: list[dict], dynamic_keywords: list[str]) -> str:
    """アイテム + キーワードを LLM に渡す JSON 文脈に整形する。

    LLM 側で知識から補完しないよう、事実情報を JSON で固定して渡す。
    """
    payload = {
        "dynamic_keywords": dynamic_keywords,
        "items": items,
    }
    # ensure_ascii=False で日本語を維持。tokens 削減のため indent=None
    return json.dumps(payload, ensure_ascii=False, default=str)


def compose_report_markdown(
    *,
    items: list[dict],
    dynamic_keywords: list[str],
    window_label: str,
    n_items: int,
    target_date: datetime,
    model: str = CLAUDE_MODEL_DEFAULT,
) -> str | None:
    """Claude CLI を呼び出して Markdown レポート本体を生成する。

    返り値: stdout（Markdown 全文）。失敗時は None。
    呼び出し側はこれをファイルに保存する。
    """
    day_of_week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][target_date.weekday()]
    user_prompt = f"""【対象日】 {target_date.strftime('%Y-%m-%d')} ({day_of_week})
【対象期間ラベル】 {window_label}
【収集アイテム数】 {n_items}

【収集済みアイテム + 動的キーワード（JSON）】
{_items_to_context(items, dynamic_keywords)}

上記の事実のみを使って、システムプロンプトの構造で Markdown を出力してください。
URL・日付・タイトルは入力のものをそのまま使い、改変しないこと。"""

    try:
        proc = subprocess.run(
            [
                "claude",
                "--print",
                "--model",
                model,
                "--append-system-prompt",
                SYSTEM_PROMPT,
            ],
            input=user_prompt,
            capture_output=True,
            text=True,
            timeout=CLAUDE_TIMEOUT_SEC,
        )
    except FileNotFoundError:
        logger.error("claude CLI が見つかりません")
        return None
    except subprocess.TimeoutExpired:
        logger.error("claude CLI タイムアウト (%ds)", CLAUDE_TIMEOUT_SEC)
        return None

    if proc.returncode != 0:
        logger.error("claude CLI 失敗 rc=%s stderr=%s", proc.returncode, proc.stderr[:500])
        return None

    output = proc.stdout.strip()
    if not output or len(output) < 200:
        logger.error("claude CLI 出力が短すぎる: %d bytes", len(output))
        return None
    return output


def fetch_dynamic_keywords(supabase_url: str, anon_key: str, ingest_key: str = "") -> list[str]:
    """prompt_log の直近7日から動的キーワードを抽出する。

    Management API SQL を使って生成（access_token がない環境では空 list）。
    呼び出し側で SUPABASE_ACCESS_TOKEN がない場合はスキップする想定。
    """
    import os

    access_token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    project_ref = os.environ.get("SUPABASE_PROJECT_REF", "akycymnahqypmtsfqhtr")
    if not access_token:
        return []

    import requests as rq

    query = (
        "SELECT prompt FROM prompt_log "
        "WHERE created_at > now() - interval '7 days' "
        "ORDER BY created_at DESC LIMIT 50"
    )
    try:
        resp = rq.post(
            f"https://api.supabase.com/v1/projects/{project_ref}/database/query",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"query": query},
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        rows = resp.json() or []
    except Exception:
        return []

    if not rows:
        return []

    # シンプルな単語頻度抽出（LLM に投げる前に prompt_log から候補ワードを出す）
    # 高度な NLP は不要。LLM 側で関連性判定する。
    from collections import Counter
    import re

    # 英数字 + 日本語の単語を抽出
    pattern = re.compile(r"[A-Za-z][A-Za-z0-9_-]{2,}|[ぁ-んァ-ヶ一-龯々ー]{2,}")
    counter: Counter = Counter()
    for r in rows:
        prompt = r.get("prompt") or ""
        if not isinstance(prompt, str):
            continue
        for w in pattern.findall(prompt):
            wl = w.lower() if w[0].isascii() else w
            counter[wl] += 1

    # 頻度上位 + ノイズ除去（過度に一般的な単語を除外）
    STOPWORDS = {
        "the", "and", "for", "you", "this", "that", "from", "with", "have",
        "about", "what", "when", "where", "which", "would", "could", "should",
        "した", "する", "して", "ます", "です", "ある", "ない", "なる", "いる",
        "company", "claude", "ファイル", "コード",  # 自明なものは除く
    }
    filtered = [(w, c) for w, c in counter.most_common(30) if w not in STOPWORDS and c >= 2]
    # トップ 8 個
    return [w for w, _ in filtered[:8]]


def collect_previous_urls(reports_dir: Path, lookback_days: int = 30) -> set[str]:
    """過去レポートの JSON から既出 URL の集合を作る（重複除外用）。"""
    from datetime import timedelta

    if not reports_dir.exists():
        return set()
    cutoff = datetime.now() - timedelta(days=lookback_days)
    urls: set[str] = set()

    for jp in reports_dir.glob("*.json"):
        try:
            mtime = datetime.fromtimestamp(jp.stat().st_mtime)
            if mtime < cutoff:
                continue
            with open(jp, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue

        # 新スキーマ: items[*].url。旧スキーマ: collections[*].results[*].url
        for it in data.get("items", []) or []:
            u = (it.get("url") or "").rstrip("/")
            if u:
                urls.add(u)
        for coll in data.get("collections", []) or []:
            for r in coll.get("results", []) or []:
                u = (r.get("url") or "").rstrip("/")
                if u:
                    urls.add(u)

    return urls
