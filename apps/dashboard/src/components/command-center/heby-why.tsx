"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeby } from "@/components/layout/heby/heby-context";
import type {
  HebyProductIntent,
  HebySelectedEntity,
  HebySurfaceRegion,
} from "@/features/heby-integration";

/*
 * Inline Heby explanation affordance — the operating surface's "why" layer, not a purple
 * button pasted on every card (Phase 7 §16). Opens the ambient Heby panel.
 *
 * PHASE 15: it may carry a TYPED context payload (region, intent, selected entity) so the
 * panel knows what "this" is — deterministic and explicit, never DOM-scraped. All context
 * props are optional, so existing triggers keep working unchanged and open Heby at
 * workspace level. Still no model call and no fabricated response.
 */

export function HebyWhy({
  label = "Why?",
  variant = "text",
  className,
  region,
  intent,
  entity,
}: {
  label?: string;
  variant?: "text" | "icon";
  className?: string;
  /** Optional typed context: the surface region this trigger is about. */
  region?: HebySurfaceRegion;
  /** Optional product intent (defaults to EXPLAIN in the panel). */
  intent?: HebyProductIntent;
  /** Optional selected entity this trigger is about. */
  entity?: HebySelectedEntity;
}) {
  const { openHeby } = useHeby();

  // Wrap openHeby so the click event is never passed as the trigger payload, and so a
  // typed context is carried only when one was explicitly provided.
  const handleOpen = () => {
    if (region || intent || entity) {
      openHeby({ region, intent, selectedEntity: entity });
    } else {
      openHeby();
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`${label} — ask Heby`}
        title={`${label} — ask Heby`}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-md text-fg-muted transition-colors duration-(--dur-fast) hover:bg-highlight/10 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
          className,
        )}
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-fg-muted transition-colors duration-(--dur-fast) hover:bg-highlight/10 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
        className,
      )}
    >
      <Sparkles className="size-3.5 text-highlight" aria-hidden="true" />
      {label}
    </button>
  );
}
