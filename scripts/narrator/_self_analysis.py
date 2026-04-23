#!/usr/bin/env python3
"""Self Analysis (batch): run framework analyses (MBTI, Big5, etc.).

Trigger condition (per type):
  - No previous analysis exists → run immediately
  - diary_entries total count grew by 10+ since last analysis → run
  - Last analysis is 7+ days old AND any new entries → run

Skip guards (per type):
  - Last analysis < 7 days ago → skip
  - Diary count delta < 10 since last analysis → skip

Runs via Claude Code CLI on GitHub Actions (flat-rate plan, no API billing).
"""
from __future__ import annotations

import json
import sys

import _lib

ANALYSIS_TYPES = [
    "mbti",
    "big5",
    "strengths_finder",
    "values",
    "stress_resilience",
    "communication_style",
    "emotion_triggers",
]

MODEL = "claude-opus-4-7"
LLM_TIMEOUT = 360  # seconds per type (complex JSON output)

# ---------------------------------------------------------------------------
# Prompt builders (ported from company-dashboard/src/hooks/useSelfAnalysis.ts)
# ---------------------------------------------------------------------------

_MODE_UPDATE = """【分析モード: 更新分析】
あなたには「前回の分析結果とその根拠」+「前回以降の新しいデータ」が渡されます。
前回の結論を出発点として、新しいデータに基づいて更新・修正してください。

- 前回と一致するパターンが新データでも確認される → 確信度を上げる
- 新データで矛盾が見つかる → 結論を修正する（変化した理由も説明）
- 新データが少ない場合 → 前回の結論をほぼ維持しつつ、微調整のみ
- 最新のデータは「今の状態」を反映するので、やや重みを大きくする

changes_from_previous フィールドに、前回からの変化を具体的に記載してください。

"""

_MODE_INITIAL = """【分析モード: 初回分析】
全データが渡されます。全体を通して一貫するパターンと、時期による変化の両方に注目してください。

"""

_DATA_LITERACY = """【データソースの文脈を理解して分析すること】

1. **日記**: 本音。ただし悩みが書かれやすいバイアスあり。「なぜそれを書いたか」に注目。
2. **Claude Code指示**: AIへの業務指示。命令形は指示フォーマット。関心テーマ・時間帯が有用。
3. **AIチャット**: 自然な会話。日記と同様に本音に近い。
4. **タスク**: AI自動完了含む。内容と種類に注目。
5. **スケジュール**: 客観的な行動記録。
6. **夢・目標**: 価値観の直接的な証拠。

"""


def _chg(prev_result: dict | None) -> str:
    return ',\n  "changes_from_previous": "前回からの変化の説明"' if prev_result else ""


def _mbti_prompt(prev_result: dict | None) -> str:
    prev_note = ""
    if prev_result:
        prev_note = (
            f"\n\n【前回の分析結果】\nMBTIタイプ: {prev_result.get('type')} "
            f"({prev_result.get('type_name')})\n"
            "新しいデータからタイプや各次元スコアに変動があればchanges_from_previousに記載。"
        )
    return f"""以下のデータからMBTIタイプを推定してください。JSON形式で返してください:
{{
  "type": "INFJ",
  "type_name": "提唱者",
  "confidence": 0.75,
  "dimensions": {{
    "EI": {{"score": 70, "tendency": "I", "label": "内向"}},
    "SN": {{"score": 80, "tendency": "N", "label": "直感"}},
    "TF": {{"score": 60, "tendency": "F", "label": "感情"}},
    "JP": {{"score": 65, "tendency": "J", "label": "判断"}}
  }},
  "evidence": [
    {{"dimension": "EI", "point": "内向寄りと判断した根拠", "quote": "[日付] 日記からの直接引用"}},
    {{"dimension": "SN", "point": "直感寄りと判断した根拠", "quote": "[日付] 引用"}},
    {{"dimension": "TF", "point": "感情寄りと判断した根拠", "quote": "[日付] 引用"}},
    {{"dimension": "JP", "point": "判断寄りと判断した根拠", "quote": "[日付] 引用"}}
  ],
  "description": {{
    "core_insight": "あなたの本質を一言で表す洞察（日記の具体例を交えて）",
    "daily_patterns": "日常生活での現れ方（日記の具体的エピソードを元に）",
    "strengths_in_action": "このタイプの強みが発揮されている場面（日記から）",
    "growth_edges": "成長の余白（日記から読み取れる課題）",
    "advice": "このタイプへの具体的なアドバイス（その人の生活に即して）"
  }}{_chg(prev_result)}
}}
dimensionsのscoreは優勢な方向への度合い(50=真ん中、100=最大)。evidenceは各次元の代表的な根拠を4つ。
JSON以外は返さないでください。{prev_note}"""


