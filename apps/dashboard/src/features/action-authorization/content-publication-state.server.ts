/*
 * action-authorization/content-publication-state.server.ts — CONTENT-PUBLICATION-STATE-1: THE ACTION
 * AUTHORIZATION AUTHORITY'S read projection of the publication history of one content revision.
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * The same rule `heby-decision-queue-source.server.ts` follows: a projection belongs to the authority
 * that owns the facts, and consumers (Heby's content-media shaper, the /operations package panel)
 * import the projection. They never hold `hebyActionRequests`, `actionPermits` or a database handle
 * for decision truth, and never hold a decision writer, the permit consumer or the executor.
 *
 * This directory ALSO holds the decision writer, the proposal writer, the permit consumer and the
 * permit revoker. This module imports none of them: it reads the tables through the governance
 * database resolver and takes the permit's display state from the R3A read seam by exact path.
 *
 * ── THE JOIN, AND WHY IT CANNOT MULTIPLY ROWS ────────────────────────────────
 *
 *   heby_action_requests (tenant, target_ref = work-artifact/<id>@<n>, action_kind ∈ publication kinds)
 *     ⟕ action_permits            on (tenant, action_request_id)   — unique per request
 *     ⟕ action_execution_attempts on (tenant, permit_id)           — unique per permit
 *
 * Both outer joins are on unique keys, so each request yields exactly one row. Every join repeats the
 * tenant predicate: a row of another tenant cannot join even if an id collided.
 *
 * ── UNKNOWN IS NOT NONE ──────────────────────────────────────────────────────
 *
 * A successful read with no matching request is `no-request-recorded`. No tenant, no database or a
 * thrown read is `unknown`, and nothing here turns one into the other.
 *
 * READ ONLY. No insert, update, delete or transaction appears in this module. No provider is called.
 *
 * Server-only.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import { actionExecutionAttempts } from "@/db/schema/action-execution";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type {
  ExecutionAttemptStatus,
  ExecutionFailureClass,
  ProviderResponseClass,
} from "@/features/action-execution/contracts";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { PUBLISH_YOUTUBE_VIDEO_ACTION_KIND } from "@/features/youtube-publishing/contracts";
import { derivePermitState } from "./read-action-authorizations.server";
import {
  PUBLICATION_ACTION_KINDS,
  PUBLICATION_DESTINATION,
  PUBLICATION_HISTORY_LIMIT,
  derivePublicationStage,
  isPublicationActionKind,
  type ContentPublicationState,
  type PublicationHistoryEntry,
  type PublicationRequestStatus,
} from "./content-publication-state";

export interface ContentPublicationStateDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

/** At most this many revisions per call; the /operations listing and Heby's ten drafts fit well inside it. */
export const CONTENT_PUBLICATION_REVISIONS_LIMIT = 50 as const;

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/*
 * The reference exactly as the publish proposals record it in `target_ref` (lowercase uuid, positive
 * revision, no padding). Built here rather than imported: R3A takes no dependency on the artifact
 * authority (pinned in tests/r3w-flow), and this string is only ever compared for equality.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function refOf(input: { readonly artifactId: string; readonly revisionNo: number }): string | null {
  if (typeof input?.artifactId !== "string" || !UUID.test(input.artifactId)) return null;
  if (!Number.isInteger(input.revisionNo) || input.revisionNo < 1 || input.revisionNo > 999_999_999) return null;
  return `work-artifact/${input.artifactId.toLowerCase()}@${input.revisionNo}`;
}

/**
 * CONTENT-PUBLICATION-DUPLICATE-GUARD-1 — the ONE definition of a revision's publication history,
 * callable with a transaction handle.
 *
 * The read projection below and the execution guard read history through this single function, so
 * "what has been published for this revision" has one answer on both the read side and the write
 * side. `limit: null` reads the WHOLE history: a guard must never decide from a truncated page.
 * It THROWS on a failed read; the caller decides what a failure means (the projection says
 * `unknown`, the guard refuses before any provider call).
 *
 * Read only. The handle may be a transaction; nothing here writes.
 */
