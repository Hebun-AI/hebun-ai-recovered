/*
 * provider-google/google-authorized-call.server.ts — SPEND A TENANT'S GOOGLE CREDENTIAL, ONCE.
 *
 * ── WHY THIS EXISTS AS A SEPARATE FILE ───────────────────────────────────────
 *
 * INT-3 built exactly one authorized Google call — verification — and its refresh ordering lived
 * inside the verifier. INT-4 adds a second (Drive metadata), and the ordering is the single most
 * dangerous thing to copy: replace the access credential, and replace the refresh credential ONLY
 * IF GOOGLE RETURNED A NEW ONE. A second copy of that rule is a second place for it to rot, and
 * the failure mode is a tenant losing their only way back into their own connection.
 *
 * So the rule is stated once, here, and both callers run through it.
 *
 * ── THE PLAINTEXT NEVER LEAVES ───────────────────────────────────────────────
 *
 * The token is handed to the caller's callback INSIDE `withDecryptedSecret` and what comes back
 * out is the callback's own result. The generic is deliberately NOT `string`-shaped: a caller
 * cannot ask this function for a token, because it never returns one. `withDecryptedSecret` owns
 * the scoped-secret lifetime and this module does not widen it.
 *
 * ── ONE REFRESH, AND ONLY FOR THE PROBLEM A REFRESH SOLVES ───────────────────
 *
 * A refresh is attempted only when Google refused the CREDENTIAL (`auth` class). A 429, a 503, a
 * timeout or a DNS failure is not retried with a refresh: nothing is known about the grant, and
 * spending a refresh token on a provider outage fixes nothing while risking rotation.
 *
 * A SCOPE GAP IS NOT REFRESHED EITHER. Refreshing returns the same grant Google already recorded,
 * so a missing scope would still be missing — the honest answer is to say the grant is short and
 * let the tenant re-consent.
 *
 * ── ONE REFRESH BEFORE THE CALL, TOO, WHEN GOOGLE ALREADY SAID IT IS OVER ────
 *
 * GOOGLE-PICKER-1. The rule above is reactive: it needs Google to refuse the token before it can
 * act. That is enough for every caller that SPENDS the token against Google, because their refusal
 * arrives on its own. It is not enough for the one caller that does not — the Picker ceremony asks
 * for the token itself and hands it to a browser, so no `auth` failure ever comes back here and the
 * reactive rule can never fire. Production handed out a token that had expired ~92 hours earlier
 * and Google rendered its own 403 inside the chooser.
 *
 * So a token Google has ALREADY declared over is replaced BEFORE the attempt. This is not a second
 * refresh path: it enters the same `refreshAndReplace` below, under the same authority, with the
 * same ordering. What changed is only WHEN it may be entered.
 *
 * `expires_at` is the provider's own statement, recorded at the moment the grant was issued. It is
 * read HERE, at the acquisition seam, and nowhere else: a credential's LIVENESS is a lifecycle fact
 * (revoked, destroyed) that this module has no business redefining, and a refresh credential carries
 * no expiry at all. An access token that is temporally spent and a credential that is lifecycle-dead
 * are different things, and conflating them would revoke rows nobody revoked.
 *
 * ── IT WRITES NO LIFECYCLE ───────────────────────────────────────────────────
 *
 * It replaces credentials through INT-2's authority and returns an outcome. It holds no connection
 * writer, so it cannot decide that a tenant's grant ended.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  listCredentialMetadata,
  replaceCredentialFromProviderRefresh,
  withDecryptedSecret,
} from "@/features/integration-credentials/credential-repository.server";
import type { GoogleFailure } from "./contracts";
import { refreshAccessToken, type GoogleTransportDeps } from "./google-transport.server";
import {
  resolveGoogleOAuthEnvironment,
  type ConfiguredGoogleOAuth,
} from "./google-environment.server";

export interface GoogleAuthorizedCallDeps extends GoogleTransportDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/** What a caller's callback must return: its own success value, or a classified Google failure. */
export type GoogleCallResult<T> = { readonly ok: true; readonly value: T } | GoogleFailure;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Authorized Google calls are server-only.");
  }
}

