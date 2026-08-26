"use client";

import { useState, useTransition } from "react";
import {
  createExternalRecipientAction,
  retireExternalRecipientAction,
} from "@/app/(dashboard)/operations/actions";
import type {
  RecipientListing,
  RecipientValidationProblem,
  RecipientView,
} from "@/features/external-recipients/contracts";
import { ReferenceChip } from "./reference-chip";

/*
 * recipients-section.tsx — who a prepared communication could eventually go to (OPS-P1).
 *
 * ── AN ADDRESS IS NEVER EDITED ───────────────────────────────────────────────
 *
 * R3R's authority has no update path for the address, the kind or the owning tenant, and a released
 * structural test parses every `.set({…})` touching the table to keep it that way. The reason is
 * not tidiness: a mutable address would silently re-point every approved-but-unspent permit naming
 * it. So this surface offers ADD and RETIRE and no third verb. Correcting an address means
 * recording the new one and retiring the old, and the form says so in one line rather than hiding
 * the constraint or explaining it at length.
 *
 * RETIREMENT IS NOT DELETION. The stored address is left exactly as it was, so a permit or an audit
 * row naming it still resolves to the same bytes. Retired recipients stay READABLE and are
 * deliberately NOT proposable — they are listed apart, with no reference to copy, because offering
 * one would invite a `/send` that the authority will refuse.
 *
 * ── WHAT IS NOT SHOWN ────────────────────────────────────────────────────────
 *
 * `endpointDigest`, `createdByActorType`, `createdByActorId` and the raw row `id` are all present on
 * `RecipientView` and none is rendered. The digest is an integrity value, the actor pair is audit
 * internals, and the id is already carried — correctly — inside `recordRef`.
 *
 * RECORDING AN ADDRESS IS NOT APPROVING A SEND. Nothing here consults Governance, issues a permit,
 * or causes an effect.
 */

const REFUSAL_WORDING: Record<string, string> = {
  unauthenticated: "Your session could not be resolved, so nothing was recorded.",
  "invalid-input": "That recipient was not recorded — see the problems listed.",
  "persistence-unavailable": "Durable storage is not reachable, so nothing was recorded.",
  "duplicate-active-endpoint": "This organization already holds an active recipient at that address.",
  "recipient-not-found": "That recipient could not be found for your organization.",
  "recipient-already-retired": "That recipient was already retired.",
};

function problemText(problem: RecipientValidationProblem): string {
  if (problem.field === "displayName") {
    if (problem.problem === "empty") return "A display name is required.";
    if (problem.problem === "too-long") return "That display name is too long.";
    return "That display name contains control characters.";
  }
  if (problem.field === "endpointKind") return "That recipient kind is not one Hebun records.";
  return "That address is not a valid email address.";
}

function RecipientRow({ recipient, retirable }: { recipient: RecipientView; retirable: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex flex-col gap-2 border-b border-border-subtle py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-fg-primary">{recipient.displayName}</p>
        <p className="text-xs text-fg-secondary">
          {recipient.endpointKind}: {recipient.endpointValue}
        </p>
        {/* Retired recipients are readable and NOT proposable, so no reference is offered. */}
        {recipient.status === "active" ? <ReferenceChip reference={recipient.recordRef} /> : null}
        {message ? <p className="text-xs text-fg-muted">{message}</p> : null}
      </div>
      {retirable ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await retireExternalRecipientAction({
                recipientRef: recipient.recordRef,
              });
              setMessage(
                result.status === "retired"
                  ? "Retired. The address is kept exactly as it was."
                  : (REFUSAL_WORDING[result.reason] ?? `Not retired: ${result.reason}.`),
              );
            })
          }
          className="shrink-0 self-start rounded border border-border-subtle px-2 py-1 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
        >
          {pending ? "Retiring…" : "Retire"}
        </button>
      ) : null}
    </li>
  );
}

export function RecipientsSection({
  active,
  retired,
}: {
  readonly active: RecipientListing;
  readonly retired: RecipientListing;
}) {
  const [displayName, setDisplayName] = useState("");
  const [endpointValue, setEndpointValue] = useState("");
  const [problems, setProblems] = useState<readonly RecipientValidationProblem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-5">
      <header className="mb-1">
        <h2 className="text-sm font-semibold text-fg-primary">Recipients</h2>
        <p className="mt-1 text-xs text-fg-secondary">
          Who a prepared communication could eventually go to. Recording an address here proposes
          nothing, approves nothing and sends nothing.
        </p>
      </header>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            setProblems([]);
            setMessage(null);
            const result = await createExternalRecipientAction({
              displayName,
              endpointKind: "email",
              endpointValue,
            });
            if (result.status === "created") {
              setDisplayName("");
              setEndpointValue("");
              setMessage("Recorded.");
              return;
            }
            /*
             * `refused` is the ONLY negative branch, and it optionally carries the field problems.
             * Both are surfaced: the reason says which rule said no, the problems say where.
             */
            setProblems(result.problems ?? []);
            setMessage(REFUSAL_WORDING[result.reason] ?? `Not recorded: ${result.reason}.`);
          });
        }}
      >
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Display name"
          className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
        />
        <input
          value={endpointValue}
          onChange={(event) => setEndpointValue(event.target.value)}
          placeholder="name@example.com"
          className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded border border-border-subtle px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
        >
          {pending ? "Recording…" : "Record recipient"}
        </button>
      </form>
      <p className="mt-2 text-xs text-fg-muted">
        An address is never edited. To correct one, record the new address and retire the old.
      </p>
      {problems.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {problems.map((problem) => (
            <li key={`${problem.field}-${problem.problem}`} className="text-xs text-error">
              {problemText(problem)}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="mt-2 text-xs text-fg-secondary">{message}</p> : null}

      <div className="mt-5">
        {active.unavailableReason ? (
          /* UNAVAILABLE IS NOT EMPTY. A failed read must never render as "you have no recipients". */
          <p className="text-xs text-warning">
            Your recipients could not be read ({active.unavailableReason}), so this list is unknown
            rather than empty.
          </p>
        ) : active.recipients.length === 0 ? (
          <p className="text-xs text-fg-muted">
            No recipients recorded yet. The list was read successfully — this is the real state.
          </p>
        ) : (
          <ul>
            {active.recipients.map((recipient) => (
              <RecipientRow key={recipient.recordRef} recipient={recipient} retirable />
            ))}
          </ul>
        )}
      </div>

      {!retired.unavailableReason && retired.recipients.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-fg-muted">
            Retired ({retired.recipients.length}) — readable, and not proposable
          </summary>
          <ul className="mt-2">
            {retired.recipients.map((recipient) => (
              <RecipientRow key={recipient.recordRef} recipient={recipient} retirable={false} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
