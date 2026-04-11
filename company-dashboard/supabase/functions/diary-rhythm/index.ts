// supabase/functions/diary-rhythm/index.ts
// 日記の記入リズム分析 Edge Function
//
// diary_entries.created_at から時間帯・曜日分布を集計し、
// ユーザーの日記記入パターンを返す。
// プロダクト向け（全ユーザー共通ロジック）。
//
// GET /diary-rhythm?days=30
//   → { hourly, daily, stats, suggestions }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface HourCount {
  hour: number;
  count: number;
}

interface DowCount {
  dow: number;
  dow_label: string;
  count: number;
}

interface RhythmStats {
  total_entries: number;
  period_days: number;
  peak_hour: number;
  peak_dow: number;
  peak_dow_label: string;
  late_night_pct: number;
  weekend_pct: number;
  avg_entries_per_day: number;
  streak_current: number;
  streak_max: number;
}

interface Suggestion {
  type: "positive" | "neutral" | "warning";
  text: string;
}

interface RhythmResponse {
  hourly: HourCount[];
  daily: DowCount[];
  stats: RhythmStats;
  suggestions: Suggestion[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30"), 7), 365);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 直近N日の日記エントリを取得
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: entries, error } = await sb
      .from("diary_entries")
      .select("entry_date, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!entries || entries.length < 3) {
      return new Response(
        JSON.stringify({ error: "Not enough diary entries", min_required: 3 }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // --- 時間帯・曜日集計（JST） ---
    const hourCounts = new Array(24).fill(0);
    const dowCounts = new Array(7).fill(0);
    const dateSet = new Set<string>();
    let lateNight = 0;
    let weekend = 0;

    for (const e of entries) {
      const d = new Date(e.created_at);
      const jstHour = (d.getUTCHours() + 9) % 24;
      const jstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const dow = jstDate.getDay();

      hourCounts[jstHour]++;
      dowCounts[dow]++;
      dateSet.add(e.entry_date);

      if ([22, 23, 0, 1, 2, 3, 4, 5].includes(jstHour)) lateNight++;
      if (dow === 0 || dow === 6) weekend++;
    }

    const total = entries.length;

    // --- ピーク算出 ---
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakDow = dowCounts.indexOf(Math.max(...dowCounts));

    // --- 連続記入日数（ストリーク） ---
    const sortedDates = [...dateSet].sort();
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 1;

    const today = new Date().toISOString().slice(0, 10);
    // 今日から遡ってcurrent streakを計算
    const todayDate = new Date(today);
    let checkDate = new Date(todayDate);
    while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // max streakを計算
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        maxStreak = Math.max(maxStreak, tempStreak);
        tempStreak = 1;
      }
    }
    maxStreak = Math.max(maxStreak, tempStreak);

    // --- レスポンス構築 ---
    const hourly: HourCount[] = hourCounts.map((count: number, hour: number) => ({ hour, count }));
    const daily: DowCount[] = dowCounts.map((count: number, dow: number) => ({
      dow,
      dow_label: DOW_LABELS[dow],
      count,
    }));

    const lateNightPct = Math.round((lateNight / total) * 100);
    const weekendPct = Math.round((weekend / total) * 100);

    const stats: RhythmStats = {
      total_entries: total,
      period_days: days,
      peak_hour: peakHour,
      peak_dow: peakDow,
      peak_dow_label: DOW_LABELS[peakDow],
      late_night_pct: lateNightPct,
      weekend_pct: weekendPct,
      avg_entries_per_day: Math.round((total / days) * 100) / 100,
      streak_current: currentStreak,
      streak_max: maxStreak,
    };

    // --- 示唆生成 ---
    const suggestions: Suggestion[] = [];

    // ストリーク
    if (currentStreak >= 7) {
      suggestions.push({ type: "positive", text: `${currentStreak}日連続で書いています。素晴らしい習慣です` });
    } else if (currentStreak >= 3) {
      suggestions.push({ type: "positive", text: `${currentStreak}日連続記入中。この調子で続けましょう` });
    } else if (currentStreak === 0) {
      suggestions.push({ type: "neutral", text: "今日はまだ書いていません。一言でもOKです" });
    }

    // 時間帯
    if (peakHour >= 21 || peakHour <= 5) {
      suggestions.push({
        type: "neutral",
        text: `${peakHour}時台に書くことが多いです。寝る前の振り返りが習慣になっていますね`,
      });
    } else if (peakHour >= 6 && peakHour <= 9) {
      suggestions.push({
        type: "positive",
        text: `朝(${peakHour}時台)に書く習慣があります。一日の意図を持って始められています`,
      });
    }

    // 頻度
    const avgPerWeek = (total / days) * 7;
    if (avgPerWeek >= 5) {
      suggestions.push({ type: "positive", text: `週${Math.round(avgPerWeek)}回ペースで書いています。十分な頻度です` });
    } else if (avgPerWeek >= 2) {
      suggestions.push({ type: "neutral", text: `週${Math.round(avgPerWeek)}回ペース。もう少し増やすと変化に気づきやすくなります` });
    } else {
      suggestions.push({ type: "warning", text: `週${Math.round(avgPerWeek)}回ペース。短くても毎日書くと自己理解が深まります` });
    }

    // 曜日の偏り
    const weekdayCounts = dowCounts.slice(1, 6);
    const minWeekday = Math.min(...weekdayCounts);
    const minWeekdayIdx = weekdayCounts.indexOf(minWeekday) + 1;
    if (minWeekday === 0 && total >= 14) {
      suggestions.push({
        type: "neutral",
        text: `${DOW_LABELS[minWeekdayIdx]}曜日は書いたことがありません。忙しい日こそ一言残すと後で役立ちます`,
      });
    }

    const response: RhythmResponse = { hourly, daily, stats, suggestions };

    return new Response(JSON.stringify(response), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
