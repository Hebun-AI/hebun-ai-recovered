/*
 * content-schedule/contracts.ts — V1-STAGE-2. Pure: no I/O, no clock, safe on client and server.
 *
 * A schedule is an intent to publish one READY content revision at a chosen moment. It authorizes
 * nothing. When the moment arrives a human proposes the publication through the released governed
 * path, which re-checks everything; nothing publishes on its own.
 *
 *   SCHEDULED != REQUESTED != APPROVED != PUBLISHED
 */
import { YOUTUBE_CATEGORY_ID, YOUTUBE_PRIVACY_STATUSES } from "@/features/youtube-publishing/contracts";

export const SCHEDULE_STATES = Object.freeze(["scheduled", "cancelled", "requested"] as const);
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export const SCHEDULE_DESTINATIONS = Object.freeze(["instagram", "youtube"] as const);
export type ScheduleDestination = (typeof SCHEDULE_DESTINATIONS)[number];

/** A schedule must be at least this far ahead when it is made or moved. */
export const SCHEDULE_MIN_LEAD_MS = 5 * 60_000;
/** And no further ahead than this. */
export const SCHEDULE_MAX_HORIZON_MS = 366 * 86_400_000;

export const CONTENT_SCHEDULE_ENTITY_TYPE = "content_publication_schedule" as const;
export const CONTENT_SCHEDULE_AUDIT_ACTIONS = Object.freeze([
  "content.schedule.created",
  "content.schedule.rescheduled",
  "content.schedule.cancelled",
  "content.schedule.requested",
] as const);
export type ContentScheduleAuditAction = (typeof CONTENT_SCHEDULE_AUDIT_ACTIONS)[number];

export interface ScheduleYouTubeOptions {
  readonly privacyStatus: (typeof YOUTUBE_PRIVACY_STATUSES)[number];
  readonly categoryId: string;
  readonly madeForKids: "yes" | "no";
  readonly syntheticMedia: "yes" | "no";
}

export function asScheduleYouTubeOptions(raw: unknown): ScheduleYouTubeOptions | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const yesNo = (v: unknown) => v === "yes" || v === "no";
  if (
    !(YOUTUBE_PRIVACY_STATUSES as readonly unknown[]).includes(r.privacyStatus) ||
    typeof r.categoryId !== "string" ||
    !YOUTUBE_CATEGORY_ID.test(r.categoryId) ||
    !yesNo(r.madeForKids) ||
    !yesNo(r.syntheticMedia)
  ) {
    return null;
  }
  return Object.freeze({
    privacyStatus: r.privacyStatus as ScheduleYouTubeOptions["privacyStatus"],
    categoryId: r.categoryId,
    madeForKids: r.madeForKids as "yes" | "no",
    syntheticMedia: r.syntheticMedia as "yes" | "no",
  });
}

export type ScheduleRefusal =
  | "unauthenticated"
  | "persistence-unavailable"
  | "invalid-input"
  | "invalid-time-zone"
  | "invalid-local-time"
  | "nonexistent-local-time"
  | "too-soon"
  | "too-far"
  | "not-found"
  | "not-current-revision"
  | "destination-not-publishable"
  | "package-not-ready"
  | "already-scheduled"
  | "not-scheduled"
  | "stale-version"
  | "not-due";

/* ── time ───────────────────────────────────────────────────────────────── */

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function wallClock(instant: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length < 1 || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The UTC instant at which the wall clock in `timeZone` reads `local` ("YYYY-MM-DDTHH:mm").
 * A local time skipped by a daylight-saving jump is refused (`nonexistent-local-time`) rather than
 * silently moved. A local time that occurs twice (the hour repeated when clocks go back) resolves
 * to its FIRST occurrence, and the calendar shows the UTC instant so the choice is visible.
 */
export function zonedLocalToUtc(
  local: string,
  timeZone: string,
): { readonly ok: true; readonly instant: Date } | { readonly ok: false; readonly reason: "invalid-time-zone" | "invalid-local-time" | "nonexistent-local-time" } {
  if (!isValidTimeZone(timeZone)) return { ok: false, reason: "invalid-time-zone" };
  const m = LOCAL_RE.exec(local);
  if (!m) return { ok: false, reason: "invalid-local-time" };
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(naive);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) {
    return { ok: false, reason: "invalid-local-time" };
  }
  /* Every real zone offset lies within ±18 h; try each offset seen around the naive instant. */
  const candidates = new Set<number>();
  for (const probe of [naive - 18 * 3_600_000, naive, naive + 18 * 3_600_000]) {
    const offset = Date.parse(`${wallClock(probe, timeZone)}:00Z`) - probe;
    candidates.add(naive - offset);
  }
  const matches = [...candidates].filter((t) => wallClock(t, timeZone) === local).sort((a, b) => a - b);
  if (matches.length === 0) return { ok: false, reason: "nonexistent-local-time" };
  return { ok: true, instant: new Date(matches[0]!) };
}

/** Deterministic display of an instant in a named zone: "2026-11-12 09:00 Europe/Istanbul". */
export function formatInZone(instant: Date | string, timeZone: string): string {
  const t = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  if (Number.isNaN(t) || !isValidTimeZone(timeZone)) return String(instant);
  return `${wallClock(t, timeZone).replace("T", " ")} ${timeZone}`;
}

/** Due means the chosen moment has arrived; due-ness is derived at read time, never stored. */
export function isDue(scheduledFor: Date | string, now: Date): boolean {
  return new Date(scheduledFor).getTime() <= now.getTime();
}

export function checkLead(instant: Date, now: Date): "too-soon" | "too-far" | null {
  const ahead = instant.getTime() - now.getTime();
  if (ahead < SCHEDULE_MIN_LEAD_MS) return "too-soon";
  if (ahead > SCHEDULE_MAX_HORIZON_MS) return "too-far";
  return null;
}

/** What the calendar shows for one schedule. Publication outcome comes from the ledger, by request. */
export interface ContentScheduleView {
  readonly scheduleId: string;
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly title: string;
  readonly destination: ScheduleDestination;
  readonly scheduledFor: string;
  readonly timeZone: string;
  readonly state: ScheduleState;
  readonly version: number;
  readonly requestId: string | null;
  /** True when the revision is no longer the draft's current one: proposing it would be refused. */
  readonly stale: boolean;
  readonly due: boolean;
}
