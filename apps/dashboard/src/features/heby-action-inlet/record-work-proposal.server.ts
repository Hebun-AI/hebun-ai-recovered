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
  if (!input) return refused("invalid-input", "A title and a department reference are required.");

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
  /* Shape first — a malformed reference is refused exactly as an absent one is. */
  if (!isDepartmentRef(input.departmentRef)) {
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

  const parsed = parseDepartmentRef(input.departmentRef)!;
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
