/*
 * action-execution/execute-authorized-action.server.ts — the first act Hebun performs (R3B).
 *
 * ── THE SHAPE, AND WHY IT IS THIS SHAPE ──────────────────────────────────────
 *
 *   PRE-FLIGHT   read-only. Refuses without spending anything, so a fixable condition does not
 *                cost the Director their authorization.
 *   TRANSACTION  the permit is spent AND the attempt row is written in ONE statement-group. The
 *                world is re-read inside it, because the pre-flight answer is already stale.
 *   POST-COMMIT  the kill switch is read again, then exactly one external call is made.
 *
 * ── WHY THE SAME CHECK APPEARS TWICE, WITH DIFFERENT CONSEQUENCES ────────────
 *
 * A retired recipient found in PRE-FLIGHT leaves the permit `active`: Hebun could see it coming,
 * so it declines cheaply and the Director can fix the cause and execute the same authorization.
 * The same fact found INSIDE the transaction burns the permit and records a refused attempt: the
 * world changed under a valid authorization, and R3A's doctrine is that a retry needs a NEW
 * decision. Two timings, two costs, and the unsafe outcome — acting on a retired recipient — is
 * impossible in both.
 *
 * ── WHY THE PERMIT IS BURNED WHEN THE WORLD CHANGES ──────────────────────────
 *
 * The alternative is a live permit pointing at an address its tenant has withdrawn, or at an
 * artifact they retired. An authorization must not outlive the fact that justified it, and R3A
 * already states that a failed execution does not return the permit.
 *
 * ── WHAT THIS MODULE CANNOT DO ───────────────────────────────────────────────
 *
 * It cannot approve, reject, revoke or mint. It cannot create a recipient or a draft. It cannot
 * mutate Knowledge, Governance, permissions or policy. It cannot retry. It imports no model, no
 * agent, no browser, no shell and no filesystem. The single external reach it has is one call to
 * one adapter with four scalars.
 *
 * Server-only.
 */
