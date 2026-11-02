-- Destructive fixtures ONLY in a fresh disposable local database.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
\ir ../schema-reference/supabase_auth_profiles.sql
-- Use the current shape without the historical auth backfill's extra columns.
alter table public.profiles add column email text, add column status text not null default 'active',
 add column invited_by text, add column invited_at timestamptz;
\ir ../schema-reference/supabase_manager_role.sql
insert into auth.users values ('00000000-0000-4000-8000-000000000001','admin@test','{"role":"admin"}');
\ir ../schema-reference/supabase_account_expiry.sql
-- Reapply to test migration idempotence.
\ir ../schema-reference/supabase_account_expiry.sql
insert into auth.users values
 ('00000000-0000-4000-8000-000000000002','manager@test','{"role":"manager"}'),
 ('00000000-0000-4000-8000-000000000003','viewer@test','{"role":"viewer"}'),
 ('00000000-0000-4000-8000-000000000004','other@test','{"role":"viewer"}'),
 ('00000000-0000-4000-8000-000000000005','pending@test','{"role":"viewer","access_setup_required":true}');
update public.profiles set status='active' where user_id <> '00000000-0000-4000-8000-000000000005';
update public.profiles set invited_by='manager@test' where email in ('viewer@test','pending@test');
create function pg_temp.expect_error(actor uuid, target uuid, action text, days integer, expected text)
returns void language plpgsql as $$
begin
  perform public.change_account_access(actor,target,action,days,gen_random_uuid());
  raise exception 'Expected failure %', expected;
exception when others then
  if sqlstate <> expected then raise; end if;
end $$;
do $$
declare
 a uuid := '00000000-0000-4000-8000-000000000001';
 m uuid := '00000000-0000-4000-8000-000000000002';
 v uuid := '00000000-0000-4000-8000-000000000003';
 o uuid := '00000000-0000-4000-8000-000000000004';
 p uuid := '00000000-0000-4000-8000-000000000005';
 r uuid := gen_random_uuid(); d timestamptz; d2 timestamptz;
begin
 assert (select access_expires_at is null and not access_setup_pending from public.profiles where user_id=a), 'legacy account changed';
 assert (select access_setup_pending from public.profiles where user_id=p), 'new invite must start closed';
 perform public.change_account_access(m,p,'initialize',null,gen_random_uuid());
 assert (select access_expires_at is null and not access_setup_pending from public.profiles where user_id=p), 'legacy invite not compatible';
 perform pg_temp.expect_error(m,o,'set',7,'42501');
 perform pg_temp.expect_error(m,a,'set',7,'42501');
 perform pg_temp.expect_error(m,m,'set',7,'42501');
 perform pg_temp.expect_error(v,o,'set',7,'42501');
 perform pg_temp.expect_error(m,v,'unlimited',null,'42501');
 perform pg_temp.expect_error(a,a,'set',7,'42501');
 perform pg_temp.expect_error(a,v,'set',31,'22023');
 perform pg_temp.expect_error(a,v,'extend',7,'22023');
 d := public.change_account_access(m,v,'set',7,r);
 assert d = statement_timestamp() + interval '168 hours', 'incorrect 7-day duration';
 d2 := public.change_account_access(m,v,'set',7,r);
 assert d2 = d, 'retry changed deadline';
 assert (select count(*) = 1 from public.account_access_log where request_id=r), 'duplicate audit';
 d2 := public.change_account_access(m,v,'extend',30,gen_random_uuid());
 assert d2 = d + interval '720 hours', 'extension lost remaining time';
 update public.profiles set access_expires_at=now()-interval '1 day', status='disabled' where user_id=v;
 d := public.change_account_access(a,v,'extend',7,gen_random_uuid());
 assert d = statement_timestamp()+interval '168 hours', 'expired renewal base';
 assert (select status='disabled' from public.profiles where user_id=v), 'renewal enabled disabled account';
 perform public.change_account_access(a,m,'set',7,gen_random_uuid());
 perform pg_temp.expect_error(m,v,'set',30,'22023');
 update public.profiles set access_expires_at=now() where user_id=m;
 perform pg_temp.expect_error(m,v,'set',7,'42501');
 assert not has_function_privilege('authenticated','public.change_account_access(uuid,uuid,text,integer,uuid)','EXECUTE'), 'RPC exposed';
 assert not has_function_privilege('anon','public.change_account_access(uuid,uuid,text,integer,uuid)','EXECUTE'), 'RPC exposed';
 assert not has_table_privilege('authenticated','public.account_access_log','SELECT'), 'audit exposed';
end $$;
select 'All account expiry database assertions passed' as result;
