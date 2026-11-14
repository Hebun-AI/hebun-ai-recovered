/*
 * P5 BYOK slice 2 — WHICH CREDENTIAL CARRIES THIS TENANT'S HEBY MODEL CALL (design gate B4).
 *
 *   no Anthropic connection            → the platform key, exactly as before this slice
 *   connected + healthy + a live key   → the tenant's own key, and only it
 *   a connection in any other state    → REFUSED: no transport at all. Never the platform key.
 *
 * "Any other state" is a revoked key, a key Anthropic rejected or could not be reached for, or a
 * connection the credential store cannot read. The tenant leaves BYOK only by a human disconnecting the
 * connection (the released `disconnectConnection`); nothing here moves it back to the platform key.
 *
 * The decision is made from the session's tenant only. The key is never opened here: the transport
 * opens it through `withDecryptedSecret` around the one fetch, so a key revoked after this decision
 * still refuses the call (B8: revocation effective on the next call).
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import { TENANT_ACCOUNT_REF_PREFIX } from "@/db/schema/external-ai-data-use";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import { isTerminalConnectionState } from "@/features/integration-authority/contracts";
import {
  listCredentialMetadata,
  withDecryptedSecret,
} from "@/features/integration-credentials/credential-repository.server";
import { ModelConnectivityError } from "@/features/heby-model/model-error";
import {
  MODEL_TRANSPORT_ENV_KEY,
  selectModelTransport,
  type ModelTransportSelection,
} from "@/features/heby-model/model-transport-selection.server";
import { createLiveClaudeTransport } from "@/features/heby-model-live/claude-http-transport.server";
import { ANTHROPIC_PROVIDER_KEY } from "./contracts";

export interface TenantModelCredentialDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export type ByokRefusal = "byok-key-revoked" | "byok-not-verified" | "byok-unavailable";

export type TenantModelCredential =
  | { readonly kind: "platform" }
  | { readonly kind: "tenant"; readonly integrationId: string; readonly credentialId: string }
  | { readonly kind: "refused"; readonly reason: ByokRefusal };

export const tenantAnthropicAccountRef = (integrationId: string): string =>
  `${TENANT_ACCOUNT_REF_PREFIX}${integrationId}`;

/** B4, as a pure read of the tenant's own connection. Fails closed: unreadable is refused, not platform. */
export async function resolveTenantModelCredential(
  tenant: TenantContext | null,
  deps: TenantModelCredentialDeps = {},
): Promise<TenantModelCredential> {
  if (!tenant?.tenantId) return { kind: "refused", reason: "byok-unavailable" };
  try {
    const listing = await listConnections(tenant, { getDb: deps.getDb });
    if (listing.status !== "read") return { kind: "refused", reason: "byok-unavailable" };
    const connection = listing.connections.find(
      (c) => c.providerKey === ANTHROPIC_PROVIDER_KEY && !isTerminalConnectionState(c.connectionState),
    );
    if (!connection) return { kind: "platform" };
    const keys = await listCredentialMetadata(tenant, connection.integrationId, { getDb: deps.getDb });
    if (keys.status !== "read") return { kind: "refused", reason: "byok-unavailable" };
    const live = keys.credentials.find((c) => c.live && c.kind === "api_key");
    if (!live) return { kind: "refused", reason: "byok-key-revoked" };
    if (connection.connectionState !== "connected" || connection.health !== "healthy") {
      return { kind: "refused", reason: "byok-not-verified" };
    }
    return { kind: "tenant", integrationId: connection.integrationId, credentialId: live.credentialId };
  } catch {
    return { kind: "refused", reason: "byok-unavailable" };
  }
}

export type TenantModelTransportSelection = ModelTransportSelection & { readonly byokRefusal?: ByokRefusal };

/**
 * The Heby conversation transport for this tenant. Only the `live` mode consults BYOK; `fake` and a
 * closed configuration are returned exactly as `selectModelTransport` returns them.
 */
export async function selectTenantModelTransport(
  tenant: TenantContext | null,
  env: Readonly<Record<string, string | undefined>> = process.env,
  deps: TenantModelCredentialDeps = {},
): Promise<TenantModelTransportSelection> {
  if (env[MODEL_TRANSPORT_ENV_KEY]?.trim() !== "live") return selectModelTransport(env);
  const credential = await resolveTenantModelCredential(tenant, deps);
  if (credential.kind === "platform") return selectModelTransport(env);
  if (credential.kind === "refused") return { byokRefusal: credential.reason };

  const repo = { getDb: deps.getDb, env: deps.env ?? env };
  const withApiKey = async <T>(run: (apiKey: string) => Promise<T>): Promise<T> => {
    let sent = false;
    const used = await withDecryptedSecret(tenant, credential.credentialId, (key) => ((sent = true), run(key)), repo).catch(
      (error: unknown) => {
        if (sent) throw error; /* the fetch's own failure: the transport classifies it */
        return { status: "refused" } as const;
      },
    );
    if (used.status !== "used") {
      throw new ModelConnectivityError("missing-credential", "The organization's Anthropic key is not available.");
    }
    return used.value;
  };
  return {
    transport: createLiveClaudeTransport({
      tenantCredential: {
        withApiKey,
        integrationId: credential.integrationId,
        accountRef: tenantAnthropicAccountRef(credential.integrationId),
      },
    }),
    transportProvenance: "live",
  };
}
