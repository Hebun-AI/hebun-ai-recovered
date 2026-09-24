import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * COMMAND SURFACE — the visual chrome of the accepted Command design (command-final).
 *
 * Presentation only. Every region keeps its CommandRegion semantics (heading, question, provenance
 * note, read state); this file only draws the visible heading and the card surface around it. It
 * reads nothing and states nothing.
 */

/** The card every operating surface sits on. `attention` is the one contextual emphasis. */
export const COMMAND_CARD =
  "cmd-card relative min-w-0 rounded-[1.125rem] border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_10px_28px_-16px_rgb(15_23_42/0.18)]";

/** Hides CommandRegion's own heading row visually; the heading stays for assistive technology. */
export const HIDE_REGION_HEADING = "[&>div:first-child]:sr-only";

const TONE = {
  heby: "bg-highlight/10 text-highlight",
  attention: "bg-warning-subtle text-warning",
  work: "bg-success-subtle text-success",
  primary: "bg-primary-subtle text-primary",
  map: "bg-white/10 text-(--cmd-map-accent)",
} as const;

export function CardHeading({
  icon: Icon,
  tone,
  title,
  subtitle,
  aside,
  inverse = false,
}: {
  readonly icon: LucideIcon;
  readonly tone: keyof typeof TONE;
  readonly title: React.ReactNode;
  readonly subtitle?: React.ReactNode;
  readonly aside?: React.ReactNode;
  readonly inverse?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3" aria-hidden="true">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[0.625rem]", TONE[tone])}>
        <Icon className="size-[1.125rem]" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-title font-bold leading-tight tracking-tight", inverse ? "text-white" : "text-fg")}>{title}</p>
        {subtitle ? (
          <p className={cn("mt-0.5 truncate text-meta", inverse ? "text-(--cmd-map-muted)" : "text-fg-muted")}>{subtitle}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0 pt-0.5">{aside}</div> : null}
    </div>
  );
}
