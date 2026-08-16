"use client";

import { useState, useTransition } from "react";
import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";
import {
  approveActionRequestAction,
  rejectActionRequestAction,
  revokeActionPermitAction,
} from "@/app/(dashboard)/approvals/actions";
import type {
  ActionPermitView,
  PendingActionRequestView,
} from "@/features/action-authorization/read-action-authorizations.server";

/*
 * Consequential Action Authorization (R3A) — the first REAL decision act on this surface.
 *
 * Phase 14 built this workspace with an honest empty state because no server-authorized
 * decision-mutation path existed. R3A is that path, for exactly one class of decision: authorizing
 * one prepared consequential action. Everything else on this page is unchanged and still honest.
 *
 * WHAT A HUMAN MUST SEE BEFORE THEY MAY APPROVE — and therefore what is rendered without
 * truncation: the exact target, every typed parameter and its value, the expected effect, the
 * consequences, and whether the act is reversible. Consequences before confirmation is the Heby
 * Core Phase 6 rule, and an approval control that appears before them would break it.
 *
 * WHAT THIS COMPONENT CANNOT DO. There is no execute control, because no execute action exists to
 * call. Approving produces an authorization; it does not perform anything, and the permit column
 * says so on every row.
 */

const MIN_JUSTIFICATION = 12;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <span className="min-w-0 break-words text-xs text-fg-secondary">{value}</span>
    </div>
  );
}

function RequestCard({ item }: { item: PendingActionRequestView }) {
  const [justification, setJustification] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = justification.trim().length >= MIN_JUSTIFICATION;

  const run = (kind: "approve" | "reject") =>
    startTransition(async () => {
      setMessage(null);
      const result =
        kind === "approve"
          ? await approveActionRequestAction({ requestId: item.requestId, justification })
          : await rejectActionRequestAction({
              requestId: item.requestId,
              justification,
              rejectionReason: reason,
            });
      if (result.status === "refused") {
        setMessage(`Refused: ${result.reason}`);
        return;
      }
      setMessage(
        result.status === "authorized"
          ? `Authorized. Permit expires ${new Date(result.expiresAt).toLocaleString()}. Nothing has been executed.`
          : "Refused and recorded.",
      );
    });

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-surface-sunken p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-secondary">
          {item.actionKind}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${
            item.reversibility === "irreversible"
              ? "border border-danger/40 bg-danger/10 text-danger"
              : "border border-border bg-surface text-fg-secondary"
          }`}
        >
          {item.reversibility}
        </span>
      </div>

      <p className="text-sm leading-6 text-fg-primary">{item.expectedEffect}</p>

      <div className="flex flex-col gap-1">
        <Field label="Tool" value={item.toolId} />
        <Field
          label="Target"
          value={
            item.targetRef
              ? `${item.targetLabel ?? item.targetRef} (${item.targetKind}:${item.targetRef})`
              : "none"
          }
        />
        {item.parameters.map((p) => (
          <Field key={p.name} label={p.name} value={p.value} />
        ))}
      </div>

      {/* Consequences before confirmation — never after, never collapsed. */}
      <div className="rounded-md border border-border bg-surface p-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Consequences
        </p>
        <ul className="mt-1 list-disc pl-4">
          {item.consequences.map((c) => (
            <li key={c} className="text-xs leading-5 text-fg-secondary">
              {c}
            </li>
          ))}
        </ul>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">
          Your justification (recorded in the Governance ledger)
        </span>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={2}
          className="rounded-md border border-border bg-surface p-2 text-xs text-fg-primary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">
          Reason, if refusing
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-md border border-border bg-surface p-2 text-xs text-fg-primary"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!ready || pending}
          onClick={() => run("approve")}
          className="rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-40"
        >
          Authorize this action
        </button>
        <button
          type="button"
          disabled={!ready || pending || reason.trim().length === 0}
          onClick={() => run("reject")}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-fg-secondary disabled:opacity-40"
        >
          Refuse
        </button>
        <span className="text-[0.65rem] text-fg-muted">
          Authorizing does not execute — it issues a bounded, revocable permit.
        </span>
      </div>

      {message ? <p className="text-xs text-fg-secondary">{message}</p> : null}
    </li>
  );
}

function PermitRow({ item }: { item: ActionPermitView }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const revoke = () =>
    startTransition(async () => {
      const result = await revokeActionPermitAction({
        permitId: item.permitId,
        justification: "Withdrawing this authorization before it is spent.",
        revocationReason: reason,
      });
      setMessage(
        result.status === "revoked" ? "Revoked." : `Refused: ${result.reason}`,
      );
    });

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface-sunken p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StructuralMarker label={item.state} />
        <span className="text-xs text-fg-secondary">{item.actionKind}</span>
        <span className="text-[0.65rem] text-fg-muted">
          expires {new Date(item.expiresAt).toLocaleString()}
        </span>
      </div>
      <p className="text-[0.65rem] text-fg-muted">
        Authorized, not executed. Execution substrate is not connected.
      </p>
      {item.revocationReason ? (
        <p className="text-[0.65rem] text-fg-muted">Revoked: {item.revocationReason}</p>
      ) : null}
      {item.state === "active" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for revoking"
            className="rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
          />
          <button
            type="button"
            disabled={pending || reason.trim().length === 0}
            onClick={revoke}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-fg-secondary disabled:opacity-40"
          >
            Revoke
          </button>
        </div>
      ) : null}
      {message ? <p className="text-xs text-fg-secondary">{message}</p> : null}
    </li>
  );
}

export function ActionAuthorizations({
  requests,
  permits,
  connected,
}: {
  readonly requests: readonly PendingActionRequestView[];
  readonly permits: readonly ActionPermitView[];
  readonly connected: boolean;
}) {
  return (
    <DecisionRegion
      eyebrow="Consequential action authorization"
      title="Actions Awaiting Authorization"
      accent
      action={<StructuralMarker label={connected ? `${requests.length} pending` : "Not connected"} />}
    >
      <div className="flex flex-col gap-4">
        {!connected ? (
          <DecisionEmptyState
            title="Authorization persistence is not configured"
            detail="Durable authorization requires the control-plane database. Until it is configured, no action request can be recorded and no permit can be issued — and none is fabricated here."
          />
        ) : requests.length === 0 ? (
          <DecisionEmptyState
            title="No action is waiting for authorization"
            detail="Heby records a request here when it prepares a consequential action that requires human authority. Each one states its exact target, its typed parameters, its consequences and its reversibility before any control to authorize it appears."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => (
              <RequestCard key={r.requestId} item={r} />
            ))}
          </ul>
        )}

        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            Issued permits
          </p>
          {permits.length === 0 ? (
            <p className="mt-1 text-xs text-fg-muted">
              None issued. A permit exists only once a Governance decision authorized one.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {permits.map((p) => (
                <PermitRow key={p.permitId} item={p} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </DecisionRegion>
  );
}
