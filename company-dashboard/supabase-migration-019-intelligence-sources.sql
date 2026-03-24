-- ============================================================
-- Migration 019: intelligence_sources テーブル（情報収集ソース管理）
-- ============================================================
-- 目的: 情報収集部のソースをダッシュボードから閲覧・編集可能にする
-- sources.yaml の内容を Supabase に移行し、GUI で管理する
-- ============================================================

create table if not exists intelligence_sources (
  id serial primary key,
  source_type text not null
    check (source_type in (
      'x_account', 'keyword', 'web_source',
      'tech_article', 'github_release', 'hacker_news'
    )),
  name text not null,                    -- 表示名（例: "Anthropic Blog", "@trq212"）
  config jsonb not null default '{}',    -- タイプ別の設定
  category text not null default 'general',
  priority text not null default 'normal'
    check (priority in ('high', 'normal', 'low')),
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekly', 'monthly')),
  enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_intelligence_sources_type on intelligence_sources(source_type);
create index if not exists idx_intelligence_sources_enabled on intelligence_sources(enabled);

-- Updated_at trigger
create or replace trigger intelligence_sources_updated_at
  before update on intelligence_sources
  for each row execute function update_updated_at();

-- RLS
alter table intelligence_sources enable row level security;

-- Owner only
create policy "owner_full" on intelligence_sources for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Anon: ingest-key で READ のみ（collect.py がソース一覧を読む用）
create policy "anon_select_sources_with_key"
  on intelligence_sources for select to anon
  using (public.check_ingest_key());

-- ============================================================
-- 既存 sources.yaml からのデータ移行
-- ============================================================

-- X アカウント
INSERT INTO intelligence_sources (source_type, name, config, category, priority, note) VALUES
  ('x_account', '@AnthropicAI', '{"handle": "AnthropicAI"}', 'AI', 'high', 'Claude / Anthropic 公式'),
  ('x_account', '@OpenAI', '{"handle": "OpenAI"}', 'AI', 'high', 'OpenAI 公式'),
  ('x_account', '@GoogleAI', '{"handle": "GoogleAI"}', 'AI', 'high', 'Google AI 公式'),
  ('x_account', '@trq212', '{"handle": "trq212"}', '個人', 'high', NULL),
  ('x_account', '@systematicls', '{"handle": "systematicls"}', '個人', 'high', NULL),
  ('x_account', '@tricalt', '{"handle": "tricalt"}', '個人', 'high', NULL),
  ('x_account', '@CodevolutionWeb', '{"handle": "CodevolutionWeb"}', '開発', 'normal', 'Web開発チュートリアル'),
  ('x_account', '@AkshayxSaini', '{"handle": "AkshayxSaini"}', '開発', 'normal', '開発コンテンツ');

-- キーワード
INSERT INTO intelligence_sources (source_type, name, config, category, priority, frequency) VALUES
  ('keyword', 'Claude Code', '{"term": "Claude Code"}', 'AI tools', 'high', 'daily'),
  ('keyword', 'Cursor AI', '{"term": "Cursor AI"}', 'AI tools', 'high', 'daily'),
  ('keyword', 'GitHub Copilot', '{"term": "GitHub Copilot"}', 'AI tools', 'normal', 'weekly'),
  ('keyword', 'AI Agent framework', '{"term": "AI Agent framework"}', 'AI tools', 'normal', 'weekly'),
  ('keyword', 'MCP server', '{"term": "MCP server"}', 'AI tools', 'high', 'daily'),
  ('keyword', 'AI coding assistant', '{"term": "AI coding assistant"}', 'AI tools', 'normal', 'weekly');

-- 公式ブログ・リリースノート
INSERT INTO intelligence_sources (source_type, name, config, category, priority, frequency) VALUES
  ('web_source', 'Anthropic Blog', '{"url": "https://www.anthropic.com/news"}', 'AI', 'high', 'daily'),
  ('web_source', 'OpenAI Blog', '{"url": "https://openai.com/news/"}', 'AI', 'high', 'daily'),
  ('web_source', 'Google AI Blog', '{"url": "https://blog.google/technology/ai/"}', 'AI', 'high', 'daily'),
  ('web_source', 'Claude Code Changelog', '{"url": "https://code.claude.com/docs/en/changelog"}', 'AI tools', 'high', 'daily'),
  ('web_source', 'Cursor Changelog', '{"url": "https://cursor.com/changelog"}', 'AI tools', 'high', 'daily'),
  ('web_source', 'MCP Roadmap', '{"url": "https://modelcontextprotocol.io/development/roadmap"}', 'AI tools', 'normal', 'weekly'),
  ('web_source', 'TechCrunch AI', '{"url": "https://techcrunch.com/category/artificial-intelligence/"}', 'tech news', 'normal', 'daily'),
  ('web_source', 'The Verge AI', '{"url": "https://www.theverge.com/ai-artificial-intelligence"}', 'tech news', 'normal', 'daily');

-- 技術記事プラットフォーム（海外）
INSERT INTO intelligence_sources (source_type, name, config, category, priority, frequency, note) VALUES
  ('tech_article', 'Dev.to', '{"site": "dev.to", "keywords": ["Claude Code", "MCP server", "AI agent", "Cursor"]}', '海外技術記事', 'high', 'daily', '海外版 Zenn。開発者コミュニティ'),
  ('tech_article', 'Medium', '{"site": "medium.com", "keywords": ["Claude Code", "AI coding assistant", "MCP"]}', '海外技術記事', 'normal', 'daily', 'テック記事プラットフォーム'),
  ('tech_article', 'Hashnode', '{"site": "hashnode.dev", "keywords": ["Claude", "AI agent", "MCP server"]}', '海外技術記事', 'normal', 'weekly', '開発者ブログプラットフォーム'),
  ('tech_article', 'HuggingFace Blog', '{"site": "huggingface.co/blog", "keywords": ["agent", "MCP", "coding"]}', '海外技術記事', 'normal', 'weekly', 'ML コミュニティ公式ブログ'),
  ('tech_article', 'arXiv', '{"site": "arxiv.org", "keywords": ["LLM agent", "code generation", "agentic"]}', '海外技術記事', 'normal', 'weekly', 'AI/ML 論文プレプリント'),
  ('tech_article', 'HackerNoon', '{"site": "hackernoon.com", "keywords": ["Claude", "AI coding", "MCP", "agent"]}', '海外技術記事', 'high', 'daily', 'Zenn に最も近い海外プラットフォーム'),
  ('tech_article', 'daily.dev', '{"site": "daily.dev", "keywords": ["Claude Code", "AI agent", "MCP"]}', '海外技術記事', 'normal', 'daily', '開発者向けニュースアグリゲーター'),
  ('tech_article', 'Lobste.rs', '{"site": "lobste.rs", "keywords": ["Claude", "AI", "MCP"]}', '海外技術記事', 'normal', 'weekly', 'HN より厳選。招待制で品質高い'),
  ('tech_article', 'freeCodeCamp', '{"site": "freecodecamp.org", "keywords": ["AI coding", "Claude", "agent"]}', '海外技術記事', 'normal', 'weekly', 'チュートリアル寄り。AI 関連記事充実'),
  ('tech_article', 'Substack', '{"site": "substack.com", "keywords": ["Claude Code", "AI agent", "coding assistant"]}', '海外技術記事', 'normal', 'weekly', 'テック系ニュースレター。深掘り記事多');

-- 技術記事プラットフォーム（日本）
INSERT INTO intelligence_sources (source_type, name, config, category, priority, frequency, note) VALUES
  ('tech_article', 'Zenn', '{"site": "zenn.dev", "keywords": ["Claude Code", "MCP", "Cursor", "AIエージェント"]}', '日本語技術記事', 'high', 'daily', '日本の技術記事プラットフォーム'),
  ('tech_article', 'note', '{"site": "note.com", "keywords": ["Claude Code", "AI開発", "MCP"]}', '日本語技術記事', 'normal', 'daily', '日本のクリエイター記事プラットフォーム'),
  ('tech_article', 'Qiita', '{"site": "qiita.com", "keywords": ["Claude Code", "MCP", "AIエージェント", "Cursor"]}', '日本語技術記事', 'high', 'daily', '日本のエンジニア向け技術情報共有');

-- GitHub Releases
INSERT INTO intelligence_sources (source_type, name, config, category, priority, frequency) VALUES
  ('github_release', 'Claude Code', '{"repo": "anthropics/claude-code"}', 'AI tools', 'high', 'daily'),
  ('github_release', 'MCP Spec', '{"repo": "modelcontextprotocol/specification"}', 'AI tools', 'normal', 'weekly'),
  ('github_release', 'Anthropic Python SDK', '{"repo": "anthropics/anthropic-sdk-python"}', 'AI tools', 'normal', 'weekly');

-- Hacker News
INSERT INTO intelligence_sources (source_type, name, config, category, priority, frequency, note) VALUES
  ('hacker_news', 'Hacker News', '{"keywords": ["Claude", "Anthropic", "Cursor", "MCP", "AI agent", "coding assistant"], "min_score": 50}', 'tech news', 'high', 'daily', 'キーワードフィルター（50pt以上）');
