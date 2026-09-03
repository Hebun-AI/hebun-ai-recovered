"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";
import {
  approveActionRequestAction,
  declareActionPurposeAction,
  executeAuthorizedActionAction,
  executeGovernedInternalActionAction,
  rejectActionRequestAction,
  revokeActionPermitAction,
} from "@/app/(dashboard)/approvals/actions";
import type {
  ActionPermitView,
  PendingActionRequestView,
} from "@/features/action-authorization/read-action-authorizations.server";
import {
  EXECUTION_OUTCOME_WORDING,
  type ExecutionAttemptStatus,
} from "@/features/action-execution/contracts";
import { RECORD_WORK_ACTION_KIND } from "@/features/heby-action-inlet/contracts";
import {
  elapsedSince,
  type ElapsedObservation,
} from "@/features/attention-observation/contracts";

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
 * R3B ADDED ONE CONTROL: Execute, on an active permit, and nowhere else. It is a SECOND deliberate
 * click by the same human — approving still authorizes and stops. There is no auto-execute, no
 * queue and no worker, so an authorization nobody clicks simply expires.
 *
 * WHAT THIS COMPONENT STILL REFUSES TO SAY. It never renders "sent" or "delivered". The strongest
 * claim available is "accepted by the provider", and it appears only alongside the provider's own
 * message id. An `unknown` outcome is rendered as prominently as an accepted one, with an explicit
 * instruction not to retry — because the one thing a human must not do with an ambiguous send is
 * assume it failed.
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

/*
 * PBGA-1 — DECLARE WHICH WORK THIS PENDING ACT SERVES.
 *
 * ── IT IS NOT A DECISION CONTROL, AND IT SITS APART FROM ONE ─────────────────
 *
 * Declaring a purpose approves nothing, rejects nothing and executes nothing. A Director may
 * declare what an act is for and then reject it — the two are separate acts by separate authorities,
 * and this control carries no justification field for exactly that reason: a justification is what
 * a DECISION requires.
 *
 * ── A CLOSED PICKER, NEVER FREE TEXT ────────────────────────────────────────
 *
 * The options come from the Work authority, resolved on the server. A typed field would make the
 * browser a source of work identity; a picker means a declaration can only name work this
 * organization already recorded.
 *
 * ── ONCE DECLARED, THIS CONTROL IS GONE ─────────────────────────────────────
 *
 * It renders only while `purposeWorkTitle` is null. Rebinding is refused by the writer, so offering
 * an edit here would be offering something the authority will not do.
 */
function DeclarePurposeControl({
  requestId,
  options,
}: {
  readonly requestId: string;
  readonly options: readonly { readonly workItemId: string; readonly title: string }[];
}) {
  const [choice, setChoice] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (options.length === 0) {
    return (
      <p className="mt-1 text-xs leading-5 text-fg-muted">
        This organization has recorded no work, so there is nothing to declare a purpose against.
      </p>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <select
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
        disabled={pending}
        aria-label="Declare which work this act serves"
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-primary"
      >
        <option value="">Declare which work this serves…</option>
        {options.map((option) => (
          <option key={option.workItemId} value={option.workItemId}>
            {option.title}
          </option>
        ))}
      </select>
      {/*
        * ── THE AFFORDANCE, WHICH IS NOT DECORATION ──────────────────────────
        *
        * This shipped as a secondary control whose ONLY difference between armed and unarmed was
        * `disabled:opacity-40` on already-muted text, beside a solid primary "Authorize" button.
        * An operator selected a work item, the button became genuinely clickable, and it still
        * looked exactly as inert as before — so it was read as disabled and never clicked. The
        * predicate was right and the surface lied about it.
        *
        * It stays SECONDARY: a declaration is not a decision, and this must never look like the
        * authorize control. But armed and unarmed are now different at a glance — border, weight
        * and foreground all move, not opacity alone.
        */}
      <button
        type="button"
        disabled={pending || choice === ""}
        className={
          choice === "" || pending
            ? "rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted opacity-60"
            : "rounded-md border border-fg-secondary bg-surface px-3 py-1.5 text-xs font-semibold text-fg-primary"
        }
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await declareActionPurposeAction({ requestId, workItemId: choice });
            /* The writer's own verdict, unreworded. A second wording is a second interpretation. */
            setMessage(result.status === "declared" ? null : `Refused: ${result.reason}`);
          })
        }
      >
        Declare purpose
      </button>
      {/*
        * WHAT WOULD BE DECLARED, ON THIS CARD, IN WORDS.
        *
        * Three identical pending proposals to the same recipient stack on this surface, each with
        * its own picker. Naming the chosen work beside the button that would record it makes the
        * selection legible per card rather than something a reader has to hold in their head.
        */}
      {choice !== "" && !pending ? (
        <span className="text-xs leading-5 text-fg-secondary">
          will declare: {options.find((option) => option.workItemId === choice)?.title ?? choice}
        </span>
      ) : null}
      {message ? <span className="text-xs text-danger">{message}</span> : null}
    </div>
  );
}

