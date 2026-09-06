/*
 * agent-origination/candidate-set.server.ts — what a durable agent is allowed to choose from
 * (AGENT-PROPOSAL-1).
 *
 * ── THE SERVER BUILDS THE CHOICE SPACE ───────────────────────────────────────
 *
 * The agent never proposes a reference it thought of. It proposes one of these, or nothing. Every
 * list comes from a released, tenant-scoped read seam — `listActiveRecipients` (R3R),
 * `listWorkArtifacts` (R3W) and, since TRH-17, `readOrganizationAuthority` (L3/OSA-1) — so
 * membership in the set already means "this tenant owns this row".
 *
 * ── TWO KINDS, TWO INDEPENDENT CHOICE SPACES (TRH-17) ────────────────────────
 *
 * `send` chooses a recipient AND a draft. `record-work` chooses an organizational SCOPE — a
 * department of this tenant, or the organization itself. They share nothing, so neither one being
 * empty may silence the other; see {@link candidatesAreProposable}.
 *
 * ── THE NARROW PROJECTION IS THE PRIVACY BOUNDARY ────────────────────────────
 *
 * `RecipientView` carries `endpointValue`: the actual address. R3A.1 established that the raw
 * address never enters a proposal, and it must not enter a model prompt either. Projecting to
 * `{ ref, label }` here means the address is absent from the agent's context BY CONSTRUCTION —
 * there is no field on the candidate type that could hold one, so no later caller can leak it by
 * forgetting to strip it. Nothing else on either view is carried: no digest, no id, no tenant, no
 * actor, no timestamp, no content.
 *
 * ── ONLY PROPOSABLE THINGS ARE OFFERED ───────────────────────────────────────
 *
 * Retired recipients are excluded by calling the active-only seam, which takes no status parameter
 * precisely so a caller cannot widen the set. Retired artifacts are excluded here, and only the
 * artifact's CURRENT revision reference is offered — R3W's rule is that a superseded revision is
 * not proposable, so offering one would produce a candidate the inlet is required to refuse.
 *
 * Server-only. Reads only; this module writes nothing.
 */
import { listActiveRecipients } from "@/features/external-recipients/read-external-recipients.server";
import type { RecipientReadDeps } from "@/features/external-recipients/read-external-recipients.server";
import { listWorkArtifacts } from "@/features/work-artifacts/read-work-artifacts.server";
import type { WorkArtifactReadDeps } from "@/features/work-artifacts/read-work-artifacts.server";
import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";
import type { OrganizationAuthorityDeps } from "@/features/organization-authority/read-organization.server";
import { formatDepartmentRef } from "@/features/organization-authority/department-ref";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  MAX_CANDIDATES_PER_KIND,
  type DepartmentCandidate,
  type OriginationCandidateSet,
  type RecordWorkCandidateSpace,
} from "./contracts";

export interface CandidateSetDeps {
  readonly recipients?: RecipientReadDeps;
  readonly artifacts?: WorkArtifactReadDeps;
  /** TRH-17. The SAME Organization seam the record-work inlet uses — not a second one. */
  readonly organization?: OrganizationAuthorityDeps;
}

/** Nothing about this organization was readable, so record-work is not proposable. */
const NO_RECORD_WORK: RecordWorkCandidateSpace = Object.freeze({
  organizationLevel: false,
  departments: Object.freeze([]) as readonly DepartmentCandidate[],
});

/**
 * Build this tenant's candidate set for one origination attempt.
 *
 * An UNAVAILABLE send read is reported as an empty list rather than as a fabricated one. For the
 * SEND half the two cases are honestly identical at this seam: whether the tenant has nothing or
 * the read failed, there is nothing an agent may legitimately choose right now.
 *
 * THE RECORD-WORK HALF KEEPS THEM APART, because it can. `readOrganizationAuthority` answers
 * "could I look?" and "what did I find?" as two different facts, so an unreadable organization
 * yields `organizationLevel: false` while a readable one with no departments yields
 * `organizationLevel: true` and an empty list — and only the first is unproposable. Collapsing them
 * would make TRH-16's whole finding unreachable from here.
 *
 * The bound is a ceiling on the prompt, not a filter on truth: a tenant with more rows than the
 * bound simply offers the first `MAX_CANDIDATES_PER_KIND` in each seam's own released order. It is
 * stated here rather than hidden so nobody reads a short list as "this is everything you own".
 */
