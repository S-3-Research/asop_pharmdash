-- Run this once in the Supabase SQL editor for this project.
--
-- Adds a `profiles` table that stores app-level role info per Supabase Auth
-- user (Supabase Auth itself only manages email/password/MFA — it has no
-- concept of "admin" vs "viewer", so we keep that mapping ourselves).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users may read their own profile row (used only if you ever query this
-- from the browser with the publishable key; the server routes use the
-- service-role key and bypass RLS entirely).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

-- Auto-create a `viewer` profile row whenever a new auth user is created.
-- Promote specific users to 'admin' manually afterwards, e.g.:
--   update public.profiles set role = 'admin' where user_id = '<uuid>';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'viewer')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
