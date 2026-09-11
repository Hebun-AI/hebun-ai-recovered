/*
 * tenant-provisioning/contracts.ts — the typed vocabulary of tenant birth.
 *
 * ── WHAT THIS PHASE CHANGED, AND WHAT IT DID NOT ────────────────────────────
 *
 * R4A cut the bootstrap cycle with a ceremony that lived under `scripts/`, unreachable from the
 * application tree by construction. That placement was the enforcement of a rule — "tenant creation
 * is not a product act" — and the Director has now decided that rule is too strong: a new customer
 * must be able to bring their own organization into existence.
 *
 * The rule that REPLACES it is narrower, not absent. There is still exactly ONE implementation that
 * may write tenant bootstrap state, it still writes exactly three tables, and it still cannot be
 * reached by an arbitrary product module. What changed is that the authority now lives in `src/`
 * with two declared callers instead of in `scripts/` with one.
 *
 *   BEFORE   scripts/lib/provision-tenant.ts   ← operator CLI only, unreachable from src
 *   NOW      this authority                    ← operator CLI, and self-service signup
 *
 * ── THE CYCLE IS STILL REAL ─────────────────────────────────────────────────
 *
 * Nothing about the foreign keys changed. `memberships` still needs an invitation that needs a
 * membership authorization that needs a Governance decision that needs an accepted genesis
 * nomination that needs a membership. A brand-new tenant still cannot reach Genesis, so bootstrap
 * is still an exception to the normal writers — and the cut point is still `memberships`, because
 * everything after it is structurally reachable and everything before it is not.
 *
 * ── WHAT THIS AUTHORITY STILL CANNOT DO ─────────────────────────────────────
 *
 *   - create a user, an auth identity or a credential (Identity and Credential authority own those)
 *   - nominate or accept genesis, establish Governance, or create a governance session
 *   - provision the `member` baseline role, authorize a membership, or issue an invitation
 *   - write audit_log, provider controls, Knowledge, actions, recipients or artifacts
 *   - modify an existing tenant — a taken slug is refused, never updated
 *   - own a transaction: the CALLER does, so identity and tenant commit or fail together
 *
 * Pure types and frozen values. No React, no I/O, no database.
 */

/**
 * WHICH ROOT PRODUCED A TENANT. A CLOSED vocabulary, and the only values the database admits.
 *
 * `provisioning_source` is the ONLY evidence tenant birth leaves — no `audit_log` row is written,
 * because `actor_type` and `actor_id` are both NOT NULL there and an operator terminal has no
 * honest actor to name. So this value has to carry the distinction by itself, and it must never
 * become something a caller can invent: the union is closed, the database CHECK mirrors it exactly,
 * and every caller passes one of these literals rather than a string it computed.
 *
 * The two ceremony values keep their exact prior meaning. They say WHICH ROOT acted, never WHO
 * operated it — read them as a limitation, not a credential.
 *
 * `self-service-signup` is the new one and it says something DIFFERENT in kind: not "a possessed
 * deployment produced this" but "an anonymous visitor produced this by proving an email and a
 * password". That is a WEAKER provenance, and keeping it distinguishable is the entire reason it is
 * a third value rather than a reuse of the local one. A later phase that wants to treat
 * self-service tenants differently — a quota, a review, a retention rule — can, because the row
 * says so.
 */
export const TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony" as const;
export const TENANT_PROVISIONING_SOURCE_PRODUCTION_OPERATOR =
  "production-operator-ceremony" as const;
export const TENANT_PROVISIONING_SOURCE_SELF_SERVICE = "self-service-signup" as const;

export type TenantProvisioningSource =
  | typeof TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR
  | typeof TENANT_PROVISIONING_SOURCE_PRODUCTION_OPERATOR
  | typeof TENANT_PROVISIONING_SOURCE_SELF_SERVICE;

/** Every admitted value. Asserted against the database CHECK by test, never merely asserted here. */
export const TENANT_PROVISIONING_SOURCES: readonly TenantProvisioningSource[] = Object.freeze([
  TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR,
  TENANT_PROVISIONING_SOURCE_PRODUCTION_OPERATOR,
  TENANT_PROVISIONING_SOURCE_SELF_SERVICE,
]);

