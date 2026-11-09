/*
 * support-tickets/contracts.ts — V1-STAGE-5 vocabulary and input rules. Client-safe: no I/O.
 */
export const SUPPORT_TICKET_STATUSES = Object.freeze(["open", "in_progress", "waiting_on_customer", "resolved", "closed"] as const);
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_STATUS_LABEL: Readonly<Record<SupportTicketStatus, string>> = Object.freeze({
  open: "Open",
  in_progress: "In progress",
  waiting_on_customer: "Waiting on customer",
  resolved: "Resolved",
  closed: "Closed",
});

export const SUPPORT_TICKET_ENTITY_TYPE = "support_ticket" as const;
export const SUPPORT_TICKET_CREATED = "support-ticket.created" as const;
export const SUPPORT_TICKET_STATUS_CHANGED = "support-ticket.status-changed" as const;
export type SupportTicketAuditAction = typeof SUPPORT_TICKET_CREATED | typeof SUPPORT_TICKET_STATUS_CHANGED;

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;

export function isSupportTicketStatus(value: unknown): value is SupportTicketStatus {
  return typeof value === "string" && (SUPPORT_TICKET_STATUSES as readonly string[]).includes(value);
}

/* C0 controls except tab/newline, DEL, C1, bidi overrides and zero-width characters. */
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/;

/** Title: one line, trimmed, whitespace collapsed, 1–200 characters. */
export function normalizeTitle(value: unknown): { ok: true; value: string } | { ok: false } {
  if (typeof value !== "string" || /[\r\n\t]/.test(value) || FORBIDDEN.test(value)) return { ok: false };
  const v = value.trim().replace(/\s+/g, " ");
  return v.length >= 1 && v.length <= TITLE_MAX ? { ok: true, value: v } : { ok: false };
}

/** Description: trimmed, line breaks kept (CRLF → LF), 1–5000 characters. */
export function normalizeDescription(value: unknown): { ok: true; value: string } | { ok: false } {
  if (typeof value !== "string" || FORBIDDEN.test(value)) return { ok: false };
  const v = value.replace(/\r\n?/g, "\n").trim();
  return v.length >= 1 && v.length <= DESCRIPTION_MAX ? { ok: true, value: v } : { ok: false };
}

export interface SupportTicketView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: SupportTicketStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly filedByViewer: boolean;
}

export type SupportTicketsRead =
  | { readonly status: "unauthenticated" | "unavailable" }
  | {
      readonly status: "read";
      readonly tickets: readonly SupportTicketView[];
      readonly truncated: boolean;
      readonly viewerMayChangeStatus: boolean;
    };

export type SupportTicketRefusal =
  | "unauthenticated"
  | "persistence-unavailable"
  | "invalid-input"
  | "not-authorized"
  | "not-found"
  | "stale-version"
  | "unchanged";

export type SupportTicketWrite =
  | { readonly status: "created" | "updated"; readonly ticketId: string; readonly version: number }
  | { readonly status: "refused"; readonly reason: SupportTicketRefusal };
