"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarClock, Check, LoaderCircle, Pencil, X } from "lucide-react";

type Props = {
  userId: string;
  email: string | null;
  expiresAt: string | null;
  isManager: boolean;
  onSaved: () => void;
};

export function ExpiryEditor({ userId, email, expiresAt, isManager, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("set");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const request = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const close = () => {
    if (inFlight.current) return;
    dialog.current?.close();
  };
  const preview = action === "unlimited" ? "No expiration date" : new Date(
    (action === "extend" ? Math.max(now, Date.parse(expiresAt!)) : now) + days * 86400000,
  ).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const actions = [
    { value: "set", label: "Set duration" },
    ...(expiresAt ? [{ value: "extend", label: "Extend access" }] : []),
    ...(!isManager ? [{ value: "unlimited", label: "Unlimited" }] : []),
  ];

  return <>
    <button
      type="button"
      aria-label={`Edit access expiry${email ? ` for ${email}` : ""}`}
      aria-haspopup="dialog"
      title="Edit access expiry"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
      onClick={() => {
        setNow(Date.now());
        setError("");
        setOpen(true);
        dialog.current?.showModal();
      }}
    >
      <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
    </button>

    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={() => setOpen(false)}
      onCancel={event => { if (inFlight.current) event.preventDefault(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-left text-slate-900 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={async event => {
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        const key = `${action}:${action === "unlimited" ? "" : days}`;
        if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
        try {
          const response = await fetch(`/api/admin/users/${userId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expiry: { action, ...(action === "unlimited" ? {} : { days }), requestId: request.current.id } }),
          });
          const body = await response.json();
          if (!response.ok) { setError(body.message ?? "Could not update expiry"); return; }
          request.current = null;
          dialog.current?.close();
          onSaved();
        } catch {
          setError("Connection interrupted. Retry to confirm the same change safely.");
        } finally {
          setBusy(false);
          inFlight.current = false;
        }
      }}>
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">Edit access expiry</h2>
            <p id={descriptionId} className="mt-1 break-all text-sm text-slate-500">{email ?? "Account access settings"}</p>
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label="Close expiry settings" className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-40">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <fieldset disabled={busy} className="space-y-6 px-6 py-6 disabled:opacity-60">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Current expiry</p>
            <p className="text-sm font-medium">{expiresAt ? new Date(expiresAt).toLocaleString(undefined, { timeZoneName: "short" }) : "Unlimited"}</p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Access setting</legend>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {actions.map(option => <label key={option.value} className="relative flex-1 cursor-pointer">
                <input type="radio" name={`expiry-action-${titleId}`} value={option.value} checked={action === option.value} onChange={() => { setAction(option.value); setNow(Date.now()); }} className="peer sr-only" />
                <span className="block rounded-lg px-2 py-2 text-center text-xs font-medium text-slate-500 peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-teal-600">{option.label}</span>
              </label>)}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {action === "set" ? "Start a new access period from today." : action === "extend" ? "Add time to the remaining period, or start today if expired." : "Keep access available without an expiration date."}
            </p>
          </fieldset>

          {action !== "unlimited" && <fieldset>
            <legend className="mb-2 text-sm font-medium">Duration</legend>
            <div className="grid grid-cols-2 gap-3">
              {[{ days: 7, label: "1 week" }, { days: 30, label: "1 month" }].map(option => <label key={option.days} className="relative cursor-pointer">
                <input type="radio" name={`expiry-days-${titleId}`} value={option.days} checked={days === option.days} onChange={() => { setDays(option.days); setNow(Date.now()); }} className="peer sr-only" />
                <span className="block rounded-xl border border-slate-200 px-4 py-3 peer-checked:border-teal-600 peer-checked:bg-teal-50/70 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-600">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs text-slate-500">{option.days} days</span>
                </span>
                {days === option.days && <Check size={14} className="pointer-events-none absolute right-3 top-3 text-teal-700" aria-hidden="true" />}
              </label>)}
            </div>
          </fieldset>}

          <div className="flex gap-3 rounded-xl bg-slate-50 p-4" aria-live="polite" aria-atomic="true">
            <CalendarClock size={18} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">{action === "unlimited" ? "New expiry" : "New expiry · estimated"}</p>
              <p className="mt-1 text-sm font-semibold">{preview}</p>
              {action !== "unlimited" && <p className="mt-1 text-xs text-slate-400">{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>}
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </fieldset>

        <footer className="border-t border-slate-100 px-6 py-4">
          <p className="mb-4 text-xs text-slate-500">Changing expiry won’t re-enable a disabled account.</p>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={close} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50">Cancel</button>
            <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50">
              {busy && <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  </>;
}
