// supabase/functions/news-collect/index.ts
// Multi-source news aggregator driven by intelligence_sources table.
// Reads enabled sources from DB → fetches in parallel → saves to news_items.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// Types
// ============================================================

interface Source {
  id: number;
  name: string;
  source_type: string;
  config: Record<string, unknown>;
  priority: string;
}

interface RawNewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  source_type: string;
  source_url: string;
  topic: string;
  published_date: string | null;
}

// ============================================================
// Fetchers by source_type
// ============================================================

/** keyword: Google News RSS search with the configured term */
async function fetchKeyword(src: Source): Promise<RawNewsItem[]> {
  const term = (src.config.term as string) || src.name;
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(term)}&hl=ja&gl=JP&ceid=JP:ja`;
  return parseRssFeed(feedUrl, "google_news", term, 5);
}

/** web_source: try RSS feed first, fall back to Google News search */
async function fetchWebSource(src: Source): Promise<RawNewsItem[]> {
  const url = src.config.url as string;
  if (!url) return [];

  // Known RSS mappings
  const rssMap: Record<string, string> = {
    "anthropic.com": "https://www.anthropic.com/feed.xml",
    "openai.com": "https://openai.com/blog/rss/",
    "blog.google": "https://blog.google/technology/ai/rss/",
  };

  for (const [domain, rssUrl] of Object.entries(rssMap)) {
    if (url.includes(domain)) {
      return parseRssFeed(rssUrl, "rss_feed", src.name, 5);
    }
  }

  // Fallback: Google News search for the source name
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(src.name)}&hl=ja&gl=JP&ceid=JP:ja`;
  return parseRssFeed(feedUrl, "google_news", src.name, 3);
}

/** tech_article: Google News RSS search with site: filter */
async function fetchTechArticle(src: Source): Promise<RawNewsItem[]> {
  const site = src.config.site as string;
  const keywords = (src.config.keywords as string[]) || [];
  if (!site) return [];

  // Use first 2 keywords for focused search
  const terms = keywords.slice(0, 2).join(" OR ");
  const query = terms ? `site:${site} ${terms}` : `site:${site}`;
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
  return parseRssFeed(feedUrl, "google_news", site, 3);
}

/** hacker_news: HN API filtered by configured keywords */
async function fetchHackerNews(src: Source): Promise<RawNewsItem[]> {
  const keywords = (src.config.keywords as string[]) || ["AI"];
  const minScore = (src.config.min_score as number) || 10;
  const items: RawNewsItem[] = [];

  try {
    const topRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!topRes.ok) return items;
    const topIds: number[] = await topRes.json();

    const stories = await Promise.all(
      topIds.slice(0, 20).map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return r.ok ? r.json() : null;
      })
    );

    const pattern = new RegExp(keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|"), "i");

    for (const s of stories) {
      if (!s || !s.title || !s.url) continue;
      if (!pattern.test(s.title) && (s.score || 0) < minScore) continue;
      if ((s.score || 0) < 5) continue;

      const published = s.time ? new Date(s.time * 1000).toISOString().substring(0, 10) : null;
      if (published && isOlderThanDays(published, 2)) continue;

      items.push({
        title: s.title,
        summary: `Score: ${s.score || 0}, Comments: ${s.descendants || 0}`,
        url: s.url,
        source: "Hacker News",
        source_type: "hackernews",
        source_url: `https://news.ycombinator.com/item?id=${s.id}`,
        topic: "tech community",
        published_date: published,
      });
    }
  } catch { /* skip */ }

  return items;
}

/** github_release: GitHub API for latest releases */
async function fetchGithubRelease(src: Source): Promise<RawNewsItem[]> {
  const repo = src.config.repo as string;
  if (!repo) return [];
  const items: RawNewsItem[] = [];

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=3`, {
      headers: { "User-Agent": "FocusYou-NewsBot/1.0" },
    });
    if (!res.ok) return items;
    const releases = await res.json();

    for (const r of releases) {
      const published = r.published_at?.substring(0, 10) || null;
      if (published && isOlderThanDays(published, 7)) continue;

      items.push({
        title: `${repo.split("/")[1]}: ${r.name || r.tag_name}`,
        summary: (r.body || "").substring(0, 300).replace(/\n/g, " "),
        url: r.html_url,
        source: "GitHub",
        source_type: "rss_feed",
        source_url: `https://github.com/${repo}/releases`,
        topic: repo.split("/")[1],
        published_date: published,
      });
    }
  } catch { /* skip */ }

  return items;
}

