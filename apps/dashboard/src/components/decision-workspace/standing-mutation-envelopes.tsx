"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DecisionRegion, DecisionEmptyState } from "./decision-region";
import {
  authorizeStandingMutationAction,
  withdrawStandingMutationAction,
} from "@/app/(dashboard)/approvals/actions";
import type { StandingMutationView } from "@/features/standing-mutation-authority/read-standing-mutations.server";
import type {
  StandingMutationUnreachableReason,
  StandingMutationWriteRefusal,
} from "@/features/standing-mutation-authority/contracts";

/*
 * Standing envelopes (RUNG 2) — the human ingress to a bounded standing mutation authorization,
 * and the read of every envelope this organization has granted.
 *
 * ── THE ONE SENTENCE THIS SURFACE EXISTS TO MAKE UNMISSABLE ─────────────────
 *
 *     THIS AUTHORIZES FUTURE ACTS IN ADVANCE. IT IS NOT A HUMAN APPROVING EACH ONE.
 *
 * Every other control on this page decides ONE act that is already waiting. This one decides a
 * SHAPE of act that has not happened yet, and the permits it later produces will carry the
 * signer's name without the signer having read them. A surface that let that difference be
 * inferred — from a form that looks like the others, sitting above a queue of individual
 * decisions — would be the single most misleading screen in the product. So the claim is stated
 * before the form, restated on the button, and restated again on every issued-act count.
 *
 * ── WHY IT LIVES ON `/approvals` AND NOT ON A NEW ROUTE ─────────────────────
 *
 * This is the human authority surface: it is where a Governance holder already approves, refuses
 * and revokes. An envelope is the same kind of decision taken earlier, and the permits it issues
 * land in the queue directly below. Putting it anywhere else would mean a human authorizes in one
 * place and discovers the consequences in another. No new route, no eighth workspace.
 *
 * ── WHAT THE BROWSER MAY SAY, AND WHAT IT MAY NEVER SAY ─────────────────────
 *
 * It may name: one agent, one action kind, two instants, a quota, a cadence, a justification, and
 * the revision it was shown. It has no field for a tenant, an actor, a payload, a target, a work
 * title, a department, a provider, a credential, a permit or an act — an envelope authorizes a
 * SHAPE of future authorization and never a particular one.
 *
 * It CANNOT arm the deployment, enrol its own organization, widen the frozen action set, or issue
 * anything. This module does not import the issuing seam and could not: the RUNG 2 firewall pins
 * that no file under `src/app` or `src/components` may name it.
 *
 * ── EVERY UNREACHABLE STATE IS ITS OWN SENTENCE ─────────────────────────────
 *
 * "You withdrew this", "the window has not opened", "the window closed", "the quota is spent",
 * "the agent is out of service", "your organization is not enrolled" and "an operator stopped
 * everything" are seven different facts calling for seven different responses. The reader keeps
 * them apart and so does this. AMA-4 had to repair exactly this collapse at its own gate.
 */

/** The action kind offered. The released frozen set has exactly one member; this is not a widening. */
const OFFERED_ACTION_KIND = "record-work" as const;

const MIN_JUSTIFICATION = 12;
const MAX_JUSTIFICATION = 2000;

/*
 * WHY EACH ENVELOPE CANNOT FIRE, as a human is told it. One sentence per fact, and each says what
 * the reader would have to do about it — a reason a person cannot act on is a reason not worth
 * rendering.
 */
const UNREACHABLE_WORDING: Readonly<Record<StandingMutationUnreachableReason, string>> = {
  withdrawn: "You withdrew this envelope. It authorizes nothing, and permits it already issued are unaffected.",
  expired: "The validity window has closed. Nothing further can be issued under it.",
  "not-yet-valid": "The validity window has not opened yet. Nothing can be issued until it does.",
  exhausted: "Every act this envelope allows has been issued. Nothing further can be.",
  "root-control-disabled":
    "An operator has stopped machine execution for this whole deployment, so nothing can be issued or performed under any envelope.",
  "tenant-not-enrolled":
    "This organization has not enrolled in machine execution for this action, so nothing can be issued under this envelope.",
  "agent-not-in-service": "The agent this envelope names is no longer in service, so it can issue nothing.",
};