import { and, eq, sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { actionExecutionAttempts } from "@/db/schema/action-execution";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import { externalRecipients } from "@/db/schema/external-recipient";
import { workArtifacts, workArtifactRevisions } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { asCanonicalPayload } from "@/features/action-authorization/canonical-payload";
import { consumeActionPermit } from "@/features/action-authorization/consume-action-permit.server";
import type { ExecutionAuthorization } from "@/features/action-authorization/contracts";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { recordActionExecutionEventWithin } from "@/features/governance-audit/action-execution-audit.server";
import { parseWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import { parseRecipientRef } from "@/features/external-recipients/recipient-ref";
import type { ExternalSendAdapter, ProviderOutcome } from "./adapter-contract";
import { checkAdapterAvailability, resolveExternalSendAdapter } from "./adapter-registry.server";
import { type ExecutionControlDeps } from "./execution-control.server";
import {
  resolveExternalSendReachability,
  type ExternalSendReachabilityDeps,
} from "@/features/tenant-external-send-authority/resolve-external-send-reachability.server";
import {
  EXECUTABLE_ACTION_KIND,
  type ExecutionAttemptView,
  type ExecutionFailureClass,
  type ExecutionPreflightRefusal,
  type ExecutionResult,
} from "./contracts";
import { toExecutionAttemptView, type ExecutionAttemptRow } from "./attempt-view";
import {
  PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND,
  asPublishInstagramMediaPayload,
  type PublishInstagramMediaPayload,
} from "@/features/instagram-publishing/contracts";
import type { MediaStorageResolution } from "@/features/media-assets/media-object-store";
import { resolveMediaObjectStore } from "@/features/media-assets/media-storage.server";
import { selectMediaAssetRecord } from "@/features/media-assets/read-media-assets.server";
import {
  readPublishDerivative,
  selectPublishLineage,
  type PublishLineageBinding,
  type ReadPublishDerivativeResult,
} from "@/features/media-assets/read-publish-derivative.server";
import { withAuthorizedInstagramToken } from "@/features/provider-instagram/instagram-access-token-call.server";
import {
  INSTAGRAM_PUBLISH_ADAPTER_ID,
  publishInstagramImage,
  type InstagramPublishInput,
  type InstagramPublishOutcome,
} from "@/features/provider-instagram/instagram-publish-transport.server";
import type { InstagramPublishCapability } from "@/features/provider-instagram/publish-capability";
import { evaluatePublishConnection } from "@/features/provider-instagram/publish-capability";
import {
  readInstagramPublishFacts,
  resolveInstagramPublishCapability,
} from "@/features/provider-instagram/resolve-publish-capability.server";


export interface ExecuteAuthorizedActionDeps
  extends ExecutionControlDeps,
    ExternalSendReachabilityDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /**
   * Injected in tests so no live provider is ever contacted. Production leaves this unset and the
   * registry constructs the real transport. A test that forgets to inject gets `null` from the
   * registry (no credential is configured anywhere) rather than a live call.
   */
  readonly adapter?: ExternalSendAdapter | null;
  /** PUBLISH-0 — injected provider seams for the Instagram publish half. Unset in production. */
  readonly instagramPublish?: InstagramPublishExecutionPorts;
}

function refused(reason: ExecutionPreflightRefusal): ExecutionResult {
  return { status: "refused", reason };
}

/** The four typed scalars `/send` froze. Anything else in the payload is not this action. */
interface SendPayload {
  readonly recipientRef: string;
  readonly recipientEndpointDigest: string;
  readonly draftRef: string;
  readonly draftRevisionDigest: string;
}

function asSendPayload(raw: unknown): SendPayload | null {
  const payload = asCanonicalPayload(raw);
  if (!payload) return null;
  const recipientRef = payload.recipientRef;
  const recipientEndpointDigest = payload.recipientEndpointDigest;
  const draftRef = payload.draftRef;
  const draftRevisionDigest = payload.draftRevisionDigest;
  if (
    typeof recipientRef !== "string" ||
    typeof recipientEndpointDigest !== "string" ||
    typeof draftRef !== "string" ||
    typeof draftRevisionDigest !== "string"
  ) {
    return null;
  }
  return { recipientRef, recipientEndpointDigest, draftRef, draftRevisionDigest };
}

/**
 * What the in-transaction re-read produced.
 *
 * The address and the content live ONLY here, in memory, for the length of one call. Neither is
 * written to the attempt row, the audit log, or anything else.
 */
interface ResolvedTarget {
  readonly recipientId: string;
  readonly endpoint: string;
  readonly endpointDigest: string;
  readonly content: string;
  readonly contentDigest: string;
}

/**
 * Re-read the recipient and the exact artifact revision and check them against what was approved.
 *
 * Used BOTH in pre-flight and inside the transaction. Identical logic, deliberately: two versions
 * of "is this still valid" would eventually disagree, and the disagreement would be invisible.
 */
async function resolveTarget(
  reader: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  payload: SendPayload,
): Promise<{ readonly target: ResolvedTarget } | { readonly failure: ExecutionFailureClass }> {
  const recipientRef = parseRecipientRef(payload.recipientRef);
  const artifactRef = parseWorkArtifactRef(payload.draftRef);
  if (!recipientRef) return { failure: "digest-mismatch" };
  if (!artifactRef) return { failure: "artifact-unresolvable" };

  const recipientRows = await reader
    .select({
      id: externalRecipients.id,
      endpointValue: externalRecipients.endpointValue,
      endpointDigest: externalRecipients.endpointDigest,
      status: externalRecipients.status,
    })
    .from(externalRecipients)
    .where(
      and(
        eq(externalRecipients.tenantId, tenantId),
        eq(externalRecipients.id, recipientRef.recipientId),
      ),
    )
    .limit(1);
  const recipient = recipientRows[0];
  /* A foreign or fabricated reference resolves to nothing, never to a refusal that confirms it. */
  if (!recipient) return { failure: "recipient-retired" };
  /*
   * THE CHECK A DIGEST CANNOT MAKE. R3R rows are immutable — retiring one does not change its
   * address, so `endpoint_digest` still matches the permit's frozen copy. Only `status` can catch
   * this, which is exactly why it is checked rather than inferred.
   */
  if (recipient.status !== "active") return { failure: "recipient-retired" };
  if (recipient.endpointDigest !== payload.recipientEndpointDigest) {
    return { failure: "digest-mismatch" };
  }

  const artifactRows = await reader
    .select({
      id: workArtifacts.id,
      lifecycle: workArtifacts.artifactLifecycleStatus,
    })
    .from(workArtifacts)
    .where(and(eq(workArtifacts.tenantId, tenantId), eq(workArtifacts.id, artifactRef.artifactId)))
    .limit(1);
  const artifact = artifactRows[0];
  if (!artifact) return { failure: "artifact-unresolvable" };
  if (artifact.lifecycle === "retired") return { failure: "artifact-retired" };

  const revisionRows = await reader
    .select({
      content: workArtifactRevisions.content,
      contentDigest: workArtifactRevisions.contentDigest,
    })
    .from(workArtifactRevisions)
    .where(
      and(
        eq(workArtifactRevisions.tenantId, tenantId),
        eq(workArtifactRevisions.artifactId, artifactRef.artifactId),
        eq(workArtifactRevisions.revisionNo, artifactRef.revisionNo),
      ),
    )
    .limit(1);
  const revision = revisionRows[0];
  if (!revision) return { failure: "artifact-unresolvable" };
  if (revision.contentDigest !== payload.draftRevisionDigest) return { failure: "digest-mismatch" };

  /*
   * SUPERSESSION IS NOT CHECKED, AND THAT IS THE POLICY.
   *
   * `/send` refuses to PROPOSE a superseded revision, because proposing stale bytes is a mistake
   * still worth catching. Execution is the opposite case: a human read these exact bytes and
   * approved them, the revision is immutable and stays readable forever, and voiding their
   * decision because somebody later edited the draft would mean the approval named something other
   * than what it named. Retirement blocks — that is the tenant withdrawing the artifact — but a
   * newer sibling revision existing does not.
   */
  return {
    target: {
      recipientId: recipient.id,
      endpoint: recipient.endpointValue,
      endpointDigest: recipient.endpointDigest,
      content: revision.content,
      contentDigest: revision.contentDigest,
    },
  };
}

/** Pre-flight failures map to refusals that leave the permit spendable. */
function preflightReasonFor(failure: ExecutionFailureClass): ExecutionPreflightRefusal {
  switch (failure) {
    case "recipient-retired":
      return "recipient-retired";
    case "artifact-retired":
      return "artifact-retired";
    case "artifact-unresolvable":
      return "artifact-unresolvable";
    default:
      return "digest-mismatch";
  }
}

/** The provider's answer, mapped to the terminal row state. The CHECKs enforce the same pairs. */
function terminalFor(outcome: ProviderOutcome): {
  status: "accepted" | "failed" | "unknown";
  providerMessageId: string | null;
  failureClass: ExecutionFailureClass | null;
} {
  switch (outcome.class) {
    case "accepted":
      return {
        status: "accepted",
        providerMessageId: outcome.providerMessageId,
        failureClass: null,
      };
    case "rejected":
      return { status: "failed", providerMessageId: null, failureClass: "provider-rejected" };
    case "unreachable":
      return { status: "failed", providerMessageId: null, failureClass: "provider-unreachable" };
    case "ambiguous":
      /* The one outcome that must never become `failed`. A CHECK enforces it independently. */
      return { status: "unknown", providerMessageId: null, failureClass: null };
  }
}

/**
 * Execute ONE authorized action.
 *
 * The caller supplies which permit and nothing else. It cannot supply the tenant (session), the
 * handoff id (minted by the spend), the payload, the digests, the recipient, the content, the
 * adapter or any timestamp.
 */
export async function executeAuthorizedAction(
  tenant: TenantContext | null,
  input: { readonly permitId: string },
  deps: ExecuteAuthorizedActionDeps = {},
): Promise<ExecutionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action execution is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();
  const env = deps.env ?? process.env;

  /* ── 1. THE ARMING CONJUNCTION, BEFORE ANYTHING ELSE ───────────────────── */
  /*
   * Read first so an unarmed system never burns a permit and never reads a recipient's address.
   *
   * TENANT-ARM-1: this is a CONJUNCTION, not a single switch. `resolveExternalSendReachability`
   * requires BOTH this organization's own Governance arming AND the deployment-wide control, and
   * it refuses on either half. The tenant travelling into it is `tenant.tenantId`, read off the
   * branded `TenantContext` minted from the authenticated session above — never from `input`,
   * which carries only a permit id, and never from anything a client could supply.
   *
   * The two refusals stay apart: another organization being armed cannot make this one reachable,
   * and a deployment-wide stop cannot be mistaken for this organization never having been armed.
   */
  const reach = await resolveExternalSendReachability(tenant.tenantId, deps);
  if (reach.status === "refused") {
    switch (reach.reason) {
      case "tenant-not-armed":
      case "tenant-arming-withdrawn":
        return refused("tenant-not-armed");
      case "persistence-unavailable":
        return refused("persistence-unavailable");
      default:
        return refused("execution-disabled");
    }
  }

  /* ── 2. THE PERMIT AND ITS REQUEST, READ-ONLY ──────────────────────────── */
  let permitRow: {
    id: string;
    actionRequestId: string;
    boundPayloadDigest: string;
  };
  let requestRow: { id: string; actionKind: string; canonicalPayload: unknown };
  try {
    const rows = await db
      .select({
        permitId: actionPermits.id,
        actionRequestId: actionPermits.actionRequestId,
        boundPayloadDigest: actionPermits.boundPayloadDigest,
        requestId: hebyActionRequests.id,
        actionKind: hebyActionRequests.actionKind,
        canonicalPayload: hebyActionRequests.canonicalPayload,
      })
      .from(actionPermits)
      .innerJoin(
        hebyActionRequests,
        and(
          eq(actionPermits.actionRequestId, hebyActionRequests.id),
          eq(actionPermits.tenantId, hebyActionRequests.tenantId),
        ),
      )
      .where(
        and(
          eq(actionPermits.id, input.permitId),
          eq(actionPermits.tenantId, tenant.tenantId),
          eq(actionPermits.status, "active"),
          /* The DATABASE clock, exactly as the spend statement will use. */
          sql`${actionPermits.expiresAt} > now()`,
        ),
      )
      .limit(1);
    const row = rows[0];
    /* Not found, foreign tenant, consumed, revoked, or expired — one answer for all. */
    if (!row) return refused("permit-not-executable");
    permitRow = {
      id: row.permitId,
      actionRequestId: row.actionRequestId,
      boundPayloadDigest: row.boundPayloadDigest,
    };
    requestRow = {
      id: row.requestId,
      actionKind: row.actionKind,
      canonicalPayload: row.canonicalPayload,
    };
  } catch {
    return refused("persistence-unavailable");
  }

  /*
   * THE ONE EXECUTABLE KIND. A permit for `restart-workflow`, `grant-permission` or
   * `modify-governance-policy` is a valid authorization for something this generation cannot
   * perform, and saying so is more honest than a generic failure.
   */
  /*
   * PUBLISH-0 — THE SECOND EXTERNAL KIND, dispatched from INSIDE this authority, after the arming
   * conjunction above and after the live-permit read. It spends through the same permit consumer,
   * writes the same attempt ledger (recipient-less, as its CHECK requires) and the same audit event.
   */
  if (requestRow.actionKind === PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND) {
    return executeInstagramPublish(tenant, db, now, permitRow, requestRow, deps);
  }
  if (requestRow.actionKind !== EXECUTABLE_ACTION_KIND) return refused("action-not-executable");

  const payload = asSendPayload(requestRow.canonicalPayload);
  if (!payload) return refused("digest-mismatch");

  /* ── 3. THE WORLD, AS IT LOOKS NOW ─────────────────────────────────────── */
  const preflight = await resolveTarget(db, tenant.tenantId, payload);
  if ("failure" in preflight) return refused(preflightReasonFor(preflight.failure));

  /* ── 4. IS THERE ANYTHING TO SEND WITH? ────────────────────────────────── */
  const availability = checkAdapterAvailability("email", { env });
  if (availability === "adapter-unavailable") return refused("adapter-unavailable");
  if (availability === "credential-unavailable") return refused("credential-unavailable");

  /* ── 5. THE ATOMIC HALF: SPEND + ATTEMPT, ONE TRANSACTION ──────────────── */
  /*
   * Everything from here is authoritative. The pre-flight answers above are already stale by the
   * time this line runs, so the target is resolved AGAIN inside the transaction and it is that
   * result — not the pre-flight one — that reaches the adapter.
   */
  let inTxRefusal: ExecutionFailureClass | null = null;
  let inTxTarget: ResolvedTarget | null = null;
  let attemptId: string | null = null;
  let handoffId: string | null = null;

  const consumption = await consumeActionPermit(
    tenant,
    { permitId: permitRow.id },
    {
      getDb: () => db,
      now: () => now,
      async onAuthorizedWithin(tx, authorization: ExecutionAuthorization) {
        const resolved = await resolveTarget(tx, tenant.tenantId!, payload);
        const failure = "failure" in resolved ? resolved.failure : null;
        const target = "target" in resolved ? resolved.target : null;

        /*
         * The recipient FK is NOT NULL, so a refusal caused by an unresolvable recipient has no
         * row it could point at. Those cases already refused in pre-flight against the same data;
         * reaching here means the row vanished mid-transaction, which the composite FK would
         * reject anyway. Throwing rolls the spend back and leaves the permit active — the safe
         * direction, and the same one a failed audit insert takes.
         */
        const recipientId = target?.recipientId ?? inTxRecipientIdOrNull(payload);
        if (!recipientId) throw new Error("recipient-row-vanished");

        const inserted = await tx
          .insert(actionExecutionAttempts)
          .values({
            tenantId: authorization.tenantId,
            permitId: authorization.permitId,
            handoffId: authorization.handoffId,
            actionRequestId: authorization.actionRequestId,
            actionKind: authorization.actionKind,
            adapterId: ADAPTER_ID_FOR_EMAIL,
            boundPayloadDigest: authorization.boundPayloadDigest,
            recipientEndpointDigest: payload.recipientEndpointDigest,
            draftRevisionDigest: payload.draftRevisionDigest,
            recipientId,
            /* Refused rows are terminal at birth: nothing was sent and nothing will be. */
            status: failure ? "refused" : "pending",
            providerResponseClass: null,
            providerMessageId: null,
            failureClass: failure,
            startedAt: now,
            completedAt: failure ? now : null,
            createdBy: tenant.userId,
            createdByType: "human",
            updatedBy: tenant.userId,
            updatedByType: "human",
          })
          .returning({ id: actionExecutionAttempts.id });

        const row = inserted[0];
        if (!row) throw new Error("attempt-not-recorded");

        await recordActionExecutionEventWithin(
          tx,
          {
            tenantId: authorization.tenantId,
            userId: tenant.userId!,
            requestId: tenant.requestId,
            sessionContextId: tenant.sessionContextId,
          },
          {
            entityId: row.id,
            metadata: {
              attemptId: row.id,
              permitId: authorization.permitId,
              handoffId: authorization.handoffId,
              actionRequestId: authorization.actionRequestId,
              actionKind: authorization.actionKind,
              adapterId: ADAPTER_ID_FOR_EMAIL,
              payloadDigest: authorization.boundPayloadDigest,
              recipientId,
              externalEffectConfirmed: false,
            },
          },
          now,
        );

        attemptId = row.id;
        handoffId = authorization.handoffId;
        inTxRefusal = failure;
        inTxTarget = target;
      },
    },
  );

  if (consumption.status === "refused") {
    /* The spend rolled back. The permit is still active and no attempt row exists. */
    switch (consumption.reason) {
      case "unauthenticated":
        return refused("unauthenticated");
      case "digest-mismatch":
        return refused("digest-mismatch");
      case "permit-not-consumable":
        return refused("permit-not-executable");
      default:
        return refused("persistence-unavailable");
    }
  }

  const recordedAttemptId = attemptId as string | null;
  const recordedHandoffId = handoffId as string | null;
  if (!recordedAttemptId || !recordedHandoffId) return refused("persistence-unavailable");

  /* The world changed inside the transaction. The permit is spent; nothing was sent. */
  if (inTxRefusal !== null || inTxTarget === null) {
    return { status: "refused-after-spend", attempt: await readAttempt(db, tenant.tenantId, recordedAttemptId) };
  }
  const target: ResolvedTarget = inTxTarget;

  /* ── 6. THE KILL SWITCH, AGAIN, IMMEDIATELY BEFORE THE CALL ────────────── */
  /*
   * Re-read rather than cached: the window between commit and dispatch is exactly when a Director
   * reaching for the switch most needs it to work.
   */
  const reachAgain = await resolveExternalSendReachability(tenant.tenantId, deps);
  if (reachAgain.status === "refused") {
    /*
     * THE RECORDED FAILURE CLASS IS UNCHANGED, AND THAT IS DELIBERATE.
     *
     * `action_execution_failure_class` is a PostgreSQL enum on a durable attempt row. Adding a
     * member to it would rewrite the vocabulary every historical attempt was recorded in, for a
     * distinction this row does not need: whichever half refused, the fact this attempt records is
     * that execution was not permitted at dispatch and nothing was sent. The half that refused is
     * a control-plane fact, readable from the two authorities at any time; it is not a property of
     * the attempt. The PRE-spend path, which persists nothing, keeps the two apart in full.
     */
    await completeAttempt(db, tenant.tenantId, recordedAttemptId, {
      status: "refused",
      providerResponseClass: null,
      providerMessageId: null,
      failureClass: "execution-disabled",
      completedAt: now,
    });
    return {
      status: "refused-after-spend",
      attempt: await readAttempt(db, tenant.tenantId, recordedAttemptId),
    };
  }

  /* ── 7. THE ADAPTER — the only reach outside this process ───────────────── */
  const adapter =
    deps.adapter !== undefined ? deps.adapter : resolveExternalSendAdapter("email", { env });
  if (!adapter) {
    await completeAttempt(db, tenant.tenantId, recordedAttemptId, {
      status: "refused",
      providerResponseClass: null,
      providerMessageId: null,
      failureClass:
        checkAdapterAvailability("email", { env }) === "credential-unavailable"
          ? "credential-unavailable"
          : "adapter-unavailable",
      completedAt: now,
    });
    return {
      status: "refused-after-spend",
      attempt: await readAttempt(db, tenant.tenantId, recordedAttemptId),
    };
  }

  /*
   * ONE CALL. No loop, no backoff, no second chance. The adapter classifies its own transport
   * phase and returns; it does not throw for provider conditions.
   */
  let outcome: ProviderOutcome;
  try {
    outcome = await adapter.send({
      endpointKind: "email",
      /* Resolved inside the transaction, held in memory, never persisted or logged. */
      endpoint: target.endpoint,
      content: target.content,
      /* THE IDEMPOTENCY KEY — the permit's own handoff, not a new token. */
      idempotencyKey: recordedHandoffId,
    });
  } catch {
    /*
     * The adapter contract says provider conditions are returned, so a throw is a defect in the
     * adapter rather than an answer from the provider — and a defect after dispatch cannot prove
     * the request never left. Ambiguous, which becomes `unknown`.
     */
    outcome = { class: "ambiguous" };
  }

  const terminal = terminalFor(outcome);
  await completeAttempt(db, tenant.tenantId, recordedAttemptId, {
    status: terminal.status,
    providerResponseClass: outcome.class,
    providerMessageId: terminal.providerMessageId,
    failureClass: terminal.failureClass,
    completedAt: (deps.now ?? (() => new Date()))(),
  });

  return {
    status: "attempted",
    attempt: await readAttempt(db, tenant.tenantId, recordedAttemptId),
  };
}


