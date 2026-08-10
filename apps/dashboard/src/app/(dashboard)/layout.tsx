import { redirect } from "next/navigation";
import { HebunShell } from "@/components/layout/hebun-shell";
import {
  getAuthEnvironment,
  resolveRequestAuthentication,
} from "@/features/auth-runtime/request-session.server";

/**
 * Authoritative dashboard gate.
 *
 * - Auth configured  -> resolve the session server-side; redirect unauthenticated
 *   / forbidden requests to /login. Tenant identity is derived from the session
 *   row, never from client input.
 * - Auth enabled-but-invalid -> fail closed (redirect to /login).
 * - Auth disabled -> pre-auth mode: render unchanged (no DB, no cookies), so the
 *   existing UI, build, and tests are unaffected until auth is configured.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = getAuthEnvironment();
  if (env.status === "configured") {
    const result = await resolveRequestAuthentication(env);
    if (result.status !== "authorized") {
      redirect("/login");
    }
  } else if (env.status === "invalid") {
    redirect("/login");
  }

  return <HebunShell>{children}</HebunShell>;
}
