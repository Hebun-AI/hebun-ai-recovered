/*
 * organization-authority/heby-organization-source.server.ts — THE ORGANIZATION AUTHORITY'S read
 * projection of itself, shaped for Heby grounding (E2-1).
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * G6C settled this and INT-5A restated it: a projection belongs to the authority that owns the
 * facts, and the consumer imports the projection. So this file sits inside the authority, and Heby
 * imports one function from it. Heby therefore never holds `readOrganizationAuthority`, never holds
 * `companies`, and never holds a database handle for organizational truth — the authority keeps all
 * three, exactly as it did before this phase.
 *
 * It also means the L3 firewall's directory-wide read-only ban covers this file for free, rather
 * than a new directory having to re-earn it.
 *
 * ── WHY NOT THROUGH LIVE MAP ─────────────────────────────────────────────────
 *
 * Live Map composes this same authority, and reading Heby's organization facts out of the map would
 * have been the smaller diff. It would also have been wrong, and E2-1's discovery measured why:
 *
 *   Live Map adds no organizational FACT. Everything it contributes is presentation — projection
 *   node ids, a label, sentences already composed for a reader, an `openRoute`, a render order and
 *   a freshness line. Consuming it would make Heby's evidence depend on a rendering.
 *
 *   `SourceResolution.authoritative` is ONE boolean for a whole source class, and
 *   `HebySourceEvidenceGroup` pins why: a class cannot assert one standing and cite under another.
 *   Live Map Intelligence (E2-3) is chartered for authoritative AND legitimately derived layers, so
 *   a mixed-truth map is not representable as one honest resolution.
 *
 *   `LiveMapProjection.domains` is an array. A future E2-3 domain would enter Heby's model context
 *   through a one-line edit somewhere else — silent context expansion, which is exactly what an
 *   admission boundary exists to prevent.
 *
 *     PRESENTATION PROJECTION      != DOMAIN AUTHORITY
 *     CONVENIENT DATA SHAPE        != LEGITIMATE ARCHITECTURAL BOUNDARY
 *     FUTURE LIVE MAP LAYER        != AUTOMATIC HEBY EVIDENCE
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * A READ PROJECTION. It owns no organizational fact, holds no table, opens no connection, writes
 * nothing and decides nothing. Every value it returns is read through `readOrganizationAuthority`,
 * which already owns the rules — that the tenant comes from the session and from nowhere else, that
 * a missing row is `organization-not-found` and never an organization named "", and that internal
 * structure is unavailable rather than empty. This module re-derives none of that. It translates
 * one shape into another.
 *
 * ── AUTHORITATIVE, AND SAYING SO ─────────────────────────────────────────────
 *
 * INT-5A's source declares `authoritative: false` because capability state is derived on every
 * read. This one is the opposite, for the same reason G6C's is: `companies` IS the organization
 * record, and L3 is its released read authority. Reporting it as derived would flatten
 * AUTHORITATIVE into DERIVED, which is the one distinction Heby must never collapse.
 *
 * ── AND STILL NOT AN INSTRUCTION ─────────────────────────────────────────────
 *
 * `authoritative` is a statement about evidential WEIGHT. TB-1 is unchanged by this phase: these
 * lines reach the model as `untrusted-content` like every other piece of grounding, because a
 * trusted source may prove a fact without acquiring the ability to direct behaviour.
 *
 *     AUTHORITATIVE EVIDENCE != INSTRUCTION
 *
 * ── WHAT IT STRUCTURALLY CANNOT SAY, AS OF OSA-1 ─────────────────────────────
 *
 * This paragraph used to begin "No department", and OSA-1 made that false. `departments` gained a
 * writer, a reader and a released structural authority, `readOrganizationAuthority` now derives
 * structure, and `structureClause` below carries it — so the denial survived its own subject.
 *
 * A stale denial is not a harmless leftover. It travels in `ORGANIZATION_GROUNDING_PROVENANCE`,
 * which `assembleProvenance` renders to the Director beside an answer naming the very department it
 * denies carrying. OSA-1 repaired exactly this failure on Live Map — a hard-coded `no-authority`
 * sentence the milestone had falsified — and recorded the standard it was applying:
 *
 *     A FALSE STATEMENT ON THE SURFACE A DIRECTOR TRUSTS MOST IS A DEFECT, NOT A FEATURE GAP.
 *
 * The same standard applies here, so the same repair is made. Nothing else changed: no new source
 * class, no workspace re-scoped, no field added, no authority moved.
 *
 * WHAT TRAVELS NOW: department identity, department lifecycle, and the recorded accountable owner
 * as an IDENTIFIER — because OSA-1 records exactly those three and nothing more.
 *
 * WHAT STILL CANNOT: no team, no reporting line, no roster, no individual member, no role, no band,
 * no permission, no agent. Not because each is filtered here, but because `AuthoritativeOrganization`
 * carries none of them — L3 measured that `roles` has no `organization_id` at all, and OSA-1 shipped
 * neither a roster nor a team. There is no field to read.
 *
 * The owner is an IDENTIFIER and never a name: Hebun holds a member COUNT and no roster, so
 * resolving an id to a person is a read this authority has not earned.
 *
 *     DEPARTMENT CARRIED != ROSTER CARRIED        OWNER RECORDED != OWNER AUTHORIZED
 *
 * The structural facts that DO travel are the authority's own — its refusal when it cannot read,
 * its measured emptiness when it can, and its departments when it has them — each carried verbatim.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { AuthoritativeOrganization, OrganizationAuthorityRead } from "./contracts";
import { readOrganizationAuthority } from "./read-organization.server";

/**
 * Named for what it is, and for what it is not.
 *
 * REPAIRED AT OSA-2. Every clause here is checked against what the authority actually carries,
 * because this string is not a comment: it reaches the model as the line's provenance AND is
 * rendered to the Director by `assembleProvenance`. It named three things it does not carry — and
 * one, the department, that it does. A reader who sees this line must still not conclude that Hebun
 * knows who is IN the organization, only how OSA-1 recorded that it is divided.
 */