def _big5_prompt(prev_result: dict | None) -> str:
    prev_note = ""
    if prev_result:
        traits = prev_result.get("traits") or {}
        parts = [f"{k}: {v.get('score')}" for k, v in traits.items()]
        prev_note = (
            f"\n\n【前回の分析結果】\nBig5スコア: {', '.join(parts)}\n"
            "新しいデータからスコアに変動があればchanges_from_previousに記載。"
        )
    return f"""以下のデータからBig5パーソナリティを分析してください。JSON形式で返してください:
{{
  "traits": {{
    "openness": {{"score": 85, "label": "開放性", "description": "この人の開放性の特徴（日記から）"}},
    "conscientiousness": {{"score": 70, "label": "誠実性", "description": "説明"}},
    "extraversion": {{"score": 35, "label": "外向性", "description": "説明"}},
    "agreeableness": {{"score": 75, "label": "協調性", "description": "説明"}},
    "neuroticism": {{"score": 55, "label": "神経症的傾向", "description": "説明"}}
  }},
  "summary": {{
    "profile_narrative": "この人のBig5プロファイルを2-3文で描写（日記の具体例を含む）",
    "trait_insights": ["特筆すべき特徴1（日記の根拠付き）", "特徴2", "特徴3"],
    "trait_interactions": "2-3つの特性の組み合わせが生む効果（例: 高開放性×高誠実性）",
    "advice": "このプロファイルへの具体的なアドバイス"
  }},
  "evidence": [
    {{"trait": "openness", "point": "根拠", "quote": "[日付] 引用"}},
    {{"trait": "conscientiousness", "point": "根拠", "quote": "[日付] 引用"}},
    {{"trait": "extraversion", "point": "根拠", "quote": "[日付] 引用"}},
    {{"trait": "agreeableness", "point": "根拠", "quote": "[日付] 引用"}},
    {{"trait": "neuroticism", "point": "根拠", "quote": "[日付] 引用"}}
  ]{_chg(prev_result)}
}}
scoreは0-100。evidenceは各特性の代表的な根拠を5つ（全特性をカバー）。
JSON以外は返さないでください。{prev_note}"""