/**
 * The band the bootstrap role carries.
 *
 * `owner` is existing canonical vocabulary (`roleTypeEnum`), not a new one, and this authority is
 * still the ONLY possible origin of one: `ONBOARDING_EXCLUDED_ROLE_TYPES` keeps `owner` off the
 * invitation path, so a role of this band can only ever come from tenant birth.
 *
 * WHAT IT ACTUALLY GRANTS, MEASURED RATHER THAN ASSUMED. `roles.type` is consulted by exactly one
 * connected authority in the repository today — `KNOWLEDGE_AUTHOR_ROLE_TYPES`, whose resolver
 * predicates on `roles.tenantId` and fails closed. Governance reads it for NOTHING. The
 * deployment-global provider control that R4A's header warned about is no longer reachable at all:
 * R5-1 removed every write path to `provider_connectivity_controls` from `src/` and asserts that
 * `PROVIDER_CONTROL_ROLE_TYPES` does not exist anywhere under `src`. So an owner's authority is
 * bounded by their own tenant — which is what makes Director Decision 3 safe, and a test
 * re-measures it rather than trusting this paragraph.
 */
export const BOOTSTRAP_ROLE_TYPE = "owner" as const;

/** Matches the name `scripts/r1-seed.mjs` already gives the seeded owner role. */
export const BOOTSTRAP_ROLE_NAME = "Owner" as const;

/**
 * What tenant birth needs, and deliberately nothing else.
 *
 * `userId` is an ALREADY-ESTABLISHED human. This authority does not create one and does not look
 * one up: the operator ceremony resolves an existing human before calling, and signup creates one
 * in the same transaction. Either way the caller proves the human exists; this writes the tenant
 * they will own.
 */
export interface TenantBootstrapInput {
  readonly slug: string;
  readonly displayName: string;
  readonly userId: string;
  /** Never defaulted. A caller that did not state a root does not get to create a tenant. */
  readonly provisioningSource: TenantProvisioningSource;
}

export interface ProvisionedTenant {
  readonly tenantId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly roleId: string;
  readonly membershipId: string;
  readonly userId: string;
  readonly provisioningSource: TenantProvisioningSource;
}

export type TenantBootstrapRefusal =
  /** The slug or display name is empty or malformed, or the user id is not a uuid. Nothing read. */
  | "invalid-input"
  /** A tenant already occupies this slug. It was NOT modified. */
  | "slug-already-taken";

export type TenantBootstrapOutcome =
  | { readonly status: "provisioned"; readonly tenant: ProvisionedTenant }
  | { readonly status: "refused"; readonly reason: TenantBootstrapRefusal };

/** The most a slug or display name may carry. Bounds, not policy. */
export const MAX_SLUG_CHARACTERS = 64;
export const MAX_DISPLAY_NAME_CHARACTERS = 200;

/**
 * Slugs are lowercase alphanumeric with single internal hyphens.
 *
 * Deliberately NOT a sanitizer at this layer: a slug that does not match is REFUSED, never
 * rewritten. Silently turning `Acme Corp` into `acme-corp` here would mean the operator confirmed
 * one identifier and the database received another, and the CLI's confirmation prompt exists
 * precisely so that cannot happen.
 *
 * Signup has a different problem — a human types a COMPANY NAME, not a slug — and solves it one
 * layer up by DERIVING a candidate: see `deriveTenantSlugCandidate`. The derivation is a separate,
 * named act, so this rule stays a rule.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** All C0 controls and DEL, by code point. A display name is one line. */
const CONTROL_CHARACTERS = /[\p{Cc}]/u;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalize only what is a lookup key. The display name is stored as the human typed it. */
export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/** Validate the input shape. Pure — no database, no clock. */
export function validateTenantBootstrapInput(input: TenantBootstrapInput): boolean {
  const slug = normalizeSlug(input?.slug ?? "");
  const displayName = (input?.displayName ?? "").trim();
  const userId = (input?.userId ?? "").trim();

  if (slug.length === 0 || slug.length > MAX_SLUG_CHARACTERS) return false;
  if (!SLUG_PATTERN.test(slug)) return false;
  if (displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME_CHARACTERS) return false;
  if (CONTROL_CHARACTERS.test(displayName)) return false;
  if (!UUID_PATTERN.test(userId)) return false;
  /*
   * THE SOURCE MUST BE ONE OF THE THREE. A caller that reached this function with a string the
   * database would reject is refused here rather than at the CHECK constraint, so the refusal is a
   * typed outcome instead of a thrown integrity error.
   */
  if (!TENANT_PROVISIONING_SOURCES.includes(input?.provisioningSource)) return false;
  return true;
}
