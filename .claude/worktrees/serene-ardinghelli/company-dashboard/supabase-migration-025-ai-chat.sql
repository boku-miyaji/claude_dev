-- ============================================================
-- Migration 025: AI Chat (agent-loop architecture)
-- conversations + messages + chat_usage テーブル
-- ============================================================

-- === conversations: チャット会話 ===
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  title text not null default 'New Chat',
  model text,                              -- 固定モデル（nullなら自動ルーティング）
  context_mode text not null default 'full'
    check (context_mode in ('full', 'supabase', 'none')),
  company_id text,                         -- PJ会社コンテキスト（nullならHD）
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === messages: チャットメッセージ（user/assistant/tool） ===
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text not null default '',
  model text,                              -- 使用モデル
  tool_calls jsonb,                        -- LLMが要求したツール呼び出し
  tool_name text,                          -- tool roleの場合のツール名
  tool_input jsonb,                        -- ツール入力パラメータ
  tokens_input int,
  tokens_output int,
  cost_usd numeric(10, 6),
  routing_reason text,                     -- 自動ルーティング理由
  step int,                                -- エージェントループのステップ番号
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_conversations_updated on conversations(updated_at desc);

-- === chat_usage: コスト集計（日次） ===
create table if not exists chat_usage (
  id serial primary key,
  date date not null default current_date,
  model text not null,
  requests int not null default 0,
  tokens_input int not null default 0,
  tokens_output int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now(),
  unique(date, model)
);

-- === RLS: owner-only (consistent with other tables) ===
alter table conversations enable row level security;
alter table messages enable row level security;
alter table chat_usage enable row level security;

-- Authenticated users can read/write their own data
-- (Since this is single-user, allow all authenticated)
create policy "conversations_auth_all" on conversations
  for all using (auth.role() = 'authenticated');

create policy "messages_auth_all" on messages
  for all using (auth.role() = 'authenticated');

create policy "chat_usage_auth_all" on chat_usage
  for all using (auth.role() = 'authenticated');

-- Ingest key policy for Edge Function writes
create policy "conversations_ingest" on conversations
  for all using (
    current_setting('request.headers', true)::json->>'x-ingest-key' is not null
  );

create policy "messages_ingest" on messages
  for all using (
    current_setting('request.headers', true)::json->>'x-ingest-key' is not null
  );

create policy "chat_usage_ingest" on chat_usage
  for all using (
    current_setting('request.headers', true)::json->>'x-ingest-key' is not null
  );
