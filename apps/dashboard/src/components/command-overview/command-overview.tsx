import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";

import { StateBlock } from "@/components/ui/state-block";
import { WorkspaceSection } from "@/components/ui/workspace-section";
import {
  PENDING_READ_BOUND,
  UNCONNECTED_CAPABILITIES,
  type ExpressIntentSummary,
  type WaitingOnYouState,
} from "@/features/command-overview/workspace-model";

/*
 * The canonical Command Overview (CMD-B1), composed for a Director (CMD-V3) — three sections, and
 * nothing else.
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
 * ── THE COMPOSITION, AND WHY IT IS NOT A RANKING OF IMPORTANCE ───────────────
 *
 * CMD-V3 gives the three sections three different visual weights, and the ordering is the AUTHORITY
 * ordering, not an editorial one. "Waiting on you" is the only tenant-scoped authoritative state on
 * the page, so it leads. "Express intent" is derived from a registry — a doorway, not organizational
 * state — so it follows in the same column. "Not yet connected" is a disclosure of what Hebun cannot
 * answer: it must stay visible and complete, and it must not be the first thing a Director's eye
 * lands on. At `xl` it moves into a narrower parallel column; below `xl` it simply follows.
 *
 * DOM ORDER NEVER CHANGES. Waiting, then intent, then disclosure — in the markup, at every width. The
 * columns are a flex direction, not a reordering, so a screen reader and a keyboard walk the page in
 * the order the authority model puts it in.
 *
 * NOTHING WAS DROPPED TO GAIN THE HEIGHT. All six capabilities keep their own reason; the empty
 * state keeps its words; the counts keep their derivation. What changed is room — `density`,
 * a column, and a grid — never content. Where compactness and truth were actually in tension, at
 * 390px, the measured height was reported rather than bought by hiding a reason.
 *
 * Presentational and server-safe. It reads nothing, resolves nothing, and grants nothing.
 */