export async function readRevisionPublicationHistory(
  handle: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  artifactRef: string,
  now: Date,
  options: { readonly limit: number | null },
): Promise<{ readonly entries: readonly PublicationHistoryEntry[]; readonly truncated: boolean }> {
  const query = handle
    .select({
      requestId: hebyActionRequests.id,
      actionKind: hebyActionRequests.actionKind,
      requestStatus: hebyActionRequests.status,
      payloadDigest: hebyActionRequests.payloadDigest,
      proposedAt: hebyActionRequests.createdAt,
      approvedAt: hebyActionRequests.approvedAt,
      rejectedAt: hebyActionRequests.rejectedAt,
      /* Destination identity, as the governed payload bound it — never a display label. */
      instagramAccountId: sql<string | null>`${hebyActionRequests.canonicalPayload}->>'externalAccountId'`,
      youtubeChannelId: sql<string | null>`${hebyActionRequests.canonicalPayload}->>'expectedChannelId'`,
      acknowledgesPriorAttemptId: sql<string | null>`${hebyActionRequests.canonicalPayload}->>'acknowledgesPriorAttemptId'`,
      permitId: actionPermits.id,
      permitStatus: actionPermits.status,
      permitIssuedAt: actionPermits.issuedAt,
      permitExpiresAt: actionPermits.expiresAt,
      permitConsumedAt: actionPermits.consumedAt,
      permitRevokedAt: actionPermits.revokedAt,
      attemptId: actionExecutionAttempts.id,
      attemptStatus: actionExecutionAttempts.status,
      providerResponseClass: actionExecutionAttempts.providerResponseClass,
      providerMessageId: actionExecutionAttempts.providerMessageId,
      failureClass: actionExecutionAttempts.failureClass,
      attemptStartedAt: actionExecutionAttempts.startedAt,
      attemptCompletedAt: actionExecutionAttempts.completedAt,
    })
    .from(hebyActionRequests)
    .leftJoin(
      actionPermits,
      and(
        eq(actionPermits.actionRequestId, hebyActionRequests.id),
        eq(actionPermits.tenantId, hebyActionRequests.tenantId),
      ),
    )
    .leftJoin(
      actionExecutionAttempts,
      and(
        eq(actionExecutionAttempts.permitId, actionPermits.id),
        eq(actionExecutionAttempts.tenantId, actionPermits.tenantId),
      ),
    )
    .where(
      and(
        eq(hebyActionRequests.tenantId, tenantId),
        eq(hebyActionRequests.targetRef, artifactRef),
        inArray(hebyActionRequests.actionKind, [...PUBLICATION_ACTION_KINDS]),
      ),
    )
    /* Newest first so a bound keeps the most recent; reversed below into chronological order. */
    .orderBy(desc(hebyActionRequests.createdAt), desc(hebyActionRequests.id));
  const rows = options.limit === null ? await query : await query.limit(options.limit + 1);

  const truncated = options.limit !== null && rows.length > options.limit;
  const entries: PublicationHistoryEntry[] = [];
  for (const row of options.limit === null ? rows : rows.slice(0, options.limit)) {
    /* The WHERE clause admits only publication kinds; a row that is not one is a read defect. */
    if (!isPublicationActionKind(row.actionKind)) throw new Error("publication-history-kind-defect");
    const permit =
      row.permitId === null || row.permitStatus === null || row.permitIssuedAt === null || row.permitExpiresAt === null
        ? null
        : {
            state: derivePermitState(row.permitStatus, row.permitExpiresAt, now),
            issuedAt: iso(row.permitIssuedAt) ?? "",
            expiresAt: iso(row.permitExpiresAt) ?? "",
            consumedAt: iso(row.permitConsumedAt),
            revokedAt: iso(row.permitRevokedAt),
          };
    const attempt =
      row.attemptId === null || row.attemptStatus === null || row.attemptStartedAt === null
        ? null
        : {
            attemptId: row.attemptId,
            status: row.attemptStatus as ExecutionAttemptStatus,
            providerResponseClass: (row.providerResponseClass as ProviderResponseClass | null) ?? null,
            providerResultId: row.providerMessageId ?? null,
            failureClass: (row.failureClass as ExecutionFailureClass | null) ?? null,
            startedAt: iso(row.attemptStartedAt) ?? "",
            completedAt: iso(row.attemptCompletedAt),
          };
    const requestStatus = row.requestStatus as PublicationRequestStatus;
    entries.push({
      requestId: row.requestId,
      actionKind: row.actionKind,
      destination: PUBLICATION_DESTINATION[row.actionKind],
      destinationAccountId:
        row.actionKind === "publish-instagram-media" ? (row.instagramAccountId ?? null) : (row.youtubeChannelId ?? null),
      acknowledgesPriorAttemptId: row.acknowledgesPriorAttemptId ?? null,
      payloadDigest: row.payloadDigest,
      requestStatus,
      proposedAt: iso(row.proposedAt) ?? "",
      approvedAt: iso(row.approvedAt),
      rejectedAt: iso(row.rejectedAt),
      permit,
      attempt,
      stage: derivePublicationStage({ requestStatus, permit, attempt }),
    });
  }
  return { entries: entries.reverse(), truncated };
}

