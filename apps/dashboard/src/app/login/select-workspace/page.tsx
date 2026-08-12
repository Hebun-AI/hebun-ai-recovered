/*
 * Workspace selection page — reachable after a proven credential, before a tenant-bound session.
 *
 * ── WHY IT LIVES UNDER `/login` ──────────────────────────────────────────────
 *
 * `middleware.ts` treats `/login` and everything beneath it as public, so this page needs NO change
 * to route protection: the edge gate lets it through exactly as it lets the sign-in form through,
 * and the dashboard stays as protected as it was. Putting the picker anywhere else would have meant
 * widening a global rule for one page.
 *
 * ── IT IS NOT PUBLIC IN THE SENSE THAT MATTERS ───────────────────────────────
 *
 * Being past the edge gate grants nothing here. The candidate list is read from the durable
 * pre-tenant receipt in the cookie, so a visitor without one sees an empty list and is offered the
 * sign-in form. There is no parameter for a tenant, a user or a membership; nothing on this page can
 * be aimed at somebody else's account.
 *
 * Server component: the read happens on the server, and the client receives only display data.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAuthEnvironment,
  readSelectableWorkspacesForRequest,
  resolveTenantContext,
} from "@/features/auth-runtime/request-session.server";
import { WorkspaceSelectionCard } from "@/components/auth/workspace-selection-card";

export const dynamic = "force-dynamic";

export default async function SelectWorkspacePage() {
  const env = getAuthEnvironment();
  if (env.status !== "configured") redirect("/login");

  /*
   * Already tenant-bound? Then this step is behind them — send them to the product rather than
   * asking a question they have answered.
   */
  const tenant = await resolveTenantContext();
  if (tenant) redirect("/foundation");

  const workspaces = await readSelectableWorkspacesForRequest();

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <WorkspaceSelectionCard
        workspaces={workspaces.map((workspace) => ({
          membershipId: workspace.membershipId,
          tenantName: workspace.tenantName,
          roleName: workspace.roleName,
        }))}
      />
      <p className="text-center text-xs text-fg-muted">
        <Link className="underline" href="/login">
          Sign in as someone else
        </Link>
      </p>
    </main>
  );
}
