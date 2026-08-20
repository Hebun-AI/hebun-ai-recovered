import { CircleSlash, FunctionSquare, Landmark, Lock, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * provenance-chip.tsx — Stage 0. What KIND of claim the thing beside it is.
 *
 * ── WHY A SEPARATE PRIMITIVE ─────────────────────────────────────────────────
 *
 * `Badge` says how something is doing. This says where it came from, and the two must not share a
 * rendering: a reader who cannot tell a canonical record from a recomputed count cannot tell what
 * Hebun actually knows. Every word below already exists as a runtime state in `src/features` — none
 * is invented here, and none is renamed.
 *
 *   authoritative   the canonical authority answered. This IS the organization's record.
 *   derived         recomputed on read from an authority and stored nowhere. A view, not a record.
 *   seeded          compiled-in reference data. Not this organization's anything.
 *   not-connected   no source is connected. Says nothing about whether data exists.
 *   restricted      a source exists and this viewer's authority does not reach it.
 *
 * ── WHY IT IS NOT A BADGE ────────────────────────────────────────────────────
 *
 * `Badge` is `shrink-0 whitespace-nowrap` with `uppercase tracking-[0.12em]`, which is correct for
 * a badge and is exactly what makes "seeded definition" measure 158.3px inside a 197px card row on
 * `/finance` — it takes the row and the title beside it collapses to 11.9px against the 93px it
 * needs. This chip is deliberately NOT uppercase and NOT letter-spaced, so a two-word provenance
 * costs roughly two words of space, and it is allowed to wrap rather than to starve a sibling.
 *
 * Colour is never the only carrier: each kind has its own mark and its own word.
 */

export type Provenance =
  | "authoritative"
  | "derived"
  | "seeded"
  | "not-connected"
  | "restricted";

interface ProvenanceSpec {
  readonly label: string;
  readonly className: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  /** The sentence a reader gets on hover / from assistive technology. */
  readonly meaning: string;
}

const PROVENANCE: Readonly<Record<Provenance, ProvenanceSpec>> = Object.freeze({
  authoritative: {
    label: "Authoritative",
    /* Solid, bordered, full-strength text — the only kind that reads as a record. */
    className: "border border-border-strong bg-surface text-fg",
    icon: Landmark,
    meaning: "Read from the canonical authority for this organization.",
  },
  derived: {
    label: "Derived",
    /* Dashed and quiet, so it cannot be mistaken for the record it was computed from. */
    className: "border border-dashed border-border-strong bg-surface-sunken text-fg-secondary",
    icon: FunctionSquare,
    meaning: "Recomputed on each read from an authority, and stored nowhere.",
  },
  seeded: {
    label: "Seeded",
    className: "border border-warning/40 bg-warning-subtle text-warning",
    icon: Sprout,
    meaning: "Compiled-in reference data. Not this organization's record.",
  },
  "not-connected": {
    label: "Not connected",
    className: "border border-border bg-surface-sunken text-fg-muted",
    icon: CircleSlash,
    meaning: "No source is connected. This says nothing about whether data exists.",
  },
  restricted: {
    label: "Restricted",
    className: "border border-border-strong bg-surface-raised text-fg-secondary",
    icon: Lock,
    meaning: "A source exists; your authority does not reach it.",
  },
});

export function ProvenanceChip({
  kind,
  detail,
  className,
}: {
  readonly kind: Provenance;
  /** Names the specific authority or aggregate, e.g. "canonical Knowledge". */
  readonly detail?: string;
  readonly className?: string;
}) {
  const spec = PROVENANCE[kind];
  const Mark = spec.icon;
  return (
    <span
      data-provenance={kind}
      title={spec.meaning}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-label font-medium",
        spec.className,
        className,
      )}
    >
      <Mark className="size-3.5 shrink-0" aria-hidden="true" />
      {/*
        No `truncate`. VI-1: the detail names WHICH authority answered, and it was the one thing
        here that nothing else carried — `title` holds the KIND's meaning, and so does the
        screen-reader sentence below. Truncated, it was recoverable by hover and by nothing else,
        which on a touch device is not recoverable at all. Measured on /knowledge at 390px: five of
        six chips needed 331–447px and were given 320px. It wraps instead; the row it sits on is
        the chip's own row (see workspace-section.tsx), where height is the only thing it can cost.
      */}
      <span className="min-w-0">
        {spec.label}
        {detail ? <span className="font-normal"> · {detail}</span> : null}
      </span>
      <span className="sr-only">. {spec.meaning}</span>
    </span>
  );
}
