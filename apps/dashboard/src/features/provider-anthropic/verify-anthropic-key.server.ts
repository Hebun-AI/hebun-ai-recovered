/*
 * P5 BYOK — design gate B5 (approved 2026-11-11): verify a tenant's Anthropic key ONCE at entry.
 *
 * One request: `GET /v1/models?limit=1` with the key. It proves the key is accepted; it spends no
 * tokens and sends no tenant content. The response BODY IS NEVER READ — only the status decides — so
 * nothing the provider returns is stored. The key is opened only inside the released
 * `withDecryptedSecret` scope and dropped there.
 *
 * The outcome moves the connection through the released lifecycle writers
 * (`recordVerifiedConnectionWithin` / `recordVerificationFailureWithin`), so `connected` + `healthy`
 * exist only after a real 200.
 */
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  recordVerificationFailureWithin,
  recordVerifiedConnectionWithin,
  type VerificationFailureClass,
} from "@/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  withDecryptedSecret,
} from "@/features/integration-credentials/credential-repository.server";

export const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models?limit=1";
const ANTHROPIC_API_VERSION = "2023-06-01";
const VERIFY_TIMEOUT_MS = 10_000;

export interface VerifyAnthropicDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

export type AnthropicVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly failure: VerificationFailureClass; readonly reason: string };

/** Status → lifecycle class. The body is never consulted. */
export function classifyAnthropicStatus(status: number): AnthropicVerification {
  if (status === 200) return { ok: true };
  if (status === 401 || status === 403) return { ok: false, failure: "auth", reason: `http-${status}` };
  if (status === 429 || status >= 500) return { ok: false, failure: "unreachable", reason: `http-${status}` };
  return { ok: false, failure: "degraded", reason: `http-${status}` };
}

/** The one request. The key is used for this call only; the body is never read. */
export async function probeAnthropicKey(apiKey: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<AnthropicVerification> {
  try {
    const response = await fetchImpl(ANTHROPIC_MODELS_URL, {
      method: "GET",
      headers: { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_API_VERSION },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      cache: "no-store",
    });
    await response.body?.cancel().catch(() => undefined);
    return classifyAnthropicStatus(response.status);
  } catch {
    return { ok: false, failure: "unreachable", reason: "network" };
  }
}

/** Verify the connection's live key and record the outcome on the connection. */
export async function verifyAnthropicConnection(
  tenant: TenantContext,
  integrationId: string,
  deps: VerifyAnthropicDeps = {},
): Promise<AnthropicVerification> {
  if (typeof window !== "undefined") throw new Error("Anthropic verification is server-only.");
  const repo = { getDb: deps.getDb, env: deps.env };
  const listing = await listCredentialMetadata(tenant, integrationId, repo);
  if (listing.status !== "read") return { ok: false, failure: "auth", reason: "credential-unavailable" };
  const key = listing.credentials.find((c) => c.kind === "api_key" && c.live);
  if (!key) return { ok: false, failure: "auth", reason: "no-live-api-key-credential" };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const used = await withDecryptedSecret(tenant, key.credentialId, (apiKey) => probeAnthropicKey(apiKey, fetchImpl), repo);
  const outcome: AnthropicVerification =
    used.status === "used" ? used.value : { ok: false, failure: "auth", reason: `credential-${used.reason}` };

  return recordAnthropicVerification(tenant, integrationId, outcome, deps);
}

/** Move the connection through the released lifecycle writers. `connected` exists only after a 200. */
export async function recordAnthropicVerification(
  tenant: TenantContext,
  integrationId: string,
  outcome: AnthropicVerification,
  deps: VerifyAnthropicDeps = {},
): Promise<AnthropicVerification> {
  const db = (deps.getDb ?? getControlPlaneDb)();
  if (!db) return { ok: false, failure: "unreachable", reason: "persistence-not-configured" };
  const now = (deps.now ?? (() => new Date()))();
  if (outcome.ok) {
    const recorded = await db.transaction((tx) =>
      recordVerifiedConnectionWithin(tx, tenant, integrationId, { externalAccountId: null, externalAccountLabel: "Anthropic API key", grantedScopes: [] }, now),
    );
    return recorded.status === "verified" ? outcome : { ok: false, failure: "degraded", reason: `record-${recorded.reason}` };
  }
  await db.transaction((tx) =>
    recordVerificationFailureWithin(tx, tenant, integrationId, { kind: outcome.failure, reason: outcome.reason }, now),
  );
  return outcome;
}
