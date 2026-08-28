import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";
import {
  EXECUTION_LEDGER_WORDING,
  EXECUTION_OUTCOME_WORDING,
  PROVIDER_ACCEPTANCE_NON_CLAIMS,
  type ExecutionAttemptStatus,
} from "@/features/action-execution/contracts";
import type { ExecutionLedgerEntry } from "@/features/action-execution/execution-ledger-projection.server";

/*
 * The Execution Ledger (GOVERNED-EXECUTION-1) — what this organization has already done.
 *
 * ── WHY THIS IS A SERVER COMPONENT WITH NO STATE ─────────────────────────────
 *
 * There is no `"use client"` directive, no hook, no handler and no imported server action. That is
 * the guarantee, not a style choice: a component with no client boundary and no action import has
 * no representation in which a control could be added by accident. The absence of a retry button
 * here is structural — there is nothing for one to call.
 *
 * Its sibling `action-authorizations.tsx` is a client component precisely because it DOES offer
 * consequential controls. Keeping the reporting surface on the other side of that line means the
 * two cannot be confused, by a reader or by a later edit.
 *
 * ── WHAT IT REPORTS, AND WHAT IT REFUSES TO CLAIM ────────────────────────────
 *
 *   accepted  the provider took the request and returned its own id. That is the strongest claim
 *             available, and it is rendered beside an explicit list of what it does NOT mean.
 *   unknown   the request left and the answer was lost. Rendered as prominently as an acceptance,
 *             because the dangerous reading of an ambiguous send is that it failed.
 *   failed    a provider answered and declined, or the connection provably never came up.
 *   refused   Hebun declined before any external call. Nothing left this process.
 *   pending   no outcome was ever recorded. Not a success, not a failure — an absent answer.
 *
 * Nothing here is inferred. Every line is a durable column or a frozen sentence, and where a
 * column is null the surface says the fact is missing rather than filling it in.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 *
 * It offers no control of any kind. It cannot retry, replay, reconcile, resolve, dismiss, mark or
 * send. A second real send needs a new proposal, a new decision and a new permit, and this surface
 * says so rather than offering a shortcut that would bypass all three.
 */

/** `unknown` reads as a warning; nothing else is styled to imply an outcome it does not have. */
function toneFor(status: ExecutionAttemptStatus): string {
  if (status === "unknown") return "border-danger/40 bg-danger/10 text-danger";
  if (status === "accepted") return "border-border bg-surface text-fg-secondary";
  return "border-border bg-surface text-fg-muted";
}

function Correlation({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[0.6rem] text-fg-muted">
      <span className="font-semibold uppercase tracking-wider">{label}</span>{" "}
      <span className="break-all font-mono">{value}</span>
    </span>
  );
}

function LedgerRow({ entry }: { entry: ExecutionLedgerEntry }) {
  return (
    <li className={`flex flex-col gap-2 rounded-lg border p-3 ${toneFor(entry.status)}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StructuralMarker label={entry.status} />
        <span className="text-xs text-fg-secondary">{entry.actionKind}</span>
        <span className="text-[0.65rem] text-fg-muted">
          started {new Date(entry.startedAt).toLocaleString()}
        </span>
        {entry.completedAt ? (
          <span className="text-[0.65rem] text-fg-muted">
            concluded {new Date(entry.completedAt).toLocaleString()}
          </span>
        ) : null}
      </div>

      <p className="text-xs leading-5">{EXECUTION_OUTCOME_WORDING[entry.status]}</p>

      {/* An attempt that never concluded says why the row looks the way it does. */}
      {entry.status === "pending" && entry.completedAt === null ? (
        <p className="text-[0.65rem] leading-5 text-fg-muted">
          {EXECUTION_LEDGER_WORDING.pendingAfterReload}
        </p>
      ) : null}

      {entry.providerMessageId ? (
        <p className="break-all text-[0.65rem] text-fg-muted">
          Provider message id: {entry.providerMessageId}
        </p>
      ) : null}

      {/* The only place a positive provider claim appears, and it never travels alone. */}
      {entry.status === "accepted" ? (
        <ul className="flex flex-col gap-0.5">
          {PROVIDER_ACCEPTANCE_NON_CLAIMS.map((claim) => (
            <li key={claim} className="text-[0.65rem] text-fg-muted">
              Accepted {claim}.
            </li>
          ))}
        </ul>
      ) : null}

      {entry.failureClass ? (
        <p className="text-[0.65rem] text-fg-muted">Recorded reason: {entry.failureClass}</p>
      ) : null}

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <Correlation label="attempt" value={entry.attemptId} />
        <Correlation label="permit" value={entry.permitId} />
        <Correlation label="adapter" value={entry.adapterId} />
      </div>
    </li>
  );
}

export function ExecutionLedger({
  entries,
  needsAttention,
  connected,
  historyTruncated = false,
  attentionTruncated = false,
}: {
  readonly entries: readonly ExecutionLedgerEntry[];
  readonly needsAttention: readonly ExecutionLedgerEntry[];
  readonly connected: boolean;
  /** Both default to false so a caller that forgets them under-claims rather than over-claims. */
  readonly historyTruncated?: boolean;
  readonly attentionTruncated?: boolean;
}) {
  return (
    <DecisionRegion
      eyebrow="Performed acts"
      title={EXECUTION_LEDGER_WORDING.regionTitle}
      action={
        <StructuralMarker
          label={connected ? `${needsAttention.length} needing attention` : "Not connected"}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {!connected ? (
          <DecisionEmptyState
            title="The execution ledger could not be read"
            detail={EXECUTION_LEDGER_WORDING.unavailable}
          />
        ) : (
          <>
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                {EXECUTION_LEDGER_WORDING.attentionTitle}
              </p>
              {needsAttention.length === 0 ? (
                <p className="mt-1 text-xs text-fg-muted">
                  {EXECUTION_LEDGER_WORDING.attentionEmpty}
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs leading-5 text-fg-secondary">
                    {EXECUTION_LEDGER_WORDING.attentionPreamble}
                  </p>
                  <p className="mt-1 text-[0.65rem] text-fg-muted">
                    {EXECUTION_LEDGER_WORDING.secondSendRequirement}
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {needsAttention.map((entry) => (
                      <LedgerRow key={entry.attemptId} entry={entry} />
                    ))}
                  </ul>
                  {attentionTruncated ? (
                    <p className="mt-2 text-[0.65rem] font-semibold text-danger">
                      {EXECUTION_LEDGER_WORDING.attentionTruncated}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                {EXECUTION_LEDGER_WORDING.historyTitle}
              </p>
              {entries.length === 0 ? (
                <p className="mt-1 text-xs text-fg-muted">{EXECUTION_LEDGER_WORDING.emptyLedger}</p>
              ) : (
                <>
                  <ul className="mt-2 flex flex-col gap-2">
                    {entries.map((entry) => (
                      <LedgerRow key={entry.attemptId} entry={entry} />
                    ))}
                  </ul>
                  {historyTruncated ? (
                    <p className="mt-2 text-[0.65rem] text-fg-muted">
                      {EXECUTION_LEDGER_WORDING.historyTruncated}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </DecisionRegion>
  );
}
