/*
 * heby-action-inlet/send-proposal.server.ts — the deterministic `/send` inlet (R3A.1).
 *
 * ── WHAT THIS CLOSES ─────────────────────────────────────────────────────────
 *
 * R3A made an approval durable. R3W gave `draftRef` a referent. R3R gave `recipientRef` one. The
 * remaining gap was never substrate — it was CONNECTION: `recordActionRequest` had zero production
 * callers, so no real pending request could ever exist. This module is that caller, and it is the
 * only one.
 *
 * ── THE MODEL DECIDES NOTHING HERE ───────────────────────────────────────────
 *
 * There is no classifier, no intent inference and no parsing of model output anywhere in this file.
 * The action kind is a CONSTANT, chosen because the user typed `/send`. The two referents are
 * typed by the user as explicit references and resolved against their owning authorities. Nothing
 * in this path can reach a provider — it imports no model client and constructs no transport.
 *
 *   USER EXPLICIT COMMAND → closed registry → typed validation → exact referent resolution
 *     → prepareAction → recordActionRequest → /approvals
 *
 * "The model inferred you wanted to send" is not expressible here.
 *
 * ── WHY THE DIGESTS ARE DERIVED, NEVER ACCEPTED ──────────────────────────────
 *
 * The caller supplies two REFERENCES. This module reads each one and takes the digest FROM WHAT IT
 * READ. A caller-supplied digest would let somebody name one thing and freeze another — the exact
 * drift R3W and R3R exist to prevent — so `SendProposalInput` has no digest field and there is no
 * code path here that could copy one out of client input.
 *
 * ── WHAT IT REFUSES TO DO ────────────────────────────────────────────────────
 *
 * It does not create a recipient from prose. It does not create a work artifact from raw text. It
 * does not approve, reject, revoke, mint or consume anything. It performs no send. Every one of
 * those is a different module with a different authority, and none of them is imported here.
 *
 * Server-only.
 */
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { prepareAction } from "@/features/heby-actions/action-preparer";
import type { HebyEvidenceReference } from "@/features/heby-integration";
import { recordActionRequest } from "@/features/action-authorization/record-action-request.server";
import { resolveWorkArtifactReference } from "@/features/work-artifacts/read-work-artifacts.server";
import { resolveRecipientReference } from "@/features/external-recipients/read-external-recipients.server";
import { formatWorkArtifactRef, isWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import { isRecipientRef } from "@/features/external-recipients/recipient-ref";
import {
  SEND_ACTION_KIND,
  SEND_OWNER_WORKSPACE,
  type SendProposalInput,
  type SendProposalRefusal,
  type SendProposalResult,
} from "./contracts";

export interface SendProposalDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

function refused(reason: SendProposalRefusal, detail: string): SendProposalResult {
  return { status: "refused", reason, detail };
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Action proposals are server-only.");
  }
}

/**
 * File one `/send` proposal for Director review.
 *
 * Returns a typed refusal for every failure rather than throwing: an unresolvable reference is
 * ordinary operator input, not a programming error, and the surface has to be able to say exactly
 * which half was wrong.
 */
