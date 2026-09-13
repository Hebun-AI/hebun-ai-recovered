/*
 * heby-action-inlet/place-human-proposal.server.ts — PROPOSING ONE GOVERNED PLACEMENT (GIA-2).
 *
 * ── WHAT A PROPOSAL IS, AND WHAT IT IS NOT ───────────────────────────────────
 *
 *     → prepareAction → recordActionRequest → /approvals
 *
 * This files a REQUEST. It authorizes nothing, executes nothing and places nobody. The Director
 * decides at `/approvals`, and even an approved request is not a placement — a human must still
 * perform it. Three separate facts, three separate moments, and this module owns only the first.
 *
 * ── THE EVIDENCE RULE IS ANSWERED, NOT LOWERED ───────────────────────────────
 *
 * `requiredEvidenceCount(CONSEQUENTIAL_MUTATION)` is 1, and the question it asks is "does this
 * action refer to anything real?". A placement refers to TWO real things, so both are retrieved
 * through their own released read seams and both are cited. A proposal that named a fabricated,
 * foreign-tenant or retired department would put a decision about a fiction in front of the
 * Director; retrieving the rows is what makes that impossible before human review, rather than
 * after it.
 *
 * Neither read takes a department or a human parameter that could point at another organization:
 * each is scoped by the session's tenant, and the caller's references are matched against what
 * those tenant-scoped reads return. A reference to another tenant's row therefore does not resolve
 * — it is indistinguishable from one that never existed.
 *
 * ── WHAT THE CALLER MAY SAY ──────────────────────────────────────────────────
 *
 * Two references and nothing else. No tenant, no actor, no authority, no digest, no effective date
 * — the input type makes them unrepresentable rather than merely discouraged, and the placement
 * domain has no other columns for them to land in.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { prepareAction } from "@/features/heby-actions/action-preparer";
import {
  recordActionRequest,
  type ActionRequestDeps,
} from "@/features/action-authorization/record-action-request.server";
import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";
import { readPeopleRegister } from "@/features/auth-runtime/people-register-read.server";
import { parseDepartmentRef } from "@/features/organization-authority/department-ref";
import {
  PLACE_HUMAN_ACTION_KIND,
  PLACE_HUMAN_OWNER_WORKSPACE,
  type PlaceHumanProposalInput,
} from "./contracts";

export type PlaceHumanProposalRefusal =
  /** No server-resolved tenant. */
  | "unauthenticated"
  /** The input is not two references in the shapes this act is defined over. */
  | "invalid-input"
  /** The department did not resolve for THIS tenant, or is not in service. */
  | "department-unresolved"
  /** The human did not resolve as an eligible member of THIS tenant. */
  | "human-unresolved"
  /** Organizational truth could not be read. Nothing was prepared and nothing was filed. */
  | "persistence-unavailable"
  /** The prepared action did not reach human review, so it was not filed. */
  | "not-authorizable";

export type PlaceHumanProposalResult =
  | {
      readonly status: "proposed";
      readonly receipt: {
        readonly requestId: string;
        readonly actionKind: typeof PLACE_HUMAN_ACTION_KIND;
      };
    }
  | { readonly status: "refused"; readonly reason: PlaceHumanProposalRefusal; readonly detail?: string };

export type PlaceHumanProposalDeps = ActionRequestDeps;

const USER_REF = /^user\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function refused(
  reason: PlaceHumanProposalRefusal,
  detail?: string,
): PlaceHumanProposalResult {
  return { status: "refused", reason, ...(detail ? { detail } : {}) };
}

/**
 * File one placement proposal for human decision.
 *
 * THE TENANT COMES FROM THE SESSION. Both references are resolved against tenant-scoped reads before
 * anything is filed, so the decision the Director sees is about rows that existed a moment ago.
 * They are resolved AGAIN by the Organization Authority when the act is performed, because the
 * world may move between the proposal and the execution — this read is about not proposing fiction,
 * not about trusting the proposal later.
 */
