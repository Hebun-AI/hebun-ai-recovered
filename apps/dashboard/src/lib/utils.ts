import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The five Stage 0 semantic type steps, as tailwind-merge must understand them.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * `--text-display|title|body|meta|label` are declared in the theme and Tailwind compiles them
 * correctly: the production stylesheet carries `.text-label { font-size: var(--fs-label) }` and the
 * browser renders 28 / 18 / 16 / 13 / 12px. The utilities are real.
 *
 * tailwind-merge does not know that. Its class groups are built from Tailwind's DEFAULT scale, so
 * `text-xs` is a font size and `text-label` is not — and an unrecognised `text-*` falls into the
 * text-COLOUR group. `cn()` then treats a semantic size and a text colour as the same conflict and
 * keeps whichever came last, deleting the other. Measured in the released product, on the canonical
 * Knowledge workspace:
 *
 *   cn("… text-fg-muted", "text-label")        -> `text-label` survives, the colour is GONE.
 *                                                 Region eyebrows rendered #142033, not #5b687a.
 *   cn("… text-fg-secondary", "text-meta")     -> `text-meta` survives, the colour is GONE.
 *                                                 Region plain titles rendered #142033, not #526075.
 *   cn("text-meta", "text-fg-secondary")       -> the SIZE would be gone instead.
 *
 * Which of the two is destroyed depends only on the order they were written in, which is why this
 * cannot be fixed at the call sites: the same class is correct in a plain `className` and silently
 * broken the moment it passes through `cn()`. Counted over `src`, comments stripped: 80 usages in
 * 21 files, 76 written plainly and 4 passing through `cn()`, and the two spellings must not mean
 * different things.
 *
 * So the five are registered where the merge decides — one configuration, one owner, no call site
 * touched, and no second scale. `text-xs` and `text-sm` are untouched: tailwind-merge already knows
 * them, which is exactly why VI-2's shell floor was written in `text-xs` and stays there.
 */
const SEMANTIC_TYPE_STEPS = ["display", "title", "body", "meta", "label"] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...SEMANTIC_TYPE_STEPS] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
