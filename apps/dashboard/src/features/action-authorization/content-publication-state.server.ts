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
import { and, desc, eq, inArray } from "drizzle-orm";
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

async function readOne(
  db: ControlPlaneDatabase,
  tenantId: string,
  artifactRef: string,
  now: Date,
): Promise<ContentPublicationState> {
  try {
    const rows = await db
      .select({
        requestId: hebyActionRequests.id,
        actionKind: hebyActionRequests.actionKind,
        requestStatus: hebyActionRequests.status,
        proposedAt: hebyActionRequests.createdAt,
        approvedAt: hebyActionRequests.approvedAt,
        rejectedAt: hebyActionRequests.rejectedAt,
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
      /* Newest first so the bound keeps the most recent; reversed below into chronological order. */
      .orderBy(desc(hebyActionRequests.createdAt), desc(hebyActionRequests.id))
      .limit(PUBLICATION_HISTORY_LIMIT + 1);

    if (rows.length === 0) return { status: "no-request-recorded", artifactRef };

    const truncated = rows.length > PUBLICATION_HISTORY_LIMIT;
    const entries: PublicationHistoryEntry[] = [];
    for (const row of rows.slice(0, PUBLICATION_HISTORY_LIMIT)) {
      /* The WHERE clause admits only publication kinds; a row that is not one would be a read defect. */
      if (!isPublicationActionKind(row.actionKind)) return { status: "unknown", artifactRef, reason: "read-failed" };
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
        requestStatus,
        proposedAt: iso(row.proposedAt) ?? "",
        approvedAt: iso(row.approvedAt),
        rejectedAt: iso(row.rejectedAt),
        permit,
        attempt,
        stage: derivePublicationStage({ requestStatus, permit, attempt }),
      });
    }
    return { status: "recorded", artifactRef, entries: entries.reverse(), truncated };
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

