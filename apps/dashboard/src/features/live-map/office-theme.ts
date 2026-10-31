import type { LiveMapAgentOfficePlacement } from "./contracts";

/*
 * LIVE MAP — WHICH ROOM AN OFFICE PAGE DRAWS (PHASE 4B).
 *
 * A cosmetic choice over one authoritative fact: the department an agent is CURRENTLY placed in. The
 * name, the id and the counts never reach this file, so no agent is matched to a picture, and an
 * unread, withdrawn or historical placement is the neutral room.
 *
 * A theme says nothing about what an agent does or may do. A security room grants no security
 * authority, and any room is a room, not activity.
 *
 *     THEME != AUTHORITY        ROOM != WORK
 */
export type OfficeTheme = "neutral" | "content" | "engineering" | "security";

const THEME_BY_DEPARTMENT_SLUG: Readonly<Record<string, OfficeTheme>> = {
  content: "content",
  engineering: "engineering",
  security: "security",
};

export function officeThemeFor(placement: LiveMapAgentOfficePlacement): OfficeTheme {
  if (placement.status !== "available" || placement.state !== "placed") return "neutral";
  const slug = placement.department?.slug;
  return (slug && Object.hasOwn(THEME_BY_DEPARTMENT_SLUG, slug) && THEME_BY_DEPARTMENT_SLUG[slug]) || "neutral";
}
