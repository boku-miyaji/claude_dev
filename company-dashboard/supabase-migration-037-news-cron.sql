-- News collection cron: 7:00 JST and 19:00 JST daily
-- Uses pg_cron + pg_net to call the Edge Function

-- Enable extensions if not already
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cron job: 7:00 JST (22:00 UTC previous day)
select cron.schedule(
  'news-collect-morning',
  '0 22 * * *',  -- 22:00 UTC = 07:00 JST
  $$
  select net.http_post(
    url := 'https://akycymnahqypmtsfqhtr.supabase.co/functions/v1/ai-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'apikey', current_setting('app.settings.anon_key', true)
    ),
    body := jsonb_build_object(
      'message', '以下のトピックについて最新ニュース・技術動向を3-5件調べて、各項目をタイトル+1行要約で報告してください。トピック: AI/LLM、データプラットフォーム、Snowflake、Databricks、Claude、OpenAI。日本語で。箇条書きで。各項目に日付(推定可)を付けて。',
      'model', 'gpt-5-nano',
      'context_mode', 'none'
    )
  );
  $$
);

-- Cron job: 19:00 JST (10:00 UTC)
select cron.schedule(
  'news-collect-evening',
  '0 10 * * *',  -- 10:00 UTC = 19:00 JST
  $$
  select net.http_post(
    url := 'https://akycymnahqypmtsfqhtr.supabase.co/functions/v1/ai-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'apikey', current_setting('app.settings.anon_key', true)
    ),
    body := jsonb_build_object(
      'message', '以下のトピックについて最新ニュース・技術動向を3-5件調べて、各項目をタイトル+1行要約で報告してください。トピック: AI/LLM、データプラットフォーム、Snowflake、Databricks、Claude、OpenAI。日本語で。箇条書きで。各項目に日付(推定可)を付けて。',
      'model', 'gpt-5-nano',
      'context_mode', 'none'
    )
  );
  $$
);
