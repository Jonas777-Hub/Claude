-- Drei am Tag – Datenbank für Supabase
-- Einmal komplett in Supabase → SQL Editor einfügen und auf "Run" klicken.

create extension if not exists pgcrypto;

-- Spielname pro Konto
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nick text not null check (char_length(nick) between 1 and 24),
  created_at timestamptz not null default now()
);

-- Gruppen (jede Runde Freunde ist eine Gruppe mit Einladungscode)
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  code text not null unique,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_day text not null check (joined_day ~ '^\d{4}-\d{2}-\d{2}$'),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  url text not null check (url ~ '^https://(open\.spotify\.com|spotify\.link|spoti\.fi)/'),
  track_id text,
  title text not null check (char_length(title) between 1 and 80),
  artist text not null default '' check (char_length(artist) <= 80),
  note text not null default '' check (char_length(note) <= 140),
  day text not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at timestamptz not null default now()
);
create index if not exists songs_group_idx on public.songs (group_id);

create table if not exists public.ratings (
  song_id uuid not null references public.songs on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  group_id uuid not null references public.groups on delete cascade,
  score int not null check (score between 1 and 10),
  crit jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  comment text not null default '' check (char_length(comment) <= 600),
  updated_at timestamptz not null default now(),
  primary key (song_id, user_id)
);
create index if not exists ratings_group_idx on public.ratings (group_id);

-- Ist der angemeldete Nutzer in dieser Gruppe?
create or replace function public.is_member(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where group_id = g and user_id = auth.uid());
$$;

-- Höchstens 3 Lieder pro Person, Gruppe und Tag; kein Lied doppelt in einer Gruppe
create or replace function public.check_song() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from songs where group_id = new.group_id and user_id = new.user_id and day = new.day) >= 3 then
    raise exception 'LIMIT_REACHED';
  end if;
  if new.track_id is not null and exists (select 1 from songs where group_id = new.group_id and track_id = new.track_id) then
    raise exception 'DUPLICATE_SONG';
  end if;
  return new;
end $$;
drop trigger if exists songs_check on public.songs;
create trigger songs_check before insert on public.songs for each row execute function public.check_song();

-- Bewertung nur für Lieder der eigenen Gruppe und nicht für eigene Lieder
create or replace function public.check_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare g uuid; owner uuid;
begin
  select group_id, user_id into g, owner from songs where id = new.song_id;
  if g is null or g <> new.group_id then raise exception 'BAD_SONG'; end if;
  if owner = new.user_id then raise exception 'OWN_SONG'; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ratings_check on public.ratings;
create trigger ratings_check before insert or update on public.ratings for each row execute function public.check_rating();

-- Gruppe anlegen (mit zufälligem 6-stelligem Code) und selbst beitreten
create or replace function public.create_group(p_name text, p_day text) returns public.groups
language plpgsql security definer set search_path = public as $$
declare g groups; c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from groups where code = c);
  end loop;
  insert into groups (name, code, created_by) values (trim(p_name), c, auth.uid()) returning * into g;
  insert into members (group_id, user_id, joined_day) values (g.id, auth.uid(), p_day);
  return g;
end $$;

-- Mit Code einer Gruppe beitreten
create or replace function public.join_group(p_code text, p_day text) returns public.groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into g from groups where code = upper(trim(p_code));
  if g.id is null then raise exception 'CODE_NOT_FOUND'; end if;
  insert into members (group_id, user_id, joined_day) values (g.id, auth.uid(), p_day) on conflict do nothing;
  return g;
end $$;

revoke all on function public.create_group(text, text) from public, anon;
revoke all on function public.join_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group(text, text) to authenticated;

-- Zugriffsregeln
alter table public.profiles enable row level security;
alter table public.groups   enable row level security;
alter table public.members  enable row level security;
alter table public.songs    enable row level security;
alter table public.ratings  enable row level security;

drop policy if exists "profiles lesen" on public.profiles;
drop policy if exists "profil anlegen" on public.profiles;
drop policy if exists "profil ändern" on public.profiles;
create policy "profiles lesen"  on public.profiles for select to authenticated using (true);
create policy "profil anlegen"  on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profil ändern"   on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "gruppen lesen" on public.groups;
create policy "gruppen lesen" on public.groups for select to authenticated using (public.is_member(id));

drop policy if exists "mitglieder lesen" on public.members;
drop policy if exists "gruppe verlassen" on public.members;
create policy "mitglieder lesen"  on public.members for select to authenticated using (public.is_member(group_id));
create policy "gruppe verlassen"  on public.members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "lieder lesen" on public.songs;
drop policy if exists "lied schicken" on public.songs;
drop policy if exists "lied löschen" on public.songs;
create policy "lieder lesen"  on public.songs for select to authenticated using (public.is_member(group_id));
create policy "lied schicken" on public.songs for insert to authenticated with check (user_id = auth.uid() and public.is_member(group_id));
create policy "lied löschen"  on public.songs for delete to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.ratings r where r.song_id = songs.id));

drop policy if exists "bewertungen lesen" on public.ratings;
drop policy if exists "bewerten" on public.ratings;
drop policy if exists "bewertung ändern" on public.ratings;
drop policy if exists "bewertung löschen" on public.ratings;
create policy "bewertungen lesen" on public.ratings for select to authenticated using (public.is_member(group_id));
create policy "bewerten"          on public.ratings for insert to authenticated with check (user_id = auth.uid() and public.is_member(group_id));
create policy "bewertung ändern"  on public.ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(group_id));
create policy "bewertung löschen" on public.ratings for delete to authenticated using (user_id = auth.uid());

-- Live-Updates
do $$
begin
  begin alter publication supabase_realtime add table public.songs;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ratings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
end $$;
