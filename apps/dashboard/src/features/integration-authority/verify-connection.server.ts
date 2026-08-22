/*
 * integration-authority/verify-connection.server.ts — THE HONEST REFUSAL (I1).
 *
 * ── WHAT THIS MODULE DOES ────────────────────────────────────────────────────
 *
 * It refuses. Every call, for every connection, in every tenant, with
 * `no-credential-authority`.
 *
 * ── WHY THAT IS THE ONLY TRUTHFUL BEHAVIOUR ──────────────────────────────────
 *
 * Verification means: decrypt a stored credential, reach the provider, resolve an external
 * account, confirm the granted scopes cover the definition's minimum, and record the result. I1
 * has no credential store, no encryption boundary, no key registry and no verifier — every one of
 * those is I2. There is nothing to decrypt and nobody to ask.
 *
 * ── WHY A REFUSAL AND NOT A STUB, A THROW, OR AN ABSENCE ─────────────────────
 *
 * A stub returning `{ ok: true }` would be a claim about a provider that was never contacted — the
 * exact class of lie this repository spends its phases removing.
 *
 * A `throw new Error("not implemented")` would be indistinguishable, at the call site, from a
 * verification that failed for a real reason, and a caller would reasonably retry it.
 *
 * Omitting the module entirely would leave the phase boundary implicit: the next author would have
 * to infer from absence that verification is unbuilt, rather than reading a named reason that says
 * which authority is missing.
 *
 * A refusal states, in one value, that nothing was attempted, nothing failed, and the connection's
 * state is untouched.
 *
 * ── WHAT THIS MODULE CANNOT DO ───────────────────────────────────────────────
 *
 * It makes no network call: it imports no transport, no fetch, no adapter and no provider SDK. It
 * writes NOTHING — the refusal does not touch `connection_state`, `health`, `last_verified_at`,
 * `last_error_at` or `failure_reason`, because a refusal to attempt is not a failed attempt and
 * recording it as one would poison the health signal with Hebun's own incompleteness.
 *
 * It emits no audit event, for the same reason: `integration.verification.failed` is an I2 event
 * about a provider, and nothing here reached one.
 *
 * ── THE TENANT PREDICATE STILL APPLIES ───────────────────────────────────────
 *
 * The connection is resolved through the repository FIRST, so a foreign or nonexistent id gets
 * `not-found` and never `no-credential-authority`. Refusing everything with one reason would leak
 * nothing, but it would also make this function unable to tell a caller they asked about a row
 * that is not theirs — and the day a credential authority exists, that ordering has to already be
 * correct.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { hasLiveCredential } from "@/features/integration-credentials/credential-repository.server";
import { readConnection } from "./integration-repository.server";
import {
  NO_CREDENTIAL_AUTHORITY,
  NO_PROVIDER_VERIFIER,
  type ProviderCatalog,
  type VerificationOutcome,
} from "./contracts";

export interface VerifyConnectionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly catalog?: ProviderCatalog;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Connection verification is server-only.");
  }
}

/**
 * Verify a connection.
 *
 * STILL ALWAYS REFUSES — but INT-2 made it refuse for TWO different reasons, because two different
 * facts became possible.
 *
 *   no-credential-authority   this connection holds no live credential. Nothing was supplied, so
 *                             there is nothing to verify with.
 *   no-provider-verifier      a credential IS held and could be opened, and verification still
 *                             cannot happen: nothing in this deployment knows how to ask this
 *                             provider anything.
 *
 * Before INT-2 the first reason covered everything, because no credential store existed. Keeping
 * it for both cases afterwards would tell a tenant their credential was missing while it sat
 * encrypted in a row three feet away.
 *
 * NEITHER PRODUCES `connected`. A credential existing is not verification; a credential decrypting
 * is not verification. The `ok: true` arm of `VerificationOutcome` is declared and is constructed
 * NOWHERE in this repository — a test walks every source file to prove it.
 *
 * Nothing here contacts a provider, and nothing here writes. A refusal to attempt is not a failed
 * attempt: no state, no health and no error is recorded.
 */
export async function verifyConnection(
  tenant: TenantContext | null,
  integrationId: string,
  deps: VerifyConnectionDeps = {},
): Promise<VerificationOutcome> {
  assertServerOnly();
  if (!tenant?.tenantId) return { ok: false, reason: "no-authorized-tenant-context" };

  const connection = await readConnection(tenant, integrationId, {
    getDb: deps.getDb,
    catalog: deps.catalog,
  });
  /* Foreign id and nonexistent id are one branch, so the difference is never disclosed. */
  if (!connection) return { ok: false, reason: "not-found" };

  /*
   * The connection is this tenant's and it exists. Which refusal is truthful now depends on
   * whether a secret was ever supplied — a BOOLEAN is all that crosses this boundary, so asking
   * the question cannot leak a credential, its metadata or its material into this module.
   */
  const credentialHeld = await hasLiveCredential(tenant, integrationId, {
    getDb: deps.getDb,
  });
  if (!credentialHeld) return { ok: false, reason: NO_CREDENTIAL_AUTHORITY };

  /*
   * A credential is held. It is sealed, it is this tenant's, and it may well be perfectly valid —
   * and verification is STILL impossible, because no provider verifier exists in this deployment.
   * Returning `ok: true` here would be the exact false claim the whole subsystem exists to prevent.
   */
  return { ok: false, reason: NO_PROVIDER_VERIFIER };
}
