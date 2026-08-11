"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { hebyWorkspaceHref } from "@/features/heby-surface";
import type {
  HebyProductIntent,
  HebySelectedEntity,
  HebySurfaceRegion,
} from "@/features/heby-integration";

/*
 * Inline Heby explanation affordance — the operating surface's "why" layer, not a purple button
 * pasted on every card (Phase 7 §16).
 *
 * HW1: it NAVIGATES to the Heby Full Workspace, carrying the current workspace as a hint. It no
 * longer opens the side drawer — the drawer was retired so Hebun has exactly one Heby experience
 * rather than two competing ones.
 *
 * STATED LIMITATION (not a fabrication): the finer typed context Phase 15 modelled — surface
 * region, selected entity, product intent — is accepted here but is NOT transported across this
 * navigation in HW1. It never reached the model in any earlier phase either; it only relabelled the
 * drawer header. Carrying it needs a server-verifiable representation rather than free text in a
 * URL, which belongs to a later phase. The props are kept so the typed call sites stay intact and
 * the contract survives until it can be honoured.
 */

export interface HebyWhyProps {
  label?: string;
  variant?: "text" | "icon";
  className?: string;
  /** Accepted, NOT transported in HW1. See the note above. */
  region?: HebySurfaceRegion;
  /** Accepted, NOT transported in HW1. See the note above. */
  intent?: HebyProductIntent;
  /** Accepted, NOT transported in HW1. See the note above. */
  entity?: HebySelectedEntity;
}

export function HebyWhy(props: HebyWhyProps) {
  const { label = "Why?", variant = "text", className } = props;
  const pathname = usePathname();
  const href = hebyWorkspaceHref(pathname);

  if (variant === "icon") {
    return (
      <Link
        href={href}
        aria-label={`${label} — ask Heby`}
        title={`${label} — ask Heby`}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-fg-muted transition-colors duration-(--dur-fast) hover:bg-highlight/10 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
          className,
        )}
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-fg-muted transition-colors duration-(--dur-fast) hover:bg-highlight/10 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
        className,
      )}
    >
      <Sparkles className="size-3.5 text-highlight" aria-hidden="true" />
      {label}
    </Link>
  );
}
