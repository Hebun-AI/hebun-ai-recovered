/*
 * The Hebun AI wordmark — TEXT ONLY.
 *
 * There is no symbol, no icon, no gradient and no image, because none exists: inventing one here
 * would create a second brand authority that no design phase has decided. The mark is the product
 * name set in the typeface the product already loads.
 *
 * PREFERRED LOCKUP: "Hebun" in primary ink, "AI" in brand blue, one weight (800) and one size for
 * both words — "AI" is part of the name, not a suffix or a badge.
 *
 * MONOCHROME: `tone="mono"` sets both words in `currentColor`. It is not an opacity trick — an
 * opacity difference disappears in print, at favicon size, and on any non-flat ground, and would
 * make the mark read as two things of unequal importance. On an inverted surface this is the
 * correct lockup, not a degraded one.
 */
export function PublicWordmark({
  tone = "brand",
  className,
}: {
  readonly tone?: "brand" | "mono";
  readonly className?: string;
}) {
  return (
    /*
     * NO `aria-label` AND NO `aria-hidden`, deliberately.
     *
     * An earlier version carried `aria-label="Hebun AI"` on this span to keep the two colour runs
     * from being read apart. That is a PROHIBITED attribute — `aria-label` on a `<span>` with no
     * role is ignored by some assistive technology and flagged by every audit — and it was also
     * unnecessary: the two runs are adjacent text nodes separated by a real space, so the
     * accessible name computes to "Hebun AI" from the content itself. The colour break is a
     * painting concern and never reaches the accessibility tree.
     */
    <span className={`font-extrabold tracking-[-0.025em] ${className ?? ""}`}>
      <span className={tone === "brand" ? "text-fg" : undefined}>Hebun</span>{" "}
      <span className={tone === "brand" ? "text-primary" : undefined}>AI</span>
    </span>
  );
}
