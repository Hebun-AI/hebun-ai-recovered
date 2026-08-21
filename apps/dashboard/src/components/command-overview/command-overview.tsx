import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { StateBlock } from "@/components/ui/state-block";
import { WorkspaceSection } from "@/components/ui/workspace-section";
import {
  PENDING_READ_BOUND,
  UNCONNECTED_CAPABILITIES,
  type ExpressIntentSummary,
  type WaitingOnYouState,
} from "@/features/command-overview/workspace-model";

/*
 * The canonical Command Overview (CMD-B1) — three sections, and nothing else.
 *
 * ── WHY THIS IS THIN ─────────────────────────────────────────────────────────
 *
 * The Overview it replaces rendered eight operational cells, an executive state strip, a decision
 * pressure panel and an advisory strip. Measured authenticated, every one of them was UNAVAILABLE
 * for a real tenant, and the strip printed "0 critical · 0 warning · 0 AGENTS · 0 WORKFLOWS" over a
 * projection its own adapter had deliberately WITHHELD — the adapter's comment reads "WITHHELD, NOT
 * ZEROED… A fabricated zero would be its own lie." The adapter was right; the presentation put the
 * zero back.
 *
 * What replaces it is one connected section, one derived section, and one honest disclosure. That
 * is not a smaller ambition; it is the whole of what this system can currently prove.
 *
 * ── WHAT EACH SECTION MAY CLAIM ──────────────────────────────────────────────
 *
 *   Waiting on you     AUTHORITATIVE about the action-authorization store — never about Command.
 *                      Bounded: `shown`, never a total. Routes to the act; never offers it.
 *   Express intent     DERIVED from the declared action registry. Declared is not invokable.
 *   Not yet connected  NOT-CONNECTED, with the real reason per capability, never one grey sentence.
 *
 * Provenance is not decoration here: `WorkspaceSection` makes it a required field, so a section
 * cannot be added to this page without answering where its content came from.
 *
 * Presentational and server-safe. It reads nothing, resolves nothing, and grants nothing.
 */

function ordinaryDate(iso: string): string {
  /* Deterministic and locale-free: a timestamp is evidence, not a greeting. */
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function WaitingOnYou({ state }: { state: WaitingOnYouState }) {
  return (
    <WorkspaceSection
      id="waiting"
      title="Waiting on you"
      question="What is waiting for a human decision in this organization?"
      provenance="authoritative"
      provenanceDetail="the action authorization store, scoped to this tenant"
      actions={
        state.status === "waiting" ? (
          <span className="text-meta font-medium text-fg-secondary">
            {state.items.length} shown
          </span>
        ) : null
      }
    >
      {state.status === "unavailable" ? (
        <StateBlock
          tone="unavailable"
          title="Hebun could not read your authorization queue"
          description={`The durable read did not answer (${state.reason}). This is not an empty queue — Hebun does not currently know whether anything is waiting.`}
        />
      ) : state.status === "none-waiting" ? (
        <StateBlock
          tone="empty"
          title="Nothing is waiting for a human decision"
          description="The authorization store answered, and it holds no pending consequential action for this organization. When Heby prepares one, it appears here and is decided on Decisions."
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <ul className="flex min-w-0 flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {state.items.map((item) => (
              <li key={item.requestId} className="flex min-w-0 flex-col gap-1 p-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-body font-semibold text-fg">{item.actionKind}</span>
                  {item.targetLabel ? (
                    <span className="text-meta text-fg-secondary">{item.targetLabel}</span>
                  ) : null}
                  <span className="text-meta text-fg-muted">{ordinaryDate(item.proposedAt)}</span>
                </div>
                <p className="text-meta leading-5 text-fg-secondary">{item.expectedEffect}</p>
              </li>
            ))}
          </ul>
          {state.boundReached ? (
            <p className="text-meta text-fg-muted">
              This read is bounded at {PENDING_READ_BOUND} and came back full, so there may be more
              than is shown here. Decisions holds the queue.
            </p>
          ) : null}
        </div>
      )}

      {/*
        THE ACT IS NOT HERE, AND NEITHER IS THE AUTHORITY TO TAKE IT. Reading this queue needs a
        tenant. Authorizing needs Governance, resolved server-side on Decisions — and a signed-in
        member can read a queue they are not the authority for. So this says where the act lives; it
        does not say the reader may take it.
      */}
      <p className="text-meta leading-5 text-fg-muted">
        Authorizing, refusing or revoking happens on Decisions, under Governance authority. Command
        neither holds that authority nor checks it.
      </p>
      <Link
        href="/approvals"
        className="inline-flex w-fit items-center gap-1 text-meta font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        Open Decisions
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </WorkspaceSection>
  );
}

function ExpressIntent({ summary }: { summary: ExpressIntentSummary }) {
  return (
    <WorkspaceSection
      id="intent"
      title="Express intent"
      question="What can you ask Hebun to investigate or prepare?"
      provenance="derived"
      provenanceDetail="counted from the declared action registry"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-body leading-6 text-fg-secondary">
          {summary.declared} actions are declared. {summary.invokableNow} can run now — read-only
          ones with a connected substrate. {summary.connectedMutations} consequential action has a
          substrate at all, and having one is not being armed, authorized, or executed.
        </p>
        {/*
          The five states this product refuses to collapse, stated where a reader meets them. Each
          step is a different fact and a different owner; the registry can only ever answer the
          first two.
        */}
        <p className="text-meta leading-5 text-fg-muted">
          Declared is not invokable. Invokable is not authorized. Authorized is not executed.
          Executed is not successful. Free text never reaches execution: every argument is typed and
          every consequential act is gated to a human on Decisions.
        </p>
        <Link
          href="/command/intent"
          className="inline-flex w-fit items-center gap-1 text-meta font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
        >
          Open Director Intent
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </WorkspaceSection>
  );
}

function NotYetConnected() {
  return (
    <WorkspaceSection
      id="not-connected"
      title="Not yet connected"
      question="What will Command answer once these sources exist?"
      provenance="not-connected"
      provenanceDetail="no source is connected for any capability listed here"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <StateBlock
          tone="unavailable"
          hideEyebrow
          title="Six executive capabilities have no connected source"
          description="Each is listed with the reason it cannot be answered. None is shown as an empty result, a zero, or a placeholder figure, because Hebun does not know these facts — it is not that they are none."
        />
        <ul className="flex min-w-0 flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {UNCONNECTED_CAPABILITIES.map((row) => (
            <li key={row.capability} className="flex min-w-0 flex-col gap-1 p-3">
              <span className="text-body font-medium text-fg">{row.capability}</span>
              <p className="text-meta leading-5 text-fg-secondary">{row.reason}</p>
            </li>
          ))}
        </ul>
      </div>
    </WorkspaceSection>
  );
}

export function CommandOverview({
  waiting,
  intent,
}: {
  waiting: WaitingOnYouState;
  intent: ExpressIntentSummary;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
      <WaitingOnYou state={waiting} />
      <ExpressIntent summary={intent} />
      <NotYetConnected />
    </div>
  );
}
