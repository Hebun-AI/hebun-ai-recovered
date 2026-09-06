/*
 * heby-action-inlet/record-work-proposal.server.ts — the deterministic `record-work` inlet (GIA-1).
 *
 * ── WHAT THIS CLOSES ─────────────────────────────────────────────────────────
 *
 * R3B built an execution runtime for ONE action kind, and every argument for why that was safe
 * rested on the act reaching an external provider. GIA-1 authorizes a SECOND kind whose execution
 * never leaves this system. This module is the only place a proposal for it can be filed, and it is
 * the twin of `send-proposal.server.ts` on purpose — a second proposal path that worked differently
 * would be a second set of rules to keep honest.
 *
 * ── THE MODEL DECIDES NOTHING HERE ───────────────────────────────────────────
 *
 * There is no classifier, no intent inference and no parsing of model output anywhere in this file,
 * exactly as in its sibling. The action kind is a CONSTANT. The department is an explicit reference
 * resolved against the authority that owns departments. The title is text a human typed, or — on
 * the agent path — text a durable agent proposed, which a human then reads before deciding.
 *
 *   EXPLICIT INPUT → closed registry → typed validation → exact referent resolution
 *     → prepareAction → recordActionRequest → /approvals
 *
 * ── WHAT IT REFUSES TO DO ────────────────────────────────────────────────────
 *
 * It does not create a department. It does not record work. It does not approve, reject, revoke,
 * mint or consume anything. It imports no work writer, no permit writer and no executor: filing a
 * proposal and performing an act are different modules with different authorities, and this one
 * holds neither the transaction nor the table.
 *
 * ── IT REACHES NO PROVIDER, AND CANNOT ───────────────────────────────────────
 *
 * No adapter, no transport, no recipient, no endpoint, no credential. The internal act is internal
 * from its first seam, and a firewall walks the real import graph of this module to prove it.
 *
 * Server-only.
 */
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { prepareAction } from "@/features/heby-actions/action-preparer";
import type { HebyEvidenceReference } from "@/features/heby-integration";
import {
  recordActionRequest,
  recordAgentOriginatedActionRequest,
} from "@/features/action-authorization/record-action-request.server";
import type { AgentProposer } from "@/features/action-authorization/agent-proposer.server";
import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";
import { isDepartmentRef, parseDepartmentRef, formatDepartmentRef } from "@/features/organization-authority/department-ref";
import { formatOrganizationRef } from "@/features/organization-authority/organization-ref";
import { isWellFormedWorkTitle } from "@/features/organizational-work/work-contracts";
import {
  RECORD_WORK_ACTION_KIND,
  RECORD_WORK_OWNER_WORKSPACE,
  type RecordWorkProposalInput,
  type RecordWorkProposalRefusal,
  type RecordWorkProposalResult,
} from "./contracts";

export interface RecordWorkProposalDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

function refused(reason: RecordWorkProposalRefusal, detail: string): RecordWorkProposalResult {
  return { status: "refused", reason, detail };
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Action proposals are server-only.");
  }
}

/**
 * File one `record-work` proposal for Director review.
 *
 * Returns a typed refusal for every failure rather than throwing: an unresolvable department is
 * ordinary operator input, not a programming error.
 */
/**
 * ORGANIZATION-LEVEL WORK — the same gates, one fewer fact (TRH-16).
 *
 * It runs the SAME `prepareAction` lifecycle, the SAME human-review requirement and the SAME R3A
 * writer as the department branch. What differs is only what is true: no department is named, so
 * none is read, none is evidenced and none is invented.
 *
 * NO EVIDENCE ENTRY, AND THAT IS CORRECT. Evidence exists to prove a named record was RETRIEVED
 * rather than asserted. Nothing is named here, so there is nothing to retrieve, and manufacturing
 * an entry would be the fabrication this phase removes. The capability gate agrees by construction:
 * its rule is "an optional record-ref that is simply absent is fine; one that is SUPPLIED must
 * resolve", and this branch supplies none.
 *
 * THE TARGET IS THE WORKSPACE, NOT A RECORD. A `record` target would need a ref, and the only refs
 * available would be invented. The owning workspace is a real, released identifier, and it is what
 * this work actually attaches to.
 */
