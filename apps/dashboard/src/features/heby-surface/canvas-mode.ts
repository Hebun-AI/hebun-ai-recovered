/*
 * heby-surface/canvas-mode.ts — G7. Whether the Heby canvas is INVITING a question or resting.
 *
 * The approved reference asks for a composer that is not permanently parked across the bottom of
 * the screen: Heby is the presence, and conversation emerges from it. This module is the single
 * pure decision for that, for the same reason `composition.ts` is the single pure decision for how
 * the presence and the transcript share the room — the alternative is the rule living in scattered
 * event handlers where it cannot be proved.
 *
 * ── THE COMPOSER IS ALWAYS MOUNTED. THIS ONLY DECIDES ITS PRESENTATION. ─────
 *
 * "Emerging" is a visual state, never a mounting condition, and that is deliberate on three counts:
 *
 *   ACCESSIBILITY   a control that exists only after a mouse enters a region is unreachable by
 *                   keyboard, by touch, and by a screen reader. The dock is in the document at all
 *                   times, tabbable at all times, and `resting` is styling.
 *   HONESTY         a surface that hides its input while it is unavailable would hide the reason
 *                   too. The notice line lives in the composer.
 *   NO DATA LOSS    a draft, an in-flight request or an open microphone can never be hidden,
 *                   because each of them forces `inviting` below.
 *
 * Pure. No React, no DOM, no I/O, no timer.
 */

import type { HebyComposition } from "./composition";

/** `inviting` — the composer is presented. `resting` — it is a quiet affordance at the edge. */
export type HebyDockState = "inviting" | "resting";

export interface HebyDockInput {
  /** How the presence and the transcript are currently sharing the room. */
  readonly composition: HebyComposition;
  /** The pointer is genuinely inside the dock's reveal region. A real UI fact. */
  readonly pointerInDock: boolean;
  /** Focus is genuinely inside the dock. Keyboard users reach `inviting` through this. */
  readonly focusInDock: boolean;
  /** The operator has typed something. A draft may never be hidden. */
  readonly hasDraft: boolean;
  /** A request or a server read is genuinely in flight. */
  readonly busy: boolean;
  /** A microphone is genuinely open or an answer is genuinely being played back. */
  readonly voiceActive: boolean;
  /** The surface has PROVEN it cannot take a question. The reason is in the composer. */
  readonly unavailable: boolean;
}

/**
 * The rule, stated once.
 *
 * Resting is only possible in the HERO composition — the empty screen the reference is about. The
 * moment a conversation exists the operator is working, and taking their input away to preserve a
 * composition would be the surface serving itself rather than them.
 */
export function resolveHebyDock(input: HebyDockInput): HebyDockState {
  if (input.composition !== "hero") return "inviting";
  if (input.pointerInDock || input.focusInDock) return "inviting";
  if (input.hasDraft || input.busy || input.voiceActive || input.unavailable) return "inviting";
  return "resting";
}
