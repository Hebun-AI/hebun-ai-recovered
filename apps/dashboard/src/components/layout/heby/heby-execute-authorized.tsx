"use client";

/*
 * heby-execute-authorized.tsx — HEBY-EXECUTE-AUTHORIZED-1: perform an act a human already authorized,
 * from where the person asked for it, instead of sending them to Approvals for the last click.
 *
 * ── THE SAME HUMAN ACT, NOT A NEW AUTHORITY ──────────────────────────────────
 *
 *   it is offered only for a request whose permit is ACTIVE — a human decision already exists;
 *   it calls the two NAMED server actions Approvals calls (record-work, set-work-declared-state), with
 *   the permit id as the only input; the server resolves the tenant from the session and refuses
 *   anyone who does not hold this tenant's Governance authority, exactly as from Approvals;
 *   it is a click by the signed-in person, behind a second, explicit confirmation — no model, no
 *   agent, no effect, no timer reaches it, and nothing runs on render;
 *   it shows no outcome of its own: after an executed act the caller re-reads the request's lifecycle
 *   and the sentence comes from the Action Authorization and Work records, as before.
 *
 * Deciding, revoking and external sends stay in Approvals. A `send` is irreversible and armed per
 * deployment; it is deliberately not offered here.
 */
import { useState, useTransition } from "react";
import {
  executeGovernedInternalActionAction,
  executeGovernedWorkStateChangeAction,
} from "@/app/(dashboard)/approvals/actions";
import {
  RECORD_WORK_ACTION_KIND,
  SET_WORK_DECLARED_STATE_ACTION_KIND,
} from "@/features/heby-action-inlet/contracts";
import type { ActionRequestLifecycleView } from "@/features/action-authorization/read-action-authorizations.server";

/** The only kinds this control performs. A closed list, read from the kind — never a dispatcher over rows. */
export const HEBY_EXECUTABLE_KINDS: readonly string[] = Object.freeze([RECORD_WORK_ACTION_KIND, SET_WORK_DECLARED_STATE_ACTION_KIND]);

/** Offered only when a human decision minted a permit that is still active, for a kind listed above. */
export function executableFromHeby(view: ActionRequestLifecycleView): boolean {
  return view.decision.status === "approved" && view.permit?.state === "active" && HEBY_EXECUTABLE_KINDS.includes(view.actionKind);
}

/** Why the server did not perform it. Every refusal leaves the authorization unspent. */
const REFUSAL_WORDING: Readonly<Record<string, string>> = {
  unauthenticated: "Your session could not be confirmed.",
  "permit-not-consumable": "This authorization can no longer be used — it was already used, expired or revoked.",
  "no-governance-authority": "This organization has no Governance authority Hebun can read, so nothing can be performed.",
  "not-the-governance-authority": "Only the person holding this organization's Governance authority can perform it.",
  "agent-not-in-service": "The agent that proposed it is no longer in service.",
  "agent-mandate-refused": "The proposing agent's mandate no longer covers it.",
};

export function HebyExecuteAuthorized({
  view,
  onExecuted,
}: {
  readonly view: ActionRequestLifecycleView;
  /** Re-read the lifecycle. The outcome is shown from that read, never from this click. */
  readonly onExecuted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!executableFromHeby(view) || view.permit === null) return null;
  const permitId = view.permit.permitId;

  const perform = () =>
    start(async () => {
      try {
        const result =
          view.actionKind === SET_WORK_DECLARED_STATE_ACTION_KIND
            ? await executeGovernedWorkStateChangeAction({ permitId })
            : await executeGovernedInternalActionAction({ permitId });
        if (result.status === "executed") {
          setRefusal(null);
          setConfirming(false);
          onExecuted();
          return;
        }
        setRefusal(
          `Not performed. ${REFUSAL_WORDING[result.reason] ?? "Hebun refused it."}${
            result.authorityReason ? ` (${result.authorityReason})` : ""
          } The authorization was not used.`,
        );
      } catch {
        setRefusal("Hebun could not reach the server. Whether it was performed is unknown — refresh to read the request again.");
      }
    });

  return (
    <div className="mt-1" data-heby-execute-authorized={view.requestId}>
      {confirming ? (
        <>
          <p className="text-fg">
            Perform this now, under the authorization a human granted? It changes the work register and cannot be
            undone here.
          </p>
          <div className="mt-1 flex gap-3">
            <button type="button" className="rounded text-[0.72rem] underline disabled:opacity-50" disabled={pending} onClick={perform}>
              {pending ? "Performing…" : "Yes, perform it"}
            </button>
            <button type="button" className="rounded text-[0.72rem] text-fg-muted disabled:opacity-50" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="rounded text-[0.72rem] underline" onClick={() => setConfirming(true)}>
          Perform it here
        </button>
      )}
      {refusal ? <p role="status">{refusal}</p> : null}
    </div>
  );
}