// arxiv keywords: keep in sync with .company/departments/intelligence/sources.yaml
// (academic_papers.arxiv.keywords). Sync check: scripts/intelligence/check-arxiv-sync.sh
const ARXIV_KEYWORDS = [
  "LLM agent",
  "code generation LLM",
  "multi-agent system LLM",
  "memory augmented LLM",
  "agentic coding",
  "tool use LLM",
  "self-improvement LLM",
  "knowledge management AI",
  "personal AI assistant",
  "Claude Code",
  "AI coding assistant",
];
const ARXIV_CATEGORIES = ["cs.AI", "cs.CL", "cs.LG", "cs.SE", "cs.MA"];
const ARXIV_CATCHALL_MAX_DAYS = 3;
const ARXIV_KEYWORD_MAX_DAYS = 7;
const ARXIV_MAX_RESULTS = 150;

function buildArxivUrl(searchQuery: string, maxResults: number): string {
  const params = new URLSearchParams({
    search_query: searchQuery,
    sortBy: "submittedDate",
    sortOrder: "descending",
    max_results: String(maxResults),
  });
  return `https://export.arxiv.org/api/query?${params.toString()}`;
}

async function runArxivQuery(apiUrl: string, maxDays: number, seen: Set<string>): Promise<RawNewsItem[]> {
  const items: RawNewsItem[] = [];
  const res = await fetch(apiUrl);
  if (!res.ok) {
    console.error(`arxiv HTTP ${res.status} for ${apiUrl}`);
    return items;
  }
  const xml = await res.text();

  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  for (const entry of entries) {
    const title = extractTag(entry, "title")?.replace(/\n/g, " ").trim();
    const summary = extractTag(entry, "summary")?.replace(/\n/g, " ").trim().substring(0, 300);
    const link = entry.match(/href="(https:\/\/arxiv\.org\/abs\/[^"]+)"/)?.[1];
    const published = extractTag(entry, "published")?.substring(0, 10);

    if (!title || !link) continue;
    if (seen.has(link)) continue;
    if (published && isOlderThanDays(published, maxDays)) continue;

    seen.add(link);
    items.push({
      title,
      summary: summary || "",
      url: link,
      source: "arXiv",
      source_type: "arxiv",
      source_url: apiUrl,
      topic: "academic",
      published_date: published || null,
    });
  }
  return items;
}

/**
 * arXiv: search for AI/ML papers (always included as built-in).
 *
 * Two queries are run and merged:
 *   1. Catch-all recent (last ARXIV_CATCHALL_MAX_DAYS days) across ARXIV_CATEGORIES.
 *   2. Keyword-filtered recent (last ARXIV_KEYWORD_MAX_DAYS days) — captures
 *      relevant papers that fall outside the catch-all's newest window.
 *
 * Keywords and categories are in sync with sources.yaml.
 */
async function fetchArxiv(): Promise<RawNewsItem[]> {
  const items: RawNewsItem[] = [];
  const seen = new Set<string>();
  const catClause = `(${ARXIV_CATEGORIES.map((c) => `cat:${c}`).join(" OR ")})`;

  try {
    const catchAllUrl = buildArxivUrl(catClause, ARXIV_MAX_RESULTS);
    items.push(...(await runArxivQuery(catchAllUrl, ARXIV_CATCHALL_MAX_DAYS, seen)));
  } catch (e) {
    console.error(`arxiv catch-all failed: ${(e as Error).message}`);
  }

  try {
    const kwClause = `(${ARXIV_KEYWORDS.map((k) => `all:"${k}"`).join(" OR ")})`;
    const kwUrl = buildArxivUrl(`${catClause} AND ${kwClause}`, ARXIV_MAX_RESULTS);
    items.push(...(await runArxivQuery(kwUrl, ARXIV_KEYWORD_MAX_DAYS, seen)));
  } catch (e) {
    console.error(`arxiv keyword query failed: ${(e as Error).message}`);
  }

  return items;
}

// ============================================================
// RSS Parser (shared)
// ============================================================

