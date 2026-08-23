/*
 * config/public-site.ts — the public site's own origin, in one place.
 *
 * ── WHY A CONSTANT AND NOT AN ENVIRONMENT VARIABLE ───────────────────────────
 *
 * `metadataBase`, `robots.ts` and `sitemap.ts` must agree on one absolute origin, and a value read
 * from the environment can disagree with itself across a preview deployment, a production one and
 * a local run — producing a sitemap that advertises one host while the canonical tag names
 * another. Nothing here needs to vary per deployment today: there is exactly one public origin,
 * and moving it is a deliberate act with its own gate, not a configuration change.
 *
 * `hebuntech.com` is deliberately NOT this value. That domain currently serves a different
 * application, and naming it here would publish a canonical URL and a sitemap pointing at a site
 * this repository does not control.
 *
 * Pure. No React, no I/O, no server.
 */
export const PUBLIC_SITE_ORIGIN = "https://hebun-ai-recovered.vercel.app";

/**
 * The complete set of paths the public site publishes.
 *
 * It is the single list `sitemap.ts` enumerates and `robots.ts` permits, so a path cannot be
 * advertised in one and withheld in the other. `/login` is public at the edge but is NOT here: a
 * sign-in form is not a document anybody should arrive at from a search result.
 */
export const PUBLIC_INDEXABLE_PATHS = Object.freeze(["/", "/contact", "/privacy", "/terms"]);
