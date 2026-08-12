"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ProfileRow = {
  user_id: string;
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
}: {
  currentActor: string;
  currentRole: "admin" | "manager";
}) {
  const isManager = currentRole === "manager";
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteQuota, setInviteQuota] = useState<number | null>(null);
  const [inviteQuotaUsed, setInviteQuotaUsed] = useState<number | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = (await res.json()) as {
        users: ProfileRow[];
        inviteQuota: number | null;
        inviteQuotaUsed: number | null;
      };
      setUsers(data.users);
      setInviteQuota(data.inviteQuota ?? null);
      setInviteQuotaUsed(data.inviteQuotaUsed ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviting(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.message ?? "Failed to send invite");
      setInviting(false);
      return;
    }

    setMessage(`Invite sent to ${inviteEmail}.`);
    setInviteEmail("");
    setInviteRole("viewer");
    setInviting(false);
    refresh();
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
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 bg-white p-6 text-slate-900">
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

      <section className="rounded-xl border border-slate-200 p-4">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "admin" | "manager" | "viewer")}
              >
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={
              inviting || (isManager && inviteQuota !== null && (inviteQuotaUsed ?? 0) >= inviteQuota)
            }
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">All users</h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Email</th>
                <th>Role</th>
                <th>Status</th>
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
          </table>
        )}
      </section>
    </main>
  );
}
