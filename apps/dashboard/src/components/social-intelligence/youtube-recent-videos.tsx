/*
 * youtube-recent-videos.tsx — the recent-content list for a stored YouTube channel observation
 * (YT-SOC3).
 *
 * ── IT RENDERS A MODEL; IT RESOLVES NOTHING ─────────────────────────────────
 *
 * The items arrive already projected from the capability-scoped read the page performed. This
 * component holds no database handle, no tenant, no provider client and no fetch.
 *
 * ── WHY THERE IS NO LINK AND NO THUMBNAIL ───────────────────────────────────
 *
 * The released observation contract stores neither a URL nor a thumbnail. A "Watch on YouTube" link
 * would be Hebun CONSTRUCTING an address from an identifier rather than showing one YouTube
 * reported, so there is none. A text card that is honest beats a visual card implying content Hebun
 * does not hold.
 *
 * ── IT SHOWS COUNTS AND COMPUTES NOTHING ────────────────────────────────────
 *
 * Views, likes and comments are provider counts at one instant. Nothing here adds, averages or ranks
 * them, and no video is described as performing.
 *
 * Server component — no client state, no mutation affordance.
 */
import { Eye, MessageCircle, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  describeVideoCounts,
  YOUTUBE_VIDEO_NO_PUBLISHED_AT,
  YOUTUBE_VIDEO_NO_TITLE,
  type YouTubeRecentVideoItemView,
} from "@/features/youtube-channel-surface/recent-video-observation";

/** The icon for each count row, in the order the projection returns them. Decorative only. */
const COUNT_ICONS = [Eye, ThumbsUp, MessageCircle] as const;

/*
 * FIXED LOCALE, FIXED ZONE, AND NO CLOCK. This formats the stored publication instant; it never reads
 * the present, so "12 Sept 2026" is what YouTube said and "3 days ago" is never produced.
 */
const PUBLISHED_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

function publishedOn(iso: string | null): string | null {
  if (iso === null) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : PUBLISHED_FORMAT.format(parsed);
}

function VideoCard({ item }: { item: YouTubeRecentVideoItemView }) {
  const published = publishedOn(item.publishedAt);
  const counts = describeVideoCounts(item);

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      {/*
       * "Published" IS NOT DECORATION. The section states when HEBUN OBSERVED the channel; this states
       * when YOUTUBE says the video was published. Two instants, two facts.
       */}
      <span className="text-xs text-fg-muted">
        {published ? `Published ${published}` : YOUTUBE_VIDEO_NO_PUBLISHED_AT}
      </span>

      {item.title ? (
        <p className="line-clamp-3 break-words text-sm font-medium leading-6 text-fg">{item.title}</p>
      ) : (
        <p className="text-sm italic leading-6 text-fg-muted">{YOUTUBE_VIDEO_NO_TITLE}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-4 pt-1">
        {counts.map((count, index) => {
          const Icon = COUNT_ICONS[index] ?? Eye;
          return (
            <span key={count.label} className="flex items-center gap-1.5 text-sm text-fg-secondary">
              <Icon className="size-3.5 text-fg-muted" aria-hidden="true" />
              <span className={count.reported ? "font-medium text-fg" : "text-fg-muted"} aria-hidden="true">
                {count.display}
              </span>
              {/* A withheld count keeps its own sentence; a reported one names which number it is. */}
              <span className="sr-only">
                {count.reported ? `${count.label}: ${count.value}` : count.value}
              </span>
            </span>
          );
        })}
      </div>
    </Card>
  );
}

/** One column on small screens, two from `sm`, three from `xl` — the released media grid's shape. */
export function YouTubeRecentVideos({ items }: { items: readonly YouTubeRecentVideoItemView[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <li key={`${item.publishedAt ?? "unknown"}-${index}`} className="min-w-0">
          <VideoCard item={item} />
        </li>
      ))}
    </ul>
  );
}
