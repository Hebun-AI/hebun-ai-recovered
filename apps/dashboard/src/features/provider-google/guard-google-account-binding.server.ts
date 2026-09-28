/*
 * provider-google/guard-google-account-binding.server.ts — GOOGLE-OAUTH-ACCOUNT-INTEGRITY-1.
 *
 * WHICH GOOGLE ACCOUNT A FRESH GRANT BELONGS TO, ASKED BEFORE IT IS STORED.
 *
 * The callback used to store (or replace) the credential first, verify with the stored copy, and
 * only then let the connection authority refuse an account change. A refused switch therefore left
 * the OTHER account's token in the credential authority, beside a row still bound to the original
 * account — and the row had already been moved to `unverified` by the write.
 *
 * This asks the connection authority's own question — `isAccountChange` — while the new access
 * token is still only in memory:
 *
 *   row names no account yet   → nothing to protect; the released first-binding flow runs unchanged
 *   row names an account       → Google's `userinfo` for the NEW token, then the same predicate the
 *                                authority applies on the write; different → refused, nothing written
 *
 * It reads; it writes nothing. The binding is read from the Integration authority's released
 * listing (tenant-scoped); the identity from the one Google network module. Account integrity is
 * per CONNECTION: `google-workspace` and `google-youtube` are separate rows, each compared only
 * with itself, so one tenant may hold different Google accounts on the two.
 *
 * `recordVerifiedConnectionWithin` still refuses an account change on the write. This is not a
 * replacement for that guard; it is the reason the guard is never reached with the wrong token
 * already stored.
 *
 * Server-only. No token, code or provider body is logged or returned.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  isAccountChange,
  listConnections,
  type IntegrationRepositoryDeps,
} from "@/features/integration-authority/integration-repository.server";
import type { GoogleFailureClass } from "./contracts";
import { fetchGoogleIdentity, type GoogleTransportDeps } from "./google-transport.server";

export type GoogleAccountBindingGuard =
  /** The existing credential path may run. `boundAccountId` is what the row names (null = first binding). */
  | { readonly ok: true; readonly boundAccountId: string | null }
  | {
      readonly ok: false;
      /** The callback's outcome label — the same labels the released flow already used. */
      readonly outcome:
        | "record-account-changed"
        | "record-not-found"
        | "record-persistence-unavailable"
        | `verification-${GoogleFailureClass}`;
    };

export type GoogleAccountBindingGuardDeps = IntegrationRepositoryDeps & GoogleTransportDeps;

export async function guardGoogleAccountBeforeCredentialWrite(
  tenant: TenantContext,
  integrationId: string,
  accessToken: string,
  deps: GoogleAccountBindingGuardDeps = {},
): Promise<GoogleAccountBindingGuard> {
  if (typeof window !== "undefined") throw new Error("Google account binding checks are server-only.");

  const listing = await listConnections(tenant, deps);
  if (listing.status !== "read") return { ok: false, outcome: "record-persistence-unavailable" };
  const row = listing.connections.find((c) => c.integrationId === integrationId);
  if (!row) return { ok: false, outcome: "record-not-found" };

  /* FIRST BINDING. Nothing is bound, so nothing can be substituted; the released flow decides. */
  if (row.externalAccountId === null) return { ok: true, boundAccountId: null };

  /* AN ACCOUNT IS BOUND. Prove who the NEW token belongs to before anything is written. */
  const identity = await fetchGoogleIdentity(accessToken, deps);
  if (!identity.ok) return { ok: false, outcome: `verification-${identity.failure}` };
  if (isAccountChange(row.externalAccountId, identity.identity.subject)) {
    return { ok: false, outcome: "record-account-changed" };
  }
  return { ok: true, boundAccountId: row.externalAccountId };
}
