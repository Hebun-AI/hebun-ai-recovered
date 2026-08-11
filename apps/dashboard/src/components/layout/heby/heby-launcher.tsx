"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHebySurface } from "./heby-surface-context";

/*
 * The two Heby controls (HW3). Same launcher, same accent, two clearly different jobs:
 *
 *   TOPBAR (top-right)      QUICK HEBY   — "ask without leaving my work". Opens/closes the Quick
 *                                          Panel over the current workspace. It no longer navigates
 *                                          to /heby.
 *   RAIL (bottom-left)      FULL HEBY    — "enter Heby's dedicated workspace". Navigates to /heby
 *                                          and toggles back out to the workspace it came from.
 *
 * Neither control decides anything: both hand their identity to the one surface planner, which
 * owns every transition (including "opening one surface closes the other"). Presentation state
 * only — no conversation, no tenant, no provider, no runtime.
 *
 * ACTIVE STATE means exactly one thing: THIS UI SURFACE IS CURRENTLY OPEN. It is never a claim that
 * Claude is connected, that a provider is healthy, that Heby is "online", that voice is listening,
 * or that an agent is running — none of which have an authoritative read seam.
 */

export function HebyLauncher({ variant }: { variant: "rail" | "topbar" }) {
  const { surface, operate } = useHebySurface();
  const active = variant === "topbar" ? surface === "quick-panel" : surface === "full-workspace";

  const label =
    variant === "topbar"
      ? active
        ? "Close Heby panel"
        : "Ask Heby"
      : active
        ? "Close Heby workspace"
        : "Open Heby workspace";

  if (variant === "rail") {
    return (
      <button
        type="button"
        onClick={() => operate("rail")}
        aria-label={label}
        aria-pressed={active}
        data-heby-control="rail"
        data-heby-active={active ? "true" : undefined}
        className={cn(
          "group flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2 text-highlight transition-colors duration-(--dur-fast) hover:bg-highlight/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
          active ? "border-highlight/60 bg-highlight/20" : "border-highlight/30 bg-highlight/10",
        )}
      >
        <Sparkles className="size-5" aria-hidden="true" />
        <span className="text-[0.6rem] font-semibold uppercase tracking-wider">Heby</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => operate("topbar")}
      aria-label={label}
      aria-expanded={active}
      data-heby-control="topbar"
      data-heby-active={active ? "true" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold text-highlight transition-colors duration-(--dur-fast) hover:bg-highlight/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight",
        active ? "border-highlight/60 bg-highlight/20" : "border-highlight/30 bg-highlight/10",
      )}
    >
      <Sparkles className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Heby</span>
    </button>
  );
}
