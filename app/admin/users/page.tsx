import { redirect } from "next/navigation";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import UsersClient from "./users-client";

/**
 * Server-side gate: only `admin` role users may view this page (same
 * pattern as app/admin/data-releases/page.tsx).
 */
export default async function AdminUsersPage() {
  const auth = await requireAuthenticatedActor();

  if (!auth.ok) {
    redirect("/login");
  }

  if (auth.role !== "admin") {
    redirect("/dashboard");
  }

  return <UsersClient currentActor={auth.actor} />;
}
