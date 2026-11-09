/*
 * content-schedule/write-content-schedule.server.ts — V1-STAGE-2 writers.
 *
 * Every state change happens in one transaction with its audit row, under a row lock:
 *   create      → locks the content revision (`work_artifact_revisions` FOR UPDATE — the same row the
 *                 publish executor locks), so scheduling serializes with publication of that revision.
 *   reschedule, cancel → lock the schedule row and require the version the human saw (optimistic).
 *   propose     → the only bridge to publication: once due, it calls the RELEASED
 *                 `proposePackagePublication` — which re-reads readiness, the connection and the prior-
 *                 publication guard — and records the governed request it produced. It never approves,
 *                 never issues a permit, never executes. A refused proposal leaves the schedule as it was.
 *
 * Explicit content approval is required to schedule: the package must be READY (copy accepted and
 * every selected medium approved through Governance), checked here and again when proposed.
 */
import { and, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { contentPublicationIntents } from "@/db/schema/content-publication-intent";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readContentPackage } from "@/features/content-composition/read-content-package.server";
import { recordContentScheduleEventWithin } from "@/features/governance-audit/content-schedule-audit.server";
import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import {
  proposePackagePublication,
  type PackagePublicationProposalResult,
} from "@/features/heby-action-inlet/package-publication-proposal.server";
import {
  asScheduleYouTubeOptions,
  checkLead,
  isDue,
  zonedLocalToUtc,
  type ScheduleRefusal,
  type ScheduleYouTubeOptions,
} from "./contracts";

export interface ContentScheduleDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** Passed through to the released proposal path (storage for the Instagram derivative). */
  readonly proposalDeps?: Parameters<typeof proposePackagePublication>[2];
}

export type ScheduleWriteResult =
  | { readonly status: "scheduled" | "rescheduled" | "cancelled"; readonly scheduleId: string; readonly version: number }
  | { readonly status: "refused"; readonly reason: ScheduleRefusal; readonly detail?: string };

