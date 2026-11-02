/** Pure access policy, shared by server checks and deterministic tests. */
export type AccessProfile = {
  status: string;
  access_expires_at: string | null;
  access_setup_pending?: boolean;
};

export function accessFailure(profile: AccessProfile, now = Date.now()) {
  if (profile.status === "disabled") return "ACCOUNT_DISABLED";
  if (profile.access_setup_pending || profile.status !== "active") return "ACCOUNT_NOT_ACTIVE";
  if (profile.access_expires_at !== null) {
    const expires = Date.parse(profile.access_expires_at);
    if (!Number.isFinite(expires) || expires <= now) return "ACCOUNT_EXPIRED";
  }
  return null;
}

export type ExpiryChange = { action: "set" | "extend" | "unlimited"; days?: 7 | 30; requestId: string };
export function isExpiryChange(value: unknown): value is ExpiryChange {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.requestId)
    && (v.action === "unlimited" ? v.days === undefined :
      (v.action === "set" || v.action === "extend") && (v.days === 7 || v.days === 30));
}