/* ════════════════════════════════════════════════════════════════════════════
 * PUBLISH-0 — THE `publish-instagram-media` HALF OF THIS SAME AUTHORITY.
 *
 * Kept IN this module on purpose: `action_execution_attempts` has exactly one writer, and it is this
 * file. The publish half is reached only from `executeAuthorizedAction` above, after the arming
 * conjunction and the live-permit read, and follows the send's shape exactly — pre-flight (no
 * spend), one transaction (spend + attempt + audit, bindings re-read), post-commit (arming re-read,
 * image grant minted, ONE publish through the one transport). The attempt carries NO recipient, as
 * `action_execution_attempts_recipient_binding_chk` requires for this kind and forbids for any other.
 * Only a media id Meta returned is `accepted`; a post-write fault is `unknown`, never `failed`.
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * The provider-facing seams, injectable so no test ever reaches Meta, the media store or a
 * credential. Production leaves every one unset.
 */
export interface InstagramPublishExecutionPorts {
  readonly resolveCapability?: (tenant: TenantContext) => Promise<InstagramPublishCapability>;
  readonly resolveStorage?: () => MediaStorageResolution;
  /** Lineage + integrity re-verified; a grant minted for the DERIVATIVE only. */
  readonly readPublishImage?: (
    tenant: TenantContext,
    binding: PublishLineageBinding,
  ) => Promise<ReadPublishDerivativeResult>;
  /** Runs `publish` with the connection's token; `null` when no credential could be opened. */
  readonly withToken?: (
    tenant: TenantContext,
    integrationId: string,
    publish: (accessToken: string) => Promise<InstagramPublishOutcome>,
  ) => Promise<InstagramPublishOutcome | null>;
  readonly publish?: (input: InstagramPublishInput, accessToken: string) => Promise<InstagramPublishOutcome>;
}