async function fileOrganizationLevelProposal(
  tenant: TenantContext,
  title: string,
  proposer: AgentProposer | null,
  deps: RecordWorkProposalDeps,
  originationInvocationId?: string,
): Promise<RecordWorkProposalResult> {
  /*
   * ── THE ORGANIZATION IS READ, AND THAT IS THE DEVIATION WORTH NAMING ─────
   *
   * This branch names no department, so it resolves none — but it is NOT evidence-free.
   * `requiredEvidenceCount(CONSEQUENTIAL_MUTATION)` is 1, and that rule asks "does this action
   * refer to anything real?". Organization-level work refers to the ORGANIZATION, so the honest
   * answer is to retrieve it and cite it. THE EVIDENCE RULE WAS NOT LOWERED; IT WAS ANSWERED.
   *
   * The read goes through `readOrganizationAuthority` — the SAME seam the department branch uses,
   * not a second one — and it takes no organization parameter, so a caller cannot point it at
   * another tenant. The id therefore comes from the authority's answer for THIS session's tenant
   * and from nowhere else; nothing the caller sent can influence which organization is cited.
   */
  const authoritative = await readOrganizationAuthority(tenant, deps);
  if (authoritative.status !== "available") {
    return refused(
      "persistence-unavailable",
      "Organizational truth is not readable, so nothing was prepared.",
    );
  }
  const organizationRef = formatOrganizationRef(authoritative.organization.organizationId);

  const prepared = prepareAction({
    actionKind: RECORD_WORK_ACTION_KIND,
    requestingWorkspace: RECORD_WORK_OWNER_WORKSPACE,
    target: {
      kind: "record",
      ref: organizationRef,
      label: authoritative.organization.name,
      sourceClass: "organization",
    },
    proposedArguments: {
      title,
      /* The DECLARATION is the payload. A human reading the decision surface sees an asserted
       * organizational fact, not a field somebody forgot to fill in. */
      departmentScope: "organization-level",
    },
    /*
     * ONE entry, because ONE row was read a moment ago — the same sentence the department branch
     * earns. It is not constructed to satisfy the evidence rule; it IS the read.
     *
     * NOTE WHAT IS NOT HERE: no `departmentRef` argument. The generic record-ref gate therefore has
     * nothing to resolve on this branch, which is exactly its released rule — "an optional
     * record-ref that is simply absent is fine; one that is SUPPLIED must resolve."
     */
    evidence: [{ sourceClass: "organization", recordRef: organizationRef, lifecycle: "settled" }],
  });

  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") {
    return refused(
      "not-authorizable",
      `The action did not reach human review (${prepared.lifecycleState}). Nothing was filed.`,
    );
  }

  const recorded = proposer
    ? await recordAgentOriginatedActionRequest(tenant, prepared, proposer, deps, originationInvocationId)
    : await recordActionRequest(tenant, prepared, deps);

  if (recorded.status === "recorded") {
    return {
      status: "proposed",
      receipt: {
        requestId: recorded.requestId,
        actionKind: RECORD_WORK_ACTION_KIND,
        title,
        /* Declared absence, carried as absence. Nothing is named because nothing is. */
        departmentRef: null,
        departmentName: null,
        status: "pending-review",
      },
    };
  }

  /* The department branch's own refusal ladder, followed rather than re-invented. */
  if (recorded.reason === "already-pending") {
    return refused(
      "already-pending",
      "That exact organization-level work record is already waiting for Director approval. Nothing was filed again.",
    );
  }
  if (recorded.reason === "persistence-unavailable") {
    return refused("persistence-unavailable", "Durable persistence is not connected, so nothing was prepared.");
  }
  return {
    status: "refused",
    reason: "not-authorizable",
    detail: `The proposal was refused (${recorded.reason}). Nothing was filed.`,
    authorityRefusal: recorded.reason,
  };
}

