/*
 * content-schedule/read-content-schedules.server.ts — V1-STAGE-2 calendar read. Read only, tenant
 * predicate on every table. Open schedules first by moment, then the most recent closed ones.
 */
import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { contentPublicationIntents } from "@/db/schema/content-publication-intent";
import { workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isDue, type ContentScheduleView, type ScheduleDestination, type ScheduleState } from "./contracts";

export const CLOSED_SCHEDULE_LIMIT = 20;
export const OPEN_SCHEDULE_LIMIT = 200;

export type ContentSchedulesRead =
  | { readonly status: "read"; readonly open: readonly ContentScheduleView[]; readonly closed: readonly ContentScheduleView[] }
  | { readonly status: "unauthenticated" | "unavailable" };

export async function readContentSchedules(
  tenant: TenantContext | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly now?: () => Date } = {},
): Promise<ContentSchedulesRead> {
  if (!tenant?.tenantId) return { status: "unauthenticated" };
  let db: ControlPlaneDatabase | null;
  try {
    db = deps.getDb ? deps.getDb() : getControlPlaneDb();
  } catch {
    db = null;
  }
  if (!db) return { status: "unavailable" };
  const now = (deps.now ?? (() => new Date()))();
  const columns = {
    id: contentPublicationIntents.id,
    artifactId: contentPublicationIntents.artifactId,
    revisionNo: contentPublicationIntents.revisionNo,
    destination: contentPublicationIntents.destination,
    scheduledFor: contentPublicationIntents.scheduledFor,
    timeZone: contentPublicationIntents.timeZone,
    state: contentPublicationIntents.state,
    version: contentPublicationIntents.version,
    requestId: contentPublicationIntents.requestId,
    updatedAt: contentPublicationIntents.updatedAt,
    title: workArtifacts.title,
    currentRevision: workArtifacts.currentRevision,
  };
  const base = () =>
    db!
      .select(columns)
      .from(contentPublicationIntents)
      .innerJoin(
        workArtifacts,
        and(eq(workArtifacts.tenantId, contentPublicationIntents.tenantId), eq(workArtifacts.id, contentPublicationIntents.artifactId)),
      );
  try {
    const [open, closed] = await Promise.all([
      base()
        .where(and(eq(contentPublicationIntents.tenantId, tenant.tenantId), inArray(contentPublicationIntents.state, ["scheduled"])))
        .orderBy(asc(contentPublicationIntents.scheduledFor))
        .limit(OPEN_SCHEDULE_LIMIT),
      base()
        .where(and(eq(contentPublicationIntents.tenantId, tenant.tenantId), notInArray(contentPublicationIntents.state, ["scheduled"])))
        .orderBy(desc(contentPublicationIntents.updatedAt))
        .limit(CLOSED_SCHEDULE_LIMIT),
    ]);
    const view = (r: (typeof open)[number]): ContentScheduleView => ({
      scheduleId: r.id,
      artifactId: r.artifactId,
      revisionNo: r.revisionNo,
      title: r.title,
      destination: r.destination as ScheduleDestination,
      scheduledFor: r.scheduledFor.toISOString(),
      timeZone: r.timeZone,
      state: r.state as ScheduleState,
      version: r.version,
      requestId: r.requestId,
      stale: r.currentRevision !== r.revisionNo,
      due: isDue(r.scheduledFor, now),
    });
    return { status: "read", open: open.map(view), closed: closed.map(view) };
  } catch {
    return { status: "unavailable" };
  }
}
