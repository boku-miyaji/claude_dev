// supabase/functions/google-calendar-proxy/index.ts
// Server-side Google Calendar proxy with refresh token management.
// Replaces the client-side implicit flow to eliminate hourly re-authentication.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const TOKEN_ENCRYPT_KEY = Deno.env.get("GOOGLE_TOKEN_ENCRYPT_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TASKS_BASE = "https://tasks.googleapis.com/tasks/v1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// ============================================================
// Encryption helpers (AES-256-GCM)
// ============================================================

async function getEncryptionKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(TOKEN_ENCRYPT_KEY.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // Store as base64: iv(12 bytes) + ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ============================================================
// Google OAuth token helpers
// ============================================================

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/** Exchange authorization code for tokens */
async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }
  return res.json();
}

/** Refresh access token using stored refresh token */
async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }
  return res.json();
}

// ============================================================
// Token management
// ============================================================

// In-memory cache: userId -> { access_token, expires_at }
const tokenCache = new Map<string, { access_token: string; expires_at: number }>();

async function getAccessToken(userId: string): Promise<string> {
  // Check in-memory cache
  const cached = tokenCache.get(userId);
  if (cached && cached.expires_at > Date.now() + 60_000) {
    return cached.access_token;
  }

  // Load refresh token from DB
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await sb
    .from("google_tokens")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("NEEDS_AUTH");
  }

  const refreshToken = await decrypt(data.refresh_token_encrypted);
  const tokens = await refreshAccessToken(refreshToken);

  // Cache the new access token
  tokenCache.set(userId, {
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  });

  return tokens.access_token;
}

// ============================================================
// Google Calendar API helpers
// ============================================================

async function calendarFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// ============================================================
// Route handlers
// ============================================================

