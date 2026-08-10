import { redirect } from "next/navigation";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import DataReleasesClient from "./data-releases-client";

/**
 * Server-side gate: only users with the `admin` role (see
 * public.profiles / app/api/admin/_auth.ts) may view this page.
 * Unauthenticated users are sent to /login; authenticated non-admins are
 * sent back to the dashboard.
 */
export default async function DataReleasesAdminPage() {
  const auth = await requireAuthenticatedActor();

  if (!auth.ok) {
    redirect("/login");
  }

  if (auth.role !== "admin") {
    redirect("/dashboard");
  }

  return <DataReleasesClient />;
}