export const ORGANIZATION_GROUNDING_PROVENANCE =
  "Organization Authority — the organization record this tenant IS, read tenant-scoped from the " +
  "session and authoritative (authoritative: true). It answers what organization exists and, since " +
  "the Organization Structure Authority, how it is divided: each recorded department's identity, " +
  "its lifecycle, and the accountable owner recorded for it as an identifier. Ownership is " +
  "attribution only — it grants no permission, no Governance authority, no approval right and no " +
  "right to execute anything. No team, no reporting line and no member roster is carried, because " +
  "no authority for any of them exists.";

/**
 * Why the source could not be resolved.
 *
 * FOUR REASONS, FOUR SENTENCES, AND THEY MUST NOT MERGE. "The store is not configured" and "this
 * session names an organization Hebun cannot find" are different facts with different remedies, and
 * collapsing them into "no organization exists" would turn an infrastructure state into a claim
 * about the customer's organization. Each maps to exactly one `OrganizationUnavailableReason`.
 */
export const ORGANIZATION_GROUNDING_UNAVAILABLE = Object.freeze({
  "no-tenant":
    "No authorized tenant context, so no organization was read. Nothing was substituted for it.",
  "persistence-not-configured":
    "Durable storage is not configured for this deployment, so Hebun holds no organization record " +
    "to read. That is a fact about the deployment, not about your organization.",
  "organization-not-found":
    "This session names an organization Hebun cannot find as a live record. That is a failed " +
    "lookup, not an organization with nothing in it.",
  "read-failed":
    "Hebun could not read your organization. That is a read failure, not an organization with " +
    "nothing in it.",
});

export interface OrganizationGroundingDeps {
  readonly readOrganization?: (tenant: TenantContext | null) => Promise<OrganizationAuthorityRead>;
}

function unavailable(reason: string): SourceResolution {
  return {
    sourceClass: "organization",
    state: "unavailable",
    provenance: ORGANIZATION_GROUNDING_PROVENANCE,
    authoritative: true,
    items: [],
    unavailableReason: reason,
  };
}

/**
 * The item's one machine-derived detail line.
 *
 * EVERY CLAUSE IS READ OFF THE AUTHORITY. Nothing is inferred, nothing is softened, and a value the
 * authority does not carry is stated as such rather than guessed — `tenantStatus` is nullable and
 * becomes "none recorded", never an invented lifecycle.
 *
 * THE STRUCTURE CLAUSE IS THE AUTHORITY'S OWN SENTENCE, verbatim. It is not summarized, shortened
 * or re-worded here, because a second wording is a second interpretation of a refusal, and the
 * refusal is the most important thing on this line. When a structural authority one day exists, it
 * becomes available in L3 and this line inherits it unchanged.
 *
 *     UNAVAILABLE != EMPTY        HUMAN MEMBER COUNT != MEMBER ROSTER
 */
