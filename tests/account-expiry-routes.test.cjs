/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

// Execute actual route/auth source with mocked network boundaries, not production credentials.
function load(file, mocks, env = {}) {
  const testModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    exports: testModule.exports, module: testModule, process: { env: { ACCOUNT_EXPIRY_MANAGEMENT_ENABLED: 'true', ...env } },
    crypto: globalThis.crypto, Date, console,
    require: name => {
      if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (name === 'server-only') return {};
      if (name in mocks) return mocks[name];
      throw new Error(`Unmocked boundary: ${name}`);
    },
  }, { filename: file });
  return testModule.exports;
}
const policy = load('lib/account-access.ts', {});
function setup({ role = 'manager', target = {}, profile = {}, dbError = null, rpcError = null, ownError = null, legacySchema = false, env = {} } = {}) {
  const calls = [];
  const row = { email: 'viewer@test', role: 'viewer', invited_by: 'manager@test', access_expires_at: null, ...target };
  const actor = { role, status: 'active', ...(legacySchema ? {} : { access_expires_at: null, access_setup_pending: false }), ...profile };
  const admin = {
    from() {
      let result = { data: row, error: null };
      const query = {
        select(fields) {
          if (fields === '*' || fields.includes('access_setup_pending')) result = { data: actor, error: dbError };
          return query;
        },
        eq() { return query; },
        update(value) { calls.push(['update', value]); result = { data: null, error: ownError }; return query; },
        single: async () => result,
        maybeSingle: async () => result,
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return query;
    },
    rpc: async (name, args) => { calls.push(['rpc', args]); return { data: null, error: rpcError }; },
    auth: { admin: {
      updateUserById: async (...args) => { calls.push(['ban', ...args]); return { error: null }; },
      inviteUserByEmail: async (...args) => { calls.push(['invite', ...args]); return { data: { user: { id: 'new-user' } }, error: null }; },
    } },
  };
  const user = { id: 'actor-id', email: `${role}@test` };
  const mocks = {
    '@/lib/account-access': policy,
    '@/lib/supabase-admin': { getSupabaseAdmin: () => admin },
    '@/lib/supabase-server': { getSupabaseServerClient: async () => ({ auth: {
      getUser: async () => ({ data: { user } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } }) },
    } }) },
    '@/lib/supabase': { supabase: {} },
  };
  const auth = load('app/api/admin/_auth.ts', mocks, env);
  mocks['@/app/api/admin/_auth'] = auth;
  return { calls, auth, route: load('app/api/admin/users/[userId]/route.ts', mocks), invites: load('app/api/admin/users/route.ts', mocks) };
}
const body = value => ({ json: async () => value });
const params = { params: Promise.resolve({ userId: 'target-id' }) };
const expiry = { action: 'set', days: 7, requestId: '11111111-1111-4111-8111-111111111111' };
test('expired sessions fail actual unified auth before mutation', async () => {
  const s = setup({ profile: { access_expires_at: '2000-01-01T00:00:00Z' } });
  const res = await s.route.PATCH(body({ expiry }), params);
  assert.equal(res.status, 403); assert.equal((await res.json()).code, 'ACCOUNT_EXPIRED'); assert.equal(s.calls.length, 0);
});
test('database failure fails closed', async () => {
  const s = setup({ dbError: { message: 'unavailable' } });
  const result = await s.auth.requireAuthenticatedActor();
  assert.equal(s.auth.authError(result).status, 503);
});
test('legacy status update does not touch expiry or call expiry RPC', async () => {
  const s = setup(); const res = await s.route.PATCH(body({ status: 'active' }), params);
  assert.equal(res.status, 200);
  assert.equal(s.calls.some(c => c[0] === 'rpc'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls.find(c => c[0] === 'update')[1])), { status: 'active' });
});
test('manager cannot manage another inviter viewer', async () => {
  const s = setup({ target: { invited_by: 'other@test' } });
  assert.equal((await s.route.PATCH(body({ expiry }), params)).status, 403); assert.equal(s.calls.length, 0);
});
test('expiry RPC receives verified actor and stable request key', async () => {
  const s = setup(); assert.equal((await s.route.PATCH(body({ expiry }), params)).status, 200);
  assert.equal(s.calls[0][1].p_actor, 'actor-id'); assert.equal(s.calls[0][1].p_request_id, expiry.requestId);
});
test('mixed role/expiry mutation rejected before any writes', async () => {
  const s = setup({ role: 'admin' });
  assert.equal((await s.route.PATCH(body({ expiry, status: 'active' }), params)).status, 400); assert.equal(s.calls.length, 0);
});
test('invalid duration rejected and database policy errors propagated', async () => {
  const s = setup({ rpcError: { code: '42501' } });
  assert.equal((await s.route.PATCH(body({ expiry: { ...expiry, days: 999 } }), params)).status, 400);
  assert.equal((await s.route.PATCH(body({ expiry }), params)).status, 403);
});
test('legacy admin invite keeps unlimited access and closes setup before initialization', async () => {
  const s = setup({ role: 'admin' });
  assert.equal((await s.invites.POST(body({ email: 'new@test.com' }))).status, 200);
  assert.equal(s.calls.find(c => c[0] === 'invite')[2].data.access_setup_required, true);
  assert.equal(s.calls.find(c => c[0] === 'rpc')[1].p_days, null);
});
test('invite expiry persistence failure never reports success', async () => {
  const s = setup({ role: 'admin', rpcError: { code: 'XX000' } });
  const res = await s.invites.POST(body({ email: 'new@test.com', accessDays: 7 }));
  assert.equal(res.status, 500); assert.match((await res.json()).message, /blocked/);
});
test('failed ownership save does not open pending invitation', async () => {
  const s = setup({ role: 'admin', ownError: { message: 'failed' } });
  assert.equal((await s.invites.POST(body({ email: 'new@test.com' }))).status, 500);
  assert.equal(s.calls.some(c => c[0] === 'rpc'), false);
});
test('legacy manager invite keeps omitted duration while explicit unlimited is rejected', async () => {
  const s = setup();
  assert.equal((await s.invites.POST(body({ email: 'new@test.com' }))).status, 200);
  assert.equal(s.calls.find(c => c[0] === 'rpc')[1].p_days, null);
  assert.equal((await s.invites.POST(body({ email: 'new@test.com', accessDays: null }))).status, 403);
});
test('invalid JSON and non-object bodies return client errors', async () => {
  const s = setup();
  assert.equal((await s.route.PATCH({ json: async () => { throw Error('bad JSON'); } }, params)).status, 400);
  assert.equal((await s.invites.POST(body(null))).status, 400);
});
test('unmigrated dev schema works only with expiry management disabled', async () => {
  const env = { NODE_ENV: 'development', ACCOUNT_EXPIRY_MANAGEMENT_ENABLED: 'false' };
  const s = setup({ legacySchema: true, env });
  const result = await s.auth.requireAuthenticatedActor();
  assert.equal(result.ok, true); assert.equal(result.accessExpiresAt, null);
});
test('production and enabled management reject unmigrated schema', async () => {
  for (const env of [
    { NODE_ENV: 'production', ACCOUNT_EXPIRY_MANAGEMENT_ENABLED: 'false' },
    { NODE_ENV: 'development', ACCOUNT_EXPIRY_MANAGEMENT_ENABLED: 'true' },
  ]) {
    const s = setup({ legacySchema: true, env });
    assert.equal((await s.auth.requireAuthenticatedActor()).code, 'ACCESS_UNAVAILABLE');
  }
});
test('partial migration cannot bypass expiry, even in local development', async () => {
  const env = { NODE_ENV: 'development', ACCOUNT_EXPIRY_MANAGEMENT_ENABLED: 'false' };
  const s = setup({ legacySchema: true, env, profile: { access_expires_at: '2000-01-01T00:00:00Z' } });
  assert.equal((await s.auth.requireAuthenticatedActor()).code, 'ACCESS_UNAVAILABLE');
});
test('dev compatibility never ignores existing deadlines or disabled status', async () => {
  const env = { NODE_ENV: 'development', ACCOUNT_EXPIRY_MANAGEMENT_ENABLED: 'false' };
  const expired = setup({ env, profile: { access_expires_at: '2000-01-01T00:00:00Z' } });
  assert.equal((await expired.auth.requireAuthenticatedActor()).code, 'ACCOUNT_EXPIRED');
  const disabled = setup({ env, legacySchema: true, profile: { status: 'disabled' } });
  assert.equal((await disabled.auth.requireAuthenticatedActor()).code, 'ACCOUNT_DISABLED');
});