async function fileRecordWorkProposal(
  tenant: TenantContext | null,
  input: RecordWorkProposalInput | null,
  proposer: AgentProposer | null,
  deps: RecordWorkProposalDeps,
  /** The model invocation that caused this proposal. Absent on the human path, by construction. */
  originationInvocationId?: string,
): Promise<RecordWorkProposalResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) {
    return refused("unauthenticated", "Sign in to prepare an action.");
  }
  if (!input) return refused("invalid-input", "A title and a declared department scope are required.");

  /*
   * THE TITLE IS CHECKED BY THE WORK AUTHORITY'S OWN RULE, imported rather than restated.
   *
   * Checking it here is not a second opinion: `recordWorkWithin` applies the same predicate inside
   * the permit's transaction and would refuse there. It is checked NOW so a title the authority
   * will never accept cannot become a decision a human spends their attention on and a permit they
   * then cannot spend.
   */
  if (!isWellFormedWorkTitle(input.title)) {
    return refused("invalid-input", "That title is not one the Work Authority will accept.");
  }
  /*
   * ── 0. THE DECLARED SCOPE, BEFORE ANYTHING IS READ (TRH-16) ──────────────
   *
   * The caller must say which organizational truth it is asserting. This is checked FIRST, and
   * separately from whether any department exists, because the two questions have different
   * audiences: this one is about the caller's own envelope, which it always knows, so refusing it
   * precisely leaks nothing. Department EXISTENCE stays collapsed into one answer below.
   *
   * A CONTRADICTORY ENVELOPE IS REFUSED, NOT REPAIRED. `organization-level` carrying a reference
   * is not organization-level work with a stray field — it is a caller asserting two different
   * things, and choosing one for it would be inventing intent.
   */
  const scope = input.department;
  if (!scope || (scope.kind !== "department" && scope.kind !== "organization-level")) {
    return refused(
      "invalid-department-scope",
      "Declare whether this work belongs to a department or to the organization itself.",
    );
  }
  if (scope.kind === "organization-level" && "departmentRef" in scope) {
    return refused(
      "invalid-department-scope",
      "Organization-level work names no department; remove the department reference or declare a department scope.",
    );
  }
  if (scope.kind === "department" && typeof (scope as { departmentRef?: unknown }).departmentRef !== "string") {
    return refused(
      "invalid-department-scope",
      "A department scope must carry the department reference it is scoped to.",
    );
  }

  /*
   * ── ORGANIZATION-LEVEL: NOTHING IS RESOLVED, BECAUSE NOTHING IS NAMED ────
   *
   * No Organization Authority read happens here, and that is not a shortcut — there is no
   * reference to resolve. The absence is carried forward EXPLICITLY into the payload a human will
   * see, so the decision surface shows a declared organizational fact rather than a blank field.
   */
  if (scope.kind === "organization-level") {
    return fileOrganizationLevelProposal(tenant, input.title, proposer, deps, originationInvocationId);
  }

  /* Shape first — a malformed reference is refused exactly as an absent one is. */
  if (!isDepartmentRef(scope.departmentRef)) {
    return refused("department-not-found", "That department reference does not name a department of this organization.");
  }

  /* ── 1. THE DEPARTMENT, RESOLVED AGAINST THE ORGANIZATION AUTHORITY ─────── */
  /*
   * Through `readOrganizationAuthority`, the ONE seam every consumer calls for organizational
   * truth, so this module learns no second way to ask and gains no department query of its own. It
   * takes no organization parameter, so a caller cannot point it at another tenant.
   */
  const authoritative = await readOrganizationAuthority(tenant, deps);
  if (authoritative.status !== "available") {
    return refused("persistence-unavailable", "Organizational truth is not readable, so nothing was prepared.");
  }
  const structure = authoritative.organization.structure;
  if (structure.status !== "available") {
    return refused("persistence-unavailable", "Organizational truth is not readable, so nothing was prepared.");
  }

  const parsed = parseDepartmentRef(scope.departmentRef)!;
  const department = structure.departments.find((entry) => entry.departmentId === parsed.departmentId);
  if (!department) {
    return refused("department-not-found", "That department reference does not name a department of this organization.");
  }
  if (!department.inService) {
    /*
     * Deliberately distinct from not-found. A retired department is a real thing the operator can
     * see and fix, and the Work Authority refuses it too — so filing this would produce an
     * authorization that could never be spent.
     */
    return refused(
      "department-retired",
      `"${department.name}" was retired, so work cannot be filed against it.`,
    );
  }

  /* ── 2. EVIDENCE FROM A REAL READ ONLY ──────────────────────────────────── */
  /*
   * ONE entry, because ONE row was read a moment ago. It is not constructed to satisfy the
   * `record-ref` gate — it IS the read, and a fabricated reference cannot reach this line because
   * it refused above.
   */
  const departmentRef = formatDepartmentRef(department.departmentId);
  const evidence: readonly HebyEvidenceReference[] = [
    { sourceClass: "organization", recordRef: departmentRef, lifecycle: "settled" },
  ];

  /* ── 3. PREPARE — the existing gates, not a second lifecycle ─────────────── */
  const prepared = prepareAction({
    actionKind: RECORD_WORK_ACTION_KIND,
    requestingWorkspace: RECORD_WORK_OWNER_WORKSPACE,
    target: { kind: "record", ref: departmentRef, label: department.name },
    proposedArguments: {
      title: input.title,
      /* Declared on BOTH branches, so the frozen payload states which truth was asserted rather
       * than leaving a reader to infer it from which fields happen to be present. */
      departmentScope: "department",
      /* The RE-FORMATTED reference, not the caller's string — so what is frozen provably came
       * from the row that was read. */
      departmentRef,
    },
    evidence,
  });

  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") {
    return refused(
      "not-authorizable",
      `The action did not reach human review (${prepared.lifecycleState}). Nothing was filed.`,
    );
  }

  /*
   * ── 4. PERSIST — R3A's writer, unchanged ────────────────────────────────
   *
   * ONE MODULE, TWO TRUTHS, exactly as `/send`. `AgentProposer` is branded in the authorization
   * feature and only its resolver mints one, so a null proposer means a human dictated this. The
   * agent path additionally passes the released mandate ceiling inside that writer — being able to
   * call this function is not being allowed to propose.
   */
  const recorded = proposer
    ? await recordAgentOriginatedActionRequest(tenant, prepared, proposer, deps, originationInvocationId)
    : await recordActionRequest(tenant, prepared, deps);

  if (recorded.status === "recorded") {
    return {
      status: "proposed",
      receipt: {
        requestId: recorded.requestId,
        actionKind: RECORD_WORK_ACTION_KIND,
        title: input.title,
        departmentRef,
        departmentName: department.name,
        status: "pending-review",
      },
    };
  }

  if (recorded.reason === "already-pending") {
    /*
     * R3A's own dedup, not a second one. The same title and the same department produce the same
     * payload digest, so proposing the same record twice hits the existing pending request instead
     * of creating a duplicate a human would have to reconcile.
     */
    return refused(
      "already-pending",
      "That exact work record is already waiting for Director approval. Nothing was filed again.",
    );
  }
  if (recorded.reason === "persistence-unavailable") {
    return refused("persistence-unavailable", "Durable persistence is not connected, so nothing was prepared.");
  }
  /* The collapse point, repaired the same way its sibling repairs it: the authoritative refusal
   * travels beside this inlet's coarser reason, never instead of it. */
  return {
    status: "refused",
    reason: "not-authorizable",
    detail: `The proposal was refused (${recorded.reason}). Nothing was filed.`,
    authorityRefusal: recorded.reason,
  };
}

