import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  ClipboardCheck,
  Database,
  ListChecks,
  LockKeyhole,
  Send,
} from "lucide-react";

import { ProvenanceChip, type Provenance } from "@/components/ui/provenance-chip";
import { TONES } from "@/components/ui/state-block";
import { cn } from "@/lib/utils";
import {
  PENDING_READ_BOUND,
  UNCONNECTED_CAPABILITIES,
  type ExpressIntentSummary,
  type WaitingOnYouState,
} from "@/features/command-overview/workspace-model";

/*
 * The Command Overview — an operating surface (CMD-FINAL).
 *
 * ── THE DEFECT FIVE PHASES TOOK TO NAME ──────────────────────────────────────
 *
 * CMD-B1 established what this page may CLAIM, and every phase since has been about what it LOOKS
 * like. CMD-V3 gave it a primary column and a tertiary rail. CMD-V4 layered the disclosure so six
 * architectural reasons stopped being half the page. CMD-V5 then tried to fix the remaining problem
 * with typography — smaller labels, no rules, provenance moved below — and FAILED its visual
 * acceptance, correctly. The measured verdict was that a normal person would see "they changed some
 * typography", not a redesign.
 *
 * The reason is worth writing down, because it was structural and four phases missed it:
 *
 *   THREE SECTIONS WITH DIFFERENT SEMANTIC ROLES WERE RENDERING THROUGH ONE VISIBLE GRAMMAR.
 *
 * `WorkspaceSection` gives every region the same skeleton — heading, question, provenance, rule,
 * content. That is the correct grammar for a workspace built out of comparable regions, which is
 * what `/knowledge` is. It is the wrong grammar for a page whose three answers are an operating
 * STATE, an ACTION, and a COVERAGE LIMIT. Restyling one skeleton cannot express three roles, and
 * CMD-V5 is the proof: every metric it set out to move, moved, and the page still read as a
 * document.
 *
 * ── WHAT REPLACED IT ─────────────────────────────────────────────────────────
 *
 *   Waiting on you     an unboxed STATEMENT. The answer is the largest text on the page after the
 *                      workspace identity, set directly on the canvas with its state mark beside
 *                      it. No card: a card is the right shape for "this region is empty" and the
 *                      wrong shape for "here is where your organization stands".
 *   Express intent     a DOORWAY. One line of what it is for, then a bordered destination block —
 *                      the only affordance of its kind on the page. It navigates and does nothing
 *                      else, which is why it is an anchor and not a button.
 *   Not yet connected  an INVENTORY. Six names first, doctrine after. What Hebun cannot answer is
 *                      a list of capabilities, not an essay with a list at the end.
 *
 * They share a scaffold — `CommandRegion` below — and share the tone table, the provenance chip and
 * the type scale. They do not share a body grammar, and that is the whole change.
 *
 * ── WHY THE SCAFFOLD IS LOCAL ────────────────────────────────────────────────
 *
 * `WorkspaceSection` keeps its one remaining consumer and its released rendering, untouched. Adding
 * a Command-shaped variant to it would put this page's semantics inside a primitive that another
 * workspace depends on — and CMD-V5 already tried exactly that. `CommandRegion` is nine lines, it
 * lives here, and it keeps the one guarantee that mattered: PROVENANCE IS A REQUIRED PROP, so a
 * region cannot be added to this page without answering where its content came from.
 *
 * ── THE QUESTIONS ARE STILL HERE, AND NO LONGER ON SCREEN ────────────────────
 *
 * Each region still declares the question it answers, and each is attached to its `<section>` by
 * `aria-describedby`. A screen reader still hears "What is waiting for a human decision in this
 * organization?"; a sighted Director no longer reads three of them before reaching any state. That
 * was the strongest documentary signal the visual acceptance identified, and it is the one thing
 * here that is hidden from sight rather than merely demoted — deliberately, and only because the
 * heading beside it already says the same thing in fewer words.
 *
 * Presentational and server-safe. It reads nothing, resolves nothing, and grants nothing.
 */

