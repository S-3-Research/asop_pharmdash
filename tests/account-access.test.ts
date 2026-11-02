import { strict as assert } from "node:assert";
import { test } from "node:test";
// @ts-expect-error Node's native TypeScript runner requires the file extension.
import { accessFailure, isExpiryChange } from "../lib/account-access.ts";
const now = Date.parse("2026-11-01T00:00:00Z");
test("legacy active profiles remain unlimited", () => {
  assert.equal(accessFailure({ status: "active", access_expires_at: null }, now), null);
});
test("expiry is inclusive and accepts timezone offsets", () => {
  const profile = { status: "active", access_expires_at: "2026-10-31T17:00:00-07:00" };
  assert.equal(accessFailure(profile, now - 1), null);
  assert.equal(accessFailure(profile, now), "ACCOUNT_EXPIRED");
  assert.equal(accessFailure(profile, now + 1), "ACCOUNT_EXPIRED");
});
test("disabled and pending accounts stay closed regardless of renewal", () => {
  assert.equal(accessFailure({ status: "disabled", access_expires_at: null }, now), "ACCOUNT_DISABLED");
  assert.equal(accessFailure({ status: "active", access_expires_at: null, access_setup_pending: true }, now), "ACCOUNT_NOT_ACTIVE");
  assert.equal(accessFailure({ status: "invited", access_expires_at: null }, now), "ACCOUNT_NOT_ACTIVE");
});
test("malformed timestamps fail closed", () => {
  assert.equal(accessFailure({ status: "active", access_expires_at: "bad" }, now), "ACCOUNT_EXPIRED");
});
test("mutation validation rejects unsupported durations and missing idempotency keys", () => {
  const requestId = "11111111-1111-4111-8111-111111111111";
  for (const action of ["set", "extend"]) for (const days of [7, 30]) assert.equal(isExpiryChange({ action, days, requestId }), true);
  assert.equal(isExpiryChange({ action: "unlimited", requestId }), true);
  for (const value of [null, {}, { action: "set", days: 7 }, { action: "set", days: 31, requestId }, { action: "unlimited", days: 7, requestId }, { action: "initialize", requestId }]) assert.equal(isExpiryChange(value), false);
});
