// =============================================================================
// Seismic World Cup — Supabase schema
// =============================================================================
// Panini-style community cards. Each submission is a single user's card
// that goes through Discord-based curator review before appearing in the
// public album.
// =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Card enums
-- -----------------------------------------------------------------------------
create type card_position as enum (
  'forward', 'midfielder', 'defender', 'goalkeeper', 'captain', 'coach'
);

create type card_kit as enum ('home', 'away', 'foil');

create type submission_status as enum ('pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- discord_sessions: user sessions after Discord OAuth
-- -----------------------------------------------------------------------------
create table if not exists discord_sessions (
  session_id uuid primary key default uuid_generate_v4(),
  discord_id text not null unique,
  username text not null,
  global_name text,
  pfp_url text not null,
  is_default_avatar boolean default false,
  magnitude int check (magnitude between 1 and 9),
  role_ids text[] default '{}',
  joined_at timestamptz,
  access_token text not null,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists discord_sessions_discord_id_idx on discord_sessions (discord_id);
create index if not exists discord_sessions_expires_at_idx on discord_sessions (expires_at);

-- -----------------------------------------------------------------------------
-- submissions: every card attempt
-- -----------------------------------------------------------------------------
create table if not exists submissions (
  id uuid primary key default uuid_generate_v4(),
  discord_id text not null,
  username text not null,
  global_name text,
  pfp_url text not null,
  magnitude int check (magnitude between 1 and 9),
  position card_position not null,
  kit card_kit not null default 'home',
  motto text not null check (char_length(motto) <= 80),
  card_png_url text,                            -- rendered card (client-side, then uploaded)
  stats jsonb default '{}',                     -- { pac, sho, pas, dri } deterministic by discord_id
  status submission_status not null default 'pending',
  rejection_reason text,
  discord_message_id text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewer_id text,
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
  moderator_id text not null,
  moderator_handle text,
  action text not null check (action in ('approve', 'reject', 'request_changes')),
  reason text,
  created_at timestamptz default now()
);

create index if not exists moderator_audit_submission_idx on moderator_audit (submission_id);

-- -----------------------------------------------------------------------------
-- public_album view: only approved cards, newest first
-- -----------------------------------------------------------------------------
create or replace view public_album as
  select
    id, username, global_name, pfp_url, magnitude,
    position, kit, motto, card_png_url, stats, submitted_at
  from submissions
  where status = 'approved'
  order by submitted_at desc;

-- -----------------------------------------------------------------------------
-- Rate limit helper: max N submissions per discord_id in last D days
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

create policy "public read approved" on submissions
  for select using (status = 'approved');

create policy "service role write submissions" on submissions
  for all using (auth.role() = 'service_role');

create policy "service role write sessions" on discord_sessions
  for all using (auth.role() = 'service_role');

create policy "service role write audit" on moderator_audit
  for all using (auth.role() = 'service_role');

-- Storage bucket: cards (publicly readable)
-- Create in dashboard: insert into storage.buckets (id, name, public) values ('cards', 'cards', true);