function ordinaryDate(iso: string): string {
  /* Deterministic and locale-free: a timestamp is evidence, not a greeting. */
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

/**
 * The scaffold all three regions share: identity, an accessible description, content, and a source.
 *
 * `provenance` is REQUIRED, which is the property this borrows from `WorkspaceSection` and the only
 * one worth borrowing. The chip keeps a row of its OWN in every region — never opposite the
 * heading, which is the `/finance` defect measured at 158.3px of a 197px row against a title
 * needing 93px — and it sits after the content it qualifies, because it describes that content.
 */
function CommandRegion({
  id,
  title,
  question,
  provenance,
  provenanceDetail,
  actions,
  children,
  className,
  bodyClassName,
}: {
  readonly id: string;
  readonly title: string;
  /** Answered by this region. Announced, not printed — see the header. */
  readonly question: string;
  readonly provenance: Provenance;
  readonly provenanceDetail?: string;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly bodyClassName?: string;
}) {
  const describedBy = `${id}-question`;
  return (
    <section
      id={id}
      aria-label={title}
      aria-describedby={describedBy}
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 text-meta font-semibold uppercase tracking-[0.08em] text-fg-muted">
          {title}
        </h2>
        {actions ? <div className="flex min-w-0 shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <p id={describedBy} className="sr-only">
        {question}
      </p>
      <div className={cn("flex min-w-0 flex-col gap-4", bodyClassName)}>
        {children}
        <div className="flex min-w-0 flex-wrap items-center gap-2 pt-1">
          <ProvenanceChip kind={provenance} detail={provenanceDetail} />
        </div>
      </div>
    </section>
  );
}

/**
 * The operating statement. Mark, answer, and one clause form the focal signal inside Command's
 * primary operating module.
 *
 * The tone's mark and the tone's WORD both come from the shared table, so `empty` and `unavailable`
 * remain two renderings that a reader can tell apart without colour: a different glyph, a different
 * word, and a different sentence. What is deliberately NOT here is the container border, which is
 * the third carrier the boxed primitive uses — the word moved up beside the label to replace it,
 * where it is more legible than it was inside the card.
 */
function OperatingStatement({
  tone,
  title,
  detail,
  compact = false,
}: {
  readonly tone: "empty" | "unavailable";
  readonly title: string;
  readonly detail: string;
  readonly compact?: boolean;
}) {
  const spec = TONES[tone];
  const Mark = spec.icon;
  return (
    <div data-state-tone={tone} className={cn("flex min-w-0 items-start", compact ? "gap-3" : "gap-4")}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center ring-1 ring-inset ring-current/10",
          compact ? "size-9 rounded-lg" : "size-12 rounded-xl",
          spec.badge,
        )}
        aria-hidden="true"
      >
        <Mark className={compact ? "size-4" : "size-6"} />
      </span>
      <div className={cn("flex min-w-0 flex-col", compact ? "gap-1" : "gap-2")}>
        <h3 className={cn("font-semibold leading-tight text-fg text-balance", compact ? "text-title" : "text-display")}>{title}</h3>
        <p className={cn("max-w-2xl text-fg-secondary text-pretty", compact ? "text-meta leading-5" : "text-body leading-6")}>{detail}</p>
      </div>
    </div>
  );
}

