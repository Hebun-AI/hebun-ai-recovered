/*
 * organization-authority/contracts.ts — L3. WHAT ORGANIZATION EXISTS?
 *
 * ── THE QUESTION NOBODY COULD ASK ────────────────────────────────────────────
 *
 * Measured at the L3 baseline: inside an authenticated session Hebun could not tell you the name of
 * the organization you were signed into. `companies.name` is read in exactly one place —
 * `identity-repository.server.ts`, for the pre-tenant workspace picker, whose own comment says a
 * picker "needs to tell workspaces apart, not to carry authority". Every product surface that spoke
 * about the organization spoke from `features/organization/mock.ts` and a hard-coded
 * `company-hebun-ai`, disclosed by L1 but not answerable.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * ONE tenant-scoped, server-only, READ-ONLY authority that answers that question from rows whose
 * lifecycle owners already exist. It is the seam Heby, Agents, Governance, Knowledge and later Live
 * Map may consume instead of a projection nobody owns.
 *
 * ── WHAT IT IS EMPHATICALLY NOT ──────────────────────────────────────────────
 *
 * It creates NO writer, NO schema, NO migration and NO authorization. It decides nothing and grants
 * nothing. Every fact it returns is already durable, and this module is only the first reader of it:
 *
 *   organization identity + lifecycle  <- `companies`, written by the local operator possession
 *                                         ceremony (`npm run tenant:provision`) and by
 *                                         `npm run tenant:lifecycle`. L3 adds no second writer.
 *                                         The ceremony's module path is deliberately not named
 *                                         here: R4A forbids the application tree from mentioning
 *                                         it at all, so that nothing in the product is one
 *                                         copy-paste away from importing it.
 *   human membership count             <- `memberships`, written by the ceremony and by
 *                                         `human-onboarding/accept-invitation.server.ts`.
 *   provenance                         <- `companies.provisioning_source`, a released column with
 *                                         a released CHECK constraint and, until now, zero readers.
 *
 * ── INTERNAL STRUCTURE IS UNAVAILABLE, AND SAYS SO ───────────────────────────
 *
 * `organizations` and `departments` have existed since the foundation baseline and were re-measured
 * at L3 entry: zero value importers outside `src/db/schema/`, zero INSERT, zero UPDATE, zero rows.
 * A table is not an authority, so this seam reports internal structure as UNAVAILABLE with a
 * reason — never as an empty list.
 *
 *   UNAVAILABLE != EMPTY ORGANIZATION
 *
 * "This organization has no departments" and "Hebun has no authority that could tell you" are
 * different sentences, and an organization chart drawn from the second one is a fabrication.
 *
 * ── THE SEC-2 ENTRY GATE, ANSWERED HERE BECAUSE THIS IS WHERE IT BINDS ───────
 *
 * "Do organizational roles carry permissions?" Measured at the L3 baseline:
 *
 *   - `permissions` and `role_permissions` have zero readers and zero writers outside
 *     `src/db/schema/`, and are empty. UNAVAILABLE, and this milestone leaves them that way.
 *   - `roles` carries a band (`roles.type`). It is consulted for the CALLER's authority in exactly
 *     one released place — `knowledge/knowledge-write-authority.server.ts` — and for the TARGET
 *     role's eligibility in `membership-authority` and `human-onboarding`. Governance authority,
 *     action authorization and identity enrollment each state in their own source that they consult
 *     none of `roles.type`, `roles.authority_rank`, `memberships.authority_scope`, `permissions` or
 *     `role_permissions`; they resolve from `decision_records` alone.
 *   - `roles` has NO `organization_id`. Today's role is a TENANT membership band, not an
 *     organizational-unit role. An "organizational role" does not exist in this repository at all.
 *
 * So the answer is bounded, and the boundary is the design: roles participate in authorization
 * through an EXISTING owner, and therefore L3 does not touch them. This seam carries no role, no
 * band, no permission and no authority scope — not because they are hidden, but because an
 * organizational read that carried them would be the first step toward a second answer to "may this
 * actor act?", which is a regression rather than a security improvement.
 */

import {
  COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR,
  COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR,
} from "@/db/schema/company";

/** Why Hebun could not establish the organization. Never rendered as an empty organization. */
export type OrganizationUnavailableReason =
  /** No authorized tenant context. Fail closed — an unauthenticated caller learns nothing. */
  | "no-tenant"
  /** Durable persistence is not configured for this deployment. */
  | "persistence-not-configured"
  /** The session named a tenant with no live `companies` row. Fail closed. */
  | "organization-not-found"
  /** The read itself failed. "Could not look" is never "looked and found none". */
  | "read-failed";