interface ResolvedPublishTarget {
  readonly caption: string;
}

/**
 * Re-read every binding the decision froze and check it against the database now. Used in
 * pre-flight AND inside the spend transaction — one definition of "still valid".
 */
async function resolvePublishTarget(
  reader: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  payload: PublishInstagramMediaPayload,
  deps: ExecuteAuthorizedActionDeps,
): Promise<{ readonly target: ResolvedPublishTarget } | { readonly failure: ExecutionFailureClass }> {
  const artifactRef = parseWorkArtifactRef(payload.draftRef);
  if (!artifactRef) return { failure: "artifact-unresolvable" };

  const artifactRows = await reader
    .select({ id: workArtifacts.id, lifecycle: workArtifacts.artifactLifecycleStatus })
    .from(workArtifacts)
    .where(and(eq(workArtifacts.tenantId, tenantId), eq(workArtifacts.id, artifactRef.artifactId)))
    .limit(1);
  const artifact = artifactRows[0];
  if (!artifact) return { failure: "artifact-unresolvable" };
  if (artifact.lifecycle === "retired") return { failure: "artifact-retired" };

  const revisionRows = await reader
    .select({ content: workArtifactRevisions.content, contentDigest: workArtifactRevisions.contentDigest })
    .from(workArtifactRevisions)
    .where(
      and(
        eq(workArtifactRevisions.tenantId, tenantId),
        eq(workArtifactRevisions.artifactId, artifactRef.artifactId),
        eq(workArtifactRevisions.revisionNo, artifactRef.revisionNo),
      ),
    )
    .limit(1);
  const revision = revisionRows[0];
  if (!revision) return { failure: "artifact-unresolvable" };
  if (revision.contentDigest !== payload.draftRevisionDigest) return { failure: "digest-mismatch" };

  /* The original (generated or supplied): of THIS draft, read from its own provenance. */
  const asset = await selectMediaAssetRecord(reader, tenantId, payload.mediaAssetRef);
  if (!asset) return { failure: "artifact-unresolvable" };
  if (asset.lifecycle !== "admitted") return { failure: "artifact-retired" };
  if (asset.byteDigest !== payload.mediaAssetDigest) return { failure: "digest-mismatch" };
  if (asset.sourceArtifactId !== artifactRef.artifactId) return { failure: "digest-mismatch" };

  /* The derivative: exactly the bound `jpeg-publish-v1` of exactly that original. */
  const lineage = await selectPublishLineage(reader, tenantId, publishLineageOf(payload));
  if (lineage.status !== "verified") {
    switch (lineage.reason) {
      case "original-retired":
      case "derivative-retired":
        return { failure: "artifact-retired" };
      case "original-unresolvable":
      case "derivative-unresolvable":
        return { failure: "artifact-unresolvable" };
      default:
        return { failure: "digest-mismatch" };
    }
  }

  /* The connection the decision named must still be THE publish-eligible connection, same account. */
  const facts = await readInstagramPublishFacts({ tenantId }, { getDb: () => reader as ControlPlaneDatabase, env: deps.env });
  if (!facts) return { failure: "credential-unavailable" };
  const eligibility = evaluatePublishConnection(facts);
  if (
    eligibility.status !== "eligible" ||
    eligibility.connection.integrationId !== payload.integrationId ||
    eligibility.connection.externalAccountId !== payload.externalAccountId
  ) {
    return { failure: "credential-unavailable" };
  }

  return { target: { caption: revision.content } };
}