export async function buildOriginationCandidates(
  tenant: TenantContext | null,
  deps: CandidateSetDeps = {},
): Promise<OriginationCandidateSet> {
  if (typeof window !== "undefined") {
    throw new Error("Origination candidates are server-only.");
  }
  if (!tenant?.tenantId) return { recipients: [], drafts: [], work: NO_RECORD_WORK };

  const recipientListing = await listActiveRecipients(tenant, deps.recipients ?? {});
  const artifactListing = await listWorkArtifacts(tenant, deps.artifacts ?? {});
  const organization = await readOrganizationAuthority(tenant, deps.organization ?? {});

  const recipients = recipientListing.recipients
    .slice(0, MAX_CANDIDATES_PER_KIND)
    /* `ref` and `label` ONLY. The address has no field to travel in. */
    .map((recipient) => ({ ref: recipient.recordRef, label: recipient.displayName }));

  const drafts =
    artifactListing.status === "read"
      ? artifactListing.artifacts
          .filter((artifact) => artifact.lifecycleStatus === "draft")
          .slice(0, MAX_CANDIDATES_PER_KIND)
          /* The CURRENT revision reference. A superseded one is not proposable. */
          .map((artifact) => ({ ref: artifact.currentRef, label: artifact.title }))
      : [];

  return { recipients, drafts, work: recordWorkSpace(organization) };
}

/**
 * The record-work half of the choice space (TRH-17).
 *
 * ── ONE READ, THROUGH THE SAME SEAM THE INLET USES ───────────────────────────
 *
 * `readOrganizationAuthority` takes no organization parameter and resolves the organization from
 * the session's own tenant, so this cannot be pointed at another tenant's structure. It answers
 * both questions in one call: whether the organization is readable at all, and what departments it
 * has recorded. A second seam here would be a second way to ask a question the inlet already asks
 * exactly one way.
 *
 * ── UNREADABLE IS NOT EMPTY ──────────────────────────────────────────────────
 *
 * An organization Hebun could not read yields `organizationLevel: false` and no departments —
 * record-work is simply not proposable right now. That is NOT the same fact as an organization with
 * no departments, which yields `organizationLevel: true` and an empty list and is fully proposable.
 * OSA-1's three-state structure result is preserved rather than flattened.
 *
 * ── ONLY IN-SERVICE DEPARTMENTS, AND ONLY THEIR SLUGS ────────────────────────
 *
 * `inService` is the read seam's derived retirement fact. Offering a retired department would
 * produce a candidate the inlet is required to refuse — the same rule the draft projection above
 * already follows for superseded revisions.
 *
 * The `departmentRef` is minted HERE, by trusted code, from an id the model never sees. A malformed
 * id would throw from `formatDepartmentRef`; a department that cannot be named canonically is
 * dropped rather than offered under a reference nothing could resolve.
 */
function recordWorkSpace(
  organization: Awaited<ReturnType<typeof readOrganizationAuthority>>,
): RecordWorkCandidateSpace {
  if (organization.status !== "available") return NO_RECORD_WORK;

  const structure = organization.organization.structure;
  const departments: DepartmentCandidate[] = [];
  if (structure.status === "available") {
    for (const department of structure.departments) {
      if (departments.length >= MAX_CANDIDATES_PER_KIND) break;
      if (!department.inService) continue;
      let departmentRef: string;
      try {
        departmentRef = formatDepartmentRef(department.departmentId);
      } catch {
        continue;
      }
      departments.push({ slug: department.slug, label: department.name, departmentRef });
    }
  }

  /*
   * ORGANIZATION-LEVEL IS AVAILABLE THE MOMENT THE ORGANIZATION IS READABLE, and it does not depend
   * on the structural read. TRH-16: organization-level work names no department, so a structural
   * read that failed cannot make it unproposable — it was never going to consult one.
   */
  return { organizationLevel: true, departments };
}

/**
 * Whether there is anything at all an agent could propose (TRH-17).
 *
 * ── WHY THIS IS AN `OR` AND NOT AN `AND` ─────────────────────────────────────
 *
 * Until TRH-17 this read `recipients.length > 0 && drafts.length > 0` — the SEND requirement, and
 * the only requirement there was. That made a tenant with no recorded recipient unable to reach the
 * model AT ALL, however much record-work it could legitimately propose. Turkish Rug House is
 * exactly that tenant: zero recipients, a mandate of `["record-work"]`, and an origination runtime
 * that refused `no-candidates` before the model was ever called.
 *
 * The two kinds have INDEPENDENT choice spaces and must have independent proposability. `send`'s
 * own requirement is unchanged and still conjunctive — a send needs both halves, and
 * {@link sendIsProposable} says so in one place instead of being spelled out at the call site.
 */
export function candidatesAreProposable(candidates: OriginationCandidateSet): boolean {
  return sendIsProposable(candidates) || recordWorkIsProposable(candidates);
}

/** A send needs BOTH halves. Unchanged from AGENT-PROPOSAL-1; only its name is new. */
export function sendIsProposable(candidates: OriginationCandidateSet): boolean {
  return candidates.recipients.length > 0 && candidates.drafts.length > 0;
}

/**
 * Record-work needs ONE of its two organizational truths to be available.
 *
 * An organization with zero departments is proposable — that is TRH-16's whole finding, and writing
 * `departments.length > 0` here would re-impose the department requirement that phase removed.
 */
export function recordWorkIsProposable(candidates: OriginationCandidateSet): boolean {
  return candidates.work.organizationLevel || candidates.work.departments.length > 0;
}