async function readOne(
  db: ControlPlaneDatabase,
  tenantId: string,
  artifactRef: string,
  now: Date,
): Promise<ContentPublicationState> {
  try {
    const { entries, truncated } = await readRevisionPublicationHistory(db, tenantId, artifactRef, now, {
      limit: PUBLICATION_HISTORY_LIMIT,
    });
    if (entries.length === 0) return { status: "no-request-recorded", artifactRef };
    return { status: "recorded", artifactRef, entries, truncated };
  } catch {
    return { status: "unknown", artifactRef, reason: "read-failed" };
  }
}

/**
 * The publication history of several revisions of THIS tenant, keyed by canonical reference. The
 * tenant comes only from the authenticated context; the revisions only choose which records to ask
 * about and can never widen whose records are read.
 */
export async function readContentPublicationStates(
  tenant: TenantContext | null,
  revisions: readonly { readonly artifactId: string; readonly revisionNo: number }[],
  deps: ContentPublicationStateDeps = {},
): Promise<ReadonlyMap<string, ContentPublicationState>> {
  if (typeof window !== "undefined") throw new Error("Content publication state reads are server-only.");
  const result = new Map<string, ContentPublicationState>();
  const refs = [...new Set(revisions.slice(0, CONTENT_PUBLICATION_REVISIONS_LIMIT).map(refOf))];
  const valid = refs.filter((r): r is string => r !== null);

  if (!tenant?.tenantId) {
    for (const ref of valid) result.set(ref, { status: "unknown", artifactRef: ref, reason: "no-authorized-tenant-context" });
    return result;
  }
  let db: ControlPlaneDatabase | null = null;
  try {
    db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  } catch {
    db = null;
  }
  if (!db) {
    for (const ref of valid) result.set(ref, { status: "unknown", artifactRef: ref, reason: "persistence-not-configured" });
    return result;
  }
  const now = (deps.now ?? (() => new Date()))();
  const tenantId = tenant.tenantId;
  const read = await Promise.all(valid.map(async (ref) => [ref, await readOne(db!, tenantId, ref, now)] as const));
  for (const [ref, state] of read) result.set(ref, state);
  return result;
}

/** One revision. A malformed reference is `unknown`, never "no request". */
export async function readContentPublicationState(
  tenant: TenantContext | null,
  input: { readonly artifactId: string; readonly revisionNo: number },
  deps: ContentPublicationStateDeps = {},
): Promise<ContentPublicationState> {
  const ref = refOf(input);
  if (ref === null) return { status: "unknown", artifactRef: null, reason: "invalid-reference" };
  const states = await readContentPublicationStates(tenant, [input], deps);
  return states.get(ref) ?? { status: "unknown", artifactRef: ref, reason: "read-failed" };
}


/* ═══════════════════════════════════════════════════════════════════════════
 * YOUTUBE-RECORDED-MEASUREMENT-1 — THE IDENTITY OF ONE ACCEPTED YOUTUBE PUBLICATION.
 *
 * ── WHAT IT ANSWERS, AND NOTHING WIDER ──────────────────────────────────────
 *
 * "For this permit, in this tenant: which video did YouTube return, on which channel was it
 * authorized, and through which connection?" Three values, each already on a ledger row this
 * authority owns: the attempt's `provider_message_id`, and the governed payload's
 * `expectedChannelId` and `integrationId`. Nothing else about the request, the permit, the decision
 * or the payload is returned.
 *
 * ── A LOOKUP, NOT AN AUTHORIZATION ──────────────────────────────────────────
 *
 * The permit id is only how a caller says WHICH publication it means. Resolving it grants nothing:
 * whether a provider may then be read is decided by the capability authority, elsewhere. Another
 * tenant's permit, a permit for a different action kind and a permit that does not exist are ONE
 * answer, so the refusal cannot be used to learn that a permit exists somewhere else.
 *
 * Read only. No provider is called and nothing is written.
 * ═════════════════════════════════════════════════════════════════════════ */

