/*
 * P5 BYOK slice 1 — a tenant's human stores, replaces or revokes the tenant's own Anthropic key.
 *
 * Design gate `hebun-p5-byok-design-gate.md`: B2 (the key lives in `integrations` +
 * `integration_credentials`, kind `api_key`, sealed with the integration key set and its AAD bound
 * to the tenant) and B8 (rotation = replace; revocation effective immediately; every act audited by
 * the released credential repository with no key material).
 *
 * THIS MODULE ADDS NO STORAGE AND NO CRYPTOGRAPHY. Every write goes through the released
 * `storeCredential` / `replaceCredential` / `revokeCredential`, which seal, bind and audit. It
 * returns only metadata and outcomes — never the key, never ciphertext.
 *
 * B5 (approved): a new key is checked once with Anthropic BEFORE anything is written
 * (`verify-anthropic-key.server.ts`). A key Anthropic rejects (401/403) is never stored and the
 * tenant's current key stays as it was; an unreachable provider stores the key as unverified.
 *
 * WHAT IT DOES NOT DO (later slices, each with its own gate): select the key for model calls (B4),
 * attribute calls to it (B7), or check data use against a tenant attestation (B6). Until then a
 * stored key is UNUSED, and Heby keeps using the platform key — the page says so.
 *
 * WHO MAY ACT: any authenticated human of the tenant, the same rule every released connection
 * entry point applies (Google, Instagram). `tenant` reaches here only from the session.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  createConnection,
  listConnections,
} from "@/features/integration-authority/integration-repository.server";
import { isTerminalConnectionState, type IntegrationView } from "@/features/integration-authority/contracts";
import {
  listCredentialMetadata,
  replaceCredential,
  revokeCredential,
  storeCredential,
} from "@/features/integration-credentials/credential-repository.server";
import { probeAnthropicKey, recordAnthropicVerification, type VerifyAnthropicDeps } from "./verify-anthropic-key.server";
import {
  ANTHROPIC_CONNECTION_NAME,
  ANTHROPIC_PROVIDER_KEY,
  isPlausibleAnthropicKey,
} from "./contracts";

export interface ByokDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Tests only; production uses the verifier's own default. */
  readonly fetchImpl?: VerifyAnthropicDeps["fetchImpl"];
}

export type ByokKeyStatus =
  | { readonly status: "unavailable" }
  | { readonly status: "none" }
  | {
      readonly status: "stored";
      /** When the live key was stored. Never the key or any part of it. */
      readonly storedAt: string;
      /** True only after Anthropic accepted the key (connection `connected` + `healthy`). */
      readonly verified: boolean;
    };

export type ByokWriteOutcome =
  | "verified"
  | "rejected"
  | "unverified"
  | "revoked"
  | "invalid-key"
  | "no-key"
  | "unavailable";

type Tenant = TenantContext | null;

/** The tenant's live (non-terminal) Anthropic connection, or null. */
async function findConnection(tenant: Tenant, deps: ByokDeps): Promise<IntegrationView | null | "unavailable"> {
  const listing = await listConnections(tenant, { getDb: deps.getDb });
  if (listing.status !== "read") return "unavailable";
  return (
    listing.connections.find(
      (c) => c.providerKey === ANTHROPIC_PROVIDER_KEY && !isTerminalConnectionState(c.connectionState),
    ) ?? null
  );
}

async function findConnectionId(tenant: Tenant, deps: ByokDeps): Promise<string | null | "unavailable"> {
  const connection = await findConnection(tenant, deps);
  return connection === "unavailable" ? "unavailable" : (connection?.integrationId ?? null);
}

async function findLiveKey(
  tenant: Tenant,
  integrationId: string,
  deps: ByokDeps,
): Promise<{ credentialId: string; createdAt: string } | null | "unavailable"> {
  const listing = await listCredentialMetadata(tenant, integrationId, { getDb: deps.getDb });
  if (listing.status !== "read") return "unavailable";
  const live = listing.credentials.find((c) => c.live && c.kind === "api_key");
  return live ? { credentialId: live.credentialId, createdAt: live.createdAt } : null;
}

export async function readByokKeyStatus(tenant: Tenant, deps: ByokDeps = {}): Promise<ByokKeyStatus> {
  if (!tenant?.tenantId) return { status: "unavailable" };
  try {
    const connection = await findConnection(tenant, deps);
    if (connection === "unavailable") return { status: "unavailable" };
    if (!connection) return { status: "none" };
    const key = await findLiveKey(tenant, connection.integrationId, deps);
    if (key === "unavailable") return { status: "unavailable" };
    if (!key) return { status: "none" };
    const verified = connection.connectionState === "connected" && connection.health === "healthy";
    return { status: "stored", storedAt: key.createdAt, verified };
  } catch {
    return { status: "unavailable" };
  }
}

/** Store the tenant's key, or replace the live one (rotation). The plaintext is never returned. */
export async function saveByokKey(tenant: Tenant, plaintext: string, deps: ByokDeps = {}): Promise<ByokWriteOutcome> {
  if (!tenant?.tenantId) return "unavailable";
  if (typeof plaintext !== "string" || !isPlausibleAnthropicKey(plaintext)) return "invalid-key";
  try {
    const verification = await probeAnthropicKey(plaintext, deps.fetchImpl);
    if (!verification.ok && verification.failure === "auth") return "rejected";
    let integrationId = await findConnectionId(tenant, deps);
    if (integrationId === "unavailable") return "unavailable";
    if (!integrationId) {
      const created = await createConnection(
        tenant,
        { providerKey: ANTHROPIC_PROVIDER_KEY, name: ANTHROPIC_CONNECTION_NAME },
        { getDb: deps.getDb },
      );
      if (created.status !== "created") return "unavailable";
      integrationId = created.connection.integrationId;
    }
    const credentialDeps = { getDb: deps.getDb, env: deps.env };
    const existing = await findLiveKey(tenant, integrationId, deps);
    if (existing === "unavailable") return "unavailable";
    const written = existing
      ? (await replaceCredential(tenant, { integrationId, kind: "api_key", plaintext }, credentialDeps)).status === "replaced"
      : (await storeCredential(tenant, { integrationId, kind: "api_key", plaintext }, credentialDeps)).status === "stored";
    if (!written) return "unavailable";

    const recorded = await recordAnthropicVerification(tenant, integrationId, verification, deps);
    return recorded.ok ? "verified" : "unverified";
  } catch {
    return "unavailable";
  }
}

/** Revoke the live key. Takes effect immediately (B8). */
export async function revokeByokKey(tenant: Tenant, deps: ByokDeps = {}): Promise<ByokWriteOutcome> {
  if (!tenant?.tenantId) return "unavailable";
  try {
    const integrationId = await findConnectionId(tenant, deps);
    if (integrationId === "unavailable") return "unavailable";
    if (!integrationId) return "no-key";
    const key = await findLiveKey(tenant, integrationId, deps);
    if (key === "unavailable") return "unavailable";
    if (!key) return "no-key";
    const revoked = await revokeCredential(tenant, key.credentialId, { getDb: deps.getDb });
    return revoked.status === "revoked" ? "revoked" : "unavailable";
  } catch {
    return "unavailable";
  }
}
