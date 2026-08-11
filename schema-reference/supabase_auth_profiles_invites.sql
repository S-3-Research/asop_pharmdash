-- Run this once in the Supabase SQL editor for this project, AFTER
-- supabase_auth_profiles.sql has already been applied.
--
-- Adds invitation-related columns to `public.profiles` and updates the
-- new-user trigger so that:
--   - `email` is cached on the profile row (handy for the admin Users list
--     without needing an extra admin.listUsers() call every time).
--   - `status` tracks whether the account has completed setup yet
--     ('invited' until the user sets a password, then 'active').
--   - `role` is read from the invited user's `user_metadata.role` (set by
--     `auth.admin.inviteUserByEmail(email, { data: { role } })`) instead of
--     always defaulting to 'viewer', so admins can invite someone directly
--     as an admin.

alter table public.profiles
  add column if not exists email text,
  add column if not exists status text not null default 'active'
    check (status in ('invited', 'active', 'disabled')),
  add column if not exists invited_by text,
  add column if not exists invited_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_role text;
begin
  invited_role := new.raw_user_meta_data ->> 'role';

  insert into public.profiles (user_id, email, role, status, invited_at)
  values (
    new.id,
    new.email,
    case when invited_role in ('admin', 'viewer') then invited_role else 'viewer' end,
    -- Users created via inviteUserByEmail have no password yet and
    -- `email_confirmed_at` is null until they follow the invite link and
    -- set one; users created any other way (e.g. manual dashboard signup)
    -- are considered already active.
    case when new.email_confirmed_at is null then 'invited' else 'active' end,
    now()
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Supabase fires `updated` (not just `insert`) on auth.users when a user
-- completes an invite (their `email_confirmed_at` gets set) — flip the
-- profile row to 'active' at that point.
create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles set status = 'active' where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute procedure public.handle_user_confirmed();

-- Backfill: `email` is a brand-new column, so any profiles rows that
-- already existed before this migration ran have `email = null` (the
-- trigger above only populates it for rows inserted/updated from now on).
-- Copy the email from auth.users once so the admin Users list
-- (/api/admin/users) doesn't show "null" for pre-existing accounts.
update public.profiles p
set email = u.email
from auth.users u
where p.user_id = u.id
  and p.email is null;
