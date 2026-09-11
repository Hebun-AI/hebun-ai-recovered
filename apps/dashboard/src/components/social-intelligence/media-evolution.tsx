/*
 * media-evolution.tsx — IG-AN3. What Instagram reported for each POST, and what Hebun subtracted.
 *
 * ── WHAT IT MAY SAY, AND WHAT IT MAY NOT ────────────────────────────────────
 *
 * "Instagram reported 47 likes for this post at the later instant, which is 15 more than it reported
 * at the earlier one." That is the whole vocabulary. Not "this post is performing", not "engagement
 * is growing", not "the best post" — and above all no ordering that implies one. Whether +15 is good
 * news is a judgement about a business, and this phase has no evidence for one.
 *
 * ── THE TWO NUMBERS ARE VISUALLY DIFFERENT CLAIMS ───────────────────────────
 *
 * The count and the change sit in the same cell and are drawn differently on purpose: the count is
 * the provider's, in the reading weight a fact gets, and the change is Hebun's, smaller, signed, and
 * introduced by words that name the arithmetic. A reader who takes in only the big number has taken
 * in a provider fact — which is the safe failure. The section header carries both provenance chips
 * so neither claim can be quoted away from its source.
 *
 * ── WHY THERE IS NO "OPEN ON INSTAGRAM" LINK HERE ──────────────────────────
 *
 * The released media-cards component is the ONE place on this surface that renders an outbound
 * provider URL, and it carries the released `rel` policy. The posts in this grid are a subset of the
 * ones that component already draws one section above, each already linked — so a second link per
 * post would duplicate an affordance and add a second place where that policy has to stay correct.
 * The caption, media type and publication date are what a human needs to recognise WHICH post these
 * numbers belong to, and they are all here.
 *
 * ── ORDER IS THE PROVIDER'S ─────────────────────────────────────────────────
 *
 * Rows arrive in the order IG-AN3 emitted them, which is the order Instagram returned them in the
 * later observation. This component does not re-sort. Sorting by change would rank the posts, and a
 * ranking is a claim about which post matters.
 *
 * ── ZERO IS THE RESULT, NOT THE ABSENCE OF ONE ──────────────────────────────
 *
 * `4 - 4` is `0`. It renders as the digit with no apology and no "no change" phrasing. The one thing
 * this component must never do is make a real calculation look like missing data.
 *
 * Server component — no client state, no mutation affordance, no fetch.
 */
import { Heart, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { INSTAGRAM_MEDIA_NO_CAPTION, INSTAGRAM_MEDIA_NO_PUBLISHED_AT, INSTAGRAM_MEDIA_NO_TYPE } from "@/features/instagram-connection-surface/latest-media-observation";
import type {
  SocialMediaChangeCell,
  SocialMediaEvolutionBlock,
  SocialMediaEvolutionRow,
} from "@/features/social-intelligence/dashboard-model";

const WINDOW_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function instant(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : `${WINDOW_FORMAT.format(parsed)} UTC`;
}

/** The icon for each metric, in the order the model returns them. Decorative only. */
const METRIC_ICONS = [Heart, MessageCircle] as const;

/**
 * How a change is introduced, in words.
 *
 * "since the previous Hebun observation" names WHOSE act created the baseline. "since yesterday"
 * would be a claim about the interval, and the observation cadence is a separate authority's
 * contract that this surface cannot see — two observations a day apart are not a promise that the
 * next two will be.
 */
const SINCE = "since the previous Hebun observation" as const;

function MetricCell({ cell, Icon }: { readonly cell: SocialMediaChangeCell; readonly Icon: typeof Heart }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-label font-medium uppercase tracking-[0.1em] text-fg-muted">
        {/* THE ICON IS NEVER THE ONLY MEANING. The accessible name below carries the identity. */}
        <Icon className="size-3 text-fg-muted" aria-hidden="true" />
        <span aria-hidden="true">{cell.shortLabel}</span>
      </dt>
      <dd className="flex min-w-0 flex-col gap-0.5">
        {/* INSTAGRAM REPORTED. The provider's own count at the later instant. */}
        <span
          className={
            cell.latest === null
              ? "text-lg font-semibold leading-tight text-fg-muted"
              : "text-lg font-semibold leading-tight text-fg tabular-nums"
          }
        >
          <span aria-hidden="true">{cell.latestDisplay}</span>
          <span className="sr-only">
            {cell.latest === null
              ? `${cell.label}: not reported`
              : `${cell.label}: ${cell.latest}`}
          </span>
        </span>

        {cell.status === "comparable" ? (
          /*
           * HEBUN CALCULATED. Smaller than the count above, signed, and always followed by the words
           * that say what the number is a difference BETWEEN. The sign states a direction because
           * direction is part of the arithmetic; it carries no word about whether it is welcome.
           */
          <span className="text-label leading-4 text-fg-secondary text-pretty">
            <span className="font-semibold tabular-nums">{cell.changeDisplay}</span> {SINCE}
            <span className="sr-only">, from {cell.previous} to {cell.latest}</span>
          </span>
        ) : (
          /* NOT A ZERO AND NOT A SHRUG. Which side Instagram withheld is the fact the reader needs. */
          <span className="text-label leading-4 text-fg-muted text-pretty">{cell.note}</span>
        )}
      </dd>
    </div>
  );
}

