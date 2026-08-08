"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeby } from "@/components/layout/heby/heby-context";

/*
 * Inline "why / explain" affordance. Opens the EXISTING Phase 5 Heby panel — it
 * does not create a second Heby system, call a model, or fabricate a response.
 * The panel itself states, honestly, that Heby is not yet available. This is an
 * entry point only (spec §9 / §10).
 */

export function HebyWhy({ label = "Why?", className }: { label?: string; className?: string }) {
  const { openHeby } = useHeby();
  return (
    <button
      type="button"
      onClick={openHeby}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-highlight transition-colors duration-(--dur-fast) hover:bg-highlight/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
        className,
      )}
    >
      <Sparkles className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
