import Link from "next/link";
import { ArrowRight, ChevronRight, CircleSlash, FunctionSquare, Landmark, Lock, Settings2, Sprout } from "lucide-react";

import type { Provenance } from "@/components/ui/provenance-chip";
import { TONES } from "@/components/ui/state-block";
import { cn } from "@/lib/utils";

/*
 * region.tsx — the Command Center's region grammar (CMD-V2).
 *
 * ── WHAT A REGION IS ─────────────────────────────────────────────────────────
 *
 * A `<section>` with an id, a label, an announced question, content, and — unless it declares none —
 * exactly ONE source note saying what KIND of claim its content is. `provenance` is a REQUIRED prop
 * and `null` is a VALUE, never a default: the decorative executive band passes it deliberately.
 *
 * ── WHY PROVENANCE IS A NOTE HERE AND A CHIP ELSEWHERE (V2.1) ────────────────
 *
 * `ProvenanceChip` is the product's released primitive and it is correct for a workspace built of
 * comparable regions, where the KIND of claim is part of the content. On the Command Center it was
 * measured as the loudest thing on the page: nine bordered pills reading "Authoritative · the action
 * authorization store, scoped to this tenant" turned an executive landing into an audit view, and
 * the Director rejected it for exactly that.
 *
 * SO THE SEMANTICS ARE KEPT AND THE VOLUME IS CUT. `SourceNote` below renders the same
 * `data-provenance` fact, the same five kinds, the same mark per kind and the same one-word label —
 * at label size, without a border or a fill, and with the specific authority carried in `title` and
 * in a screen-reader sentence rather than printed across the card.
 *
 *     DEMOTED != DELETED        A QUIET FACT IS STILL A FACT
 *
 * Nothing about what a region may CLAIM changed, and the composition contract still asserts one
 * declared kind per region — including that a region declaring none renders none.
 *
 * ── WEIGHT RESPONDS TO STATE, NOT TO IMPORTANCE IN THE ABSTRACT ──────────────
 *
 * `attention` is the dominant surface, and a region may only ask for it when it has something to
 * say. An empty queue rendered at full dominance is a large box announcing nothing, which is the
 * second defect the Director named. `card` is the ordinary surface; `rail` is the quiet supporting
 * one; `bare` is unboxed.
 *
 * Presentational and server-safe. It reads nothing, resolves nothing, and grants nothing.
 */

