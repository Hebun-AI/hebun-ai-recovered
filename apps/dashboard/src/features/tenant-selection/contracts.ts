/*
 * tenant-selection/contracts.ts — the typed vocabulary of choosing a workspace.
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   A verified human holds several active memberships. Which tenant is this session for?
 *   REFUSED    May they hold that membership?        (I1/I2 — already decided and durable.)
 *   REFUSED    Who is this human?                    (Credential authority. Already proven.)
 *   REFUSED    What may they do inside the tenant?   (Role/Governance. Untouched.)
 *
 * WHO OWNS WHAT. Session authority owns the outcome — which durable receipt exists and what it is
 * bound to. Membership authority owns the candidates. Tenant selection is the orchestration between
 * them, and it introduces NO new authority and NO new persistent artifact: the pre-tenant receipt is
 * a `user_session_contexts` row whose tenant columns are NULL, a shape the schema has always
 * permitted and that nothing had ever written.
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * THE RULE THAT MAKES THIS SAFE, stated as a value so a test asserts the sentence.
 *
 * A client may choose AMONG candidates the server derived for it. It may never manufacture one.
 */
export const SELECTION_RULE = Object.freeze({
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
  ]),
  candidatesAre: "derived server-side from the authenticated human's own active memberships" as const,
  selectionIsNotAuthorization:
    "the chosen membership is re-read by id AND by the authenticated user_id, and its lifecycle is " +
    "re-checked from that row — nothing shown in the candidate list is trusted on the way back" as string,
  issuance: "a FRESH tenant-bound session; the pre-tenant receipt is revoked, never rewritten" as const,
});

/**
 * WHAT A PRE-TENANT RECEIPT CAN AND CANNOT DO.
 *
 * It proves a credential was verified. It carries no tenant and no membership, so `assembleAuthorized`
 * is never reached for it, no `TenantContext` exists, `resolveTenantContext()` returns null, the
 * dashboard gate refuses it, and every governed action refuses a null tenant.
 */
export const PRE_TENANT_RECEIPT = Object.freeze({
  proves: "this human's credential was verified in this browser, recently" as const,
  grants: "nothing — no tenant, no membership, no role, no authority of any kind" as const,
  reaches: "only the workspace picker" as const,
  livesFor: "ten minutes" as const,
  diesWhen: "a workspace is chosen, or it expires" as const,
});

export type WorkspaceSelectionRefusal =
  /** No usable pre-tenant receipt: missing, expired, revoked, or already tenant-bound. */
  | "no-selection-context"
  /**
   * The named membership is not a live entitlement of this human. ONE reason for "never existed",
   * "belongs to somebody else", "revoked", "no role" and "tenant disabled" — any difference between
   * them would let a guessed identifier probe the membership table.
   */
  | "membership-unavailable"
  /** Auth is not configured, or the durable store is unavailable. Nothing was changed. */
  | "unavailable";

export type WorkspaceSelectionResult =
  | { readonly status: "selected"; readonly tenantId: string }
  | { readonly status: "refused"; readonly reason: WorkspaceSelectionRefusal };

/* ── WHAT THIS PHASE DOES AND DOES NOT DO ──────────────────────────────────── */

export const TENANT_SELECTION_EFFECT =
  "binds this sign-in to ONE workspace the human already belongs to, by issuing a fresh session for " +
  "the membership they chose";

export const TENANT_SELECTION_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not create a membership",
  "does not create or change any role",
  "does not create a user, an identity or a credential",
  "does not change what a normal tenant session requires",
  "does not grant Governance authority",
  "does not grant Knowledge, provider, execution or Computer Use authority",
  "does not change any membership you hold",
  "does not let you enter a workspace you do not belong to",
]);

/**
 * SWITCHING NOW EXISTS, AND IT IS NOT THIS.
 *
 * When this phase closed, choosing at sign-in was implemented and switching from inside an
 * already-authorized session was not. It is now — as a SEPARATE entry point, `switchTenantForSession`
 * in the same Session authority, with `@/features/tenant-switching/contracts` as its vocabulary.
 *
 * WHAT DID NOT CHANGE HERE, and must not. `selectTenantForSession` still refuses a tenant-bound
 * receipt. It is reachable from `/login/select-workspace`, beneath the one public route prefix, so
 * letting an authorized session through it would make that session re-pointable from a public
 * surface. The two entry points have opposite preconditions and each refuses the other's input; they
 * share the one revalidation reader and the one assembly path, so no authority is duplicated.
 */
export const POST_LOGIN_SWITCHING = Object.freeze({
  implemented: true as const,
  implementedBy: "switchTenantForSession — a sibling entry point, not a widening of this one" as const,
  thisEntryPointStillRefuses:
    "a tenant-bound receipt; an already-authorized session cannot be re-pointed through the sign-in picker" as const,
  reuses:
    "the same server-side membership revalidation (findMembershipForUser) and the same fresh-session " +
    "issuance; no new authority decision was required for it",
});
