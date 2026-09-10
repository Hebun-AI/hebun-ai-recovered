/*
 * instagram-media-cards.tsx — the recent-content grid for a stored Instagram media observation.
 *
 * ── IT RENDERS A MODEL; IT RESOLVES NOTHING ─────────────────────────────────
 *
 * The view arrives as a prop, already projected from an authorized, capability-scoped read the PAGE
 * performed. This component holds no database handle, no tenant, no provider client and no fetch, so
 * it cannot become a second opinion about what Instagram said — it has nothing to have an opinion
 * with.
 *
 * ── WHY THERE ARE NO IMAGES, AND WHY THAT IS CORRECT ────────────────────────
 *
 * The released observation contract deliberately stores neither `media_url` nor `thumbnail_url`:
 * both are ephemeral signed CDN links that expire, so an immutable observation carrying one would
 * record a fact that stops being true while the row still claims it. There is therefore no image to
 * render, and this component does not invent one — no placeholder tile, no gradient standing in for
 * a photo, and above all no fetch of the permalink to scrape a preview. **A text-first card that is
 * honest beats a visual card that implies content Hebun does not hold.**
 *
 * ── IT SHOWS COUNTS AND COMPUTES NOTHING ────────────────────────────────────
 *
 * Likes and comments are provider counts at one instant. This file does not add them, average them,
 * rank by them, or describe any post as performing. The arithmetic is trivial and that is exactly
 * what makes the restraint necessary: an analytics authority does not exist, and a card is not the
 * place to invent one.
 *
 * Server component — no client state, no mutation affordance.
 */
import { ArrowUpRight, Heart, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  describeMediaCounts,
  formatPublishedOn,
  mediaTypeLabel,
  INSTAGRAM_MEDIA_NO_CAPTION,
  INSTAGRAM_MEDIA_NO_PUBLISHED_AT,
  INSTAGRAM_MEDIA_NO_TYPE,
  type InstagramMediaItemView,
} from "@/features/instagram-connection-surface/latest-media-observation";

/** The icon for each count row, in the order the projection returns them. Decorative only. */
const COUNT_ICONS = [Heart, MessageCircle] as const;

function MediaCard({ item }: { item: InstagramMediaItemView }) {
  const typeLabel = mediaTypeLabel(item.mediaType);
  const publishedOn = formatPublishedOn(item.publishedAt);
  const counts = describeMediaCounts(item);

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {typeLabel ? (
          <Badge variant="neutral">{typeLabel}</Badge>
        ) : (
          <Badge variant="neutral">{INSTAGRAM_MEDIA_NO_TYPE}</Badge>
        )}
        {/*
         * PUBLICATION DATE, NOT OBSERVATION DATE. When Instagram says the post was published — a
         * different fact from when Hebun looked, which the section header states once above.
         */}
        <span className="text-xs text-fg-muted">
          {publishedOn ?? INSTAGRAM_MEDIA_NO_PUBLISHED_AT}
        </span>
      </div>

      {/*
       * THE CAPTION IS CLAMPED VISUALLY, NEVER TRUNCATED IN THE DATA. `line-clamp-4` bounds the card
       * height; the stored provider value is untouched, and the whole post remains one click away at
       * its own permalink. `break-words` is what stops a single unbroken hashtag from widening the
       * grid column and forcing the page to scroll sideways.
       */}
      {item.caption ? (
        <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-fg-secondary">
          {item.caption}
        </p>
      ) : (
        <p className="text-sm italic leading-6 text-fg-muted">{INSTAGRAM_MEDIA_NO_CAPTION}</p>
      )}

      {/* `mt-auto` keeps this row on the card's floor, so cards in a row end level. */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-4">
          {counts.map((count, index) => {
            const Icon = COUNT_ICONS[index] ?? Heart;
            return (
              <span key={count.label} className="flex items-center gap-1.5 text-sm text-fg-secondary">
                {/*
                 * THE ICON IS NEVER THE ONLY MEANING. It is hidden from assistive technology, and the
                 * full sentence — including "Instagram did not report the like count" — is carried in
                 * the adjacent screen-reader text.
                 */}
                <Icon className="size-3.5 text-fg-muted" aria-hidden="true" />
                <span className={count.reported ? "font-medium text-fg" : "text-fg-muted"}>
                  {count.display}
                </span>
                <span className="sr-only">{count.value}</span>
              </span>
            );
          })}
        </div>

        {/*
         * A LINK ONLY WHEN THE PERMALINK PASSED THE RELEASED POLICY (https, Instagram host). A
         * refused permalink removes the link, never the media, and nothing here fetches the URL.
         */}
        {item.permalink ? (
          <a
            href={item.permalink}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="inline-flex items-center gap-1 text-xs font-medium text-fg-secondary underline underline-offset-4 hover:text-fg"
          >
            Open on Instagram
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * The grid.
 *
 * Breakpoints follow the product's most common grid shape rather than new numbers: one column on
 * small screens, two from `sm`, three from `xl`. A caption-bearing card needs width to stay readable,
 * so it earns its third column later than a metric tile would.
 */
export function InstagramMediaCards({ items }: { items: readonly InstagramMediaItemView[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.permalink ?? `${item.publishedAt ?? "unknown"}-${index}`} className="min-w-0">
          <MediaCard item={item} />
        </li>
      ))}
    </ul>
  );
}
