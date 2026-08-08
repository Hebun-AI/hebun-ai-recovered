"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeby } from "@/components/layout/heby/heby-context";

/*
 * Inline Heby explanation affordance — the operating surface's "why" layer, not
 * a purple button pasted on every card (Phase 7 §16). Opens the EXISTING Phase 5
 * Heby panel; no model call, no fabricated response, no new Heby system. The
 * panel states honestly that Heby is not yet available.
 *
 * `icon` variant is a quiet per-row trigger; `text` is used once per region.
 */

export function HebyWhy({
  label = "Why?",
  variant = "text",
  className,
}: {
  label?: string;
  variant?: "text" | "icon";
  className?: string;
}) {
  const { openHeby } = useHeby();

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={openHeby}
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
      onClick={openHeby}
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