/**
 * The HUMAN record-work proposal.
 *
 * A person typed the title and chose the department from their own organization's in-service
 * departments. Nothing here originates anything, so the proposer is the person.
 */
export function proposeRecordWorkAction(
  tenant: TenantContext | null,
  input: RecordWorkProposalInput | null,
  deps: RecordWorkProposalDeps = {},
): Promise<RecordWorkProposalResult> {
  return fileRecordWorkProposal(tenant, input, null, deps);
}

/**
 * The AGENT-ORIGINATED record-work proposal (GIA-1).
 *
 * ── WHAT REACHES THIS FUNCTION, AND WHAT CANNOT ──────────────────────────────
 *
 * A title, a department reference, and a verified proposer. No model, no transport and no prompt
 * crosses this boundary — the selection already happened upstream and was already validated.
 *
 * ── A MANDATE IS REQUIRED, AND IT IS NOT ENFORCED HERE ───────────────────────
 *
 * `recordAgentOriginatedActionRequest` reads the agent's effective mandate before it writes and
 * refuses when the authority is unreachable, when no mandate exists, or when `record-work` is
 * outside the recorded scope. That is the ONE enforcement seam and this module deliberately does
 * not add a second: two places deciding what an agent may propose is one place too many.
 *
 * The department is re-resolved here regardless of where the reference came from. An agent that
 * named something retired, foreign or absent is refused by the same code that refuses a human who
 * typed it — the resolution is not relaxed for a machine.
 */
export function proposeAgentOriginatedRecordWorkAction(
  tenant: TenantContext | null,
  input: RecordWorkProposalInput | null,
  proposer: AgentProposer,
  deps: RecordWorkProposalDeps = {},
  originationInvocationId?: string,
): Promise<RecordWorkProposalResult> {
  return fileRecordWorkProposal(tenant, input, proposer, deps, originationInvocationId);
}
