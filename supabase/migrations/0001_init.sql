-- L.P.T Tennis Bracket schema
-- All write operations go through the service-role key from server actions/route handlers
-- (the app has a single fixed admin account, not per-row Supabase Auth users),
-- so RLS policies here only need to allow public read and block all public writes.

create extension if not exists "pgcrypto";

-- ========== members (정회원) ==========
create type gender as enum ('male', 'female');
create type grade as enum ('A', 'B', 'C');

create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender gender not null,
  grade grade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== rooms (일정/방) ==========
create type room_template as enum ('tuesday', 'thursday', 'saturday', 'custom');
create type room_status as enum ('draft', 'ready', 'published');

create table rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  template room_template not null default 'custom',
  event_date date not null,
  location text not null,
  is_indoor boolean not null default false,
  start_time time not null,
  end_time time not null,
  games_per_set smallint not null default 6, -- 세트(경기) 당 선승 게임 수: 4/5/6
  minutes_per_match smallint not null default 25, -- 5분 단위
  break_minutes smallint not null default 5,
  status room_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== courts (방에 속한 코트) ==========
create table courts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null, -- 'A', 'B', '12번' 등
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ========== room_participants (방 참가자, 등급은 방별 override 가능) ==========
create table room_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  grade_override grade, -- null이면 members.grade 사용
  created_at timestamptz not null default now(),
  unique (room_id, member_id)
);

-- ========== matches (대진표 경기) ==========
create type match_type as enum (
  'mens_doubles',    -- 남복
  'womens_doubles',  -- 여복
  'mixed_doubles',   -- 혼복
  'mixed_any_doubles', -- 잡복
  'mens_singles',    -- 남단
  'womens_singles'   -- 여단
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  match_type match_type not null,
  round_no smallint not null, -- 코트별 몇 번째 경기인지 (1,2,3...)
  start_time time,
  created_at timestamptz not null default now()
);

-- ========== match_players (경기 참가 선수, team 1 or 2) ==========
create table match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  room_participant_id uuid not null references room_participants(id) on delete cascade,
  team smallint not null check (team in (1, 2)),
  created_at timestamptz not null default now(),
  unique (match_id, room_participant_id)
);

create index idx_courts_room on courts(room_id);
create index idx_room_participants_room on room_participants(room_id);
create index idx_matches_room on matches(room_id);
create index idx_matches_court on matches(court_id);
create index idx_match_players_match on match_players(match_id);
create index idx_match_players_participant on match_players(room_participant_id);

-- ========== updated_at trigger ==========
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_members_updated_at before update on members
  for each row execute function set_updated_at();

create trigger trg_rooms_updated_at before update on rooms
  for each row execute function set_updated_at();

-- ========== RLS: public read-only, no public writes ==========
alter table members enable row level security;
alter table rooms enable row level security;
alter table courts enable row level security;
alter table room_participants enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;

create policy "public read members" on members for select using (true);
create policy "public read rooms" on rooms for select using (true);
create policy "public read courts" on courts for select using (true);
create policy "public read room_participants" on room_participants for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read match_players" on match_players for select using (true);

-- No insert/update/delete policies are defined for the anon/authenticated roles,
-- so all writes are denied under RLS unless performed with the service-role key
-- (used server-side only, after the app's own admin-session check).
