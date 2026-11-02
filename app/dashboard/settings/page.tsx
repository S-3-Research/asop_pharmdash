import { redirect } from "next/navigation";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const auth = await requireAuthenticatedActor();

  if (!auth.ok) {
    redirect(auth.code === "ACCOUNT_EXPIRED" ? "/auth/expired" : "/login");
  }

  return <SettingsClient />;
}