function publishLineageOf(payload: PublishInstagramMediaPayload): PublishLineageBinding {
  return {
    originalAssetId: payload.mediaAssetRef,
    originalDigest: payload.mediaAssetDigest,
    derivedAssetId: payload.publishAssetRef,
    derivedDigest: payload.publishAssetDigest,
  };
}

function publishPreflightReasonFor(failure: ExecutionFailureClass): ExecutionPreflightRefusal {
  switch (failure) {
    case "artifact-retired":
      return "artifact-retired";
    case "artifact-unresolvable":
      return "artifact-unresolvable";
    case "credential-unavailable":
      return "capability-unavailable";
    default:
      return "digest-mismatch";
  }
}

/** Meta's answer → the ledger's terminal state. The table's CHECKs enforce the same pairs. */
function publishTerminalFor(outcome: InstagramPublishOutcome): {
  status: "accepted" | "failed" | "unknown";
  providerResponseClass: "accepted" | "rejected" | "unreachable" | "ambiguous";
  providerMessageId: string | null;
  failureClass: ExecutionFailureClass | null;
} {
  switch (outcome.class) {
    case "accepted":
      /* The real Instagram media id Meta returned — the only thing ever recorded as success. */
      return { status: "accepted", providerResponseClass: "accepted", providerMessageId: outcome.mediaId, failureClass: null };
    case "rejected":
      return { status: "failed", providerResponseClass: "rejected", providerMessageId: null, failureClass: "provider-rejected" };
    case "unreachable":
      return { status: "failed", providerResponseClass: "unreachable", providerMessageId: null, failureClass: "provider-unreachable" };
    case "ambiguous":
      /* The post may exist. Never `failed` — a `failed` invites a retry that posts twice. */
      return { status: "unknown", providerResponseClass: "ambiguous", providerMessageId: null, failureClass: null };
  }
}

