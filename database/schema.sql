-- College Event Management System
-- Run the complete script in Supabase Dashboard -> SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  email text not null unique,
  role text not null default 'student' check (role in ('student','organizer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 140),
  description text not null check (char_length(trim(description)) between 10 and 3000),
  category text not null check (category in ('Technical','Cultural','Sports','Workshop','Seminar','Other')),
  venue text not null check (char_length(trim(venue)) between 2 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 10000),
  status text not null default 'published' check (status in ('published','cancelled')),
  organizer_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_time_order check (ends_at > starts_at)
);
create index if not exists events_status_start_idx on public.events(status, starts_at);
create index if not exists events_organizer_idx on public.events(organizer_id);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'registered' check (status in ('registered','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_registration_per_user_event unique(event_id, user_id)
);
create index if not exists registrations_user_idx on public.registrations(user_id, created_at desc);
create index if not exists registrations_event_status_idx on public.registrations(event_id, status);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists registrations_set_updated_at on public.registrations;
create trigger registrations_set_updated_at before update on public.registrations for each row execute function public.set_updated_at();

-- Creates a student profile whenever Supabase Auth creates a user.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'New Student'),
    lower(new.email),
    'student'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

-- Atomic registration: the row lock prevents two simultaneous requests taking the last seat.
create or replace function public.register_for_event(p_event_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ev public.events%rowtype;
  current_count integer;
  existing_status text;
  registration_id uuid;
begin
  select * into ev from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if ev.status <> 'published' or ev.ends_at <= now() then raise exception 'EVENT_CLOSED'; end if;
  select status into existing_status from public.registrations where event_id = p_event_id and user_id = p_user_id;
  if existing_status = 'registered' then raise exception 'ALREADY_REGISTERED'; end if;
  select count(*) into current_count from public.registrations where event_id = p_event_id and status = 'registered';
  if current_count >= ev.capacity then raise exception 'EVENT_FULL'; end if;
  if existing_status = 'cancelled' then
    update public.registrations set status = 'registered' where event_id = p_event_id and user_id = p_user_id returning id into registration_id;
  else
    insert into public.registrations(event_id, user_id) values (p_event_id, p_user_id) returning id into registration_id;
  end if;
  return jsonb_build_object('id', registration_id, 'event_id', p_event_id, 'user_id', p_user_id, 'status', 'registered');
end;
$$;
revoke all on function public.register_for_event(uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_for_event(uuid, uuid) to service_role;

-- The Express server uses its service key and enforces authorization on every protected route.
-- RLS is enabled as defense-in-depth; no browser role is granted direct table access.
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;
revoke all on public.profiles, public.events, public.registrations from anon, authenticated;
grant all on public.profiles, public.events, public.registrations to service_role;