/** One honest sentence per refusal. Nothing here implies an envelope, permit or act was created. */
const REFUSAL_WORDING: Readonly<Record<StandingMutationWriteRefusal, string>> = {
  unauthenticated: "Sign in to authorize a standing envelope.",
  "no-governance-authority":
    "This organization has no Governance authority on record, so no standing decision can be taken.",
  "not-the-governance-authority":
    "You do not hold Governance authority in this organization. Nothing was written.",
  "justification-required": "State why this envelope is warranted. Nothing was written.",
  "agent-unresolvable": "That agent does not belong to this organization. Nothing was written.",
  "agent-not-in-service":
    "That agent has been retired. An envelope for an agent out of service would authorize nothing, so nothing was written.",
  "unsupported-action-kind":
    "That action is outside the frozen set a machine may perform. Nothing was written, and this surface cannot widen that set.",
  "invalid-envelope":
    "The window, quota or interval is missing or outside the permitted bounds. Nothing was written.",
  "already-authorized":
    "An active envelope already stands for this agent. Withdraw it before authorizing a different one — a second decision that changed nothing would only make the ledger harder to read.",
  "no-active-authorization":
    "No active envelope stands for this agent, so there is nothing to withdraw. Nothing was written.",
  "stale-authorization-revision":
    "This envelope changed while you were reading it. Nothing was written — reload and decide against what stands now.",
  "persistence-unavailable":
    "Hebun could not reach its own durable store, so nothing was written. This is an outage, not a refusal.",
};

type Outcome =
  | { readonly kind: "idle" }
  | { readonly kind: "authorized"; readonly revision: number }
  | { readonly kind: "withdrawn"; readonly revision: number }
  | { readonly kind: "refused"; readonly reason: StandingMutationWriteRefusal };