def _strengths_finder_prompt(prev_result: dict | None) -> str:
    prev_note = ""
    if prev_result:
        top = prev_result.get("top_strengths") or []
        parts = [f"{s.get('name')}({s.get('score')})" for s in top]
        prev_note = (
            f"\n\n【前回の分析結果】\nTop5: {', '.join(parts)}\n"
            "新しいデータからTop5の順位やスコアに変動があればchanges_from_previousに記載。"
        )
    return f"""以下のデータからストレングスファインダー(CliftonStrengths)のTop5を推定してください。JSON形式で返してください:
{{
  "top_strengths": [
    {{"name": "内省", "name_en": "Intellection", "score": 92, "domain": "戦略的思考力", "evidence": [
      {{"point": "なぜこれがあなたの強みと言えるか（1つ目の根拠）", "quote": "[日付] 日記からの直接引用"}},
      {{"point": "2つ目の根拠", "quote": "[日付] 引用"}},
      {{"point": "3つ目の根拠", "quote": "[日付] 引用"}}
    ]}},
    ...5件
  ],
  "domain_summary": {{
    "strategic_thinking": {{"score": 85, "label": "戦略的思考力", "description": "この領域の説明"}},
    "relationship_building": {{"score": 60, "label": "人間関係構築力", "description": "説明"}},
    "influencing": {{"score": 45, "label": "影響力", "description": "説明"}},
    "executing": {{"score": 70, "label": "実行力", "description": "説明"}}
  }},
  "synergy": [
    {{"combo": "資質A x 資質B", "insight": "2つの資質の掛け算で生まれる力。日記の具体例も。"}}
  ],
  "blind_spot": [
    {{"point": "この強みの組み合わせが引き起こしうる盲点", "mitigation": "どう対処すればいいか"}}
  ],
  "action_plan": [
    {{"action": "明日からできる具体的アクション。この人の生活パターンに合わせた提案。", "why": "なぜ効果的か"}}
  ],
  "work_fit": ["適した仕事や役割1", "適した仕事や役割2"],
  "growth_areas": ["伸ばせる領域1", "伸ばせる領域2", "伸ばせる領域3"],
  "summary": "全体的な強みの説明と活かし方（300字以上）"{_chg(prev_result)}
}}

34資質: 達成欲,活発性,適応性,分析思考,アレンジ,信念,指令性,コミュニケーション,競争性,結合性,公平性,慎重さ,原点思考,未来志向,調和性,着想,包含,個別化,収集心,内省,学習欲,最上志向,目標志向,親密性,責任感,回復志向,自己確信,自我,戦略性,共感性,成長促進,ポジティブ,規律性,社交性
4ドメイン: 戦略的思考力(分析思考,原点思考,未来志向,着想,収集心,内省,学習欲,戦略性) / 人間関係構築力(適応性,結合性,共感性,調和性,包含,個別化,ポジティブ,親密性,成長促進) / 影響力(活発性,指令性,コミュニケーション,競争性,最上志向,自己確信,自我,社交性) / 実行力(達成欲,アレンジ,信念,公平性,慎重さ,規律性,責任感,回復志向,目標志向)

top_strengthsは5件。scoreは0-100。growth_areasは3件。synergyは2-3件。blind_spotは1-2件。action_planは3件。
各強みのevidenceは配列で3つの根拠（pointとquoteを含む）。

【バイアス補正】日記から推定する際の系統的バイアスを必ず補正すること:
- 内省・学習欲・着想・戦略性は日記を書く行為自体のバイアスで過大評価されやすい。1-2段階割り引く。
- 親密性・ポジティブ・調和性・成長促進は行動として現れるためテキストから検出しにくい。間接証拠に注目。
JSON以外は返さないでください。{prev_note}"""


def _values_prompt(prev_result: dict | None) -> str:
    prev_note = ""
    if prev_result:
        vals = prev_result.get("values") or []
        parts = [f"#{v.get('rank')} {v.get('name')}({v.get('score')})" for v in vals]
        prev_note = (
            f"\n\n【前回の分析結果】\n{', '.join(parts)}\n"
            "新しい日記から優先順位やスコアの変動があればchanges_from_previousに記載。"
        )
    return f"""以下のデータから価値観を分析してください。JSON形式で返してください:
{{
  "values": [
    {{"name": "成長", "rank": 1, "score": 95, "evidence": [
      {{"point": "なぜこの価値観がスコアXなのか、1つ目の根拠", "quote": "[日付] 日記からの直接引用"}},
      {{"point": "2つ目の根拠", "quote": "[日付] 引用"}}
    ]}},
    ...5-7件
  ],
  "tension": [
    {{"values": ["価値観A", "価値観B"], "detail": "この2つの価値観が矛盾・葛藤を起こしている場面。日記の具体例付き。", "quote": "[日付] 引用"}}
  ],
  "alignment": {{
    "aligned": [{{"value": "価値観名", "detail": "日記で語っている価値観と実際の行動が一致している例"}}],
    "gap": [{{"value": "価値観名", "stated": "日記で語っている理想", "actual": "実際の行動パターン", "detail": "ギャップの具体的な説明"}}]
  }},
  "life_question": [
    "この価値観分析から浮かぶ「あなたへの問い」。自己対話を促す深い問い。"
  ],
  "changes": "最近の価値観の変化の記述（200字以上）",
  "summary": "価値観の全体説明（300字以上）"{_chg(prev_result)}
}}
valuesは5-7件。scoreは0-100。各valueのevidenceは配列で2-3個の根拠。tensionは0-2件。life_questionは1-2個。
JSON以外は返さないでください。{prev_note}"""


def _stress_resilience_prompt(_prev_result: dict | None) -> str:
    return """日記データから、この人のストレス耐性プロファイルを分析してください。
{
  "stress_triggers": ["ストレスの引き金になるパターン3-4つ"],
  "coping_strategies": ["実際に使っている対処法3-4つ（日記から読み取れるもの）"],
  "recovery_pattern": "回復パターンの説明（1-2文）",
  "resilience_score": 7,
  "burnout_risk": "medium",
  "profile_narrative": "この人のストレス耐性を2-3文で描写"
}
burnout_riskの値: "low" | "medium" | "high"。resilience_scoreは1-10。
JSON以外は返さないでください。"""


