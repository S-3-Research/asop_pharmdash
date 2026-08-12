-- Run this once in the Supabase SQL editor for this project, AFTER
-- supabase_auth_profiles.sql has already been applied.
--
-- Adds invitation-related columns to `public.profiles` and updates the
-- new-user trigger so that:
--   - `email` is cached on the profile row (handy for the admin Users list
--     without needing an extra admin.listUsers() call every time).
--   - `status` tracks whether the account has completed setup yet
--     ('invited' until the user actually finishes setting a password,
--     then 'active').
--   - `role` is read from the invited user's `user_metadata.role` (set by
--     `auth.admin.inviteUserByEmail(email, { data: { role } })`) instead of
--     always defaulting to 'viewer', so admins can invite someone directly
--     as an admin.
--
-- IMPORTANT — why there's no `auth.users`-based trigger flipping status to
-- 'active': three different columns were tried and all three turned out to
-- flip before the user actually finishes setup, making "Resend invite"
-- wrongly disappear for accounts that never got a working password:
--   - `email_confirmed_at` is set as soon as the invite/recovery token is
--     verified — even if the browser never calls `updateUser({ password })`
--     (abandoned set-password page, or an email security scanner
--     prefetching the link and burning the one-time token before the real
--     user clicks it).
--   - `encrypted_password` is non-null from the moment
--     `inviteUserByEmail` is called — GoTrue writes a random placeholder
--     password immediately so the auth.users row can exist at all.
--   - `last_sign_in_at` is set the moment the invite link's implicit-flow
--     token is verified and a session is established — before the user
--     has typed a password at all.
-- None of those columns can distinguish "token was verified" from "user
-- actually finished setup". So `status` is instead flipped to 'active' by
-- an explicit call from app/api/auth/activate/route.ts, made by
-- app/auth/set-password/page.tsx immediately after
-- `auth.updateUser({ password })` succeeds — the only place that actually
-- knows setup succeeded.

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
    -- Users created via inviteUserByEmail start as 'invited' and are only
    -- flipped to 'active' by the explicit /api/auth/activate call once
    -- they actually finish setting a password (see note above for why we
    -- can't infer this from any auth.users column). Users created any
    -- other way (e.g. a manual dashboard signup that already has a real
    -- password) are considered active immediately.
    case when invited_role is not null then 'invited' else 'active' end,
    now()
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Previous versions of this migration flipped `status` to 'active' via a
-- trigger watching `email_confirmed_at`, then `encrypted_password`, then
-- `last_sign_in_at` on auth.users — all three turned out to fire before
-- the user actually finished setting a password (see note above). That
-- trigger no longer exists; drop it if it's still installed from an
-- earlier run of this file.
drop trigger if exists on_auth_user_confirmed on auth.users;
drop function if exists public.handle_user_confirmed();

-- One-off repair for accounts stuck 'active' from any of those retired
-- trigger versions despite never having actually signed in — puts them
-- back into 'invited' so "Resend invite" becomes available again in the
-- admin Users page. Safe to leave in / re-run: only touches rows that
-- still look like they never completed a real sign-in.
update public.profiles p
set status = 'invited'
from auth.users u
where u.id = p.user_id
  and p.status = 'active'
  and u.last_sign_in_at is null;

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
