-- =============================================================================
-- Seismic World Cup — Supabase schema
-- Run via: Supabase SQL editor (or supabase db push)
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- discord_sessions: user sessions after Discord OAuth
-- -----------------------------------------------------------------------------
create table if not exists discord_sessions (
  session_id uuid primary key default uuid_generate_v4(),
  discord_id text not null unique,             -- Discord snowflake
  username text not null,
  global_name text,
  pfp_url text not null,
  is_default_avatar boolean default false,     -- true = no custom avatar, face-swap will fail
  magnitude int check (magnitude between 1 and 9),
  role_ids text[] default '{}',
  joined_at timestamptz,                        -- when user joined the Seismic guild
  access_token text not null,                   -- Discord implicit OAuth token (7d lifetime)
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists discord_sessions_discord_id_idx on discord_sessions (discord_id);
create index if not exists discord_sessions_expires_at_idx on discord_sessions (expires_at);

-- -----------------------------------------------------------------------------
-- submissions: every composed selfie
-- status workflow: pending → approved | rejected
-- -----------------------------------------------------------------------------
create type submission_status as enum ('pending', 'approved', 'rejected');

create table if not exists submissions (
  id uuid primary key default uuid_generate_v4(),
  discord_id text not null,
  username text not null,
  global_name text,
  pfp_url text not null,
  magnitude int check (magnitude between 1 and 9),
  base_scene text not null default 'podium-raise',
  composite_url text,
  raw_composite_url text,                       -- unprocessed AI output (Replicate URL, expires)
  status submission_status not null default 'pending',
  rejection_reason text,
  discord_message_id text,                      -- for reaction tracking
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewer_id text,                             -- Discord user ID of reviewer
  created_at timestamptz default now()
);

create index if not exists submissions_status_idx on submissions (status);
create index if not exists submissions_discord_id_idx on submissions (discord_id);
create index if not exists submissions_submitted_at_idx on submissions (submitted_at desc);

-- -----------------------------------------------------------------------------
-- moderator_audit: trail of every approval/rejection
-- -----------------------------------------------------------------------------
create table if not exists moderator_audit (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid references submissions(id) on delete cascade,
  moderator_id text not null,                   -- Discord user ID
  moderator_handle text,
  action text not null check (action in ('approve', 'reject', 'request_changes')),
  reason text,
  created_at timestamptz default now()
);

create index if not exists moderator_audit_submission_idx on moderator_audit (submission_id);

-- -----------------------------------------------------------------------------
-- public_gallery view: only approved submissions
-- -----------------------------------------------------------------------------
create or replace view public_gallery as
  select
    id, username, global_name, pfp_url, magnitude,
    composite_url, base_scene, submitted_at
  from submissions
  where status = 'approved'
  order by submitted_at desc;

-- -----------------------------------------------------------------------------
-- Rate limit helper: count submissions per discord_id in last N days
-- -----------------------------------------------------------------------------
create or replace function get_submission_count(p_discord_id text, p_days int)
returns table(count bigint) language sql stable as $$
  select count(*)::bigint as count
  from submissions
  where discord_id = p_discord_id
    and submitted_at > now() - (p_days || ' days')::interval;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table submissions enable row level security;
alter table discord_sessions enable row level security;
alter table moderator_audit enable row level security;

-- Public can read approved submissions
create policy "public read approved" on submissions
  for select using (status = 'approved');

-- No public write — service role only
create policy "service role write submissions" on submissions
  for all using (auth.role() = 'service_role');

create policy "service role write sessions" on discord_sessions
  for all using (auth.role() = 'service_role');

create policy "service role write audit" on moderator_audit
  for all using (auth.role() = 'service_role');

-- Storage bucket for composited images — create in dashboard:
--   insert into storage.buckets (id, name, public) values ('composites', 'composites', true);