async function executeInstagramPublish(
  tenant: TenantContext,
  db: ControlPlaneDatabase,
  now: Date,
  permit: { readonly id: string },
  request: { readonly canonicalPayload: unknown },
  deps: ExecuteAuthorizedActionDeps,
): Promise<ExecutionResult> {
  const ports = deps.instagramPublish ?? {};
  const tenantId = tenant.tenantId!;

  const payload = asPublishInstagramMediaPayload(request.canonicalPayload);
  if (!payload) return refused("digest-mismatch");

  /* ── PRE-FLIGHT. Nothing is spent by any refusal here. ── */
  const preflight = await resolvePublishTarget(db, tenantId, payload, deps);
  if ("failure" in preflight) return refused(publishPreflightReasonFor(preflight.failure));

  /* Capability is a PREREQUISITE (and Meta's identity answer), never an authorization. */
  const capability = await (ports.resolveCapability ?? ((t) => resolveInstagramPublishCapability(t, { env: deps.env })))(tenant);
  if (capability.status !== "available" || capability.integrationId !== payload.integrationId) {
    return refused("capability-unavailable");
  }
  const publishingAccountId = capability.publishingAccountId;

  const storage = (ports.resolveStorage ?? resolveMediaObjectStore)();
  if (storage.status !== "available") return refused("adapter-unavailable");

  /* ── THE ATOMIC HALF: spend + attempt + audit. ── */
  let inTxRefusal: ExecutionFailureClass | null = null;
  let inTxTarget: ResolvedPublishTarget | null = null;
  let attemptId: string | null = null;

  const consumption = await consumeActionPermit(
    tenant,
    { permitId: permit.id },
    {
      getDb: () => db,
      now: () => now,
      async onAuthorizedWithin(tx, authorization: ExecutionAuthorization) {
        const resolved = await resolvePublishTarget(tx, tenantId, payload, deps);
        const failure = "failure" in resolved ? resolved.failure : null;

        const inserted = await tx
          .insert(actionExecutionAttempts)
          .values({
            tenantId: authorization.tenantId,
            permitId: authorization.permitId,
            handoffId: authorization.handoffId,
            actionRequestId: authorization.actionRequestId,
            actionKind: authorization.actionKind,
            adapterId: INSTAGRAM_PUBLISH_ADAPTER_ID,
            boundPayloadDigest: authorization.boundPayloadDigest,
            /* RECIPIENT-LESS: the binding CHECK requires exactly this for this kind. */
            recipientEndpointDigest: null,
            recipientId: null,
            draftRevisionDigest: payload.draftRevisionDigest,
            status: failure ? "refused" : "pending",
            providerResponseClass: null,
            providerMessageId: null,
            failureClass: failure,
            startedAt: now,
            completedAt: failure ? now : null,
            createdBy: tenant.userId,
            createdByType: "human",
            updatedBy: tenant.userId,
            updatedByType: "human",
          })
          .returning({ id: actionExecutionAttempts.id });
        const row = inserted[0];
        if (!row) throw new Error("attempt-not-recorded");

        await recordActionExecutionEventWithin(
          tx,
          {
            tenantId: authorization.tenantId,
            userId: tenant.userId!,
            requestId: tenant.requestId,
            sessionContextId: tenant.sessionContextId,
          },
          {
            entityId: row.id,
            metadata: {
              attemptId: row.id,
              permitId: authorization.permitId,
              handoffId: authorization.handoffId,
              actionRequestId: authorization.actionRequestId,
              actionKind: authorization.actionKind,
              adapterId: INSTAGRAM_PUBLISH_ADAPTER_ID,
              payloadDigest: authorization.boundPayloadDigest,
              recipientId: null,
              externalEffectConfirmed: false,
            },
          },
          now,
        );

        attemptId = row.id;
        inTxRefusal = failure;
        inTxTarget = "target" in resolved ? resolved.target : null;
      },
    },
  );

  if (consumption.status === "refused") {
    switch (consumption.reason) {
      case "unauthenticated":
        return refused("unauthenticated");
      case "digest-mismatch":
        return refused("digest-mismatch");
      case "permit-not-consumable":
        return refused("permit-not-executable");
      default:
        return refused("persistence-unavailable");
    }
  }

  const recordedAttemptId = attemptId as string | null;
  if (!recordedAttemptId) return refused("persistence-unavailable");
  const refuseAfterSpend = async (failureClass: ExecutionFailureClass): Promise<ExecutionResult> => {
    await completeAttempt(db, tenantId, recordedAttemptId, {
      status: "refused",
      providerResponseClass: null,
      providerMessageId: null,
      failureClass,
      completedAt: now,
    });
    return { status: "refused-after-spend", attempt: await readAttempt(db, tenantId, recordedAttemptId) };
  };

  if (inTxRefusal !== null || inTxTarget === null) {
    return { status: "refused-after-spend", attempt: await readAttempt(db, tenantId, recordedAttemptId) };
  }
  const target: ResolvedPublishTarget = inTxTarget;

  /* ── THE KILL SWITCH AND THE ARMING, AGAIN, IMMEDIATELY BEFORE THE CALL. ── */
  const reachAgain = await resolveExternalSendReachability(tenantId, deps);
  if (reachAgain.status === "refused") return refuseAfterSpend("execution-disabled");

  /*
   * ── THE IMAGE GRANT. The media authority re-verifies the lineage AND both stored objects, then
   * mints ONE short-lived grant — for the derivative, never the original.
   */
  const image = await (
    ports.readPublishImage ??
    ((t, binding) => readPublishDerivative(t, binding, { getDb: () => db, resolveStorage: () => storage }))
  )(tenant, publishLineageOf(payload));
  if (
    image.status !== "read" ||
    image.derivedAssetId !== payload.publishAssetRef ||
    image.derivedDigest !== payload.publishAssetDigest ||
    image.mimeType !== "image/jpeg"
  ) {
    return refuseAfterSpend("artifact-unresolvable");
  }

  /* ── ONE PUBLISH. No loop, no retry. ── */
  const publish = ports.publish ?? ((input: InstagramPublishInput, token: string) => publishInstagramImage(input, token));
  const withToken =
    ports.withToken ??
    (async (t: TenantContext, integrationId: string, run: (token: string) => Promise<InstagramPublishOutcome>) => {
      const used = await withAuthorizedInstagramToken(
        { tenantId: t.tenantId!, integrationId },
        async (token) => ({ ok: true as const, value: await run(token) }),
        { getDb: () => db, env: deps.env },
      );
      return used.ok ? used.value : null;
    });

  let outcome: InstagramPublishOutcome | null;
  try {
    outcome = await withToken(tenant, payload.integrationId, (token) =>
      publish({ publishingAccountId, imageUrl: image.access.url, caption: target.caption }, token),
    );
  } catch {
    /* A throw after the transport may have dispatched cannot prove nothing was posted. */
    outcome = { class: "ambiguous", reason: "publish-threw", containerId: null };
  }
  /* No credential could be opened: nothing left the process. */
  if (outcome === null) return refuseAfterSpend("credential-unavailable");

  const terminal = publishTerminalFor(outcome);
  await completeAttempt(db, tenantId, recordedAttemptId, {
    status: terminal.status,
    providerResponseClass: terminal.providerResponseClass,
    providerMessageId: terminal.providerMessageId,
    failureClass: terminal.failureClass,
    completedAt: (deps.now ?? (() => new Date()))(),
  });
  return { status: "attempted", attempt: await readAttempt(db, tenantId, recordedAttemptId) };
}

