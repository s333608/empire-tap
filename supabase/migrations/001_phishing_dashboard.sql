-- ============================================================
-- Phishing Incident Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────
create table if not exists public.profiles (
  id        uuid references auth.users(id) on delete cascade primary key,
  email     text,
  full_name text,
  role      text not null default 'analyst'
              check (role in ('analyst', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Authenticated users can view profiles"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── Phishing Incidents ────────────────────────────────────
create table if not exists public.phishing_incidents (
  id                 uuid default gen_random_uuid() primary key,
  reported_by        uuid references public.profiles(id) on delete set null,
  title              text not null,
  description        text,
  sender_email       text,
  sender_ip          text,
  suspicious_urls    text[] default '{}',
  severity           text not null default 'medium'
                       check (severity in ('low', 'medium', 'high', 'critical')),
  status             text not null default 'new'
                       check (status in ('new', 'in_progress', 'resolved', 'escalated')),
  target_email       text,
  raw_headers        text,
  attachments_present boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  resolved_at        timestamptz
);

alter table public.phishing_incidents enable row level security;

create policy "Authenticated users can view incidents"
  on public.phishing_incidents for select
  using (auth.uid() is not null);

create policy "Authenticated users can create incidents"
  on public.phishing_incidents for insert
  with check (auth.uid() is not null);

create policy "Analysts update own incidents; admins update any"
  on public.phishing_incidents for update
  using (
    auth.uid() = reported_by
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "Only admins can delete incidents"
  on public.phishing_incidents for delete
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Auto-bump updated_at on every row update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists phishing_incidents_updated_at on public.phishing_incidents;
create trigger phishing_incidents_updated_at
  before update on public.phishing_incidents
  for each row execute function public.set_updated_at();


-- ── Seed: promote first user to admin ─────────────────────
-- After running this migration, sign up via the dashboard,
-- then run:
--   update public.profiles set role = 'admin' where email = 'your@email.com';