/**
 * WHICH FAILURES A REFRESH COULD POSSIBLY FIX.
 *
 * Exactly one: Google refused the credential. Stated as a function rather than inline so the
 * Drive seam and the verifier cannot drift on the question, and so a test can read the rule.
 */
export function isRefreshableFailure(failure: GoogleFailure["failure"]): boolean {
  return failure === "auth";
}

/**
 * HOW LONG BEFORE GOOGLE'S STATED EXPIRY A TOKEN IS ALREADY TREATED AS SPENT.
 *
 * A token that expires while it is in flight is a token that fails at the provider, and for the
 * Picker it fails inside Google's own iframe where Hebun cannot see it. One minute is smaller than
 * Google's hour-long grant by a wide margin, so this costs at most one early replacement and never
 * shortens a usable token by anything a caller would notice.
 */
export const ACCESS_TOKEN_EXPIRY_SKEW_MS = 60_000;

/**
 * Whether this access credential can still be spent, according to what GOOGLE said about it.
 *
 * ONLY A STATED EXPIRY IN THE PAST MAKES THIS FALSE. A `null` expiry means Google returned no
 * `expires_in`, and an unparseable one means the column cannot be read — neither is EVIDENCE that
 * the token is over, so both keep the reactive behaviour that has always applied: spend it, and let
 * Google be the one to refuse. Treating "unknown" as "expired" would refresh a working credential on
 * every call.
 *
 * It takes an expiry and a clock and nothing else, so it can be read as a rule and tested as one.
 */
export function isAccessCredentialUsable(expiresAt: string | null, now: Date): boolean {
  if (expiresAt === null) return true;
  const at = Date.parse(expiresAt);
  if (Number.isNaN(at)) return true;
  return at - ACCESS_TOKEN_EXPIRY_SKEW_MS > now.getTime();
}

/**
 * Run `call` with this tenant's live Google access token, refreshing once if the token was refused.
 *
 * The tenant comes from an already-resolved server-side `TenantContext`, and every credential read
 * below carries it — so a caller holding another tenant's `integrationId` finds nothing rather
 * than something.
 */
export async function withGoogleAccessToken<T>(
  tenant: TenantContext,
  integrationId: string,
  call: (accessToken: string) => Promise<GoogleCallResult<T>>,
  deps: GoogleAuthorizedCallDeps = {},
): Promise<GoogleCallResult<T>> {
  assertServerOnly();

  const resolution = resolveGoogleOAuthEnvironment(deps.env ?? process.env);
  if (resolution.status !== "configured") {
    return { ok: false, failure: "auth", reason: "google-oauth-not-configured" };
  }

  const listing = await listCredentialMetadata(tenant, integrationId, {
    getDb: deps.getDb,
    env: deps.env,
  });
  if (listing.status !== "read") {
    return { ok: false, failure: "auth", reason: "credential-unavailable" };
  }
  const access = listing.credentials.find((c) => c.kind === "oauth_access" && c.live);
  if (!access) return { ok: false, failure: "auth", reason: "no-live-access-credential" };

  /*
   * The refresh credential is located ONCE, here, because both routes to a refresh need it and
   * neither may invent a second way to find one. Nothing about it is examined but its liveness: a
   * refresh credential has no expiry, and the freshness rule below is asked only about the ACCESS
   * credential.
   */
  const refresh = listing.credentials.find((c) => c.kind === "oauth_refresh" && c.live);

  /*
   * GOOGLE ALREADY SAID THIS ONE IS OVER — see the header. Replace it before the attempt rather
   * than after a refusal that, for a caller which never asks Google, would never arrive.
   *
   * FAIL CLOSED WHEN IT CANNOT BE REPLACED. A tenant with no refresh credential gets a refusal, not
   * the expired token: handing it over would put a token that cannot work into a browser and report
   * success. The stale token is never spent and never returned.
   */
  const now = (deps.now ?? (() => new Date()))();
  if (!isAccessCredentialUsable(access.expiresAt, now)) {
    if (!refresh) {
      return { ok: false, failure: "auth", reason: "access-credential-expired-no-refresh" };
    }
    const replaced = await refreshAndReplace(
      tenant,
      integrationId,
      refresh.credentialId,
      resolution,
      deps,
    );
    if (!replaced.ok) return { ok: false, failure: replaced.failure, reason: replaced.reason };
    return spend(tenant, replaced.accessCredentialId, call, deps);
  }

  const first = await spend(tenant, access.credentialId, call, deps);
  if (first.ok || !isRefreshableFailure(first.failure)) return first;

  /* Google refused the token. A refresh can fix that — if the tenant has one at all. */
  if (!refresh) return first;

  const refreshed = await refreshAndReplace(
    tenant,
    integrationId,
    refresh.credentialId,
    resolution,
    deps,
  );
  if (!refreshed.ok) return { ok: false, failure: refreshed.failure, reason: refreshed.reason };

  return spend(tenant, refreshed.accessCredentialId, call, deps);
}