async function handleAuthCallback(req: Request, userId: string): Promise<Response> {
  const body = await req.json();
  const { code, redirect_uri, calendar_ids } = body;

  if (!code || !redirect_uri) {
    return new Response(JSON.stringify({ error: "Missing code or redirect_uri" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let tokens: TokenResponse;
  try {
    tokens = await exchangeCode(code, redirect_uri);
  } catch (e) {
    console.error("exchangeCode failed:", e, "redirect_uri:", redirect_uri, "client_id:", GOOGLE_CLIENT_ID?.substring(0, 20));
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  if (!tokens.refresh_token) {
    return new Response(
      JSON.stringify({ error: "No refresh_token received. Ensure access_type=offline and prompt=consent in the auth URL." }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Encrypt and store refresh token
  const encryptedRefresh = await encrypt(tokens.refresh_token);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await sb.from("google_tokens").upsert({
    user_id: userId,
    refresh_token_encrypted: encryptedRefresh,
    scopes: tokens.scope,
    calendar_ids: calendar_ids || [],
    updated_at: new Date().toISOString(),
  });

  // Cache access token
  tokenCache.set(userId, {
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  });

  return new Response(
    JSON.stringify({ ok: true, scopes: tokens.scope }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
}

async function handleGetEvents(req: Request, userId: string): Promise<Response> {
  const url = new URL(req.url);
  const calendarIds = url.searchParams.get("calendar_ids")?.split(",") || [];
  const timeMin = url.searchParams.get("time_min") || "";
  const timeMax = url.searchParams.get("time_max") || "";
  const maxResults = url.searchParams.get("max_results") || "50";

  if (!calendarIds.length || !timeMin || !timeMax) {
    return new Response(JSON.stringify({ error: "Missing calendar_ids, time_min, or time_max" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const accessToken = await getAccessToken(userId);
  const allEvents: Record<string, unknown>[] = [];

  for (const calId of calendarIds) {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      timeZone: "Asia/Tokyo",
      singleEvents: "true",
      maxResults,
      orderBy: "startTime",
    });

    const res = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calId)}/events?${params}`);
    if (!res.ok) continue;
    const data = await res.json();
    for (const ev of data.items || []) {
      if (ev.status === "cancelled") continue;
      allEvents.push({
        id: ev.id,
        calendar_id: calId,
        summary: ev.summary || "(No title)",
        start_time: ev.start?.dateTime || ev.start?.date || "",
        end_time: ev.end?.dateTime || ev.end?.date || "",
        all_day: !ev.start?.dateTime,
        status: ev.status,
        location: ev.location || null,
        hangoutLink: ev.hangoutLink || null,
      });
    }
  }

  allEvents.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

  return new Response(JSON.stringify({ events: allEvents }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleCreateEvent(req: Request, userId: string): Promise<Response> {
  const { calendar_id, event } = await req.json();
  const accessToken = await getAccessToken(userId);
  const res = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendar_id)}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleUpdateEvent(req: Request, userId: string): Promise<Response> {
  const { calendar_id, event_id, patch } = await req.json();
  const accessToken = await getAccessToken(userId);
  const res = await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleDeleteEvent(req: Request, userId: string): Promise<Response> {
  const { calendar_id, event_id } = await req.json();
  const accessToken = await getAccessToken(userId);
  const res = await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendar_id)}/events/${encodeURIComponent(event_id)}`,
    { method: "DELETE" },
  );
  return new Response(JSON.stringify({ ok: res.ok }), {
    status: res.ok ? 200 : res.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleCheckAuth(userId: string): Promise<Response> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await sb
    .from("google_tokens")
    .select("scopes, calendar_ids, updated_at")
    .eq("user_id", userId)
    .single();

  return new Response(
    JSON.stringify({ authenticated: !!data, ...(data || {}) }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
}

// ============================================================
// Google Tasks API helpers
// ============================================================

async function tasksFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${GOOGLE_TASKS_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// ============================================================
// Google Tasks route handlers
// ============================================================

async function handleGetTaskLists(userId: string): Promise<Response> {
  const accessToken = await getAccessToken(userId);
  const res = await tasksFetch(accessToken, "/users/@me/lists");
  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), {
      status: res.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleGetTasks(req: Request, userId: string): Promise<Response> {
  const url = new URL(req.url);
  const taskListId = url.searchParams.get("task_list_id") || "@default";
  const dueMin = url.searchParams.get("due_min") || "";
  const dueMax = url.searchParams.get("due_max") || "";
  const showCompleted = url.searchParams.get("show_completed") || "true";
  const maxResults = url.searchParams.get("max_results") || "100";

  const accessToken = await getAccessToken(userId);

  const params = new URLSearchParams({
    maxResults,
    showCompleted,
    showHidden: "false",
  });
  if (dueMin) params.set("dueMin", dueMin);
  if (dueMax) params.set("dueMax", dueMax);

  const res = await tasksFetch(
    accessToken,
    `/lists/${encodeURIComponent(taskListId)}/tasks?${params}`,
  );

  if (!res.ok) {
    const err = await res.text();
    return new Response(JSON.stringify({ error: err }), {
      status: res.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const data = await res.json();
  const tasks = (data.items || []).map((t: Record<string, unknown>) => ({
    id: t.id,
    title: t.title,
    notes: t.notes || null,
    due: t.due || null,
    status: t.status, // "needsAction" | "completed"
    completed: t.completed || null,
    updated: t.updated,
    position: t.position,
    parent: t.parent || null,
  }));

  return new Response(JSON.stringify({ tasks }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleCreateTask(req: Request, userId: string): Promise<Response> {
  const { task_list_id, task } = await req.json();
  const listId = task_list_id || "@default";
  const accessToken = await getAccessToken(userId);

  const res = await tasksFetch(
    accessToken,
    `/lists/${encodeURIComponent(listId)}/tasks`,
    { method: "POST", body: JSON.stringify(task) },
  );
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleUpdateTask(req: Request, userId: string): Promise<Response> {
  const { task_list_id, task_id, patch } = await req.json();
  const listId = task_list_id || "@default";
  const accessToken = await getAccessToken(userId);

  const res = await tasksFetch(
    accessToken,
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(task_id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleDeleteTask(req: Request, userId: string): Promise<Response> {
  const { task_list_id, task_id } = await req.json();
  const listId = task_list_id || "@default";
  const accessToken = await getAccessToken(userId);

  const res = await tasksFetch(
    accessToken,
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(task_id)}`,
    { method: "DELETE" },
  );
  return new Response(JSON.stringify({ ok: res.ok }), {
    status: res.ok ? 200 : res.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/google-calendar-proxy/, "");

    // Auth callback: accept user_id in request body (session may not be restored after redirect)
    if (req.method === "POST" && path === "/auth/callback") {
      // Try JWT auth first, fall back to user_id in body
      let userId = "";
      const authHeader = req.headers.get("authorization") || "";
      const jwt = authHeader.replace("Bearer ", "").trim();
      if (jwt) {
        const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
        const { data: { user } } = await sb.auth.getUser(jwt);
        if (user) userId = user.id;
      }
      // Fall back: get user_id from request body
      const body = await req.clone().json().catch(() => ({}));
      if (!userId && body.user_id) userId = body.user_id;
      if (!userId) {
        return new Response(JSON.stringify({ error: "No valid auth or user_id" }), {
          status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      return await handleAuthCallback(req, userId);
    }

    // All other routes require JWT auth
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
    const { data: { user }, error: authError } = await sb.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    if (req.method === "GET" && path === "/auth/check") {
      return await handleCheckAuth(user.id);
    }
    if (req.method === "GET" && path === "/events") {
      return await handleGetEvents(req, user.id);
    }
    if (req.method === "POST" && path === "/events") {
      return await handleCreateEvent(req, user.id);
    }
    if (req.method === "PATCH" && path === "/events") {
      return await handleUpdateEvent(req, user.id);
    }
    if (req.method === "DELETE" && path === "/events") {
      return await handleDeleteEvent(req, user.id);
    }

    // Google Tasks routes
    if (req.method === "GET" && path === "/tasks/lists") {
      return await handleGetTaskLists(user.id);
    }
    if (req.method === "GET" && path === "/tasks") {
      return await handleGetTasks(req, user.id);
    }
    if (req.method === "POST" && path === "/tasks") {
      return await handleCreateTask(req, user.id);
    }
    if (req.method === "PATCH" && path === "/tasks") {
      return await handleUpdateTask(req, user.id);
    }
    if (req.method === "DELETE" && path === "/tasks") {
      return await handleDeleteTask(req, user.id);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // NEEDS_AUTH means no refresh token stored — user must re-authenticate
    if (message === "NEEDS_AUTH") {
      return new Response(JSON.stringify({ error: "NEEDS_AUTH" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Token refresh failed — refresh token was revoked
    if (message.includes("Token refresh failed")) {
      return new Response(JSON.stringify({ error: "NEEDS_AUTH", reason: "refresh_token_revoked" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    console.error("google-calendar-proxy error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