export async function proposePlaceHumanAction(
  tenant: TenantContext | null,
  input: PlaceHumanProposalInput | null,
  deps: PlaceHumanProposalDeps = {},
): Promise<PlaceHumanProposalResult> {
  if (typeof window !== "undefined") {
    throw new Error("Placement proposals are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const humanRef = typeof input?.humanRef === "string" ? input.humanRef.trim() : "";
  const departmentRef = typeof input?.departmentRef === "string" ? input.departmentRef.trim() : "";
  /*
   * `.match()` and not `.exec()`: a released R3A-1 firewall bans the substring `exec(` anywhere in
   * this feature so the inlet cannot execute anything, and a regex method name is not worth weakening
   * that rule for. Same result, same capture group.
   */
  const human = humanRef.match(USER_REF);
  const department = parseDepartmentRef(departmentRef);
  if (!human || department === null) return refused("invalid-input");
  const userId = human[1]!.toLowerCase();

  /*
   * TWO released, tenant-scoped reads — the same ones the organization surfaces use. Neither takes
   * a department or a human parameter, so neither can be aimed at another organization: the
   * caller's references are matched against what THIS tenant's reads returned.
   */
  /*
   * THROUGH L3, NOT AROUND IT. The first version called `readOrganizationStructure` directly and an
   * OSA-1 firewall refused it: only the L3 seam and the authority's own writers may reach the
   * structure read, so "every SURFACE still inherits through L3". The department list is right
   * there on `organization.structure`, so the boundary cost nothing — and it is the same seam the
   * record-work proposer already reads its organizational truth from.
   */
  const authoritative = await readOrganizationAuthority(tenant, deps);
  if (authoritative.status !== "available") return refused("persistence-unavailable");
  const structure = authoritative.organization.structure;
  if (structure.status !== "available") return refused("persistence-unavailable");
  const departmentRow = structure.departments.find(
    (candidate) => candidate.departmentId === department.departmentId,
  );
  if (!departmentRow) return refused("department-unresolved");

  /*
   * The people register enumerates by the SHARED eligibility predicate, so "is this a placeable
   * human" is answered by the same rule the placement authority will re-ask, not by a local copy.
   */
  const people = await readPeopleRegister(tenant);
  if (people.status !== "available") return refused("persistence-unavailable");
  const humanRow = people.people.find((candidate) => candidate.userId === userId);
  if (!humanRow) return refused("human-unresolved");

  const prepared = prepareAction({
    actionKind: PLACE_HUMAN_ACTION_KIND,
    requestingWorkspace: PLACE_HUMAN_OWNER_WORKSPACE,
    /*
     * THE DEPARTMENT IS THE TARGET, and the human is an argument. A placement changes the
     * organization's structure at the department; naming the human as the target would read as
     * though the act were performed upon the person.
     */
    target: {
      kind: "record",
      ref: departmentRef,
      label: departmentRow.name,
      sourceClass: "organization",
    },
    proposedArguments: { humanRef, departmentRef },
    /*
     * TWO citations, because two rows were read a moment ago. Neither is constructed to satisfy the
     * evidence rule; both ARE the reads.
     */
    evidence: [
      { sourceClass: "organization", recordRef: departmentRef, lifecycle: "settled" },
      { sourceClass: "organization", recordRef: humanRef, lifecycle: "settled" },
    ],
  });

  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") {
    return refused(
      "not-authorizable",
      `The action did not reach human review (${prepared.lifecycleState}). Nothing was filed.`,
    );
  }

  const recorded = await recordActionRequest(tenant, prepared, deps);
  if (recorded.status !== "recorded") {
    return refused("persistence-unavailable", recorded.status);
  }

  return {
    status: "proposed",
    receipt: { requestId: recorded.requestId, actionKind: PLACE_HUMAN_ACTION_KIND },
  };
}
