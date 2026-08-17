"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { resolveProviderControlAuthority } from "@/features/heby-provider-ops/provider-authority.server";
import { setClaudeDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { isExternalSendConfigured } from "@/features/action-execution/execution-arming-projection.server";
import { setExternalSendDirectorEnabled } from "@/features/action-execution/execution-control.server";

/**
 * Director connectivity control mutation (R2E). The ONLY client-crossable way to change the
 * durable Claude Director ON/OFF permission. It is deliberately thin and authority-safe:
 *
 *  - the tenant + role are resolved SERVER-SIDE from the R1 session (never client-supplied);
 *  - the actor must hold an owner/director authority band (checked against the durable role);
 *  - the client input is only a boolean `enabled` — no tenant, identity, role, or authority.
 *
 * It never returns a credential or any internal state — only the resulting permission.
 */
export type SetClaudeConnectivityResult =
  | { readonly status: "ok"; readonly directorEnabled: boolean }
  | { readonly status: "unauthorized" }
  | { readonly status: "forbidden" };

export async function setClaudeConnectivityAction(input: {
  enabled: boolean;
}): Promise<SetClaudeConnectivityResult> {
  // 1. Authentication + tenant + role are resolved server-side. The client supplies none of them.
  const tenant = await resolveTenantContext();
  if (!tenant) return { status: "unauthorized" };

  // 2. Only an owner/director authority band may change provider connectivity.
  const authority = await resolveProviderControlAuthority(tenant);
  if (!authority.authorized) return { status: "forbidden" };

  // 3. Persist the durable permission (coerced to a boolean — the only thing the client controls),
  //    recording the server-resolved actor for attribution.
  const control = await setClaudeDirectorEnabled(Boolean(input.enabled), { actorId: tenant.userId });
  revalidatePath("/platform");
  return { status: "ok", directorEnabled: control.directorEnabled };
}

/**
 * EXTERNAL-SEND ARMING (R3B). The ONLY client-crossable way to change the durable `external-send`
 * Director permission — the switch the execution runtime reads twice per attempt.
 *
 * It mirrors the Claude action deliberately: same authority resolver, same server-side tenant/role,
 * same boolean-only client input. No provider key crosses the boundary — the key is frozen inside
 * `setExternalSendDirectorEnabled`, so this action cannot be steered at another provider.
 *
 * ── THE ONE PLACE IT IS STRICTER THAN THE CLAUDE ACTION ──────────────────────
 *
 * ARMING FAILS CLOSED WITHOUT CONFIGURATION. Enabling a provider that has no credential, no sender
 * and no subject would produce a switch reading "on" over a deployment that cannot send — a state
 * whose only function is to mislead the next reader. So enabling is refused unless the deployment
 * is complete.
 *
 * DISARMING IS ALWAYS PERMITTED, including when configuration has since disappeared. A kill switch
 * that could not be turned off under a degraded configuration would be the wrong failure direction:
 * the whole point of the control is that a human can always stop it.
 *
 * It returns the resulting permission and nothing else — never a credential, sender, or subject.
 */
export type SetExternalSendConnectivityResult =
  | { readonly status: "ok"; readonly directorEnabled: boolean }
  | { readonly status: "unauthorized" }
  | { readonly status: "forbidden" }
  /** Enabling was refused because deployment configuration is incomplete. Nothing was written. */
  | { readonly status: "configuration-incomplete" };

export async function setExternalSendConnectivityAction(input: {
  enabled: boolean;
}): Promise<SetExternalSendConnectivityResult> {
  // 1. Authentication + tenant + role are resolved server-side. The client supplies none of them.
  const tenant = await resolveTenantContext();
  if (!tenant) return { status: "unauthorized" };

  // 2. Only an owner/director authority band may change provider connectivity. Same gate as Claude.
  const authority = await resolveProviderControlAuthority(tenant);
  if (!authority.authorized) return { status: "forbidden" };

  // 3. The only thing the client controls is a boolean, and only one direction of it is gated.
  const enabled = Boolean(input.enabled);
  if (enabled && !isExternalSendConfigured()) return { status: "configuration-incomplete" };

  // 4. Persist the durable permission, recording the server-resolved actor for attribution.
  const control = await setExternalSendDirectorEnabled(enabled, { actorId: tenant.userId });
  revalidatePath("/director/provider-matrix");
  return { status: "ok", directorEnabled: control.directorEnabled };
}