/** `YYYY-MM-DDTHH:mm` — what `datetime-local` speaks. Rendered from the server-resolved instant. */
function toLocalInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function formatInstant(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function StandingMutationEnvelopes({
  items,
  connected,
  agentOptions,
  maxActsCeiling,
  minIntervalCeilingMinutes,
}: {
  readonly items: readonly StandingMutationView[];
  /**
   * Whether the durable read actually ANSWERED — not whether rows exist. An empty register and an
   * unreadable one are different truths, and collapsing them is the class of lie this surface was
   * built to avoid.
   */
  readonly connected: boolean;
  /** In-service agents only. Offering a retired one would offer an envelope that authorizes nothing. */
  readonly agentOptions: readonly { readonly agentId: string; readonly name: string }[];
  readonly maxActsCeiling: number;
  readonly minIntervalCeilingMinutes: number;
}) {
  const router = useRouter();
  const [agentId, setAgentId] = useState("");
  const [notBefore, setNotBefore] = useState(() => toLocalInput(new Date()));
  const [notAfter, setNotAfter] = useState(() => toLocalInput(new Date(Date.now() + 7 * 86_400_000)));
  const [maxActs, setMaxActs] = useState("5");
  const [minInterval, setMinInterval] = useState("60");
  const [justification, setJustification] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  /* The revision the human is being shown for the chosen agent, or `null` for "none stands". */
  const shownRevision = items.find((item) => item.agentId === agentId)?.authorizationRevision ?? null;

  const ready =
    agentId.length > 0 &&
    justification.trim().length >= MIN_JUSTIFICATION &&
    justification.length <= MAX_JUSTIFICATION &&
    notBefore.length > 0 &&
    notAfter.length > 0;

  const authorize = () =>
    startTransition(async () => {
      setOutcome({ kind: "idle" });
      const result = await authorizeStandingMutationAction({
        agentId,
        actionKind: OFFERED_ACTION_KIND,
        notBefore: new Date(notBefore).toISOString(),
        notAfter: new Date(notAfter).toISOString(),
        maxActs: Number(maxActs),
        minIntervalMinutes: Number(minInterval),
        justification,
        observedRevision: shownRevision,
      });
      if (result.status === "written") {
        setOutcome({ kind: "authorized", revision: result.authorizationRevision });
        setJustification("");
        router.refresh();
        return;
      }
      setOutcome({ kind: "refused", reason: result.reason });
    });

  const withdraw = (item: StandingMutationView) =>
    startTransition(async () => {
      setOutcome({ kind: "idle" });
      const result = await withdrawStandingMutationAction({
        agentId: item.agentId,
        justification,
        observedRevision: item.authorizationRevision,
      });
      if (result.status === "written") {
        setOutcome({ kind: "withdrawn", revision: result.authorizationRevision });
        setJustification("");
        router.refresh();
        return;
      }
      setOutcome({ kind: "refused", reason: result.reason });
    });

  return (
    <DecisionRegion title="Standing envelopes" eyebrow="Authorized in advance" accent>
      <div className="flex flex-col gap-4">
        {/*
         * THE CLAIM, BEFORE THE FORM AND BEFORE THE LIST. A reader who stops here must already
         * have been told the one thing that distinguishes this control from every other on the
         * page.
         */}
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-fg-primary">
          <span className="font-medium">
            A standing envelope authorizes future acts IN ADVANCE, inside bounds you choose.
          </span>{" "}
          It does <span className="font-medium">not</span> mean a human approved each act
          individually. Permits issued under it will carry your name as the authorizer — accurately,
          because you authorized them here — and you will not have read them first. You can withdraw
          an envelope at any time; withdrawing stops future issuance and leaves permits already
          issued alone.
          <span className="mt-1 block text-xs text-fg-secondary">
            An envelope performs nothing when you sign it. It mints no permit, records no work and
            reaches no provider. It cannot arm this deployment, enrol this organization, or widen
            what a machine may do.
          </span>
        </p>

        {/* ── PHASE 2 · WHAT STANDS TODAY ─────────────────────────────────── */}
        {!connected ? (
          <DecisionEmptyState
            title="Standing envelopes could not be read"
            tone="blocked"
            detail="Hebun could not reach its own durable store, so this register is unknown rather than empty. Nothing here says an envelope does or does not exist."
          />
        ) : items.length === 0 ? (
          <DecisionEmptyState
            title="No standing envelope has ever been authorized"
            detail="Every act in this organization is still decided one at a time, by a human, in the queue below."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.authorizationId} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-fg-primary">
                    {item.agentName ?? "An agent of this organization"} — {item.actionKind}
                  </span>
                  <span className="text-xs text-fg-secondary">
                    revision {item.authorizationRevision} · {item.state}
                  </span>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-fg-secondary sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-fg-primary">Valid from</dt>
                    <dd>{formatInstant(item.notBefore)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-fg-primary">Valid until</dt>
                    <dd>{formatInstant(item.notAfter)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-fg-primary">Acts used</dt>
                    {/* DERIVED from the permits this envelope issued — never a stored tally. */}
                    <dd>
                      {item.actsIssued} of {item.maxActs} · {item.remaining} remaining
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-fg-primary">No faster than</dt>
                    <dd>one act per {item.minIntervalMinutes} minutes</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-fg-primary">Last issued</dt>
                    <dd>{item.lastIssuedAt ? formatInstant(item.lastIssuedAt) : "never"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-fg-primary">Evidence required</dt>
                    {/*
                     * The closed admitted set, stated as the requirement it is. A proposal carrying
                     * no stored provider observation is refused issuance — the envelope authorizes
                     * a class of EVIDENCED acts, not a quota to spend freely.
                     */}
                    <dd>a stored provider observation</dd>
                  </div>
                </dl>

                <p className="mt-2 text-xs text-fg-secondary">
                  Authorized by a human of this organization at {formatInstant(item.authorizedAt)},
                  recorded as Governance decision {item.governanceDecisionId}.
                </p>

                {/* EFFECTIVE REACHABILITY — this instant, never a promise about the next. */}
                <p className="mt-2 text-xs text-fg-primary">
                  {item.reachability.status === "reachable" ? (
                    <>
                      <span className="font-medium">Can issue right now.</span> The issuing authority
                      re-decides every clause of this against freshly read rows before anything is
                      written.
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Cannot issue right now.</span>{" "}
                      {UNREACHABLE_WORDING[item.reachability.reason]}
                    </>
                  )}
                </p>

                {item.state === "active" ? (
                  <button
                    type="button"
                    disabled={pending || justification.trim().length < MIN_JUSTIFICATION}
                    onClick={() => withdraw(item)}
                    className="mt-3 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg-primary disabled:opacity-50"
                  >
                    {pending ? "Recording…" : "Withdraw this envelope"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* ── PHASE 1 · AUTHORIZING ONE ───────────────────────────────────── */}
        {agentOptions.length === 0 ? (
          <DecisionEmptyState
            title="No agent is in service"
            detail="An envelope names exactly one agent. This organization has none in service, so there is nothing an envelope could authorize."
          />
        ) : (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <span className="text-xs font-medium text-fg-primary">Authorize a standing envelope</span>

            <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="sme-agent">
              Agent — exactly one, never a class
              <select
                id="sme-agent"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-primary"
              >
                <option value="">Choose an agent</option>
                {agentOptions.map((option) => (
                  <option key={option.agentId} value={option.agentId}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            {/*
             * THE ACTION KIND IS SHOWN, NOT CHOSEN. The released frozen machine-executable set has
             * exactly one member. A dropdown here would imply a choice the system does not offer
             * and would be the first place a widening could be smuggled in.
             */}
            <p className="text-xs text-fg-secondary">
              Action authorized: <span className="font-medium text-fg-primary">record-work</span>{" "}
              only. This is the entire set of actions a machine may perform in this deployment, and
              this surface cannot add to it.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="sme-from">
                Valid from
                <input
                  id="sme-from"
                  type="datetime-local"
                  value={notBefore}
                  onChange={(event) => setNotBefore(event.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="sme-until">
                Valid until
                <input
                  id="sme-until"
                  type="datetime-local"
                  value={notAfter}
                  onChange={(event) => setNotAfter(event.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="sme-max">
                Maximum acts (1–{maxActsCeiling})
                <input
                  id="sme-max"
                  type="number"
                  min={1}
                  max={maxActsCeiling}
                  value={maxActs}
                  onChange={(event) => setMaxActs(event.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="sme-interval">
                Minimum minutes between acts (1–{minIntervalCeilingMinutes})
                <input
                  id="sme-interval"
                  type="number"
                  min={1}
                  max={minIntervalCeilingMinutes}
                  value={minInterval}
                  onChange={(event) => setMinInterval(event.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-primary"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="sme-why">
              Why this envelope is warranted — recorded on the Governance decision
              <textarea
                id="sme-why"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                rows={3}
                maxLength={MAX_JUSTIFICATION}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-primary"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!ready || pending}
                onClick={authorize}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg-primary disabled:opacity-50"
              >
                {pending ? "Recording…" : "Authorize acts in advance"}
              </button>
              <span className="text-xs text-fg-secondary">
                This records a Governance decision. It performs nothing.
              </span>
            </div>
          </div>
        )}

        {outcome.kind === "authorized" ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-fg-primary">
            <span className="font-medium">Envelope authorized as revision {outcome.revision}.</span>{" "}
            Nothing has been issued, recorded or performed. Acts become permits only when this
            agent&rsquo;s own evidenced proposals arrive and the issuing authority finds them inside
            these bounds.
          </p>
        ) : null}

        {outcome.kind === "withdrawn" ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-fg-primary">
            <span className="font-medium">Envelope withdrawn as revision {outcome.revision}.</span>{" "}
            Nothing further will be issued under it. Permits it already issued are unchanged and
            keep their own expiry and revocation.
          </p>
        ) : null}

        {outcome.kind === "refused" ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-fg-primary">
            {REFUSAL_WORDING[outcome.reason]}
          </p>
        ) : null}
      </div>
    </DecisionRegion>
  );
}
