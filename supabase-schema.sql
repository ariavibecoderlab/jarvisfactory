-- Run this in your Supabase SQL Editor
-- Go to: supabase.com → your project → SQL Editor → New Query → paste this → Run

-- 1. Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  jarvis_name text,
  onboarded boolean default false,
  plan text default 'starter',
  created_at timestamptz default now()
);

-- 2. JARVIS profiles (personalisation)
create table if not exists jarvis_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  jarvis_name text default 'JARVIS',
  industry text,
  role text,
  goal text,
  tech_level text,
  language text default 'English',
  created_at timestamptz default now()
);

-- 3. Apps built by users
create table if not exists apps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  html_code text,
  tokens_used integer,
  build_time text,
  deployed_url text,
  github_repo text,
  domain text,
  created_at timestamptz default now()
);

-- 4. Waitlist from landing page
create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  created_at timestamptz default now()
);

-- 5. Domain registrations
create table if not exists domains (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  app_id uuid references apps(id) on delete set null,
  domain_name text not null,
  registrar text default 'namecheap',
  status text default 'pending',
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table jarvis_profiles enable row level security;
alter table apps enable row level security;
alter table domains enable row level security;

-- Policies: users can only see their own data
create policy "Users see own profile" on profiles for all using (auth.uid() = id);
create policy "Users see own jarvis" on jarvis_profiles for all using (auth.uid() = user_id);
create policy "Users see own apps" on apps for all using (auth.uid() = user_id);
create policy "Users see own domains" on domains for all using (auth.uid() = user_id);
create policy "Anyone can join waitlist" on waitlist for insert with check (true);

-- Auto-create profile on signup trigger
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
