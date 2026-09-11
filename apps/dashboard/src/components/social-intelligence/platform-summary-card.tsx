/*
 * platform-summary-card.tsx — one connected social platform, and what its provider last reported.
 *
 * ── A SHARED CARD IS NOT A SHARED METRIC ────────────────────────────────────
 *
 * Instagram and YouTube use the same component, and share no metric identity through it. The card
 * is handed cells that already carry their own names — "Followers", "Subscribers" — and it renders
 * whatever it is given without knowing, or being able to know, what a number means. There is no
 * `audience` slot, no `total` row, and no place where a caller could pass one platform's count under
 * another's name. **The layout is common; the vocabulary is not.**
 *
 * ── NO PROVIDER LOGO, NO PROVIDER COLOUR ────────────────────────────────────
 *
 * The platform's NAME is its identity here. A brand mark would put someone else's trademark inside
 * Hebun's chrome to decorate a number Hebun is reporting, and a brand colour would make one card
 * louder than another for reasons that have nothing to do with the evidence. Every card is drawn in
 * the product's own palette, and is exactly as prominent as every other.
 *
 * ── TWO FACTS, NEVER MERGED ─────────────────────────────────────────────────
 *
 * PRESENCE — is the grant intact and the provider answering — and EVIDENCE — has Hebun stored an
 * observation. A card can honestly show a live connection with nothing observed yet, and it can show
 * numbers from a stored observation while the connection has since gone quiet. They sit in different
 * places on the card because they are different claims.
 *
 * Server component — no client state, no mutation affordance.
 */
import { Card } from "@/components/ui/card";
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { SOCIAL_PRESENCE_SENTENCES } from "@/features/social-intelligence/platform-presence";
import type { SocialPlatformCard } from "@/features/social-intelligence/dashboard-model";

const OBSERVED_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function observedOn(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : `${OBSERVED_FORMAT.format(parsed)} UTC`;
}

/**
 * The presence mark.
 *
 * A DOT IS NEVER THE ONLY MEANING. The word beside it says the same thing, and the word is what an
 * assistive technology receives — the dot is decorative and hidden. Two states that must never look
 * alike are separated by a WORD first and a colour second.
 */
function PresenceMark({ status }: { readonly status: SocialPlatformCard["presence"]["status"] }) {
  const live = status === "live";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span
        className={`size-1.5 rounded-full ${live ? "bg-success" : "bg-warning"}`}
        aria-hidden="true"
      />
      <span className={`text-label font-semibold uppercase tracking-[0.14em] ${live ? "text-success" : "text-warning"}`}>
        {live ? "Connected" : "Not answering"}
      </span>
    </span>
  );
}

export function PlatformSummaryCard({ card }: { readonly card: SocialPlatformCard }) {
  const presenceSentence = SOCIAL_PRESENCE_SENTENCES[card.presence.status];
  const accountLabel =
    card.presence.status === "live" || card.presence.status === "impaired"
      ? card.presence.accountLabel
      : null;

  return (
    <Card className="flex h-full min-w-0 flex-col gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <h3 className="min-w-0 text-title font-semibold text-fg">{card.label}</h3>
          <PresenceMark status={card.presence.status} />
        </div>
        {/*
          The account label is a provider string and can be long ("YouTube Data API v3 — public read
          (no account)"). It wraps rather than truncating: it names WHICH subject the numbers below
          belong to, and a shortened subject is the one thing a metric card cannot afford.
        */}
        <p className="min-w-0 break-words text-meta text-fg-secondary">
          {accountLabel ?? `No ${card.subjectNoun} label was reported.`}
        </p>
        <p className="sr-only">{presenceSentence}</p>
      </div>

      {card.evidence === "observed" ? (
        <>
          {/*
            THREE CELLS, EQUAL WEIGHT. Nothing here is a "primary" metric: ranking them would be a
            judgement about which number matters, and Hebun has no basis for one.
          */}
          <dl className="mt-auto grid grid-cols-3 gap-x-3 gap-y-1 border-t border-border pt-4">
            {card.metrics.map((metric) => (
              <div key={metric.shortLabel} className="flex min-w-0 flex-col gap-0.5">
                {/*
                  THE ACCESSIBLE NAME NAMES THE PROVIDER, AND SAYS IT ONCE.
                  Visually the short label is enough, because the card's own heading sits one line
                  above it; read aloud out of that context, "Followers" alone does not say who
                  reported it. A first version appended the attributed label to the visible one and
                  acceptance heard the result: "Followers — Followers Instagram reported". So the
                  visible word is hidden from assistive technology and the attributed one replaces
                  it outright, rather than being read after it.
                */}
                <dt className="text-label font-medium uppercase tracking-[0.1em] text-fg-muted">
                  <span aria-hidden="true">{metric.shortLabel}</span>
                  <span className="sr-only">{metric.label}</span>
                </dt>
                {/*
                  `text-xl`, NOT AN ARBITRARY SIZE. A first pass used `text-[1.375rem]` for a metric
                  that wanted to sit between the token scale's 18px title and its 28px workspace
                  identity. The token authority's stated rule is that a component references a scale
                  rather than inventing a value, and 28px would in any case compete with the page's
                  own H1 two rows above. 20px on Tailwind's scale — which the released `Card` and
                  `PageHeader` already use — keeps the number dominant over its 12px label without
                  minting a size nothing else in the product has.
                */}
                <dd
                  className={
                    metric.reported
                      ? "text-xl font-semibold leading-tight tracking-tight text-fg tabular-nums"
                      : "text-xl font-semibold leading-tight text-fg-muted"
                  }
                >
                  {metric.display}
                  {/*
                    A DASH MUST NOT BE READ AS A VALUE. Where the count is absent the reason is
                    announced in full; where it is present — including when it is zero — the digit
                    already is the whole answer and needs nothing added to it.
                  */}
                  {metric.absence ? <span className="sr-only">{metric.absence}</span> : null}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <ProvenanceChip kind={card.provenance} detail={`${card.label} reported`} />
            {/*
              "Observed by Hebun" IS NOT DECORATION. These counts are what the provider said at ONE
              recorded instant — not a live reading, and not a statement of what the account holds
              now. The phrase is the whole guard, exactly as the released media surface uses it.
            */}
            <p className="text-meta text-fg-muted">
              Observed by Hebun{" "}
              <span className="font-medium text-fg-secondary">{observedOn(card.observedAt!)}</span>
            </p>
          </div>
        </>
      ) : (
        /*
          NO NUMBERS AT ALL, rather than numbers dimmed to nothing. A connected platform Hebun has
          not yet observed has no counts, and drawing three empty cells would imply three counts
          exist somewhere out of reach.
        */
        <div className="mt-auto border-t border-border pt-4">
          <p className="text-meta leading-5 text-fg-secondary text-pretty">{card.evidenceSentence}</p>
        </div>
      )}

      {/*
        AN IMPAIRED CONNECTION SAYS SO IN FULL, and only when it is impaired. A live card carries no
        paragraph about being live — the mark and the word already said it, and repeating it on every
        render is the provenance noise this phase was told to avoid.
      */}
      {card.presence.status === "impaired" ? (
        <p className="text-meta leading-5 text-warning text-pretty">{presenceSentence}</p>
      ) : null}
    </Card>
  );
}
