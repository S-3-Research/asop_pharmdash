-- Run this once in the Supabase SQL editor for this project, AFTER
-- supabase_auth_profiles.sql and supabase_auth_profiles_invites.sql have
-- already been applied.
--
-- Adds a `manager` role, sitting between `admin` and `viewer`:
--   - Can see the Users page and invite new users, but only as `viewer`
--     (never `admin` or another `manager`).
--   - Can only see/manage the viewers *they themselves* invited
--     (enforced in app/api/admin/users/route.ts + users/[userId]/route.ts
--     by filtering on `invited_by = <manager's email>`), not the full
--     user list.
--   - Has a per-manager invite quota (`invite_quota`, default 5) capping
--     how many viewers they can invite in total.
--   - Cannot access /admin/data-releases (that page's server-side gate
--     already redirects anyone whose role isn't exactly 'admin' — see
--     app/admin/data-releases/page.tsx — so no change needed there).

-- Widen the role check constraint to allow 'manager'.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'manager', 'viewer'));

alter table public.profiles
  add column if not exists invite_quota integer not null default 5;

-- Update the new-user trigger to also accept 'manager' as a valid invited
-- role (previously only 'admin' | 'viewer' were recognized and anything
-- else silently fell back to 'viewer').
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
    case
      when invited_role in ('admin', 'manager', 'viewer') then invited_role
      else 'viewer'
    end,
    case when invited_role is not null then 'invited' else 'active' end,
    now()
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