function detailFor(organization: AuthoritativeOrganization): string {
  return [
    `lifecycle ${organization.lifecycleStatus}`,
    `tenant status ${organization.tenantStatus ?? "none recorded"}`,
    /* A COUNT. L3 holds no roster and this line may never imply one. */
    `human members ${organization.humanMemberCount}`,
    organization.provenanceDetail,
    structureClause(organization.structure),
  ].join(" · ");
}

/**
 * THE STRUCTURE CLAUSE, INHERITED (OSA-1).
 *
 * Until OSA-1 this was the authority's refusal sentence, verbatim. It now carries whichever of the
 * authority's THREE states is true, and the three never collapse into two:
 *
 *     UNAVAILABLE != EMPTY        NO DEPARTMENTS != NO STRUCTURE AUTHORITY
 *
 * Departments are named here — that is the whole point of the milestone — and each one carries
 * whether an accountable human is recorded. What is NEVER carried is a claim ownership does not
 * make: no permission, no approval right, no Governance authority. Heby may say "Finance is owned
 * by <id>" only because OSA recorded exactly that, and for a department OSA has not recorded it
 * says nothing at all rather than reaching for a role, an email or a seeded name.
 *
 * The owner is an IDENTIFIER, not a name: L3 holds a count and no roster, so resolving an id to a
 * person is a read this authority has not earned and this line must not imply.
 */
function structureClause(structure: AuthoritativeOrganization["structure"]): string {
  if (structure.status === "unavailable") return structure.detail;
  if (structure.departments.length === 0) return structure.detail;

  const named = structure.departments
    .map((department) => {
      const state = department.inService ? "in service" : "retired";
      const owner = department.owner
        ? `owner ${department.owner.actorId}${department.owner.currentlyActiveMember ? "" : " (no longer an active member)"}`
        : "no owner recorded";
      return `${department.name} [${department.slug}] ${state}, ${owner}`;
    })
    .join("; ");

  return `${structure.detail} Departments: ${named}.`;
}

/**
 * Read this tenant's organization for Heby grounding.
 *
 * Tenant-scoped through the authority's own predicate — this module passes the server-resolved
 * `TenantContext` straight through and constructs no query of its own. There is no parameter by
 * which a caller could name a different organization, a different slug or a different tenant, so a
 * cross-organization read is not refused here; it is UNREPRESENTABLE.
 *
 * EXACTLY ONE ITEM, ALWAYS. An organization is one record, so the grounding contribution is bounded
 * at one line by the shape of the fact rather than by a limit somebody chose. There is no roster to
 * page, no graph to walk and no domain list to grow.
 */
export async function readOrganizationGroundingSource(
  tenant: TenantContext | null,
  deps: OrganizationGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Organization grounding reads are server-only.");
  }

  const read = await (deps.readOrganization ?? ((t: TenantContext | null) => readOrganizationAuthority(t)))(
    tenant,
  );

  if (read.status === "unavailable") {
    return unavailable(ORGANIZATION_GROUNDING_UNAVAILABLE[read.reason]);
  }

  const organization = read.organization;
  const item: ResolvedSourceItem = {
    /*
     * THE IDENTITY IS THE ORGANIZATION'S OWN SLUG, and deliberately not `organizationId`.
     *
     * `organizationId` IS the tenant id. It is a session-scoped internal identifier, and printing it
     * as a citation reference would publish tenant identity into an answer body, a durable evidence
     * row and a model request for no reader benefit. The slug is the organization's own stable
     * public name for itself, which is what a citation reference is for.
     */
    recordRef: organization.slug,
    label: organization.name,
    detail: detailFor(organization),
    /*
     * CONSTANT, AND HONEST BECAUSE THE AUTHORITY IS NARROW. L3 returns only rows whose
     * `lifecycleStatus` is `active`, so a resolved organization is always a live, settled record.
     * There is no supersession or retirement concept for a company row to map from, and inventing a
     * branch for one would imply the authority can report a state it cannot.
     */
    lifecycle: "settled",
  };

  return {
    sourceClass: "organization",
    state: "resolved",
    provenance: ORGANIZATION_GROUNDING_PROVENANCE,
    authoritative: true,
    items: [item],
  };
}
