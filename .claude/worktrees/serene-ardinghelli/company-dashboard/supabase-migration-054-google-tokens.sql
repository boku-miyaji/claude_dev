-- Migration 054: Google OAuth tokens for server-side calendar access
-- Stores encrypted refresh tokens so users don't need to re-authenticate hourly

create table if not exists google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_encrypted text not null,
  scopes text not null default 'https://www.googleapis.com/auth/calendar.events',
  calendar_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: users can read their own row, but only Edge Functions (service_role) can write
alter table google_tokens enable row level security;

create policy "Users can read own token" on google_tokens
  for select using (auth.uid() = user_id);

-- No insert/update/delete policies for authenticated users
-- Edge Function uses service_role key to bypass RLS
