"use client";

import Link from "next/link";
import { ExpiryEditor } from "./expiry-editor";
import { useCallback, useEffect, useState } from "react";

import { LogoNav } from "@/app/dashboard/components/logo-nav";

type ProfileRow = {
  user_id: string;
  access_expires_at: string | null;
  access_setup_pending: boolean;
  email: string | null;
  role: "admin" | "manager" | "viewer";
  status: "invited" | "active" | "disabled";
  invited_by: string | null;
  invited_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

function formatLastLogin(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const STATUS_STYLES: Record<ProfileRow["status"], string> = {
  invited: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  disabled: "bg-slate-200 text-slate-600",
};

export default function UsersClient({
  currentActor,
  currentRole,
  expiryEnabled,
}: {
  expiryEnabled: boolean;
  currentActor: string;
  currentRole: "admin" | "manager";
}) {
  const isManager = currentRole === "manager";
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [observedAt, setObservedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteQuota, setInviteQuota] = useState<number | null>(null);
  const [inviteQuotaUsed, setInviteQuotaUsed] = useState<number | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "viewer">("viewer");
  const [accessDays, setAccessDays] = useState("7");
  const [inviting, setInviting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Could not load users");
      setUsers(data.users);
      setObservedAt(Date.now());
      setInviteQuota(data.inviteQuota ?? null);
      setInviteQuotaUsed(data.inviteQuotaUsed ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, ...(expiryEnabled ? { accessDays: inviteRole === "admin" || accessDays === "unlimited" ? null : Number(accessDays) } : {}) }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.message ?? "Failed to send invite");
        void refresh();
        return;
      }

      setMessage(`Invite sent to ${inviteEmail}.`);
      setInviteEmail("");
      setInviteRole("viewer");
      refresh();
    } catch {
      setError("Invitation request interrupted. Refresh the list before retrying.");
      void refresh();
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (userId: string, role: "admin" | "manager" | "viewer") => {
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? "Failed to update role");
      return;
    }
    refresh();
  };

  const toggleStatus = async (userId: string, nextStatus: "active" | "disabled") => {
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? "Failed to update status");
      return;
    }
    setMessage(nextStatus === "disabled" ? "Account disabled." : "Account re-enabled.");
    refresh();
  };

  const resendInvite = async (userId: string) => {
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend" }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? "Failed to resend invite");
      return;
    }
    setMessage("Invite resent.");
  };

  const deleteUser = async (userId: string, email: string | null) => {
    const ok = window.confirm(
      `Permanently delete ${email ?? "this user"}? This cannot be undone.`,
    );
    if (!ok) return;

    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.message ?? "Failed to delete user");
      return;
    }
    setMessage(`${email ?? "User"} deleted.`);
    refresh();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f7f9]">
      <LogoNav />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-8 text-slate-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          {isManager ? "My invited viewers" : "Users"}
        </h1>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
          ← Back to dashboard
        </Link>
      </div>

      {message ? (
        <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Invite a new user</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sends an email with a one-time link where they choose their own password. No password
          is set by you.
          {isManager && inviteQuota !== null ? (
            <span className="ml-1">
              You have used {inviteQuotaUsed ?? 0} of {inviteQuota} invites.
            </span>
          ) : null}
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={onInvite}>
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              className="h-10 w-full box-border rounded-lg border border-slate-300 px-3 py-0 text-sm outline-none focus:border-blue-500"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          {!isManager ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="invite-role">
                Role
              </label>
              <select
                id="invite-role"
                className="h-10 box-border rounded-lg border border-slate-300 px-3 py-0 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "manager" | "viewer")}
              >
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ) : null}
          {expiryEnabled && inviteRole !== "admin" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="invite-access-duration">
                Access duration
              </label>
              <select
                id="invite-access-duration"
                className="h-10 box-border rounded-lg border border-slate-300 px-3 py-0 text-sm"
                value={accessDays}
                onChange={(e) => setAccessDays(e.target.value)}
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                {!isManager && <option value="unlimited">Unlimited</option>}
              </select>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={
              inviting || (isManager && inviteQuota !== null && (inviteQuotaUsed ?? 0) >= inviteQuota)
            }
            className="inline-flex h-10 box-border items-center justify-center rounded-lg bg-slate-900 px-4 py-0 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">All users</h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto"><table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Access expiry</th>
                <th>Last login</th>
                <th>Invited by</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.email === currentActor;
                return (
                  <tr key={u.user_id} className="border-b border-slate-100">
                    <td className="py-2">
                      {u.email}
                      {isSelf ? <span className="ml-2 text-xs text-slate-400">(you)</span> : null}
                    </td>
                    <td>
                      {isManager ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {u.role}
                        </span>
                      ) : (
                        <select
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) =>
                            updateRole(u.user_id, e.target.value as "admin" | "manager" | "viewer")
                          }
                        >
                          <option value="viewer">Viewer</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[u.status]}`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-2 text-xs">
                      <div className="flex items-center gap-1">
                        {u.access_setup_pending ? <span className="text-red-700">Setup incomplete — access blocked</span> : <span className={`font-medium ${u.access_expires_at && Date.parse(u.access_expires_at) <= observedAt ? "text-red-700" : "text-slate-700"}`}>
                          {u.access_expires_at ? (Date.parse(u.access_expires_at) <= observedAt ? "Expired" : `${Math.ceil((Date.parse(u.access_expires_at) - observedAt) / 86400000)} days remaining`) : "Unlimited"}
                        </span>}
                        {expiryEnabled && !isSelf && u.role !== "admin" && !u.access_setup_pending && <ExpiryEditor userId={u.user_id} email={u.email} expiresAt={u.access_expires_at} isManager={isManager} onSaved={() => { setMessage("Access expiry updated."); void refresh(); }} />}
                      </div>
                      {!u.access_setup_pending && u.access_expires_at && <span className="mt-0.5 block text-slate-500">{new Date(u.access_expires_at).toLocaleString(undefined, { timeZoneName: "short" })}</span>}
                    </td>
                    <td
                      className="text-xs text-slate-500"
                      title={u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : undefined}
                    >
                      {formatLastLogin(u.last_sign_in_at)}
                    </td>
                    <td className="text-xs text-slate-500">{u.invited_by ?? "—"}</td>
                    <td className="space-x-2 text-right">
                      {u.status === "invited" ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          onClick={() => resendInvite(u.user_id)}
                        >
                          Resend invite
                        </button>
                      ) : null}
                      {!isSelf && u.status !== "invited" ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                          onClick={() =>
                            toggleStatus(u.user_id, u.status === "disabled" ? "active" : "disabled")
                          }
                        >
                          {u.status === "disabled" ? "Re-enable" : "Disable"}
                        </button>
                      ) : null}
                      {!isSelf && !isManager ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                          onClick={() => deleteUser(u.user_id, u.email)}
                        >
                          Delete
                        </button>
                      ) : null}
                      {!isSelf && isManager && u.status === "invited" ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:text-red-800"
                          onClick={() => deleteUser(u.user_id, u.email)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </section>
      </main>
    </div>
  );
}