def _communication_style_prompt(_prev_result: dict | None) -> str:
    return """日記データから、この人のコミュニケーションスタイルを分析してください。
{
  "primary_style": "analytical",
  "communication_preferences": ["好むコミュニケーション方法3つ"],
  "conflict_approach": "対立時の傾向（1文）",
  "listening_style": "聞き方の傾向（1文）",
  "team_role": "チームでの自然な役割（1文）",
  "profile_narrative": "この人のコミュニケーションスタイルを2-3文で描写"
}
primary_styleの値: "analytical" | "driver" | "expressive" | "amiable"
JSON以外は返さないでください。"""


def _emotion_triggers_prompt(prev_result: dict | None) -> str:
    prev_note = ""
    if prev_result:
        patterns = prev_result.get("patterns") or []
        prev_note = (
            f"\n\n【前回の分析結果のパターン】\n{', '.join(patterns)}\n"
            "新しいデータから変化があればchanges_from_previousに記載。"
        )
    return f"""以下のデータから感情トリガーを分析してください。JSON形式で返してください:
{{
  "positive_triggers": [
    {{"trigger": "一人の作業時間", "emotion": "joy", "frequency": 12}}
  ],
  "negative_triggers": [
    {{"trigger": "MTG後", "emotion": "anxiety", "frequency": 8}}
  ],
  "patterns": ["火曜に不安が高まる傾向", "朝の方がポジティブ"],
  "summary": "感情パターンの詳細説明（300字以上）"{_chg(prev_result)}
}}
JSON以外は返さないでください。{prev_note}"""


