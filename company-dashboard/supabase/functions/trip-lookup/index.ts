// supabase/functions/trip-lookup/index.ts
// Given a free-text trip mention from a diary entry (origin, destination, when),
// resolve it against Google Routes API (TRANSIT mode) and return a compact list
// of route options with times and fares.
//
// Auth: in-function verification. We set `verify_jwt = false` in config.toml
// so the Supabase gateway doesn't reject ES256 user JWTs; we call auth.getUser
// from within the function to restore the user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_ROUTES_API_KEY = Deno.env.get("GOOGLE_ROUTES_API_KEY") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

interface LookupRequest {
  origin: string | null;
  destination: string;
  when: string;
}

interface RouteOption {
  summary: string;
  durationMinutes: number;
  departureTime: string | null;
  arrivalTime: string | null;
  fareYen: number | null;
  steps: string[];
}

/**
 * Convert a free-text time hint to an ISO 8601 departure time in JST.
 * Rules are intentionally simple — this is a hint, not a precise schedule.
 */
function resolveDepartureTime(when: string): string {
  const now = new Date();
  // Default: now + 10 minutes (Routes API rejects past times)
  const base = new Date(now.getTime() + 10 * 60 * 1000);
  const lower = when.toLowerCase();

  // Day offset
  let day = 0;
  if (/明日|tomorrow/.test(lower)) day = 1;
  else if (/明後日/.test(lower)) day = 2;
  else if (/来週|next week/.test(lower)) day = 7;
  else {
    // Specific weekday mentions: 土曜, 日曜, 月曜...
    const weekdayMap: Record<string, number> = { 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6, 日: 0 };
    for (const [ch, target] of Object.entries(weekdayMap)) {
      if (when.includes(`${ch}曜`)) {
        const current = now.getDay();
        day = (target - current + 7) % 7 || 7;
        break;
      }
    }
  }

  // Hour hint
  let hour = -1;
  let minute = 0;
  const hhmmMatch = when.match(/(\d{1,2}):(\d{2})/);
  const hMatch = when.match(/(\d{1,2})時(\d{1,2})?分?/);
  if (hhmmMatch) {
    hour = parseInt(hhmmMatch[1], 10);
    minute = parseInt(hhmmMatch[2], 10);
  } else if (hMatch) {
    hour = parseInt(hMatch[1], 10);
    minute = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
  } else if (/始発/.test(when)) {
    hour = 5; minute = 0;
  } else if (/朝/.test(when)) {
    hour = 8;
  } else if (/昼/.test(when)) {
    hour = 12;
  } else if (/夕方/.test(when)) {
    hour = 17;
  } else if (/夜|晩/.test(when)) {
    hour = 20;
  } else if (/深夜/.test(when)) {
    hour = 23;
  }

  const target = new Date(base);
  if (day > 0) target.setDate(target.getDate() + day);
  if (hour >= 0) {
    // Interpret hour/minute as JST (UTC+9)
    target.setUTCHours(hour - 9, minute, 0, 0);
    if (day === 0 && target.getTime() < now.getTime()) {
      // User said a time earlier than now with no day hint → assume tomorrow
      target.setDate(target.getDate() + 1);
    }
  }
  return target.toISOString();
}

/**
 * Build a one-line summary of a route leg (e.g. "JR山手線 → 踊り子号 → 徒歩").
 */
function summarizeSteps(steps: unknown[]): string[] {
  const lines: string[] = [];
  for (const raw of steps) {
    if (!raw || typeof raw !== "object") continue;
    const step = raw as Record<string, unknown>;
    const travelMode = step.travelMode as string | undefined;
    if (travelMode === "TRANSIT") {
      const details = step.transitDetails as Record<string, unknown> | undefined;
      const line = details?.transitLine as Record<string, unknown> | undefined;
      const name = (line?.nameShort as string) || (line?.name as string) || "電車";
      const from = (details?.stopDetails as Record<string, unknown> | undefined)?.departureStop as Record<string, unknown> | undefined;
      const to = (details?.stopDetails as Record<string, unknown> | undefined)?.arrivalStop as Record<string, unknown> | undefined;
      const fromName = (from?.name as string) || "";
      const toName = (to?.name as string) || "";
      lines.push(`${name}: ${fromName} → ${toName}`);
    } else if (travelMode === "WALK") {
      const dur = step.staticDuration as string | undefined;
      lines.push(`徒歩 ${dur || ""}`);
    }
  }
  return lines;
}