function WaitingOnYou({ state, className }: { state: WaitingOnYouState; className?: string }) {
  const isEmpty = state.status === "none-waiting";
  return (
    <CommandRegion
      id="waiting"
      title="Waiting on you"
      question="What is waiting for a human decision in this organization?"
      provenance="authoritative"
      provenanceDetail="the action authorization store, scoped to this tenant"
      className={className}
      bodyClassName={cn(
        "flex-1",
        isEmpty
          ? "gap-3 border-t border-border pt-4"
          : "rounded-xl border border-primary/20 bg-primary-subtle/35 p-5 shadow-sm lg:p-6",
      )}
      actions={
        <span className="text-meta font-medium uppercase tracking-[0.08em] text-fg-muted">
          {state.status === "waiting"
            ? `${state.items.length} shown`
            : TONES[state.status === "unavailable" ? "unavailable" : "empty"].eyebrow}
        </span>
      }
    >
      {state.status === "unavailable" ? (
        <OperatingStatement
          tone="unavailable"
          title="Hebun could not read your authorization queue"
          detail={`The durable read did not answer (${state.reason}). This is not an empty queue — Hebun does not currently know whether anything is waiting.`}
        />
      ) : state.status === "none-waiting" ? (
        <OperatingStatement
          tone="empty"
          compact
          title="Nothing currently requires your decision"
          detail="The authorization store answered with no pending consequential action for this organization."
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

      <Link
        href="/approvals"
        className={cn(
          "group mt-auto flex min-w-0 items-center gap-2 font-semibold text-primary transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
          isEmpty
            ? "w-fit rounded-md px-1 py-1 text-meta hover:text-primary-hover"
            : "justify-between rounded-lg border border-primary/20 bg-surface/80 px-4 py-3 text-body hover:bg-surface",
        )}
      >
        Open Decisions
        <ArrowRight
          className="size-4 shrink-0 transition-transform duration-(--dur-fast) group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
      {/*
        THE ACT IS NOT HERE, AND NEITHER IS THE AUTHORITY TO TAKE IT. Reading this queue needs a
        tenant. Authorizing needs Governance, resolved server-side on Decisions — and a signed-in
        member can read a queue they are not the authority for. So this says where the act lives; it
        does not say the reader may take it. It reads at metadata size because it qualifies the
        route above it, and a Director meets the state before meeting the boundary around it.
      */}
      <p className="max-w-2xl text-meta leading-5 text-fg-muted">
        Decisions owns authorization under Governance authority. Command neither holds that authority
        nor checks it.
      </p>
    </CommandRegion>
  );
}

function ExpressIntent({ summary }: { summary: ExpressIntentSummary }) {
  return (
    <CommandRegion
      id="intent"
      title="Express intent"
      question="What can you ask Hebun to investigate or prepare?"
      provenance="derived"
      provenanceDetail="counted from the declared action registry"
      className="min-h-full"
      bodyClassName="flex-1 rounded-2xl border border-primary/30 bg-surface p-6 shadow-sm ring-1 ring-primary/5 lg:p-8"
    >
      <span
        className="flex size-12 min-w-0 items-center justify-center rounded-xl bg-primary-subtle text-primary ring-1 ring-inset ring-primary/15"
        aria-hidden="true"
      >
        <Send className="size-6" />
      </span>
      <h3 className="max-w-xl text-display font-semibold leading-tight text-fg text-balance">
        Tell Hebun the outcome you want.
      </h3>
      <p className="max-w-xl text-body leading-6 text-fg-secondary">
        Director Intent is where you ask Hebun to investigate or prepare. It plans within declared
        capability boundaries; consequential decisions remain human-authorized.
      </p>
      {/*
        THE DOORWAY, AND WHY IT IS AN ANCHOR. This is the only bordered affordance on the page, which
        is what makes the second question answerable at a glance instead of at the end of two
        paragraphs. It is an `<a>` to the canonical inlet and nothing else: no form, no field, no
        submit, no execution. Clicking it opens Director Intent — it does not ask Hebun for anything,
        and the sentence beneath it says so in the product's own released words.
      */}
      <Link
        href="/command/intent"
        className="group flex w-full max-w-xl min-w-0 items-center justify-between gap-3 rounded-lg bg-primary px-5 py-3.5 text-body font-semibold text-on-primary shadow-sm transition-colors duration-(--dur-fast) hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        Open Director Intent
        <ArrowRight
          className="size-4 shrink-0 transition-transform duration-(--dur-fast) group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
      <ul className="grid min-w-0 grid-cols-1 gap-3 border-t border-border pt-5 text-meta leading-5 text-fg-secondary sm:grid-cols-3">
        <li className="flex min-w-0 items-start gap-2 sm:flex-col sm:gap-1">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span><strong className="font-semibold text-fg">{summary.declared} actions are declared.</strong><br />Registry-defined capability</span>
        </li>
        <li className="flex min-w-0 items-start gap-2 sm:flex-col sm:gap-1">
          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span><strong className="font-semibold text-fg">{summary.invokableNow} can run now.</strong><br />Read-only, connected substrate</span>
        </li>
        <li className="flex min-w-0 items-start gap-2 sm:flex-col sm:gap-1">
          <Database className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span><strong className="font-semibold text-fg">{summary.connectedMutations} consequential substrate</strong><br />Not armed, authorized or executed</span>
        </li>
      </ul>
      {/*
        The five states this product refuses to collapse, stated where a reader meets them. Each
        step is a different fact and a different owner; the registry can only ever answer the
        first two.
      */}
      <p className="flex min-w-0 max-w-2xl items-start gap-2 text-meta leading-5 text-fg-muted">
        <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Declared is not invokable. Invokable is not authorized. Authorized is not executed.
          Executed is not successful. Free text never reaches execution; consequential acts remain
          gated to a human on Decisions.
        </span>
      </p>
    </CommandRegion>
  );
}

function NotYetConnected() {
  return (
    <CommandRegion
      id="not-connected"
      title="Not yet connected"
      question="What will Command answer once these sources exist?"
      provenance="not-connected"
      provenanceDetail="no source is connected for any capability listed here"
      bodyClassName="flex-1 gap-3 border-t border-border pt-2"
    >
      {/*
        THE INVENTORY COMES FIRST. Through CMD-V5 this region opened with a question and a paragraph
        of doctrine, so the first thing a Director met in the coverage rail was prose about why the
        prose was necessary. What Hebun cannot answer is a LIST OF CAPABILITIES; the reason each one
        is unanswerable belongs to the row it belongs to, and the doctrine that governs all six
        belongs after them.

        The disclosure itself is CMD-V4's, unchanged and deliberately so: a native `<details>` per
        row, the capability NAME and the words "Not connected" on screen while closed, the full
        architectural reason one keystroke away in the same document — behind no link, no fetch and
        no tooltip. One pixel of grid gap over the border colour draws every divider in both axes,
        so the same markup is one column in the rail and two at tablet width.
      */}
      <ul className="grid min-w-0 grid-cols-1 divide-y divide-border overflow-hidden">
        {UNCONNECTED_CAPABILITIES.map((row) => (
          <li key={row.capability} className="min-w-0">
            <details className="group min-w-0">
              <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 rounded-md px-1 py-2.5 transition-colors duration-(--dur-fast) hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-ring [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="size-3.5 shrink-0 text-fg-muted transition-transform duration-(--dur-fast) group-open:rotate-90"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 text-body font-medium text-fg">{row.capability}</span>
                <span className="shrink-0 text-meta text-fg-muted">Not connected</span>
              </summary>
              {/*
                `pl-[34px]` is arithmetic, not a guess: the summary's own left padding (`p-3`, 12px)
                plus the chevron (`size-3.5`, 14px) plus the gap (`gap-2`, 8px).
              */}
              <p className="pb-3 pl-[29px] pr-1 text-meta leading-5 text-fg-secondary">
                {row.reason}
              </p>
            </details>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-1 pt-3 text-meta leading-5 text-fg-muted">
        Each is listed with the reason it cannot be answered. None is shown as an empty result, a
        zero, or a placeholder figure, because Hebun does not know these facts — it is not that they
        are none.
      </p>
    </CommandRegion>
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
      One semantic order at every width: attention, intent, coverage. Desktop composes them as an
      operating band; tablet gives the two live destinations equal weight and lets coverage span;
      mobile becomes the same priority order vertically. CSS changes geometry, never truth.
    */
    <div className="grid min-w-0 grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)_280px]">
      <WaitingOnYou
        state={waiting}
        className={waiting.status === "waiting" ? "lg:col-span-2 lg:col-start-1 lg:row-start-1 xl:col-span-3" : "lg:col-start-2 lg:row-start-1 xl:col-start-3"}
      />
      <div className={waiting.status === "waiting" ? "min-w-0 lg:col-start-1 lg:row-start-2 xl:col-span-2" : "min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1 xl:col-span-2"}>
        <ExpressIntent summary={intent} />
      </div>
      <div className="min-w-0 lg:col-start-2 lg:row-start-2 xl:col-start-3">
        <NotYetConnected />
      </div>
    </div>
  );
}