/**
 * WHERE THIS ORGANIZATION CAME FROM. Read from `companies.provisioning_source`, whose released
 * CHECK admits exactly the two ceremony values or NULL.
 *
 * `unrecorded` is NULL, and it is the honest word for it: the row predates the possession ceremony,
 * so Hebun holds no record of what produced it. It is NOT a claim that the organization is seeded,
 * and it is NOT a claim that it is authoritative — it is the absence of a record.
 *
 *   SEEDED != AUTHORITATIVE LIVE TRUTH
 *   UNRECORDED PROVENANCE != SEEDED
 */
export type OrganizationProvenance =
  | typeof COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR
  | typeof COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR
  /** NULL in the column: Hebun holds no record of what created this organization. */
  | "unrecorded";

/**
 * WHAT EACH ORIGIN MEANS, OWNED HERE RATHER THAN BY THE SURFACE.
 *
 * The released G1 guard states that the ceremony vocabulary is schema vocabulary and not a value
 * application code may supply — so this module names it only through the schema's own exported
 * constants, and no component ever spells it at all. The surface renders the sentence; the
 * authority decides what the value means.
 */
export const ORGANIZATION_PROVENANCE_DETAIL: Readonly<Record<OrganizationProvenance, string>> =
  Object.freeze({
    [COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR]:
      "Created by the local operator provisioning ceremony.",
    [COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR]:
      "Created by the production operator provisioning ceremony.",
    unrecorded:
      "Hebun holds no record of what created this organization. That is an absent record, not a " +
      "claim that it is seeded or that it is authoritative.",
  });

/**
 * Internal organizational structure — organizations, departments, teams.
 *
 * Modelled as its own always-unavailable fact rather than omitted, so a consumer must handle it
 * explicitly and cannot mistake a missing field for an empty one. When a legitimate structural
 * authority exists, this becomes available HERE and every consumer inherits it unchanged.
 */
export interface OrganizationStructure {
  readonly status: "unavailable";
  readonly reason: "no-structural-authority";
  /** The measured statement, carried to the surface rather than left in a comment. */
  readonly detail: string;
}

export const ORGANIZATION_STRUCTURE_UNAVAILABLE: OrganizationStructure = Object.freeze({
  status: "unavailable",
  reason: "no-structural-authority",
  detail:
    "Hebun has no authority for internal organizational structure. The organizations and " +
    "departments tables exist but have no writer and no reader, so departments, teams and " +
    "reporting lines are unavailable — not absent.",
});

/** The organization Hebun can actually vouch for. Every field is a durable row, never derived. */
export interface AuthoritativeOrganization {
  /** The tenant this organization IS. Resolved server-side; never accepted from a caller. */
  readonly organizationId: string;
  readonly name: string;
  readonly slug: string;
  /** The generic soft-delete state every governed read in this repository respects. */
  readonly lifecycleStatus: string;
  /** The released tenant lifecycle state, or null when the row records none. */
  readonly tenantStatus: string | null;
  readonly provenance: OrganizationProvenance;
  /** The provenance sentence, resolved by the authority so no surface holds the vocabulary. */
  readonly provenanceDetail: string;
  /**
   * How many live human memberships this organization holds. A COUNT, never a roster: naming the
   * humans is a different read with a different audience, and this seam has not earned it.
   */
  readonly humanMemberCount: number;
  readonly structure: OrganizationStructure;
}

export type OrganizationAuthorityRead =
  | { readonly status: "available"; readonly organization: AuthoritativeOrganization }
  | { readonly status: "unavailable"; readonly reason: OrganizationUnavailableReason };

/**
 * The authority model, frozen so a test can read it and a future phase must change it deliberately.
 * Every field here is a measurement, not an aspiration.
 */
export const ORGANIZATION_AUTHORITY_MODEL = Object.freeze({
  kind: "tenant-rooted-read-only" as const,
  /** L3 creates no organizational writer. The ceremony and `accept-invitation` keep theirs. */
  writerCreated: false as const,
  /** No table was added, altered or activated. */
  schemaChanged: false as const,
  /** The SEC-2 entry gate answer, in the repository rather than only in a document. */
  rolesCarryPermissions: false as const,
  permissionRuntimeConnected: false as const,
  /** Structural truth is not owned here, and is not owned anywhere. */
  structuralAuthorityExists: false as const,
  limitation:
    "This authority answers what organization exists, not how it is arranged. It confers no " +
    "permission, decides no authorization, and cannot mutate anything.",
});