async function computeRoutes(origin: string, destination: string, departureIso: string): Promise<RouteOption[]> {
  if (!GOOGLE_ROUTES_API_KEY) throw new Error("GOOGLE_ROUTES_API_KEY not configured");
  const body = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode: "TRANSIT",
    departureTime: departureIso,
    computeAlternativeRoutes: true,
    transitPreferences: { routingPreference: "FEWER_TRANSFERS" },
    languageCode: "ja",
    regionCode: "JP",
  };
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_ROUTES_API_KEY,
      // Parent paths include all child fields. Keep the mask short and include travelAdvisory
      // for fare/traffic data when Google decides to populate it.
      "X-Goog-FieldMask": "routes.duration,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.transitDetails,routes.travelAdvisory",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Routes API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as { routes?: Array<Record<string, unknown>> };
  const routes = data.routes ?? [];

  return routes.slice(0, 3).map((route): RouteOption => {
    const legs = (route.legs as Array<Record<string, unknown>>) || [];
    const allSteps: unknown[] = [];
    for (const leg of legs) allSteps.push(...((leg.steps as unknown[]) || []));
    const steps = summarizeSteps(allSteps);
    // Duration is ISO 8601 like "12345s"
    const durationStr = (route.duration as string) || "0s";
    const durationMin = Math.round(parseInt(durationStr.replace("s", ""), 10) / 60);

    // Depart/arrive from first/last transit step
    let departureTime: string | null = null;
    let arrivalTime: string | null = null;
    for (const s of allSteps) {
      if (!s || typeof s !== "object") continue;
      const step = s as Record<string, unknown>;
      if (step.travelMode !== "TRANSIT") continue;
      const td = step.transitDetails as Record<string, unknown> | undefined;
      const sd = td?.stopDetails as Record<string, unknown> | undefined;
      if (!departureTime) {
        const dep = sd?.departureTime as string | undefined;
        if (dep) departureTime = dep;
      }
      const arr = sd?.arrivalTime as string | undefined;
      if (arr) arrivalTime = arr;
    }

    // Fare info may come as routes.travelAdvisory.fareInfo or routes.transitFare
    let fareYen: number | null = null;
    const advisory = route.travelAdvisory as Record<string, unknown> | undefined;
    const fareInfo = advisory?.fareInfo as Record<string, unknown> | undefined;
    const price = fareInfo?.price as Record<string, unknown> | undefined;
    if (price && price.currencyCode === "JPY" && typeof price.units === "string") {
      fareYen = parseInt(price.units, 10);
    }

    return {
      summary: steps.slice(0, 2).join(" → "),
      durationMinutes: durationMin,
      departureTime,
      arrivalTime,
      fareYen,
      steps,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Authenticate user from JWT
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json(401, { error: "Missing authorization" });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
  if (userErr || !userData?.user) return json(401, { error: "Invalid token" });
  const userId = userData.user.id;

  let body: LookupRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const destination = (body.destination || "").trim();
  if (!destination) return json(400, { error: "destination is required" });

  // Resolve origin — fall back to user's home_station if not provided
  let origin = (body.origin || "").trim();
  if (!origin) {
    const { data: profile } = await sb
      .from("user_settings")
      .select("home_station, home_area, home_address")
      .eq("user_id", userId)
      .maybeSingle();
    origin = profile?.home_station || profile?.home_address || profile?.home_area || "";
  }
  if (!origin) {
    return json(400, {
      error: "出発地が不明です。基本情報ページで最寄り駅を登録するか、明示的に origin を指定してください。",
    });
  }

  const departureIso = resolveDepartureTime(body.when || "");

  try {
    const routes = await computeRoutes(origin, destination, departureIso);
    return json(200, { ok: true, origin, destination, departureTime: departureIso, routes });
  } catch (err) {
    console.error("[trip-lookup] error", err);
    return json(500, { error: err instanceof Error ? err.message : "Routes API failed" });
  }
});