export type ScheduledProposalResult =
  | { readonly status: "requested"; readonly scheduleId: string; readonly requestId: string; readonly scheduleClosed: boolean }
  | { readonly status: "already-requested"; readonly scheduleId: string; readonly requestId: string }
  | { readonly status: "refused"; readonly reason: ScheduleRefusal; readonly detail?: string }
  | { readonly status: "proposal-refused"; readonly proposal: Extract<PackagePublicationProposalResult, { status: "refused" }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Tx = Parameters<Parameters<ControlPlaneDatabase["transaction"]>[0]>[0];
const refuse = (reason: ScheduleRefusal, detail?: string) => ({ status: "refused" as const, reason, ...(detail ? { detail } : {}) });

function dbOf(deps: ContentScheduleDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function gate(tenant: TenantContext | null, deps: ContentScheduleDeps) {
  if (typeof window !== "undefined") throw new Error("Content schedule writes are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { ok: false as const, result: refuse("unauthenticated") };
  const db = dbOf(deps);
  if (!db) return { ok: false as const, result: refuse("persistence-unavailable") };
  return { ok: true as const, db, tenant, now: (deps.now ?? (() => new Date()))() };
}

function resolveMoment(local: unknown, timeZone: unknown, now: Date): { ok: true; instant: Date; timeZone: string } | { ok: false; reason: ScheduleRefusal } {
  if (typeof local !== "string" || typeof timeZone !== "string") return { ok: false, reason: "invalid-input" };
  const at = zonedLocalToUtc(local, timeZone);
  if (!at.ok) return { ok: false, reason: at.reason };
  const lead = checkLead(at.instant, now);
  if (lead) return { ok: false, reason: lead };
  return { ok: true, instant: at.instant, timeZone };
}

/** Schedule one READY, current content revision for a moment in a named zone. */
export async function createContentSchedule(
  tenant: TenantContext | null,
  input: { readonly artifactId: unknown; readonly revisionNo: unknown; readonly local: unknown; readonly timeZone: unknown; readonly youtube?: unknown },
  deps: ContentScheduleDeps = {},
): Promise<ScheduleWriteResult> {
  const g = gate(tenant, deps);
  if (!g.ok) return g.result;
  const { artifactId, revisionNo } = input;
  if (typeof artifactId !== "string" || !UUID_RE.test(artifactId) || !Number.isSafeInteger(revisionNo) || (revisionNo as number) < 1) {
    return refuse("invalid-input");
  }
  const moment = resolveMoment(input.local, input.timeZone, g.now);
  if (!moment.ok) return refuse(moment.reason);

  const pkg = await readContentPackage(g.tenant, { artifactId, revisionNo: revisionNo as number }, { getDb: () => g.db });
  if (pkg.status === "unavailable") return refuse("persistence-unavailable");
  if (pkg.status === "not-found") return refuse("not-found");
  const destination = pkg.package.destination;
  if (destination !== "instagram" && destination !== "youtube") return refuse("destination-not-publishable", String(destination));
  if (!pkg.package.ready) return refuse("package-not-ready", pkg.package.blockers.join(","));
  let youtube: ScheduleYouTubeOptions | null = null;
  if (destination === "youtube") {
    youtube = asScheduleYouTubeOptions(input.youtube);
    if (!youtube) return refuse("invalid-input", "youtube-options");
  }

  try {
    return await g.db.transaction(async (tx: Tx) => {
      const revision = await tx
        .select({ id: workArtifactRevisions.id })
        .from(workArtifactRevisions)
        .where(and(eq(workArtifactRevisions.tenantId, g.tenant.tenantId), eq(workArtifactRevisions.artifactId, artifactId), eq(workArtifactRevisions.revisionNo, revisionNo as number)))
        .for("update");
      if (revision.length === 0) return refuse("not-found");
      const artifact = await tx
        .select({ current: workArtifacts.currentRevision })
        .from(workArtifacts)
        .where(and(eq(workArtifacts.tenantId, g.tenant.tenantId), eq(workArtifacts.id, artifactId)));
      if (artifact[0]?.current !== revisionNo) return refuse("not-current-revision");

      const [row] = await tx
        .insert(contentPublicationIntents)
        .values({
          tenantId: g.tenant.tenantId,
          artifactId,
          revisionNo: revisionNo as number,
          destination,
          scheduledFor: moment.instant,
          timeZone: moment.timeZone,
          youtubeOptions: youtube,
          createdBy: g.tenant.userId,
          updatedBy: g.tenant.userId,
          createdAt: g.now,
          updatedAt: g.now,
        })
        .returning({ id: contentPublicationIntents.id, version: contentPublicationIntents.version });
      await recordContentScheduleEventWithin(tx, auditActorFrom(g.tenant), {
        action: "content.schedule.created",
        scheduleId: row!.id,
        nextState: { state: "scheduled", scheduledFor: moment.instant.toISOString(), timeZone: moment.timeZone, artifactId, revisionNo, destination },
      }, g.now);
      return { status: "scheduled" as const, scheduleId: row!.id, version: row!.version };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return refuse("already-scheduled");
    throw error;
  }
}

type ScheduleRow = typeof contentPublicationIntents.$inferSelect;

async function lockSchedule(tx: Tx, tenantId: string, scheduleId: string): Promise<ScheduleRow | undefined> {
  const rows = await tx
    .select()
    .from(contentPublicationIntents)
    .where(and(eq(contentPublicationIntents.tenantId, tenantId), eq(contentPublicationIntents.id, scheduleId)))
    .for("update");
  return rows[0];
}

/** Move a still-scheduled schedule to a new moment. The caller names the version it saw. */
export async function rescheduleContentSchedule(
  tenant: TenantContext | null,
  input: { readonly scheduleId: unknown; readonly expectedVersion: unknown; readonly local: unknown; readonly timeZone: unknown },
  deps: ContentScheduleDeps = {},
): Promise<ScheduleWriteResult> {
  const g = gate(tenant, deps);
  if (!g.ok) return g.result;
  if (typeof input.scheduleId !== "string" || !UUID_RE.test(input.scheduleId) || !Number.isSafeInteger(input.expectedVersion)) return refuse("invalid-input");
  const moment = resolveMoment(input.local, input.timeZone, g.now);
  if (!moment.ok) return refuse(moment.reason);
  const scheduleId = input.scheduleId;
  return g.db.transaction(async (tx: Tx) => {
    const row = await lockSchedule(tx, g.tenant.tenantId, scheduleId);
    if (!row) return refuse("not-found");
    if (row.state !== "scheduled") return refuse("not-scheduled", row.state);
    if (row.version !== input.expectedVersion) return refuse("stale-version");
    const version = row.version + 1;
    await tx
      .update(contentPublicationIntents)
      .set({ scheduledFor: moment.instant, timeZone: moment.timeZone, version, updatedBy: g.tenant.userId, updatedAt: g.now })
      .where(and(eq(contentPublicationIntents.tenantId, g.tenant.tenantId), eq(contentPublicationIntents.id, scheduleId)));
    await recordContentScheduleEventWithin(tx, auditActorFrom(g.tenant), {
      action: "content.schedule.rescheduled",
      scheduleId,
      previousState: { scheduledFor: row.scheduledFor.toISOString(), timeZone: row.timeZone, version: row.version },
      nextState: { scheduledFor: moment.instant.toISOString(), timeZone: moment.timeZone, version },
    }, g.now);
    return { status: "rescheduled" as const, scheduleId, version };
  });
}

/** Cancel a still-scheduled schedule. Terminal. */
export async function cancelContentSchedule(
  tenant: TenantContext | null,
  input: { readonly scheduleId: unknown; readonly expectedVersion: unknown },
  deps: ContentScheduleDeps = {},
): Promise<ScheduleWriteResult> {
  const g = gate(tenant, deps);
  if (!g.ok) return g.result;
  if (typeof input.scheduleId !== "string" || !UUID_RE.test(input.scheduleId) || !Number.isSafeInteger(input.expectedVersion)) return refuse("invalid-input");
  const scheduleId = input.scheduleId;
  return g.db.transaction(async (tx: Tx) => {
    const row = await lockSchedule(tx, g.tenant.tenantId, scheduleId);
    if (!row) return refuse("not-found");
    if (row.state !== "scheduled") return refuse("not-scheduled", row.state);
    if (row.version !== input.expectedVersion) return refuse("stale-version");
    const version = row.version + 1;
    await tx
      .update(contentPublicationIntents)
      .set({ state: "cancelled", version, updatedBy: g.tenant.userId, updatedAt: g.now })
      .where(and(eq(contentPublicationIntents.tenantId, g.tenant.tenantId), eq(contentPublicationIntents.id, scheduleId)));
    await recordContentScheduleEventWithin(tx, auditActorFrom(g.tenant), {
      action: "content.schedule.cancelled",
      scheduleId,
      previousState: { state: "scheduled", version: row.version },
      nextState: { state: "cancelled", version },
    }, g.now);
    return { status: "cancelled" as const, scheduleId, version };
  });
}

/**
 * The schedule's moment has come: propose the publication through the released governed path, then
 * record which request it produced. Idempotent: a schedule already requested answers with its request.
 * A proposal refusal (package changed, connection lost, prior attempt unacknowledged…) is returned as
 * it is and the schedule stays `scheduled`.
 */
export async function proposeScheduledPublication(
  tenant: TenantContext | null,
  input: { readonly scheduleId: unknown },
  deps: ContentScheduleDeps = {},
): Promise<ScheduledProposalResult> {
  const g = gate(tenant, deps);
  if (!g.ok) return g.result;
  if (typeof input.scheduleId !== "string" || !UUID_RE.test(input.scheduleId)) return refuse("invalid-input");
  const scheduleId = input.scheduleId;
  const rows = await g.db
    .select()
    .from(contentPublicationIntents)
    .where(and(eq(contentPublicationIntents.tenantId, g.tenant.tenantId), eq(contentPublicationIntents.id, scheduleId)));
  const row = rows[0];
  if (!row) return refuse("not-found");
  if (row.state === "requested") return { status: "already-requested", scheduleId, requestId: row.requestId! };
  if (row.state !== "scheduled") return refuse("not-scheduled", row.state);
  if (!isDue(row.scheduledFor, g.now)) return refuse("not-due");

  const youtube = row.destination === "youtube" ? asScheduleYouTubeOptions(row.youtubeOptions) : null;
  if (row.destination === "youtube" && !youtube) return refuse("invalid-input", "youtube-options");
  const proposal = await proposePackagePublication(
    g.tenant,
    { artifactId: row.artifactId, revisionNo: row.revisionNo, ...(youtube ? { youtube } : {}) },
    { getDb: () => g.db, ...(deps.proposalDeps ?? {}) },
  );
  if (proposal.status !== "proposed") return { status: "proposal-refused", proposal };

  /* Record the link. A cancel or another proposal may have won the row meanwhile: the governed
     request stands either way (it still needs approval), and the schedule says it is closed. */
  const closed = await g.db.transaction(async (tx: Tx) => {
    const locked = await lockSchedule(tx, g.tenant.tenantId, scheduleId);
    if (!locked || locked.state !== "scheduled") return true;
    const version = locked.version + 1;
    await tx
      .update(contentPublicationIntents)
      .set({ state: "requested", requestId: proposal.requestId, version, updatedBy: g.tenant.userId, updatedAt: g.now })
      .where(and(eq(contentPublicationIntents.tenantId, g.tenant.tenantId), eq(contentPublicationIntents.id, scheduleId), sql`${contentPublicationIntents.state} = 'scheduled'`));
    await recordContentScheduleEventWithin(tx, auditActorFrom(g.tenant), {
      action: "content.schedule.requested",
      scheduleId,
      previousState: { state: "scheduled", version: locked.version },
      nextState: { state: "requested", requestId: proposal.requestId, version },
    }, g.now);
    return false;
  });
  return { status: "requested", scheduleId, requestId: proposal.requestId, scheduleClosed: closed };
}
