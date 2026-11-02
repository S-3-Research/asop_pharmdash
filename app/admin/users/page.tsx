import { redirect } from "next/navigation";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import UsersClient from "./users-client";

/**
 * Server-side gate: admins and managers may view this page (managers get
 * a restricted view scoped to viewers they invited, enforced inside
 * app/api/admin/users routes, not here).
 */
export default async function AdminUsersPage() {
  const auth = await requireAuthenticatedActor();

  if (!auth.ok) {
    redirect(auth.code === "ACCOUNT_EXPIRED" ? "/auth/expired" : "/login");
  }

  if (auth.role !== "admin" && auth.role !== "manager") {
    redirect("/dashboard");
  }

  return <UsersClient currentActor={auth.actor} currentRole={auth.role} expiryEnabled={process.env.ACCOUNT_EXPIRY_MANAGEMENT_ENABLED === "true"} />;
}