/** One attempt, inside the scoped-secret boundary. */
async function spend<T>(
  tenant: TenantContext,
  credentialId: string,
  call: (accessToken: string) => Promise<GoogleCallResult<T>>,
  deps: GoogleAuthorizedCallDeps,
): Promise<GoogleCallResult<T>> {
  const used = await withDecryptedSecret(tenant, credentialId, call, {
    getDb: deps.getDb,
    env: deps.env,
  });
  if (used.status !== "used") {
    return { ok: false, failure: "auth", reason: `credential-${used.reason}` };
  }
  return used.value;
}

type RefreshResult =
  | { readonly ok: true; readonly accessCredentialId: string }
  | { readonly ok: false; readonly failure: GoogleFailure["failure"]; readonly reason: string };

/**
 * Spend the refresh credential and store the replacement access credential.
 *
 * ── IT USES THE REFRESH-SPECIFIC WRITE INTENT, NOT THE ORDINARY ONE (INT-4) ─
 *
 * `replaceCredential` demotes the connection to `unverified`, which is right for a supplied secret
 * and wrong here: the provider has just answered, and honouring the refresh IS the provider saying
 * the grant is intact. Through INT-4's first implementation this path used the ordinary writer, and
 * the first token expiry silently disabled every capability the connection carried.
 *
 * `replaceCredentialFromProviderRefresh` is the narrow intent that preserves the lifecycle. It is
 * declared as a separate function precisely so a firewall test can enumerate who may call it —
 * this file is the only one, and nothing else may reach it.
 *
 * A ROTATED REFRESH TOKEN IS REPLACED; AN ABSENT ONE IS LEFT ALONE. Google usually returns none
 * on a refresh, and treating that as "replace it with nothing" would destroy the tenant's only
 * way back. This is the INT-2 invariant, and the whole reason this file exists once.
 */
async function refreshAndReplace(
  tenant: TenantContext,
  integrationId: string,
  refreshCredentialId: string,
  config: ConfiguredGoogleOAuth,
  deps: GoogleAuthorizedCallDeps,
): Promise<RefreshResult> {
  const exchanged = await withDecryptedSecret(
    tenant,
    refreshCredentialId,
    async (refreshToken) => refreshAccessToken(refreshToken, config, deps),
    { getDb: deps.getDb, env: deps.env },
  );
  if (exchanged.status !== "used") {
    return { ok: false, failure: "auth", reason: `credential-${exchanged.reason}` };
  }
  const token = exchanged.value;
  if (!token.ok) return { ok: false, failure: token.failure, reason: token.reason };

  const replaced = await replaceCredentialFromProviderRefresh(
    tenant,
    {
      integrationId,
      kind: "oauth_access",
      plaintext: token.grant.accessToken,
      expiresAt: token.grant.expiresAt,
    },
    { getDb: deps.getDb, env: deps.env },
  );
  if (replaced.status !== "replaced") {
    return { ok: false, failure: "auth", reason: `replace-${replaced.reason}` };
  }

  if (token.grant.refreshToken) {
    const rotated = await replaceCredentialFromProviderRefresh(
      tenant,
      { integrationId, kind: "oauth_refresh", plaintext: token.grant.refreshToken },
      { getDb: deps.getDb, env: deps.env },
    );
    if (rotated.status !== "replaced") {
      return { ok: false, failure: "auth", reason: `rotate-${rotated.reason}` };
    }
  }

  return { ok: true, accessCredentialId: replaced.credential.credentialId };
}