export function ordinaryDate(iso: string): string {
  /* Deterministic and locale-free: a timestamp is evidence, not a greeting. */
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

/** The four weights a Command region may carry. Geometry only — no region's truth changes with it. */
export type RegionWeight = "attention" | "card" | "rail" | "bare";

const WEIGHT: Readonly<Record<RegionWeight, string>> = Object.freeze({
  attention:
    "cmd-attention-edge relative overflow-hidden rounded-2xl border border-border bg-surface pl-6 pr-5 py-5 shadow-md lg:pl-7 lg:pr-6 lg:py-6",
  card: "rounded-2xl border border-border bg-surface p-5 shadow-sm",
  rail: "rounded-2xl border border-border bg-surface p-5",
  bare: "",
});

/** The same five kinds the released chip carries, with the same marks and the same meanings. */
const SOURCE: Readonly<
  Record<Provenance, { label: string; icon: React.ComponentType<{ className?: string }>; meaning: string }>
> = Object.freeze({
  authoritative: {
    label: "Authoritative",
    icon: Landmark,
    meaning: "Read from the canonical authority for this organization.",
  },
  derived: {
    label: "Derived",
    icon: FunctionSquare,
    meaning: "Recomputed on each read from an authority, and stored nowhere.",
  },
  configuration: {
    label: "Configuration",
    icon: Settings2,
    meaning: "Computed from declared product configuration, not from this organization's operating record.",
  },
  seeded: {
    label: "Seeded",
    icon: Sprout,
    meaning: "Compiled-in reference data. Not this organization's record.",
  },
  "not-connected": {
    label: "Not connected",
    icon: CircleSlash,
    meaning: "No source is connected. This says nothing about whether data exists.",
  },
  restricted: {
    label: "Restricted",
    icon: Lock,
    meaning: "A source exists; your authority does not reach it.",
  },
});

/**
 * The quiet provenance affordance: one mark, one word, and the specific authority on hover and to
 * assistive technology. Colour is never the only carrier — each kind keeps its own mark and word.
 */
export function SourceNote({
  id,
  kind,
  detail,
  readState = "available",
  bounds,
  nonClaims,
  className,
}: {
  readonly id: string;
  readonly kind: Provenance;
  /** Names the authority that answered, e.g. "the action authorization store". */
  readonly detail?: string;
  readonly readState?: "available" | "empty" | "unavailable" | "blocked" | "not-connected";
  readonly bounds?: string;
  readonly nonClaims?: string;
  readonly className?: string;
}) {
  const spec = SOURCE[kind];
  const Mark = spec.icon;
  const readMeaning = {
    available: "The source answered this request.",
    empty: "The source answered and returned no record.",
    unavailable: "The source could not answer this request.",
    blocked: "The source exists, but this request could not read it.",
    "not-connected": "No source is connected, so no organizational record was read.",
  }[readState];
  const stateLabel = readState === "not-connected" ? null : readState;

  return (
    <span
      data-provenance={kind}
      data-read-state={readState}
      className={cn("inline-flex max-w-full", className)}
    >
      <button
        type="button"
        popoverTarget={id}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md text-label font-medium text-fg-muted transition-colors duration-(--dur-fast) hover:text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        <Mark className="size-3 shrink-0" aria-hidden="true" />
        <span>{spec.label}</span>
        {stateLabel ? <span aria-hidden="true">·</span> : null}
        {stateLabel ? <span className="capitalize">{stateLabel}</span> : null}
        <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
      </button>
      <span id={id} popover="auto" className="m-auto w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-3 text-left text-fg shadow-lg backdrop:bg-slate-950/20">
        <span className="block text-meta font-semibold text-fg">{spec.label}{stateLabel ? ` · ${stateLabel}` : ""}</span>
        <span className="mt-1 block text-meta leading-5 text-fg-secondary">{detail ?? spec.meaning}</span>
        <span className="mt-1 block text-meta leading-5 text-fg-muted">{readMeaning}</span>
        {bounds ? <span className="mt-1 block text-meta leading-5 text-fg-muted">Bound: {bounds}</span> : null}
        {nonClaims ? <span className="mt-1 block text-meta leading-5 text-fg-muted">Does not claim: {nonClaims}</span> : null}
      </span>
    </span>
  );
}

export function CommandRegion({
  id,
  title,
  question,
  provenance,
  provenanceDetail,
  readState,
  provenanceBounds,
  provenanceNonClaims,
  weight = "card",
  eyebrow,
  actions,
  children,
  className,
  bodyClassName,
}: {
  readonly id: string;
  readonly title: string;
  /** Answered by this region. Announced, not printed — the heading says it in fewer words. */
  readonly question: string;
  /**
   * The kind of claim this region's content is, or `null` when it makes none. Required either way:
   * the composition contract checks the rendered note against this declaration.
   */
  readonly provenance: Provenance | null;
  readonly provenanceDetail?: string;
  readonly readState?: "available" | "empty" | "unavailable" | "blocked" | "not-connected";
  readonly provenanceBounds?: string;
  readonly provenanceNonClaims?: string;
  readonly weight?: RegionWeight;
  /** A short standing word beside the heading — a count, or a state word. Never a verdict. */
  readonly eyebrow?: React.ReactNode;
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
      className={cn("flex min-w-0 flex-col gap-3", WEIGHT[weight], className)}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 text-title font-semibold leading-tight tracking-tight text-fg">
          {title}
        </h2>
        {eyebrow ? (
          <span className="shrink-0 text-label font-medium text-fg-muted">{eyebrow}</span>
        ) : null}
        {actions ? <div className="flex min-w-0 shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <p id={describedBy} className="sr-only">
        {question}
      </p>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-3", bodyClassName)}>
        {children}
        {/*
          THE SOURCE NOTE SITS AFTER THE CONTENT IT QUALIFIES, and keeps a row of its own — never
          opposite the heading, which is the `/finance` defect measured at 158.3px of a 197px row. A
          region declaring `null` renders none: a decorative surface is not evidence.
        */}
        {provenance ? (
          <div className="mt-auto flex min-w-0 flex-wrap items-center gap-2 pt-1">
            <SourceNote
              id={`${id}-provenance`}
              kind={provenance}
              detail={provenanceDetail}
              readState={readState}
              bounds={provenanceBounds}
              nonClaims={provenanceNonClaims}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The operating statement: a mark, an answer, and one clause.
 *
 * `empty` and `unavailable` stay two renderings a reader can tell apart without colour — a different
 * glyph, a different word and a different sentence. V2.1 adds `compact` as the DEFAULT posture for
 * an empty answer: "nothing is waiting" is good news, and good news does not need a large box.
 */
export function OperatingStatement({
  tone,
  title,
  detail,
  reason,
  compact = false,
}: {
  readonly tone: "empty" | "unavailable";
  readonly title: string;
  readonly detail?: string;
  /**
   * The refusal code the seam gave, when it gave one.
   *
   * IT IS CARRIED, NOT PRINTED. `persistence-not-configured` is a diagnostic, not language, and the
   * Director rejected exactly that class of string on the executive surface. It stays on the
   * element as `title` and in the accessible name, so nothing material is lost and nothing
   * technical is shouted.
   */
  readonly reason?: string;
  readonly compact?: boolean;
}) {
  const spec = TONES[tone];
  const Mark = spec.icon;
  return (
    <div
      data-state-tone={tone}
      title={reason ? `${title}. Reason: ${reason}.` : undefined}
      className={cn("flex min-w-0 items-start", compact ? "gap-3" : "gap-4")}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center ring-1 ring-inset ring-current/10",
          compact ? "size-8 rounded-lg" : "size-11 rounded-xl",
          spec.badge,
        )}
        aria-hidden="true"
      >
        <Mark className={compact ? "size-4" : "size-5"} />
      </span>
      <div className={cn("flex min-w-0 flex-col", compact ? "gap-0.5" : "gap-1")}>
        <h3
          className={cn(
            "font-semibold leading-tight text-fg text-balance",
            compact ? "text-body" : "text-title",
          )}
        >
          {title}
        </h3>
        {detail ? (
          <p className="max-w-xl text-meta leading-5 text-fg-secondary text-pretty">{detail}</p>
        ) : null}
        {reason ? <span className="sr-only">Reason: {reason}.</span> : null}
      </div>
    </div>
  );
}

/**
 * The quiet route a region offers when it is not the region asking for an act.
 *
 * It lives in the leaf beside `CommandRegion` for the same reason the region grammar does: the rail
 * and the composition both need it, and importing it from the composition would be a cycle.
 */
export function QuietLink({ href, children }: { readonly href: string; readonly children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex min-w-0 items-center gap-1.5 self-start rounded-md text-meta font-semibold text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
    >
      {children}
      <ArrowRight
        className="size-3.5 shrink-0 transition-transform duration-(--dur-fast) group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
