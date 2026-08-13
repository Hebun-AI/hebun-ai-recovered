/*
 * tenant-switching/contracts.ts — the typed vocabulary of changing workspace from inside a session.
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   A human is authorized in tenant A and also belongs to tenant B. How does the session
 *              stop being tenant A's and become tenant B's?
 *   REFUSED    May they hold that membership?        (I1/I2 — already decided and durable.)
 *   REFUSED    Who is this human?                    (Credential authority. Already proven, and the
 *                                                     current session is the proof.)
 *   REFUSED    What may they do inside the tenant?   (Role/Governance. Untouched.)
 *
 * ── WHY THIS IS NOT THE INITIAL PICKER WEARING A DIFFERENT HAT ───────────────
 *
 * Initial selection starts from a PRE-TENANT receipt: no tenant, no membership, no `TenantContext`,
 * nothing to lose. Switching starts from a LIVE tenant-bound session that a governed action would
 * accept right now. The two have opposite preconditions, so `selectTenantForSession` keeps refusing
 * a tenant-bound receipt (its firewall is unchanged, and its tests still assert it) and this phase
 * adds the mirror-image entry point instead of widening that one. Both share the one revalidation
 * reader and the one assembly path, so no authority is duplicated.
 *
 * Three things follow from the different starting point, and each is a deliberate difference:
 *
 *   THE CURRENT SESSION MUST BE AUTHORIZED. Not merely present, not merely tenant-bound. It is
 *   validated by `resolveSessionFromReference` — the exact function every request uses — so
 *   "authorized enough to switch" cannot drift from "authorized enough to act".
 *
 *   THE ABSOLUTE WINDOW IS PRESERVED, NEVER RESTARTED. A switch proves no credential, so it must not
 *   extend how long one authentication is good for. Restarting the eight hours on every switch would
 *   turn the absolute TTL into an inactivity TTL with extra steps.
 *
 *   THE OLD SESSION IS SPENT CONDITIONALLY, INSIDE THE TRANSACTION THAT MINTS THE NEW ONE. That is
 *   what makes two concurrent switches resolve to exactly one winner rather than two live sessions.
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * THE RULE THAT MAKES THIS SAFE, stated as a value so a test asserts the sentence.
 *
 * Identical to the initial picker's rule, and deliberately so: a client may choose AMONG candidates
 * the server derived for it, and may never manufacture one.
 */
export const SWITCH_RULE = Object.freeze({
  clientMaySupply: "one membership id, and nothing else" as const,
  clientMayNotSupply: Object.freeze([
    "tenantId",
    "userId",
    "actorId",
    "actorType",
    "roleId",
    "membership version",
    "membership status",
    "session authority",
    "role type",
    "session context id",
  ]),
  candidatesAre:
    "derived server-side from the authenticated human's own active memberships, read through the " +
    "session they already hold" as string,
  switchIsNotAuthorization:
    "the chosen membership is re-read by id AND by the authenticated user_id, and its lifecycle is " +
    "re-checked from that row — nothing shown in the switcher is trusted on the way back" as string,
  issuance:
    "a FRESH tenant-bound session; the previous session is revoked in the same transaction, never " +
    "rewritten" as string,
  authorityOfTheCaller:
    "the current session must resolve to `authorized` by the same function every request uses; a " +
    "forbidden or expired session cannot mint a new one" as string,
});

/**
 * WHAT A SWITCH DOES TO THE CLOCK.
 *
 * Stated as a value because it is the one place a reader might reasonably expect the opposite.
 */
export const SWITCH_LIFETIME = Object.freeze({
  authenticatedAt: "carried over unchanged — no credential was proven, so nothing was re-authenticated" as const,
  absoluteExpiresAt: "carried over unchanged — a switch may never extend one authentication's life" as const,
  inactivityExpiresAt: "slid forward like any activity, but never past the absolute expiry" as const,
});

export type WorkspaceSwitchRefusal =
  /**
   * No session that may switch: missing, expired, revoked, forbidden, or still pre-tenant. A
   * pre-tenant receipt belongs to the initial picker and is refused here for the mirror-image reason
   * a tenant-bound one is refused there.
   */
  | "no-active-session"
  /**
   * The named membership is not a live entitlement of this human. ONE reason for "never existed",
   * "belongs to somebody else", "revoked", "no role" and "tenant disabled" — any difference between
   * them would let a guessed identifier probe the membership table.
   */
  | "membership-unavailable"
  /**
   * The target IS the workspace this session is already in. Not an error and not a secret: the
   * server told this client which workspace it is in, so naming it back reveals nothing. Refused
   * rather than silently minting a second session for the same tenant.
   */
  | "already-active"
  /**
   * The session was spent by a concurrent switch or a sign-out while this one was in flight. Nothing
   * was changed by the losing attempt — its transaction unwound.
   */
  | "switch-superseded"
  /** Auth is not configured, or the durable store is unavailable. Nothing was changed. */
  | "unavailable";

export type WorkspaceSwitchResult =
  | { readonly status: "switched"; readonly tenantId: string }
  | { readonly status: "refused"; readonly reason: WorkspaceSwitchRefusal };

/* ── WHAT THIS PHASE DOES AND DOES NOT DO ──────────────────────────────────── */

export const TENANT_SWITCH_EFFECT =
  "moves this session to ONE other workspace you already belong to, by issuing a fresh session for " +
  "the membership you chose and revoking the one you were using";

export const TENANT_SWITCH_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not create a membership",
  "does not create or change any role",
  "does not create a user, an identity or a credential",
  "does not create or accept an invitation",
  "does not grant Governance authority",
  "does not grant Knowledge, provider, execution or Computer Use authority",
  "does not change any membership you hold",
  "does not let you enter a workspace you do not belong to",
  "does not extend how long your sign-in lasts",
]);

/**
 * WHAT REMAINS UNBUILT, stated rather than implied.
 *
 * A switch replaces the session, so it ends everywhere that session was in use: another tab holding
 * the same cookie is signed out at its next request rather than following along. Holding several
 * workspaces open at once would need more than one live session per browser, which is a different
 * shape of receipt than the one cookie this repository issues.
 */
export const CONCURRENT_WORKSPACES = Object.freeze({
  implemented: false as const,
  reachableToday:
    "one workspace at a time per browser — switching replaces the session rather than adding one",
  wouldRequire:
    "more than one live session reference per browser, which is a cookie and receipt decision this " +
    "phase did not take",
});
