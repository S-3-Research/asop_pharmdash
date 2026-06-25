import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "./components/dashboard-shell";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("pharmdash_auth")?.value === "1";

  if (!isAuthenticated) {
    redirect("/login");
  }

  return <DashboardShell />;
}
