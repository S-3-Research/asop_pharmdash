import { redirect } from "next/navigation";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import { getActiveChannel } from "@/lib/channel";
import { DashboardShell } from "./components/dashboard-shell";

export default async function DashboardPage() {
  const auth = await requireAuthenticatedActor();

  if (!auth.ok) {
    redirect("/login");
  }

  const channel = getActiveChannel();

  return <DashboardShell channel={channel} />;
}