function RequestCard({
  item,
  waitingFor,
  workOptions,
}: {
  readonly item: PendingActionRequestView;
  /** E2-4 — elapsed since this proposal was FILED. `null` when no instant or no usable timestamp. */
  readonly waitingFor: ElapsedObservation | null;
  /** PBGA-1 — the work a human may declare this act serves. Empty when none is recorded. */
  readonly workOptions: readonly { readonly workItemId: string; readonly title: string }[];
}) {
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
        {/*
         * E2-4 — HOW LONG THIS HAS BEEN AWAITING A DECISION.
         *
         * Rendered as ordinary secondary metadata, in the SAME neutral treatment as the action
         * kind beside it — never the `danger` styling that `irreversible` legitimately carries,
         * because reversibility is a property of the act and elapsed time is not a property of
         * anything. A duration that looked like a warning would be asserting a policy Hebun has
         * no authority to hold.
         *
         *     AGE != IMPORTANCE     WAITING != LATE     NO THRESHOLD IS A POLICY
         *
         * Absent, never zero, when the instant or the timestamp is unusable.
         */}
        {waitingFor ? (
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[0.6rem] font-medium tracking-wider text-fg-muted">
            Awaiting decision · {waitingFor.label}
          </span>
        ) : null}
        <span
          className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${
            item.reversibility === "irreversible"
              ? "border border-danger/40 bg-danger/10 text-danger"
              : "border border-border bg-surface text-fg-secondary"
          }`}
        >
          {item.reversibility}
        </span>
        {/*
         * WHO PROPOSED THIS.
         *
         * A1a made the stored column truthful and nothing read it. APP-2 built this badge so the
         * first agent-originated proposal would be VISIBLY different from a person's, and said the
         * class was all it could show because "no identity display seam exists" to turn the id into
         * a name. AGENT-PROPOSAL-2 built that seam, so the badge now says WHICH agent.
         *
         * It falls back to the CLASS, never to an identifier. A name the server could not resolve
         * renders as "proposed by agent" — the same true statement APP-2 shipped — because a raw
         * uuid on a review card is a leak, not a label.
         *
         * "proposes", never "will send". Nothing has been authorized or executed at this point, and
         * this badge sits beside an approve control precisely because it has not.
         */}
        <span
          className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${
            item.proposedByActorType === "human"
              ? "border border-border bg-surface text-fg-secondary"
              : "border border-warning/40 bg-warning/10 text-warning"
          }`}
        >
          proposed by {item.proposedByAgentName ?? item.proposedByActorType}
        </span>
        {item.proposedByAgentName !== null && item.proposedByAgentInService === false ? (
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-secondary">
            agent retired since
          </span>
        ) : null}
      </div>

      <p className="text-sm leading-6 text-fg-primary">{item.expectedEffect}</p>

      {/*
       * PBGA-1 — THE DECLARED ORGANIZATIONAL PURPOSE, BEFORE THE DECISION.
       *
       * The approver reads this above the mechanics, because "what is this act FOR" is the question
       * the mechanics cannot answer. It is stated as a DECLARATION and never as a justification:
       * this act serves that work because a person said so, not because Hebun determined the work
       * needs it, will be advanced by it, or depends on it.
       *
       *     DECLARED PURPOSE != NECESSITY != PROGRESS != COMPLETION
       *
       * Undeclared renders "Not declared" — a statement about this record. "No purpose" would be a
       * statement about the act, and would read as a fault in a proposal that has none.
       */}
      <div className="rounded-md border border-border bg-bg px-2.5 py-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">
          Declared organizational purpose
        </p>
        <p className="mt-0.5 text-sm leading-6 text-fg-primary">
          {item.purposeUnresolved
            ? "Declared, but the Work authority could not answer for it — unknown, not absent."
            : (item.purposeWorkTitle ?? "Not declared")}
        </p>
        {item.purposeWorkTitle !== null ? (
          <p className="mt-0.5 text-xs leading-5 text-fg-muted">
            A person declared this act serves that work. It is not a claim that the work needs it,
            or that authorizing it advances the work.
          </p>
        ) : (
          <DeclarePurposeControl requestId={item.requestId} options={workOptions} />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Field label="Tool" value={item.toolId} />
        <Field label="Side effect" value={item.sideEffect} />
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

      {/*
       * WHAT IS FROZEN, SAID AS WHAT IT MEANS.
       *
       * These were rendered as raw hex beside the references they bind, where a digest reads as a
       * peer field rather than an integrity value. A human authorizes "this exact revision", not a
       * hash. The raw values stay available one disclosure away — they are integrity evidence, not
       * secrets, and an operator checking a binding by hand must still be able to.
       *
       * PRESENTATION ONLY. The permit binds `payloadDigest`, computed server-side over the whole
       * payload; how this card renders an ingredient of that payload cannot loosen it.
       */}
      {item.locks.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-2">
          {item.locks.map((lock) => (
            <div key={lock.name} className="flex items-center gap-1.5">
              <Lock className="size-3 shrink-0 text-fg-muted" aria-hidden />
              <span className="text-[0.7rem] text-fg-secondary">{lock.label}</span>
            </div>
          ))}
          <details className="mt-0.5">
            <summary className="cursor-pointer text-[0.65rem] text-fg-muted">
              Show the integrity values
            </summary>
            <div className="mt-1 flex flex-col gap-1">
              {item.locks.map((lock) => (
                <Field key={lock.name} label={lock.name} value={lock.value} />
              ))}
              <Field label="payloadDigest" value={item.payloadDigest} />
              <p className="text-[0.65rem] leading-5 text-fg-muted">
                Authorization binds <span className="font-mono">payloadDigest</span>, computed over
                the whole proposal. The values above are what it was computed from.
              </p>
            </div>
          </details>
        </div>
      ) : null}

      {/*
       * THE EVIDENCE THE PROPOSAL RECORDED. Projected, never resolved: each reference is carried
       * exactly as it was stored, and this surface follows none of them. Absent evidence and
       * unreadable evidence are said differently, because they are different facts.
       */}
      <div className="flex flex-col gap-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">
          Evidence & provenance
        </p>
        {item.evidence.status === "attached" ? (
          <ul className="flex flex-col gap-0.5">
            {item.evidence.items.map((e) => (
              <li key={`${e.sourceClass}:${e.recordRef}`} className="text-xs text-fg-secondary">
                <span className="text-fg-muted">{e.sourceClass}</span>{" "}
                <span className="break-all font-mono text-[0.7rem]">{e.recordRef}</span>{" "}
                <span className="text-fg-muted">· {e.lifecycle}</span>
              </li>
            ))}
          </ul>
        ) : item.evidence.status === "none" ? (
          <p className="text-xs text-fg-muted">
            This proposal recorded no evidence. That is the stored state, not a failed read.
          </p>
        ) : (
          <p className="text-xs text-warning">
            The stored evidence could not be interpreted, so it is unknown rather than absent.
          </p>
        )}
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

/**
 * The outcome line. `unknown` is styled like a warning rather than a failure, because it is the
 * one state a human can make worse by acting on the obvious reading.
 */
function OutcomeLine({
  status,
  providerMessageId,
}: {
  readonly status: ExecutionAttemptStatus;
  readonly providerMessageId: string | null;
}) {
  const tone =
    status === "accepted"
      ? "border-border bg-surface text-fg-secondary"
      : status === "unknown"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-border bg-surface text-fg-muted";
  return (
    <div className={`rounded-md border p-2 ${tone}`}>
      <p className="text-xs leading-5">{EXECUTION_OUTCOME_WORDING[status]}</p>
      {providerMessageId ? (
        <p className="mt-0.5 break-all text-[0.65rem] text-fg-muted">
          Provider message id: {providerMessageId}
        </p>
      ) : null}
      {status === "accepted" ? (
        <p className="mt-0.5 text-[0.65rem] text-fg-muted">
          Accepted is not delivered. Hebun has no delivery confirmation.
        </p>
      ) : null}
    </div>
  );
}

/**
 * WHAT HAPPENED TO AN AUTHORIZATION THAT HAS NO EXTERNAL ATTEMPT ROW (GIA-1 repair).
 *
 * ── THE CONTRADICTION THIS EXISTS TO REMOVE ──────────────────────────────────
 *
 * This branch used to ask `item.state === "active"` and, for anything else, say "Authorized, and
 * never executed." That was true while the only executable act was an external send, because a
 * send's spend and its attempt row are written together — so "no attempt row" really did mean
 * "never executed".
 *
 * A GOVERNED INTERNAL ACT WRITES NO ATTEMPT ROW AT ALL. Its outcome record is the work item and
 * that item's audit event, deliberately, because an internal mutation inside the permit's own
 * transaction has no ambiguous phase to reconcile. So a consumed `record-work` permit rendered
 * "Authorized, and never executed." directly above the surface's own "Recorded." confirmation.
 *
 * ── THE FACT WAS ALREADY ON THE VIEW ─────────────────────────────────────────
 *
 * The question is not "is there an attempt row" but "was this authorization SPENT", and
 * `consumedAt` has answered that since R3A. Nothing new is read, no ledger is invented, and the
 * external branch above is untouched: an attempt row still speaks for itself.
 *
 *     ACTIVE != SPENT != ATTEMPTED != SUCCEEDED
 */
export function permitOutcomeSentence(item: {
  readonly actionKind: string;
  readonly state: ActionPermitView["state"];
  readonly consumedAt: string | null;
}): string {
  if (item.consumedAt !== null) {
    /*
     * SPENT. For the internal act the outcome is a durable record, and the surface may say so. For
     * an external send this combination is structurally unreachable — the attempt row and the spend
     * commit together — so it says only what it can prove: the authorization is gone.
     */
    return item.actionKind === RECORD_WORK_ACTION_KIND
      ? "Executed. Hebun performed this under your authorization; the record it created is on the work register."
      : "Spent. This authorization was consumed, and no provider attempt is recorded against it.";
  }
  return item.state === "active"
    ? "Authorized — not executed. Executing spends this authorization permanently."
    : "Authorized, and never executed.";
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

  /*
   * GIA-1 — WHICH EXECUTOR, DECIDED BY THE PERMIT'S OWN ACTION KIND.
   *
   * This is a presentation choice, not a security one. Both server actions resolve the tenant
   * themselves and both re-check the permit's action kind inside their own transaction, so a client
   * that called the wrong one is refused by the owning authority. What this branch buys is a
   * TRUTHFUL button: the two acts have different costs, different reversibility and different
   * refusal semantics, and one shared sentence about them would be false for one of them.
   */
  const internal = item.actionKind === RECORD_WORK_ACTION_KIND;

  const execute = () =>
    startTransition(async () => {
      setMessage(null);
      if (internal) {
        const result = await executeGovernedInternalActionAction({ permitId: item.permitId });
        setMessage(
          result.status === "executed"
            ? "Recorded. Hebun created one work item under your authorization; you authorized it, the system performed it."
            : /*
               * A refusal ABORTED the transaction that was spending the permit, so the
               * authorization is still the Director's to spend. Saying so is the difference
               * between a fixable condition and a lost decision.
               */
              `Not recorded (${result.reason}). Nothing was written, and the authorization is untouched.`,
        );
        return;
      }
      const result = await executeAuthorizedActionAction({ permitId: item.permitId });
      if (result.status === "refused") {
        /* Nothing was spent — the same permit can be executed once the cause is fixed. */
        setMessage(`Not executed (${result.reason}). The authorization is untouched.`);
        return;
      }
      setMessage(
        result.status === "refused-after-spend"
          ? `Refused after the authorization was spent (${result.attempt.failureClass}). Nothing was sent, and this permit cannot be reused.`
          : EXECUTION_OUTCOME_WORDING[result.attempt.status],
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

      {item.executionStatus === null ? (
        <p className="text-[0.65rem] text-fg-muted">{permitOutcomeSentence(item)}</p>
      ) : (
        <OutcomeLine status={item.executionStatus} providerMessageId={item.providerMessageId} />
      )}

      {item.revocationReason ? (
        <p className="text-[0.65rem] text-fg-muted">Revoked: {item.revocationReason}</p>
      ) : null}

      {/* Execute and Revoke exist only while the permit is live and unspent. */}
      {item.state === "active" ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={execute}
              className="rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-40"
            >
              Execute now
            </button>
            <span className="text-[0.65rem] text-fg-muted">
              {internal
                ? "Spends this authorization. The record can later be retired through the Work Authority — retirement is not erasure."
                : "Irreversible, and spends this authorization whether or not it succeeds."}
            </span>
          </div>
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
        </div>
      ) : null}
      {message ? <p className="text-xs text-fg-secondary">{message}</p> : null}
    </li>
  );
}

export function ActionAuthorizations({
  requests,
  permits,
  workOptions = [],
  connected,
  evaluatedAt = null,
  awaitingCount = null,
  oldestWaiting = null,
}: {
  readonly requests: readonly PendingActionRequestView[];
  readonly permits: readonly ActionPermitView[];
  /**
   * PBGA-1 — the work items a human may declare a pending request serves.
   *
   * A CLOSED LIST FROM THE WORK AUTHORITY, resolved on the server. A free-text field would make the
   * browser the source of a work identity; a picker means a declaration can only ever name work
   * this organization already recorded. Empty is honest: an organization with no work has nothing
   * to declare a purpose against.
   */
  readonly workOptions?: readonly { readonly workItemId: string; readonly title: string }[];
  readonly connected: boolean;
  /**
   * E2-4 — the ONE instant every duration on this surface is measured against, resolved on the
   * server. It is a prop rather than a `Date.now()` in here so the whole page shares one reading
   * and a test can pin it. `null` restores the released behaviour: no duration is shown at all.
   */
  readonly evaluatedAt?: string | null;
  /** The UNBOUNDED awaiting count. `requests.length` is capped and must never stand in for it. */
  readonly awaitingCount?: number | null;
  /** Elapsed since the oldest pending proposal, from the unbounded aggregate. Never from the list. */
  readonly oldestWaiting?: ElapsedObservation | null;
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
              <RequestCard
                key={r.requestId}
                item={r}
                waitingFor={
                  evaluatedAt
                    ? elapsedSince(r.proposedAt, evaluatedAt, "action-request.created_at")
                    : null
                }
                workOptions={workOptions}
              />
            ))}
          </ul>
        )}
        {/*
          THE OLDEST AND THE TOTAL COME FROM THE UNBOUNDED AGGREGATE, NEVER FROM THE LIST ABOVE.
          The list is `orderBy desc(created_at) limit 50`, so the oldest proposal is the first row
          it drops. Absent when that aggregate was not read — never computed from what is shown.
        */}
        {oldestWaiting ? (
          <p className="text-xs text-fg-muted">
            Oldest awaiting decision: {oldestWaiting.label}
            {awaitingCount !== null ? ` · ${awaitingCount} awaiting` : null}. Elapsed time
            only — Hebun holds no target or deadline for a human decision.
          </p>
        ) : null}

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
