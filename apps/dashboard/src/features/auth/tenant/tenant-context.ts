/*
 * PRINCIPAL-FW-1 — `TenantContext` IS AN AUTHORIZED **HUMAN** TENANT MEMBER, AND NOW SAYS SO.
 *
 * ── WHAT THIS TYPE HAS ALWAYS MEANT ─────────────────────────────────────────
 *
 * Not "a principal". Not "an authenticated caller". Every value of this type that has ever existed
 * in production was produced at ONE site, in the human session runtime, and only after a live
 * membership carrying a non-null role was revalidated. It is the AUTHORIZED end of the chain:
 *
 *     credential -> auth_identity -> user -> session -> membership -> role -> TenantContext
 *
 * Hebun already represents the authenticated-but-NOT-authorized state, and it is deliberately NOT
 * this type: a pre-tenant session row carries `active_tenant_id = NULL` and resolves to
 * `onboarding-required` or `tenant-selection-required`, neither of which produces a `TenantContext`.
 * `selectTenantForSession` is the explicit transition between the two. Authentication and
 * authorization are already separate here; what was missing was any mechanical statement that the
 * principal on this side of the line is a HUMAN.
 *
 * ── WHY THE BRAND, AND WHY NOT AN `actorType` FIELD ─────────────────────────
 *
 * 87 call sites across 33 modules stamp `actor_type = 'human'` with an id taken from this context.
 * They are correct today only because this type cannot carry a non-human. Adding
 * `actorType: "human" | "agent"` would turn all 87 into latent false attributions at once — and the
 * seven human-only CHECK constraints would not catch a single one, because they validate the
 * literal a writer supplied, not the principal that supplied it.
 *
 * So the type is made NOMINAL instead of wider. A future agent principal will be a different type,
 * and will therefore be structurally unable to reach those writers — not because each one checks,
 * but because none of them can be called.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 *
 * The brand is COMPILE-TIME ONLY. It is not a runtime principal check and must never be described
 * as one. The runtime human firewall is unchanged and lives where it always did: `auth_identities`
 * and `user_session_contexts` and `memberships` all carry NOT NULL foreign keys to `users`, so an
 * agent cannot obtain a session at all. The brand's job is to make misuse visible to TypeScript
 * BEFORE any agent authentication work exists, while that protection is still free.
 *
 * This phase grants nothing to anybody. No credential, no session, no membership, no role, no
 * permission, no runtime, no execution, and no machine ingress.
 */
import type {
  AuthenticationAssuranceLevel,
  AuthenticationProviderKey,
} from "../types/provider-authentication";

/*
 * The nominal marker. NOT exported, and deliberately unreachable from any other module: a symbol a
 * caller cannot name is a property a caller cannot supply. This is the technique the repository
 * already uses for `AuthorizedAuthenticationResult` and for `CanonicalSignal`.
 */
declare const humanTenantContextBrand: unique symbol;

/**
 * The DATA of an authorized human tenant member, without the nominal marker.
 *
 * It exists so the authoritative producer can still be fully type-checked field by field. Casting a
 * bare object literal straight to the branded type would silently switch off checking on every
 * field at exactly the site that must never drift — so the producer builds this, and the cast that
 * follows narrows a value TypeScript has already verified.
 *
 * Holding one of these is not authority. It is the shape of authority, which is why it carries no
 * brand and why nothing downstream accepts it.
 */
export interface TenantContextFields {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly membershipVersion: number;
  readonly roleId: string;
  readonly organizationId?: string;
  readonly sessionContextId: string;
  readonly provider: AuthenticationProviderKey;
  readonly assuranceLevel: AuthenticationAssuranceLevel;
  readonly mfaVerified: boolean;
  readonly requestId: string;
  readonly correlationId?: string;
  readonly permissionSummary?: readonly string[];
  readonly authenticatedAt: string;
}

/**
 * Immutable authority projection for one server request, held by an authorized HUMAN tenant member.
 *
 * Nominal: an object with all the right fields is still not one of these. The only legitimate
 * production value is minted by the human session runtime through `asHumanTenantContext`.
 */
export interface TenantContext extends TenantContextFields {
  readonly [humanTenantContextBrand]: true;
}

/**
 * MINT the authority projection. The one place a `TenantContext` may legitimately come into being.
 *
 * The cast is narrow on purpose: `TenantContext` extends `TenantContextFields`, so this narrows an
 * already-checked value rather than laundering an unchecked one. There is no `unknown` step and no
 * `any`, which is what stops this from becoming a general-purpose escape hatch — hand it something
 * that is not a fully-formed `TenantContextFields` and the compiler still refuses.
 *
 * It is exported because the producer lives in `auth-runtime` and this contract lives in `auth`.
 * That is not a second authority: this function resolves nothing, reads nothing, verifies nothing
 * and decides nothing. It relabels a value whose authority was already established by the session
 * runtime that built it. A firewall test pins its callers to exactly that one producer, so a second
 * caller anywhere in `src/` fails the suite rather than quietly becoming a second mint.
 */
export function asHumanTenantContext(fields: TenantContextFields): TenantContext {
  return fields as TenantContext;
}
