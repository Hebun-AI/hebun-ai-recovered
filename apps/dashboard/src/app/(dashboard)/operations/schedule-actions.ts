"use server";

/*
 * V1-STAGE-2 — the content calendar's server actions. A separate file from `actions.ts` (the Media
 * door) because one of them reaches the act authority: `proposeScheduledPublicationAction` proposes a
 * publication through the released governed path. None approves, issues a permit or executes.
 * Tenant and actor come from the session only.
 */
import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  cancelContentSchedule,
  createContentSchedule,
  proposeScheduledPublication,
  rescheduleContentSchedule,
  type ScheduleWriteResult,
  type ScheduledProposalResult,
} from "@/features/content-schedule/write-content-schedule.server";
import { readContentSchedules, type ContentSchedulesRead } from "@/features/content-schedule/read-content-schedules.server";

export async function createContentScheduleAction(input: {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly local: string;
  readonly timeZone: string;
  readonly youtube?: { readonly privacyStatus: string; readonly categoryId: string; readonly madeForKids: string; readonly syntheticMedia: string };
}): Promise<ScheduleWriteResult> {
  const result = await createContentSchedule(await resolveTenantContext(), {
    artifactId: input?.artifactId,
    revisionNo: input?.revisionNo,
    local: input?.local,
    timeZone: input?.timeZone,
    youtube: input?.youtube,
  });
  if (result.status !== "refused") revalidatePath("/operations");
  return result;
}

export async function rescheduleContentScheduleAction(input: {
  readonly scheduleId: string;
  readonly expectedVersion: number;
  readonly local: string;
  readonly timeZone: string;
}): Promise<ScheduleWriteResult> {
  const result = await rescheduleContentSchedule(await resolveTenantContext(), {
    scheduleId: input?.scheduleId,
    expectedVersion: input?.expectedVersion,
    local: input?.local,
    timeZone: input?.timeZone,
  });
  if (result.status !== "refused") revalidatePath("/operations");
  return result;
}

export async function cancelContentScheduleAction(input: { readonly scheduleId: string; readonly expectedVersion: number }): Promise<ScheduleWriteResult> {
  const result = await cancelContentSchedule(await resolveTenantContext(), {
    scheduleId: input?.scheduleId,
    expectedVersion: input?.expectedVersion,
  });
  if (result.status !== "refused") revalidatePath("/operations");
  return result;
}

export async function proposeScheduledPublicationAction(input: { readonly scheduleId: string }): Promise<ScheduledProposalResult> {
  const result = await proposeScheduledPublication(await resolveTenantContext(), { scheduleId: input?.scheduleId });
  if (result.status === "requested" || result.status === "already-requested") {
    revalidatePath("/operations");
    revalidatePath("/approvals");
  }
  return result;
}

export async function readContentSchedulesAction(): Promise<ContentSchedulesRead> {
  return readContentSchedules(await resolveTenantContext());
}
