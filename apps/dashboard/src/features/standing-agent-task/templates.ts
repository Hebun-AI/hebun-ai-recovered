/*
 * P5-5 — the two weekly task templates (Director decision D6). A template names the draft type and the
 * one sentence Hebun adds to the tenant's brief. The sentence is Hebun's; the brief is the organization's.
 * Pure constants.
 */
import type { StandingAgentTaskTemplate } from "./contracts";

export interface AgentTaskTemplateSpec {
  readonly template: StandingAgentTaskTemplate;
  /** Internal draft type the run files (AGENT-EXECUTION-2's internal-draft contract). */
  readonly artifactType: "operational-plan";
  /** The opening of the run's request; the period is the ISO week the run belongs to. */
  readonly lead: (periodKey: string) => string;
}

export const AGENT_TASK_TEMPLATE_SPECS: Readonly<Record<StandingAgentTaskTemplate, AgentTaskTemplateSpec>> = Object.freeze({
  "weekly-content-plan": Object.freeze({
    template: "weekly-content-plan",
    artifactType: "operational-plan",
    lead: (periodKey: string) =>
      `Prepare this organization's content plan for the week ${periodKey}: what to post on which channel and day, with a working title and the point of each post. Follow the brief below.`,
  }),
  "weekly-operations-summary": Object.freeze({
    template: "weekly-operations-summary",
    artifactType: "operational-plan",
    lead: (periodKey: string) =>
      `Prepare this organization's operations summary and plan for the week ${periodKey}: what to check, prepare and follow up on, as a checklist a person can act on. Follow the brief below.`,
  }),
});

/** The ISO-8601 week (`YYYY-Www`) of `now` in Europe/Istanbul. */
export function istanbulIsoWeek(now: Date): string {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Whether `now` is a Monday in Europe/Istanbul. */
export function isIstanbulMonday(now: Date): boolean {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(now) === "Mon";
}
