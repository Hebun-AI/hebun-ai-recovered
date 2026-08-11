"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { resolveProviderControlAuthority } from "@/features/heby-provider-ops/provider-authority.server";
import { setClaudeDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";

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
