import type { MetadataRoute } from "next";
import { PUBLIC_SITE_ORIGIN, PUBLIC_INDEXABLE_PATHS } from "@/config/public-site";

/*
 * sitemap.xml — the four public documents, and nothing else.
 *
 * It enumerates `PUBLIC_INDEXABLE_PATHS`, the same list `robots.ts` permits, so the two cannot
 * disagree about what is public. No authenticated route appears here, and none can: this file has
 * no route registry to walk and no session to resolve.
 *
 * `lastModified` is deliberately ABSENT. Next would default it to build time, which would tell a
 * crawler that every public document changed on every deployment — a claim about these documents
 * that is false in almost every deployment, including a deployment that changed only the
 * dashboard. An absent date says nothing rather than something untrue.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_INDEXABLE_PATHS.map((path) => ({
    url: new URL(path, PUBLIC_SITE_ORIGIN).toString(),
  }));
}