/**
 * Pinned here so the runtime never imports the live transport module.
 *
 * It NAMES THE VENDOR because `adapter_id` is the only durable record of who produced a given
 * `provider_message_id`, and a provider id is meaningless without knowing whose it is. Renaming it
 * from the pre-selection `email-https-v1` cost nothing: zero attempt rows exist.
 */
const ADAPTER_ID_FOR_EMAIL = "resend-email-v1";

/** The recipient id from the frozen reference, when the row itself could not be read. */
function inTxRecipientIdOrNull(payload: SendPayload): string | null {
  return parseRecipientRef(payload.recipientRef)?.recipientId ?? null;
}

/** Write the terminal outcome. The only update this feature performs, and it is idempotent-safe. */
async function completeAttempt(
  db: ControlPlaneDatabase,
  tenantId: string,
  attemptId: string,
  values: {
    status: "accepted" | "failed" | "unknown" | "refused";
    providerResponseClass: "accepted" | "rejected" | "unreachable" | "ambiguous" | null;
    providerMessageId: string | null;
    failureClass: ExecutionFailureClass | null;
    completedAt: Date;
  },
): Promise<void> {
  await db
    .update(actionExecutionAttempts)
    .set({
      status: values.status,
      providerResponseClass: values.providerResponseClass,
      providerMessageId: values.providerMessageId,
      failureClass: values.failureClass,
      completedAt: values.completedAt,
      updatedAt: values.completedAt,
    })
    .where(
      and(
        eq(actionExecutionAttempts.id, attemptId),
        eq(actionExecutionAttempts.tenantId, tenantId),
        /* Only a still-open attempt may be completed. A terminal row is never rewritten. */
        eq(actionExecutionAttempts.status, "pending"),
      ),
    );
}

async function readAttempt(
  db: ControlPlaneDatabase,
  tenantId: string,
  attemptId: string,
): Promise<ExecutionAttemptView> {
  const rows = await db
    .select()
    .from(actionExecutionAttempts)
    .where(
      and(
        eq(actionExecutionAttempts.id, attemptId),
        eq(actionExecutionAttempts.tenantId, tenantId),
      ),
    )
    .limit(1);
  return toExecutionAttemptView(rows[0] as ExecutionAttemptRow);
}