_PROMPT_BUILDERS = {
    "mbti": _mbti_prompt,
    "big5": _big5_prompt,
    "strengths_finder": _strengths_finder_prompt,
    "values": _values_prompt,
    "stress_resilience": _stress_resilience_prompt,
    "communication_style": _communication_style_prompt,
    "emotion_triggers": _emotion_triggers_prompt,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_previous(analysis_type: str) -> dict | None:
    return _lib.sb_get_one("self_analysis", {
        "analysis_type": f"eq.{analysis_type}",
        "select": "id,analysis_type,result,summary,data_count,analysis_context,created_at",
        "order": "created_at.desc",
        "limit": "1",
    })


def _prev_diary_count(prev: dict | None) -> int | None:
    """Extract stored diary count from analysis_context (batch-aware field)."""
    if not prev:
        return None
    ctx = (prev.get("analysis_context") or {})
    if isinstance(ctx, dict):
        if "diary_count" in ctx:
            return int(ctx["diary_count"])
        # Fallback: browser-created rows store total in data_stats.total_entries
        ds = ctx.get("data_stats") or {}
        if "total_entries" in ds:
            return int(ds["total_entries"])
    return None


def _should_skip(prev: dict | None, current_diary_count: int) -> tuple[bool, str]:
    if prev is None:
        return False, ""
    if _lib.days_since(prev["created_at"]) < 7:
        return True, "within_7_days"
    stored = _prev_diary_count(prev)
    if stored is not None and current_diary_count - stored < 10:
        return True, "insufficient_new_entries"
    return False, ""


def _collect_data(prev: dict | None) -> tuple[str, int]:
    """Collect diary + prompt + chat + tasks + calendar + dreams.

    Returns (sections_text, total_item_count).
    Delta mode when prev exists: only new entries + previous context block.
    """
    since = prev["created_at"] if prev else None
    is_update = since is not None

    # 1. Diary entries
    diary_params: dict = {"select": "body,entry_date,created_at", "order": "entry_date.desc"}
    if is_update:
        diary_params["created_at"] = f"gt.{since}"
        diary_params["limit"] = "50"
    else:
        diary_params["limit"] = "80"
    diaries = _lib.sb_get("diary_entries", diary_params) or []
    diary_text = "\n\n".join(
        f"[{d.get('entry_date', '')}] {d.get('body', '')}" for d in diaries
    )

    # 2. Claude Code prompt log
    prompt_params: dict = {"select": "prompt,tags,created_at,source", "order": "created_at.desc"}
    if is_update:
        prompt_params["created_at"] = f"gt.{since}"
        prompt_params["limit"] = "100"
    else:
        prompt_params["limit"] = "200"
    all_prompts = _lib.sb_get("prompt_log", prompt_params) or []
    code_prompts = [p for p in all_prompts if p.get("source") in ("claude_code", None, "")]

    tag_counts: dict[str, int] = {}
    hour_counts: dict[str, int] = {}
    for p in code_prompts:
        for t in (p.get("tags") or []):
            tag_counts[t] = tag_counts.get(t, 0) + 1
        ts = p.get("created_at", "")
        if len(ts) >= 13:
            h = ts[11:13]
            hour_counts[h] = hour_counts.get(h, 0) + 1
    top_tags = ", ".join(
        f"{t}: {c}回" for t, c in sorted(tag_counts.items(), key=lambda x: -x[1])[:15]
    )
    peak_hours = ", ".join(
        f"{h}時: {c}回" for h, c in sorted(hour_counts.items(), key=lambda x: -x[1])[:5]
    )
    sample_prompts = "\n".join(
        f"[{p.get('created_at', '')[:16]}] {(p.get('prompt') or '')[:150]}"
        for p in code_prompts[:20]
    )

    # 3. AI chat messages
    chat_params: dict = {"role": "eq.user", "select": "content,created_at", "order": "created_at.desc"}
    if is_update:
        chat_params["created_at"] = f"gt.{since}"
        chat_params["limit"] = "30"
    else:
        chat_params["limit"] = "50"
    chat_msgs = _lib.sb_get("messages", chat_params) or []
    chat_text = "\n".join(
        f"[{m.get('created_at', '')[:16]}] {str(m.get('content', ''))[:200]}"
        for m in chat_msgs
    )

    # 4. Tasks (always last 100 — no delta, for context)
    tasks = _lib.sb_get("tasks", {
        "select": "title,status,created_at,completed_at",
        "order": "created_at.desc",
        "limit": "100",
    }) or []
    done_count = sum(1 for t in tasks if t.get("status") == "done")
    open_count = sum(1 for t in tasks if t.get("status") == "open")
    task_list = "\n".join(
        "- [{}] {}{}".format(
            t.get("status"),
            t.get("title"),
            f" (完了: {(t.get('completed_at') or '')[:10]})" if t.get("completed_at") else "",
        )
        for t in tasks[:30]
    )

    # 5. Calendar events (always last 50)
    events = _lib.sb_get("calendar_events", {
        "select": "title,start_time",
        "order": "start_time.desc",
        "limit": "50",
    }) or []
    cal_text = "\n".join(
        f"- {e.get('start_time', '')[:16]} {e.get('title', '')}" for e in events[:20]
    )

    # 6. Dreams (all)
    dreams = _lib.sb_get("dreams", {
        "select": "title,category,status",
        "order": "created_at.desc",
    }) or []
    dream_text = "\n".join(
        f"- [{d.get('status')}][{d.get('category')}] {d.get('title', '')}" for d in dreams
    )

    # Build sections
    sections: list[str] = []
    data_label = "新しいデータ（前回以降）" if is_update else "データ"

    # Previous analysis context block (update mode)
    if is_update and prev:
        ctx = (prev.get("analysis_context") or {})
        if isinstance(ctx, dict):
            prev_result_json = json.dumps(prev.get("result") or {}, ensure_ascii=False)[:2000]
            prev_date = prev.get("created_at", "")[:10]
            key_ev = ctx.get("key_evidence") or []
            ev_lines = "\n".join(f"- {e}" for e in key_ev)
            sections.append(
                f"## 前回の分析結果（{prev_date}時点）\n"
                "【このデータの読み方】\n"
                "前回の結論を出発点として、新しいデータに基づいて更新・修正してください。\n\n"
                f"### 前回の結論\n{prev_result_json}\n\n"
                f"### 核心的な根拠（前回）\n{ev_lines or '(なし)'}"
            )

    sections.append(
        f"## 日記 — {data_label} ({len(diaries)}件)\n"
        "【このデータの読み方】\n"
        "日記は本人が自分のために書いた私的な記録です。ここに現れる感情・考え・悩みは「本音」です。\n"
        "ただし悩みや内省が多くなるバイアスがあり、楽しい日常は書かれにくいです。\n\n"
        + (diary_text or "(新しい日記なし)")
    )

    if code_prompts:
        sections.append(
            f"## Claude Code への業務指示 — {data_label} ({len(code_prompts)}件)\n"
            "よく使うタグ: " + top_tags + "\n"
            "活動ピーク時間帯(UTC): " + peak_hours + "\n\n"
            "### 指示サンプル\n" + sample_prompts
        )

    if chat_msgs:
        sections.append(
            f"## AIチャット（ダッシュボード） — {data_label} ({len(chat_msgs)}件)\n"
            + chat_text
        )

    sections.append(
        f"## タスク管理 (完了{done_count}件 / 未完了{open_count}件)\n"
        + task_list
    )

    if events:
        sections.append(f"## スケジュール ({len(events)}件)\n" + cal_text)

    if dreams:
        sections.append("## 夢・目標\n" + dream_text)

    count = len(diaries) + len(all_prompts) + len(chat_msgs)
    return "\n\n".join(sections), count


def _build_system_prompt(analysis_type: str, prev: dict | None) -> str:
    mode = _MODE_UPDATE if (prev and prev.get("analysis_context")) else _MODE_INITIAL
    prev_result = (prev.get("result") or None) if prev else None
    type_prompt = _PROMPT_BUILDERS[analysis_type](prev_result)
    return mode + _DATA_LITERACY + type_prompt


def _extract_summary(analysis_type: str, result: dict) -> str:
    if analysis_type == "mbti":
        desc = result.get("description") or {}
        return str(desc.get("core_insight") or f"{result.get('type')} {result.get('type_name')}")
    if analysis_type == "big5":
        s = result.get("summary") or {}
        return str(s.get("profile_narrative") or "")
    if analysis_type in ("strengths_finder", "emotion_triggers", "values"):
        return str(result.get("summary") or "")
    if analysis_type in ("stress_resilience", "communication_style"):
        return str(result.get("profile_narrative") or "")
    return ""


def _build_context(result: dict, diary_count: int) -> dict:
    key_evidence: list[str] = []
    for e in (result.get("evidence") or [])[:5]:
        if isinstance(e, dict):
            key_evidence.append((e.get("point") or "")[:150])
        elif isinstance(e, str):
            key_evidence.append(e[:150])
    for v in (result.get("values") or [])[:3]:
        for ev in (v.get("evidence") or [])[:1]:
            if isinstance(ev, dict):
                key_evidence.append((ev.get("point") or "")[:150])
    for s in (result.get("top_strengths") or [])[:3]:
        for ev in (s.get("evidence") or [])[:1]:
            if isinstance(ev, dict):
                key_evidence.append((ev.get("point") or "")[:150])
    return {
        "diary_count": diary_count,
        "key_evidence": key_evidence[:8],
        "confidence_notes": str(result.get("confidence") or result.get("confidence_notes") or ""),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run() -> dict:
    current_diary_count = _lib.sb_count("diary_entries") or 0

    results: dict[str, dict] = {}
    for analysis_type in ANALYSIS_TYPES:
        prev = _get_previous(analysis_type)
        skip, reason = _should_skip(prev, current_diary_count)
        if skip:
            results[analysis_type] = {"skipped": True, "reason": reason}
            sys.stderr.write(f"[self_analysis] {analysis_type} skipped: {reason}\n")
            continue

        sys.stderr.write(f"[self_analysis] running {analysis_type}...\n")
        data_text, data_count = _collect_data(prev)
        if not data_text.strip():
            results[analysis_type] = {"skipped": True, "reason": "no_data"}
            continue

        system_prompt = _build_system_prompt(analysis_type, prev)
        result = _lib.claude_opus_json(system_prompt, data_text, timeout_seconds=LLM_TIMEOUT)
        if not result:
            results[analysis_type] = {"error": "llm_failed"}
            sys.stderr.write(f"[self_analysis] {analysis_type} LLM failed\n")
            continue

        summary = _extract_summary(analysis_type, result)
        context = _build_context(result, current_diary_count)

        ok = _lib.sb_insert("self_analysis", {
            "analysis_type": analysis_type,
            "result": result,
            "summary": summary[:1000] if summary else None,
            "data_count": data_count,
            "model_used": MODEL,
            "analysis_context": context,
        })
        results[analysis_type] = {"updated": ok}
        if ok:
            sys.stderr.write(f"[self_analysis] {analysis_type} saved\n")

    return results


if __name__ == "__main__":
    _lib.require_env()
    result = run()
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)
