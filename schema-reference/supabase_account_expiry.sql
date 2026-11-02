-- Apply AFTER supabase_manager_role.sql, before deploying the application.
-- Additive: old accounts and old invite clients retain unlimited access.
begin;
alter table public.profiles
  add column if not exists access_expires_at timestamptz,
  add column if not exists access_setup_pending boolean not null default false;

create table if not exists public.account_access_log (
  request_id uuid primary key,
  actor_id uuid not null,
  target_id uuid not null,
  action text not null,
  days integer,
  previous_expires_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.account_access_log enable row level security;
revoke all on public.account_access_log from anon, authenticated;
grant all on public.account_access_log to service_role;

-- New UI invitations start closed until the server saves ownership + expiry.
-- This flag can only restrict access; no expiry/ownership is trusted from metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare invited_role text;
begin
  invited_role := new.raw_user_meta_data ->> 'role';
  insert into public.profiles (user_id, email, role, status, invited_at, access_setup_pending)
  values (new.id, new.email,
    case when invited_role in ('admin', 'manager', 'viewer') then invited_role else 'viewer' end,
    case when invited_role is not null then 'invited' else 'active' end, now(),
    coalesce(new.raw_user_meta_data ->> 'access_setup_required', 'false') = 'true')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Service-only RPC: actor identity MUST come from the verified server session.
-- Row lock + request UUID make concurrent extensions atomic and retries idempotent.
create or replace function public.change_account_access(
  p_actor uuid, p_target uuid, p_action text, p_days integer, p_request_id uuid
) returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  a public.profiles%rowtype;
  t public.profiles%rowtype;
  prior public.account_access_log%rowtype;
  deadline timestamptz;
  stamp timestamptz := statement_timestamp();
begin
  select * into a from public.profiles where user_id = p_actor for update;
  if not found or a.role not in ('admin', 'manager') or a.status <> 'active'
    or a.access_setup_pending or a.access_expires_at <= stamp then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_actor = p_target then raise exception 'Cannot change your own expiry' using errcode = '42501'; end if;
  select * into t from public.profiles where user_id = p_target for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if a.role = 'manager' and (t.role <> 'viewer' or t.invited_by is distinct from a.email) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  select * into prior from public.account_access_log where request_id = p_request_id;
  if found then
    if prior.actor_id <> p_actor or prior.target_id <> p_target or prior.action <> p_action
      or prior.days is distinct from p_days then
      raise exception 'Request ID already used' using errcode = '22023';
    end if;
    return prior.expires_at;
  end if;
  if p_action not in ('set', 'extend', 'unlimited', 'initialize') or p_action is null then
    raise exception 'Invalid action' using errcode = '22023';
  end if;
  if p_action = 'initialize' then
    if not t.access_setup_pending then raise exception 'Already initialized' using errcode = '22023'; end if;
  elsif t.role = 'admin' then
    raise exception 'Admin accounts do not expire' using errcode = '42501';
  end if;
  if (p_action in ('set', 'extend') and (p_days is null or p_days not in (7, 30)))
    or (p_action = 'initialize' and p_days is not null and p_days not in (7, 30))
    or (p_action = 'unlimited' and p_days is not null) then
    raise exception 'Invalid duration' using errcode = '22023';
  end if;
  if t.role = 'admin' and p_days is not null then
    raise exception 'Admin accounts do not expire' using errcode = '22023';
  end if;
  if p_action = 'unlimited' and a.role <> 'admin' then
    raise exception 'Only admins can remove expiry' using errcode = '42501';
  end if;
  if p_action = 'extend' and t.access_expires_at is null then
    raise exception 'Set a deadline before extending unlimited access' using errcode = '22023';
  end if;
  deadline := case when p_days is null then null
    else (case when p_action = 'extend' then greatest(t.access_expires_at, stamp) else stamp end)
      + make_interval(hours => p_days * 24) end;
  -- Legacy invitations without a duration remain unlimited for compatibility.
  if a.role = 'manager' and deadline is not null and a.access_expires_at is not null
    and deadline > a.access_expires_at then
    raise exception 'Expiry exceeds your own access deadline' using errcode = '22023';
  end if;
  update public.profiles set access_expires_at = deadline, access_setup_pending = false where user_id = p_target;
  insert into public.account_access_log(request_id, actor_id, target_id, action, days, previous_expires_at, expires_at)
    values (p_request_id, p_actor, p_target, p_action, p_days, t.access_expires_at, deadline);
  return deadline;
end;
$$;
revoke all on function public.change_account_access(uuid, uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.change_account_access(uuid, uuid, text, integer, uuid) to service_role;
commit;
