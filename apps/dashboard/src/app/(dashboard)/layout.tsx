import { redirect } from "next/navigation";
import { HebunShell } from "@/components/layout/hebun-shell";
import { ThemeScope } from "@/components/theme/theme-scope";
import type { ShellAccount } from "@/components/layout/account-menu";
import { resolveShellExperience } from "@/config/customer-nav";
import {
  getAuthEnvironment,
  readSwitchableWorkspacesForRequest,
  resolveRequestAuthentication,
} from "@/features/auth-runtime/request-session.server";
import { resolveHumanLabels } from "@/features/auth-runtime/human-label-read.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { EmailOwnershipNotice } from "@/components/auth/email-ownership-notice";
import type { EmailOwnershipState } from "@/features/auth-email-ownership/contracts";
import { readEmailOwnershipState } from "@/features/auth-email-ownership/email-verification.server";

/**
 * Who the top bar names, from the session this layout just authorized — never written in a file.
 *
 * The name is the released Identity label (`display_name → name → email`) for this session's own
 * user; the role is the role of THIS session's membership, read from the same entitlement list the
 * workspace switcher uses. Both reads fail soft to null, and a null simply leaves that line out.
 */
async function resolveShellAccount(tenant: TenantContext): Promise<ShellAccount> {
  const [labels, memberships] = await Promise.all([
    resolveHumanLabels(tenant, [tenant.userId]).catch(() => new Map<string, string>()),
    readSwitchableWorkspacesForRequest(),
  ]);
  const current = memberships.find((m) => m.membershipId === tenant.membershipId);
  return { name: labels.get(tenant.userId) ?? null, role: current?.roleName ?? null };
}

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
  let account: ShellAccount | null = null;
  let emailOwnership: EmailOwnershipState = { status: "unavailable" };
  if (env.status === "configured") {
    const result = await resolveRequestAuthentication(env);
    if (result.status !== "authorized") {
      redirect("/login");
    }
    [account, emailOwnership] = await Promise.all([
      resolveShellAccount(result.tenantContext),
      /* Fails soft to `unavailable`, which renders nothing: this read must never cost a page. */
      readEmailOwnershipState(result.tenantContext.authIdentityId),
    ]);
  } else if (env.status === "invalid") {
    redirect("/login");
  }

  /* P2 Phase 2A: the authenticated workspace is the customer experience — Light unless chosen. */
  return (
    <ThemeScope experience="customer">
      {/* P2 Phase 2B: a server-side deployment setting picks the navigation; default Director. */}
      <HebunShell account={account} experience={resolveShellExperience(process.env.HEBUN_SHELL_EXPERIENCE)}>
        <EmailOwnershipNotice state={emailOwnership} />
        {children}
      </HebunShell>
    </ThemeScope>
  );
}