/** The one link grammar this surface uses. A destination, never an act. */
const OUTBOUND =
  "inline-flex w-fit items-center gap-1 text-meta font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring";

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
        /*
          THE EYEBROW STAYS ON BOTH STATES. CMD-B1 carries the empty/unavailable distinction on three
          signals — icon, eyebrow word, border treatment — and `density` and `layout` were both added
          precisely so this section could be made shorter without spending one of them. `hideEyebrow`
          here would buy a few pixels with the word that tells a screen-reader user which of the two
          this is. In `row` the word moves to the end of the title line; it does not leave.

          BOTH STATES GET THE SAME ARRANGEMENT, ON PURPOSE. A reader compares them by remembering
          what the other one looked like, so giving the successful answer a status line and the
          unanswered read a panel would make the two differ in a way that has nothing to do with
          which is which.
        */
        <StateBlock
          density="compact"
          layout="row"
          tone="unavailable"
          title="Hebun could not read your authorization queue"
          description={`The durable read did not answer (${state.reason}). This is not an empty queue — Hebun does not currently know whether anything is waiting.`}
        />
      ) : state.status === "none-waiting" ? (
        <StateBlock
          density="compact"
          layout="row"
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
      <Link href="/approvals" className={OUTBOUND}>
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
        {/*
          A DOORWAY LEADS WITH THE DOOR, NOT WITH THE INVENTORY. As released, the first thing this
          section said at reading size was a count of registry entries — organizational-looking
          weight on a number that describes a source file. The registry sentence is unchanged and
          still here; it now reads at metadata size, below the sentence that says what the section
          is actually for. No number was removed, rounded, or re-derived.
        */}
        <p className="text-body leading-6 text-fg-secondary">
          Director Intent is where you ask Hebun to investigate or prepare something. Free text never
          reaches execution: every argument is typed, and every consequential act is gated to a human
          on Decisions.
        </p>
        <p className="text-meta leading-5 text-fg-secondary">
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
          Executed is not successful.
        </p>
        <Link href="/command/intent" className={OUTBOUND}>
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
        {/*
          THE SENTENCE SURVIVED; THE PANEL DID NOT. This was a `StateBlock` whose tone said
          "unavailable" beside a provenance chip that already says `not-connected` and six rows that
          now each say "Not connected" in their own summary — three statements of one fact, the
          largest of them a box. What the block uniquely carried was this sentence, so this sentence
          is what stayed, verbatim. Nothing here was shortened, softened, or turned into marketing.
        */}
        <p className="text-meta leading-5 text-fg-secondary">
          Each is listed with the reason it cannot be answered. None is shown as an empty result, a
          zero, or a placeholder figure, because Hebun does not know these facts — it is not that
          they are none.
        </p>
        {/*
          ── WHY `<details>`, AND WHY IT IS LAYERING RATHER THAN HIDING ───────────────────────────

          Measured, not assumed: at 390px these six reasons were 1,180px of a 2,416px page — a
          Director read half a screen of prose about what Hebun CANNOT do before reaching what it
          can. CMD-V3 reported that and refused to fix it by deleting a reason, which was right; the
          reason is the whole value of the disclosure, because "no source exists", "a contract
          exists but no runtime does" and "the only source is a seed, so it is withheld" are three
          different situations.

          So nothing is removed. Every capability NAME and every "Not connected" marker is on screen
          at all times, in the summary, at every width. Every reason is one keystroke away, in the
          same document, needing no navigation and no network. That is the difference between
          layering truth and hiding it.

          NATIVE, NOT REBUILT. `<details>`/`<summary>` is a disclosure widget the browser already
          gives keyboard operation, focus, and the expanded/collapsed state announcement. A div with
          `onClick` would need `aria-expanded`, `aria-controls`, a tabindex, key handlers, and would
          make this server component a client one. The native element costs none of that and this
          surface stays server-safe.

          IT IS ONLY EVER THE TERTIARY SECTION. Authoritative and derived content is never collapsed
          — a Director may not have to click to find out whether something is waiting on them.
        */}
        <ul className="grid min-w-0 grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 xl:grid-cols-1">
          {UNCONNECTED_CAPABILITIES.map((row) => (
            <li key={row.capability} className="min-w-0 bg-surface">
              <details className="group min-w-0">
                <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 p-3 transition-colors duration-(--dur-fast) hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-ring [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="size-3.5 shrink-0 text-fg-muted transition-transform duration-(--dur-fast) group-open:rotate-90"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 text-body font-medium text-fg">{row.capability}</span>
                  {/*
                    The state marker, on the closed row, as a WORD. Not a dot, not a colour, not a
                    tooltip — the same rule the shared state primitive follows one level up.
                  */}
                  <span className="shrink-0 text-meta text-fg-muted">Not connected</span>
                </summary>
                {/*
                  `pl-[34px]` is arithmetic, not a guess: the summary's own left padding (`p-3`, 12px)
                  plus the chevron (`size-3.5`, 14px) plus the gap (`gap-2`, 8px). The reason starts
                  exactly under the capability name it belongs to, so an opened row reads as one
                  block rather than two.
                */}
                <p className="px-3 pb-3 pl-[34px] text-meta leading-5 text-fg-secondary">
                  {row.reason}
                </p>
              </details>
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
    /*
      `items-start` is what makes the narrow column a column rather than a stretched panel: without
      it the flex row equalizes heights and the shorter side grows an empty tail.

      THE SPLIT IS AT `xl`, AND THAT WAS MEASURED, NOT PREFERRED. Inside this shell the canvas is the
      viewport less `--shell-nav-w` (316px) and the `lg` gutters (64px). At 1024 that leaves 644px,
      so a 320px aside would leave the PRIMARY column 292px — narrower than the thing it is meant to
      dominate. At 1280 it leaves 900px and the primary column keeps 548px; at 1440, 708px. So 1024
      stays one column because the arithmetic says so.

      THE ASIDE NARROWED FROM 360px TO 320px BECAUSE ITS CONTENT DID. CMD-V3 sized this column for
      six wrapped paragraphs; it now holds six one-line summaries, so the width that keeps them
      readable is smaller, and every pixel it gives back goes to the primary column. 320px is the
      floor of the approved band, not below it: a reason opened at this width still wraps at roughly
      forty characters, which is a column, not a sliver.
    */
    <div className="flex min-w-0 flex-col gap-6 lg:gap-8 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6 lg:gap-8">
        <WaitingOnYou state={waiting} />
        <ExpressIntent summary={intent} />
      </div>
      <div className="flex min-w-0 flex-col xl:w-[320px] xl:shrink-0">
        <NotYetConnected />
      </div>
    </div>
  );
}