export async function proposeSendAction(
  tenant: TenantContext | null,
  input: SendProposalInput | null,
  deps: SendProposalDeps = {},
): Promise<SendProposalResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) {
    return refused("unauthenticated", "Sign in to prepare an action.");
  }
  if (!input) return refused("invalid-input", "A recipient reference and a draft reference are required.");

  /*
   * Shape first, and refuse a malformed reference the same way an absent one is refused. Doing the
   * syntax check here rather than relying on the resolvers keeps the two halves' error vocabulary
   * identical, so the refusal never leaks which of "malformed" or "absent" it actually was.
   */
  if (!isRecipientRef(input.recipientRef)) {
    return refused("recipient-not-found", "That recipient reference does not name a recorded recipient.");
  }
  if (!isWorkArtifactRef(input.draftRef)) {
    return refused("draft-not-found", "That draft reference does not name a prepared draft revision.");
  }

  /* ── 1. THE RECIPIENT, RESOLVED AGAINST R3R ────────────────────────────── */
  const recipient = await resolveRecipientReference(tenant, input.recipientRef, deps);
  if (recipient.status === "refused") {
    if (recipient.reason === "persistence-unavailable") {
      return refused("persistence-unavailable", "Durable persistence is not connected, so nothing was prepared.");
    }
    return refused("recipient-not-found", "That recipient reference does not name a recorded recipient.");
  }
  if (recipient.recipient.status !== "active") {
    /*
     * Deliberately distinct from not-found. A retired recipient is a real thing the operator can
     * see and fix — either record the address again or choose another — and saying so is help, not
     * disclosure. An action prepared today must rest on an address the tenant still stands behind.
     */
    return refused(
      "recipient-retired",
      `"${recipient.recipient.displayName}" was retired, so it cannot receive a new proposal.`,
    );
  }

  /* ── 2. THE DRAFT, RESOLVED AGAINST R3W ────────────────────────────────── */
  const draft = await resolveWorkArtifactReference(tenant, input.draftRef, deps);
  if (!draft.readable || !draft.revision || !draft.artifact) {
    return refused("draft-not-found", "That draft reference does not name a prepared draft revision.");
  }
  if (draft.standing === "retired") {
    return refused("draft-retired", `"${draft.artifact.title}" was retired, so it cannot be proposed.`);
  }
  if (!draft.proposable) {
    /*
     * `superseded` — the revision is real and stays readable forever, but a newer one exists. R3W's
     * rule is that only the CURRENT revision is proposable, and nothing here upgrades the reference
     * to the newer one: silently proposing bytes the operator did not name is the whole failure
     * mode this chain exists to prevent.
     */
    return refused(
      "draft-superseded",
      `Revision ${draft.revision.revisionNo} of "${draft.artifact.title}" has been superseded. Propose the current revision explicitly.`,
    );
  }

  /* ── 3. EVIDENCE FROM REAL READS ONLY ──────────────────────────────────── */
  /*
   * The generic `record-ref` gate requires every reference argument to appear in the assembled
   * evidence, and evidence identity comes only from retrieval. These two entries exist BECAUSE two
   * tenant-scoped reads returned rows a moment ago — they are not constructed to satisfy the gate,
   * they are the reads. A fabricated reference cannot reach this line: it refused above.
   */
  const draftRef = formatWorkArtifactRef(draft.revision.artifactId, draft.revision.revisionNo);
  const evidence: readonly HebyEvidenceReference[] = [
    { sourceClass: "external-recipients", recordRef: recipient.recipient.recordRef, lifecycle: "settled" },
    { sourceClass: "work-artifacts", recordRef: draftRef, lifecycle: "settled" },
  ];

  /* ── 4. PREPARE — the existing gates, not a second lifecycle ────────────── */
  const prepared = prepareAction({
    actionKind: SEND_ACTION_KIND,
    requestingWorkspace: SEND_OWNER_WORKSPACE,
    target: {
      kind: "record",
      ref: recipient.recipient.recordRef,
      label: recipient.recipient.displayName,
    },
    proposedArguments: {
      recipientRef: recipient.recipient.recordRef,
      /* DERIVED from the row that was just read — never from client input. */
      recipientEndpointDigest: recipient.recipient.endpointDigest,
      /*
       * The RE-FORMATTED reference, not the caller's string. Both name the same revision, and
       * rebuilding it from the resolved row means the digest that gets frozen and the reference
       * that gets frozen provably came from the same read.
       */
      draftRef,
      draftRevisionDigest: draft.revision.contentDigest,
    },
    evidence,
  });

  /*
   * `recordActionRequest` enforces this too and would refuse. It is checked here so the operator
   * gets a reason naming the stage that stopped, rather than a bare "not authorizable" from a layer
   * they did not call.
   */
  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") {
    return refused(
      "not-authorizable",
      `The action did not reach human review (${prepared.lifecycleState}). Nothing was filed.`,
    );
  }

  /* ── 5. PERSIST — R3A's writer, unchanged ──────────────────────────────── */
  const recorded = await recordActionRequest(tenant, prepared, deps);

  if (recorded.status === "recorded") {
    return {
      status: "proposed",
      receipt: {
        requestId: recorded.requestId,
        actionKind: SEND_ACTION_KIND,
        recipientRef: recipient.recipient.recordRef,
        recipientLabel: recipient.recipient.displayName,
        draftRef,
        draftTitle: draft.artifact.title,
        status: "pending-review",
      },
    };
  }

  if (recorded.reason === "already-pending") {
    /*
     * R3A's own dedup, not a second one: `heby_action_requests_one_pending_per_digest_uq` decides
     * this. The same four values produce the same payload digest, so proposing the same send twice
     * hits the existing pending request instead of creating a duplicate a human would have to
     * reconcile. Nothing is looked up to "helpfully" return the original — that would be a second
     * dedup layer reading state the index already adjudicated.
     */
    return refused(
      "already-pending",
      "That exact send is already waiting for Director approval. Nothing was filed again.",
    );
  }
  if (recorded.reason === "persistence-unavailable") {
    return refused("persistence-unavailable", "Durable persistence is not connected, so nothing was prepared.");
  }
  return refused("not-authorizable", `The proposal was refused (${recorded.reason}). Nothing was filed.`);
}