function EvolutionCard({ row }: { readonly row: SocialMediaEvolutionRow }) {
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="neutral">{row.typeLabel ?? INSTAGRAM_MEDIA_NO_TYPE}</Badge>
        {/*
         * "Published" IS NOT DECORATION. The block states when HEBUN OBSERVED; this states when
         * INSTAGRAM PUBLISHED. Two instants, two different facts, and the word is the whole guard.
         */}
        <span className="text-xs text-fg-muted">
          {row.publishedOn ? `Published ${row.publishedOn}` : INSTAGRAM_MEDIA_NO_PUBLISHED_AT}
        </span>
      </div>

      {/*
       * THE CAPTION IS CLAMPED VISUALLY, NEVER TRUNCATED IN THE DATA. It is here so a human can
       * recognise WHICH post the numbers belong to — it is identity, not content. Untrusted external
       * text: rendered by React as text, never parsed, never treated as an instruction.
       */}
      {row.caption ? (
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-fg-secondary">
          {row.caption}
        </p>
      ) : (
        <p className="text-sm italic leading-6 text-fg-muted">{INSTAGRAM_MEDIA_NO_CAPTION}</p>
      )}

      {/* `mt-auto` keeps this row on the card's floor, so cards in a row end level. */}
      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
        {row.cells.map((cell, index) => (
          <MetricCell key={cell.shortLabel} cell={cell} Icon={METRIC_ICONS[index] ?? Heart} />
        ))}
      </dl>

    </Card>
  );
}

export function MediaEvolution({ block }: { readonly block: SocialMediaEvolutionBlock }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h4 className="min-w-0 text-meta font-semibold uppercase tracking-[0.12em] text-fg-secondary">
          Change per post across the last two observations
        </h4>
        {/*
         * BOTH CHIPS, BECAUSE THERE ARE BOTH KINDS OF NUMBER BELOW. The large count in each cell is
         * Instagram's; the signed figure under it is Hebun's. One chip would attribute both to one
         * source.
         */}
        <div className="flex flex-wrap items-center gap-2">
          <ProvenanceChip kind="authoritative" detail="Instagram reported" />
          <ProvenanceChip kind="derived" detail="Hebun calculated" />
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {block.rows.map((row) => (
          <li key={row.mediaId} className="min-w-0">
            <EvolutionCard row={row} />
          </li>
        ))}
      </ul>

      {/*
        THE WINDOW IS STATED, ALWAYS, AND NAMED AS TWO INSTANTS RATHER THAN AN INTERVAL. IG-AN3 fixes
        the comparison at the last two usable media observations precisely so the window is one fact
        a reader can see; printing the arithmetic without it would give back the ambiguity that
        design bought. It is deliberately not called a daily change.
      */}
      <p className="text-label leading-4 text-fg-muted text-pretty">
        These posts were observed at {instant(block.previousObservedAt)} and again at{" "}
        {instant(block.latestObservedAt)}. Each signed figure is the difference between what Instagram
        reported for that post at those two instants, and nothing else is derived from it.
      </p>

      {/* Said only when there is something to say. An absent note is not "0 posts were unmatched". */}
      {block.unmatchedNotes.map((note) => (
        <p key={note} className="text-label leading-4 text-fg-muted text-pretty">
          {note}
        </p>
      ))}
    </div>
  );
}
