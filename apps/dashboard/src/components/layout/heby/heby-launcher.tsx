"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeby } from "./heby-context";

/*
 * Persistent Heby launcher. Carries the Heby accent (highlight/indigo) so it
 * reads as its own ambient layer — distinct from workspace nav, and NOT a
 * generic support-chat bubble. Two placements: the workspace rail and the
 * topbar. Keyboard-accessible; opens the contextual panel.
 */

export function HebyLauncher({ variant }: { variant: "rail" | "topbar" }) {
  const { openHeby } = useHeby();

  if (variant === "rail") {
    return (
      <button
        type="button"
        onClick={() => openHeby()}
        aria-label="Open Heby"
        aria-haspopup="dialog"
        className="group flex w-full flex-col items-center gap-1 rounded-xl border border-highlight/30 bg-highlight/10 px-1 py-2 text-highlight transition-colors duration-(--dur-fast) hover:bg-highlight/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
      >
        <Sparkles className="size-5" />
        <span className="text-[0.6rem] font-semibold uppercase tracking-wider">Heby</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openHeby()}
      aria-label="Open Heby"
      aria-haspopup="dialog"
      className={cn(
        "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-highlight/30 bg-highlight/10 px-3 py-2 text-sm font-semibold text-highlight transition-colors duration-(--dur-fast) hover:bg-highlight/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
      )}
    >
      <Sparkles className="size-4" />
      <span className="hidden sm:inline">Heby</span>
    </button>
  );
}