export type YouTubePublicationIdentity =
  | {
      readonly status: "resolved";
      /** The id YouTube returned when the upload was accepted. */
      readonly videoId: string;
      /** The channel the governed payload bound. */
      readonly expectedChannelId: string;
      /** The connection the governed payload bound. */
      readonly integrationId: string;
    }
  | {
      readonly status: "not-resolved";
      readonly reason:
        /** No YouTube publication permit with this id exists in this tenant. */
        | "no-such-publication"
        /** The permit exists but no attempt was accepted with a provider id. */
        | "not-accepted"
        /** The stored payload does not carry a usable channel or connection. */
        | "identity-incomplete";
    }
  | {
      readonly status: "unknown";
      readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" | "read-failed";
    };

const YOUTUBE_VIDEO_ID = /^[0-9A-Za-z_-]{6,32}$/;
const YOUTUBE_CHANNEL_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function readYouTubePublicationIdentity(
  tenant: TenantContext | null,
  input: { readonly permitId: string },
  deps: ContentPublicationStateDeps = {},
): Promise<YouTubePublicationIdentity> {
  if (typeof window !== "undefined") throw new Error("Content publication state reads are server-only.");
  if (!tenant?.tenantId) return { status: "unknown", reason: "no-authorized-tenant-context" };
  if (typeof input?.permitId !== "string" || !UUID.test(input.permitId)) {
    return { status: "not-resolved", reason: "no-such-publication" };
  }
  let db: ControlPlaneDatabase | null = null;
  try {
    db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  } catch {
    db = null;
  }
  if (!db) return { status: "unknown", reason: "persistence-not-configured" };

  const tenantId = tenant.tenantId;
  let row;
  try {
    const rows = await db
      .select({
        attemptStatus: actionExecutionAttempts.status,
        providerMessageId: actionExecutionAttempts.providerMessageId,
        expectedChannelId: sql<string | null>`${hebyActionRequests.canonicalPayload}->>'expectedChannelId'`,
        integrationId: sql<string | null>`${hebyActionRequests.canonicalPayload}->>'integrationId'`,
      })
      .from(actionPermits)
      .innerJoin(
        hebyActionRequests,
        and(
          eq(hebyActionRequests.id, actionPermits.actionRequestId),
          eq(hebyActionRequests.tenantId, actionPermits.tenantId),
        ),
      )
      .leftJoin(
        actionExecutionAttempts,
        and(
          eq(actionExecutionAttempts.permitId, actionPermits.id),
          eq(actionExecutionAttempts.tenantId, actionPermits.tenantId),
        ),
      )
      .where(
        and(
          eq(actionPermits.tenantId, tenantId),
          eq(actionPermits.id, input.permitId.toLowerCase()),
          eq(hebyActionRequests.actionKind, PUBLISH_YOUTUBE_VIDEO_ACTION_KIND),
        ),
      )
      .limit(1);
    row = rows[0];
  } catch {
    return { status: "unknown", reason: "read-failed" };
  }
  if (!row) return { status: "not-resolved", reason: "no-such-publication" };
  if (row.attemptStatus !== "accepted" || !row.providerMessageId || !YOUTUBE_VIDEO_ID.test(row.providerMessageId)) {
    return { status: "not-resolved", reason: "not-accepted" };
  }
  if (
    !row.expectedChannelId ||
    !YOUTUBE_CHANNEL_ID.test(row.expectedChannelId) ||
    !row.integrationId ||
    !UUID.test(row.integrationId)
  ) {
    return { status: "not-resolved", reason: "identity-incomplete" };
  }
  return {
    status: "resolved",
    videoId: row.providerMessageId,
    expectedChannelId: row.expectedChannelId,
    integrationId: row.integrationId.toLowerCase(),
  };
}
