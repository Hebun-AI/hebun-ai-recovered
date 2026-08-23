import type { MetadataRoute } from "next";
import { PUBLIC_SITE_ORIGIN, PUBLIC_INDEXABLE_PATHS } from "@/config/public-site";

/*
 * robots.txt.
 *
 * ── THE SEMANTICS, STATED PRECISELY, BECAUSE THEY ARE EASY TO GET BACKWARDS ──
 *
 * `Disallow: /` is the base rule: by default nothing in this application may be crawled. The
 * `Allow` list then re-opens exactly the four public documents. Crawlers resolve conflicting rules
 * by the MOST SPECIFIC match, so `/contact` beats `/`.
 *
 * The root needs the `$` end-of-path anchor. A bare `Allow: /` would be a prefix rule matching
 * EVERY path in the application and would silently re-open the authenticated product — the exact
 * mistake this file exists to avoid. `Allow: /$` matches the homepage and nothing beneath it.
 *
 * ── THIS IS NOT AN ACCESS CONTROL ────────────────────────────────────────────
 *
 * robots.txt is a request to well-behaved crawlers and enforces nothing. The authenticated
 * surfaces are protected by the edge gate in `middleware.ts` and, authoritatively, by the
 * `(dashboard)` layout's server-side session check. This file exists so the public site can be
 * indexed WITHOUT the product becoming indexable alongside it — it is a discoverability decision,
 * never a security one.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: PUBLIC_INDEXABLE_PATHS.map((path) => (path === "/" ? "/$" : path)),
      disallow: "/",
    },
    sitemap: `${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
  };
}
