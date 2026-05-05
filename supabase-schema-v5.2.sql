-- ============================================================
-- JARVISFACTORY v5.2 — Backend for JARVIS-built apps
-- Run this in your Supabase SQL Editor (in addition to v1 schema)
-- ============================================================
--
-- This adds 3 generic tables that EVERY app JARVIS builds can use:
--   - app_users   : end-users who sign up to apps you build
--   - app_data    : key-value rows for any app data (staff, gifts, orders, anything)
--   - app_sessions: simple session tokens for staying logged in
--
-- All tables are scoped by app_id (the app_id from your `apps` table)
-- so each app's data is fully isolated.
-- ============================================================

-- 1. End-users of apps (e.g. staff signing up to BirthdayGifts Pro)
create table if not exists app_users (
  id uuid default gen_random_uuid() primary key,
  app_id uuid references apps(id) on delete cascade not null,
  email text not null,
  password_hash text not null,
  full_name text,
  role text default 'user',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(app_id, email)
);

create index if not exists idx_app_users_app_id on app_users(app_id);
create index if not exists idx_app_users_email on app_users(app_id, email);

-- 2. Generic key-value data store for app records
-- e.g. table='staff', key=<uuid>, value=<json blob>
create table if not exists app_data (
  id uuid default gen_random_uuid() primary key,
  app_id uuid references apps(id) on delete cascade not null,
  app_user_id uuid references app_users(id) on delete cascade,
  table_name text not null,
  record_key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(app_id, table_name, record_key)
);

create index if not exists idx_app_data_app_id on app_data(app_id);
create index if not exists idx_app_data_table on app_data(app_id, table_name);
create index if not exists idx_app_data_user on app_data(app_user_id);

-- 3. Sessions for keeping users logged in
create table if not exists app_sessions (
  id uuid default gen_random_uuid() primary key,
  app_id uuid references apps(id) on delete cascade not null,
  app_user_id uuid references app_users(id) on delete cascade not null,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_app_sessions_token on app_sessions(token);

-- ============================================================
-- Row-Level Security
-- These tables are accessed BY THE APPS THEMSELVES via the
-- anon key, NOT by JARVIS users directly. RLS policies allow
-- anyone with the anon key to insert/select rows for a given
-- app_id, but the auth boundary is enforced by the app's own
-- email/password check + the app_id in every query.
-- ============================================================

alter table app_users enable row level security;
alter table app_data enable row level security;
alter table app_sessions enable row level security;

-- Allow apps to manage their own users (anon key access)
drop policy if exists "Apps can manage their users" on app_users;
create policy "Apps can manage their users"
  on app_users for all
  using (true) with check (true);

drop policy if exists "Apps can manage their data" on app_data;
create policy "Apps can manage their data"
  on app_data for all
  using (true) with check (true);

drop policy if exists "Apps can manage their sessions" on app_sessions;
create policy "Apps can manage their sessions"
  on app_sessions for all
  using (true) with check (true);

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================
create or replace function update_app_data_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_data_set_updated_at on app_data;
create trigger app_data_set_updated_at
  before update on app_data
  for each row execute procedure update_app_data_timestamp();
