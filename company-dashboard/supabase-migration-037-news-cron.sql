-- ============================================================
-- Daily briefing + News collection cron
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- 1. Morning briefing generator (7:00 JST = 22:00 UTC)
-- Collects tasks, diary, insights → saves to activity_log
-- The dashboard reads this on Home open (instant)
-- ============================================================
select cron.schedule(
  'daily-briefing-morning',
  '0 22 * * *',  -- 22:00 UTC = 07:00 JST
  $$
  INSERT INTO activity_log (action, details)
  SELECT 'daily_briefing', jsonb_build_object(
    'text', (
      SELECT string_agg(line, E'\n') FROM (
        -- Today's tasks summary
        SELECT '【今日やること】' || coalesce(
          (SELECT string_agg(title, '、' ORDER BY priority) FROM (
            SELECT title, priority FROM tasks WHERE status IN ('open','in_progress') AND priority = 'high' LIMIT 5
          ) t), 'なし') AS line
        UNION ALL
        -- Yesterday's diary
        SELECT '【昨日の振り返り】' || coalesce(
          (SELECT left(body, 150) FROM diary_entries WHERE entry_date = (current_date - 1)::text ORDER BY created_at DESC LIMIT 1),
          '日記なし') AS line
        UNION ALL
        -- Unpaid invoices
        SELECT CASE WHEN cnt > 0 THEN '【注意】未入金 ' || cnt || '件 ¥' || total ELSE NULL END AS line
        FROM (SELECT count(*) cnt, coalesce(sum(amount),0) total FROM invoices WHERE status != 'paid' AND invoice_date >= date_trunc('year', current_date)::text) inv
        WHERE cnt > 0
      ) lines WHERE line IS NOT NULL
    ),
    'generated_at', now()
  );
  $$
);

-- ============================================================
-- 2. News collection (7:00 JST + 19:00 JST)
-- Calls Edge Function with GPT to fetch latest news
-- ============================================================
select cron.schedule(
  'news-collect-morning',
  '0 22 * * *',  -- 22:00 UTC = 07:00 JST
  $$
  select net.http_post(
    url := 'https://akycymnahqypmtsfqhtr.supabase.co/functions/v1/ai-agent',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_VYgxoltXaSlEIjcH1dpa7w_TPc3mYBf","Authorization":"Bearer sb_publishable_VYgxoltXaSlEIjcH1dpa7w_TPc3mYBf"}'::jsonb,
    body := '{"message":"最新のAI/LLMニュース・技術動向を3-5件。タイトル+1行要約。日本語。箇条書き。日付付き。トピック: AI, LLM, データ基盤, Claude, OpenAI","model":"gpt-5-nano","context_mode":"none"}'::jsonb
  );
  $$
);

select cron.schedule(
  'news-collect-evening',
  '0 10 * * *',  -- 10:00 UTC = 19:00 JST
  $$
  select net.http_post(
    url := 'https://akycymnahqypmtsfqhtr.supabase.co/functions/v1/ai-agent',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_VYgxoltXaSlEIjcH1dpa7w_TPc3mYBf","Authorization":"Bearer sb_publishable_VYgxoltXaSlEIjcH1dpa7w_TPc3mYBf"}'::jsonb,
    body := '{"message":"最新のAI/LLMニュース・技術動向を3-5件。タイトル+1行要約。日本語。箇条書き。日付付き。トピック: AI, LLM, データ基盤, Claude, OpenAI","model":"gpt-5-nano","context_mode":"none"}'::jsonb
  );
  $$
);