async function parseRssFeed(feedUrl: string, sourceType: string, topic: string, maxItems: number): Promise<RawNewsItem[]> {
  const items: RawNewsItem[] = [];

  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "FocusYou-NewsBot/1.0" },
    });
    if (!res.ok) return items;
    const xml = await res.text();

    // Try both <item> (RSS) and <entry> (Atom)
    const entries = (xml.match(/<item>([\s\S]*?)<\/item>/g) || [])
      .concat(xml.match(/<entry>([\s\S]*?)<\/entry>/g) || []);

    for (const entry of entries.slice(0, maxItems)) {
      const title = extractTag(entry, "title");
      const link = extractTag(entry, "link") || entry.match(/href="([^"]+)"/)?.[1];
      const pubDate = extractTag(entry, "pubDate") || extractTag(entry, "published") || extractTag(entry, "updated");
      const source = extractTag(entry, "source");
      const description = extractTag(entry, "description") || extractTag(entry, "summary");

      if (!title || !link) continue;

      const published = parseDate(pubDate);
      if (published && isOlderThanDays(published, 3)) continue;

      items.push({
        title: decodeEntities(title),
        summary: decodeEntities(description || "").substring(0, 300),
        url: link,
        source: source || topic,
        source_type: sourceType,
        source_url: feedUrl,
        topic,
        published_date: published,
      });
    }
  } catch { /* skip */ }

  return items;
}

// ============================================================
// Helpers
// ============================================================

function extractTag(xml: string, tag: string): string | null {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  if (cdataMatch) return cdataMatch[1].trim();
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
}

function decodeEntities(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, "");
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString().substring(0, 10);
  } catch { return null; }
}

function isOlderThanDays(dateStr: string, days: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return new Date(dateStr) < cutoff;
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
    });
  }

  try {
    // 1. Read enabled sources from DB
    const { data: sources } = await sb
      .from("intelligence_sources")
      .select("id, name, source_type, config, priority")
      .eq("enabled", true)
      .order("priority");

    const enabledSources = (sources || []) as Source[];

    // 2. Dispatch fetchers by source_type (parallel)
    const fetchPromises: Promise<RawNewsItem[]>[] = [];
    const sourceStats: Record<string, number> = {};

    for (const src of enabledSources) {
      let promise: Promise<RawNewsItem[]>;
      switch (src.source_type) {
        case "keyword":      promise = fetchKeyword(src); break;
        case "web_source":   promise = fetchWebSource(src); break;
        case "tech_article": promise = fetchTechArticle(src); break;
        case "hacker_news":  promise = fetchHackerNews(src); break;
        case "github_release": promise = fetchGithubRelease(src); break;
        default: continue;
      }
      fetchPromises.push(promise.then(items => {
        sourceStats[src.source_type] = (sourceStats[src.source_type] || 0) + items.length;
        return items;
      }));
    }

    // Always include arXiv (built-in)
    fetchPromises.push(fetchArxiv().then(items => {
      sourceStats["arxiv"] = items.length;
      return items;
    }));

    // 3. Wait for all fetchers
    const results = await Promise.all(fetchPromises);
    const allItems = results.flat();

    // 4. Deduplicate by URL
    const seen = new Set<string>();
    const unique = allItems.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    // 5. Save to DB
    // news_items.url は partial unique index (WHERE url IS NOT NULL) なので
    // PostgREST の upsert(onConflict: 'url') では正しく動かない。
    // 代わりに insert を使い、重複エラー(23505)は「既に存在する」として
    // 成功扱いにする。
    let savedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    for (const item of unique) {
      const { error } = await sb.from("news_items").insert({
        title: item.title.substring(0, 200),
        summary: item.summary.substring(0, 500),
        url: item.url,
        source: item.source.substring(0, 50),
        source_type: item.source_type,
        source_url: item.source_url,
        topic: item.topic.substring(0, 30),
        published_date: item.published_date,
        collected_at: new Date().toISOString(),
      });
      if (!error) {
        savedCount++;
      } else if (error.code === "23505") {
        // Unique violation on url → already exists, not an error
        duplicateCount++;
      } else {
        errorCount++;
        console.error(`INSERT failed for ${item.url}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify({
      total: unique.length,
      saved: savedCount,
      duplicates: duplicateCount,
      errors: errorCount,
      sources_checked: enabledSources.length + 1, // +1 for arXiv
      by_source: sourceStats,
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
