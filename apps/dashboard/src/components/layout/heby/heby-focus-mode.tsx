"use client";

/*
 * heby-focus-mode.tsx — FOCUSED HEBY MODE (post-G7 presentation architecture).
 *
 * ── WHAT THIS IS, AND WHAT IT REFUSES TO BE ─────────────────────────────────
 *
 * It is PRESENTATION ARCHITECTURE and nothing else. It introduces no truth: no read, no write, no
 * authority, no route, no preference. It states one thing — "the operator is on Heby's own surface,
 * so the shell's workspace navigation may stand down" — and it derives that from the surface state
 * the released model already computes from the route.
 *
 *   focused  ⟺  surface === "full-workspace"  AND  the operator has not asked for the navigation
 *               back  AND  the viewport is at least `lg` (that last clause is CSS, see globals.css).
 *
 * THERE IS NO SECOND SHELL. Nothing here mounts, unmounts or replaces a navigation component. Both
 * `WorkspaceRail` and `SecondaryNav` stay in the tree in every mode; this file sets ONE root data
 * attribute and a single stylesheet block reacts to it — exactly the mechanism the released
 * secondary-navigation collapse already uses. A second shell would make "which one is authoritative"
 * a question, and it is not a question worth creating for a visual state.
 *
 * IT IS NOT A PREFERENCE, AND IT MAY NOT BECOME ONE. Nothing here touches localStorage,
 * sessionStorage or a cookie. Focused mode is a property of WHERE THE OPERATOR IS, so persisting it
 * would let a stale stored value contradict the route — and it would also silently overwrite the
 * operator's real, persisted secondary-navigation preference, which this file must leave exactly as
 * it found it. Leaving Heby restores that preference because focused mode never wrote to it.
 *
 * THE WAY BACK IS ALWAYS ON SCREEN. `HebyFocusControl` lives in the top bar, which focused mode
 * keeps. A mode that hides navigation must never also hide the control that brings it back.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { HebySurfaceState } from "@/features/heby-surface";
import { useHebySurface } from "./heby-surface-context";

interface HebyFocusValue {
  /** The route is Heby's own full workspace, so focused mode is available at all. */
  readonly eligible: boolean;
  /** Focused mode is currently applied (at `lg` and above — the width clause is CSS). */
  readonly focused: boolean;
  /** Toggle. Restoring shows the workspace navigation again; it writes no preference. */
  readonly toggle: () => void;
}

const FocusContext = createContext<HebyFocusValue | null>(null);

/** Focused mode's three answers. `unavailable` is "not on Heby's surface", never "switched off". */
export type HebyFocusMode = "focused" | "restored" | "unavailable";

/**
 * THE RULE, STATED ONCE AND PURELY.
 *
 * It is a function of the surface — which is a function of the route — and of one per-visit request
 * for the navigation back. There is no third input, and in particular no stored value: a mode that
 * could be read from storage could contradict the route, which is the one thing it is derived from.
 *
 * Pure. No React, no DOM, no storage, no clock.
 */
export function resolveHebyFocusMode(input: {
  readonly surface: HebySurfaceState;
  readonly restored: boolean;
}): HebyFocusMode {
  if (input.surface !== "full-workspace") return "unavailable";
  return input.restored ? "restored" : "focused";
}

/** The one root attribute focused mode owns. It is NEVER `data-secondary` — that is the operator's. */
const FOCUS_ATTRIBUTE = "hebyFocus";

export function HebyFocusProvider({ children }: { children: React.ReactNode }) {
  const { surface } = useHebySurface();
  /*
   * "The operator asked for the navigation back." Local, per-visit, and deliberately NOT persisted:
   * see the header. It is reset whenever eligibility changes, so leaving Heby and returning starts
   * from the surface's own composition rather than from a decision made in another visit.
   */
  const [restored, setRestored] = useState(false);
  /*
   * Reset ON THE TRANSITION, in render, not in an effect. React's own "adjusting state when a prop
   * changes" pattern: an effect would let one frame paint with the previous visit's decision still
   * applied, and would make this file react to itself. The decision is per-visit by construction —
   * it is dropped the moment the operator is no longer on Heby's surface.
   */
  const eligible = resolveHebyFocusMode({ surface, restored: false }) !== "unavailable";
  const [wasEligible, setWasEligible] = useState(eligible);
  if (wasEligible !== eligible) {
    setWasEligible(eligible);
    if (!eligible && restored) setRestored(false);
  }
  const focused = resolveHebyFocusMode({ surface, restored }) === "focused";

  useEffect(() => {
    const root = document.documentElement;
    if (focused) root.dataset[FOCUS_ATTRIBUTE] = "on";
    else delete root.dataset[FOCUS_ATTRIBUTE];
    /*
     * Cleanup matters more than it looks: the shell survives client navigation, so without this a
     * surface that unmounted while focused would leave the whole product wearing Heby's layout.
     */
    return () => {
      delete document.documentElement.dataset[FOCUS_ATTRIBUTE];
    };
  }, [focused]);

  const toggle = useCallback(() => setRestored((previous) => !previous), []);

  const value = useMemo<HebyFocusValue>(() => ({ eligible, focused, toggle }), [eligible, focused, toggle]);

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useHebyFocus(): HebyFocusValue {
  const value = useContext(FocusContext);
  if (!value) throw new Error("useHebyFocus must be used inside HebyFocusProvider");
  return value;
}

/**
 * The always-visible way back to the workspace navigation.
 *
 * It replaces the generic secondary-navigation toggle for as long as the operator is on Heby, so
 * there is exactly ONE control governing the shell's navigation at any moment rather than two that
 * could disagree. Off Heby it renders nothing and the generic toggle is back.
 *
 * It announces its state (`aria-pressed`) rather than relying on the icon, and it is desktop-only
 * for the same reason the mode is: below `lg` the shell uses drawers, which focused mode never
 * touches.
 */
export function HebyFocusControl() {
  const { eligible, focused, toggle } = useHebyFocus();
  if (!eligible) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={focused}
      data-heby-focus-control=""
      aria-label={focused ? "Show workspace navigation" : "Hide workspace navigation"}
      title={focused ? "Show workspace navigation" : "Hide workspace navigation"}
      className="hidden size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring lg:flex"
    >
      {focused ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
    </button>
  );
}
