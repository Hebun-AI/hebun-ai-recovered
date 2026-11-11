/*
 * P2 Design System, Phase 2A — theme preference.
 *
 * A theme is a per-browser preference, kept per EXPERIENCE: the customer workspace opens Light and the
 * future Platform Admin opens Dark (Master Plan V2, P2), and choosing Dark in one never changes the
 * other. The preference is a plain cookie so the server renders the right theme on the first byte —
 * no flash, no database field, no migration. An absent or malformed cookie resolves to the
 * experience's default; it is never trusted as anything but one of the two names.
 */

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export type ThemeExperience = "customer" | "admin";

export const THEME_DEFAULTS: Readonly<Record<ThemeExperience, Theme>> = {
  customer: "light",
  admin: "dark",
};

/** One year. A preference, not a session: it outlives sign-out on purpose. */
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function themeCookieName(experience: ThemeExperience): string {
  return `hebun-theme-${experience}`;
}

export function resolveTheme(experience: ThemeExperience, stored: string | undefined | null): Theme {
  return stored === "light" || stored === "dark" ? stored : THEME_DEFAULTS[experience];
}

export function nextTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}
