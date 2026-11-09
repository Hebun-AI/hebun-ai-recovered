"use client";

import { useState, useTransition } from "react";
import { changeSupportTicketStatusAction, createSupportTicketAction } from "@/app/(dashboard)/tickets/actions";
import {
  DESCRIPTION_MAX,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS_LABEL,
  TITLE_MAX,
  type SupportTicketRefusal,
  type SupportTicketStatus,
} from "@/features/support-tickets/contracts";

const WORDING: Readonly<Record<SupportTicketRefusal, string>> = {
  unauthenticated: "Your session could not be confirmed. Sign in again.",
  "persistence-unavailable": "Hebun could not save this right now. Nothing was changed.",
  "invalid-input": `Give a one-line title (up to ${TITLE_MAX} characters) and a description (up to ${DESCRIPTION_MAX}), without control characters.`,
  "not-authorized": "Only your organization's Governance authority can change a ticket's status.",
  "not-found": "This ticket no longer exists in your organization.",
  "stale-version": "This ticket changed in another window. Refresh and try again.",
  unchanged: "The ticket already has that status.",
};

const FIELD = "w-full rounded border border-border-subtle bg-transparent px-2 py-1 text-sm";

export function NewTicketForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex max-w-2xl flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createSupportTicketAction({ title, description });
          if (r.status === "refused") {
            setMessage(WORDING[r.reason]);
            return;
          }
          setTitle("");
          setDescription("");
          setMessage("Ticket filed.");
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-fg-muted">Title</span>
        <input value={title} maxLength={TITLE_MAX} required onChange={(e) => setTitle(e.target.value)} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-fg-muted">Description</span>
        <textarea value={description} maxLength={DESCRIPTION_MAX} required rows={4} onChange={(e) => setDescription(e.target.value)} className={FIELD} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} aria-busy={pending} className="rounded border border-border-subtle px-3 py-1 text-xs disabled:opacity-50">
          {pending ? "Filing…" : "File ticket"}
        </button>
        {message ? (
          <p role="status" className="text-xs text-fg-muted">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function TicketStatusControl({
  ticketId,
  status,
  version,
}: {
  readonly ticketId: string;
  readonly status: SupportTicketStatus;
  readonly version: number;
}) {
  const [value, setValue] = useState<SupportTicketStatus>(status);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await changeSupportTicketStatusAction({ ticketId, status: value, expectedVersion: version });
          setMessage(r.status === "refused" ? WORDING[r.reason] : "Status changed.");
        });
      }}
    >
      <label className="sr-only" htmlFor={`status-${ticketId}`}>
        Status
      </label>
      <select id={`status-${ticketId}`} value={value} onChange={(e) => setValue(e.target.value as SupportTicketStatus)} className="rounded border border-border-subtle bg-transparent px-1 py-0.5 text-xs">
        {SUPPORT_TICKET_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SUPPORT_TICKET_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending || value === status} aria-busy={pending} className="rounded border border-border-subtle px-2 py-0.5 text-xs disabled:opacity-50">
        {pending ? "Saving…" : "Change"}
      </button>
      {message ? (
        <span role="status" className="text-xs text-fg-muted">
          {message}
        </span>
      ) : null}
    </form>
  );
}
