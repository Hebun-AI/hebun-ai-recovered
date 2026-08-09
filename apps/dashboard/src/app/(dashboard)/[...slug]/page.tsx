import { notFound, redirect } from "next/navigation";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { resolveModulePath, placeholderPaths } from "@/config/sidebar.config";

/*
 * Catch-all module page. Every entry in sidebar.config.ts without a real
 * page renders here as a placeholder — adding a config entry is enough
 * to get a working route. Static routes always win over this catch-all.
 *
 * UI Phase 25D — Workforce closure. The legacy `/workforce/{dept}/{agent}` shadow tree
 * (sidebar-only, direct-URL only, never linked from the mounted navigation) used to resolve here
 * and render a fabricated live AgentCard. It has no truthful canonical detail surface; each entry
 * represents an agent, so the whole 3-segment tree now redirects (single hop) to the authoritative
 * `/agents`. The real 2-segment Workforce routes (`/workforce/teams`, `/workforce/capabilities`)
 * are concrete pages and never reach this catch-all.
 */

export function generateStaticParams() {
  return placeholderPaths()
    // Do not pre-generate the retired Workforce shadow tree — it redirects at request time.
    .filter((href) => !/^\/workforce\/[^/]+\/[^/]+/.test(href))
    .map((href) => ({ slug: href.split("/").filter(Boolean) }));
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;

  // Phase 25D: retire the fabricated Workforce agent-detail shadow tree.
  if (/^\/workforce\/[^/]+\/[^/]+/.test(path)) redirect("/agents");

  const module_ = resolveModulePath(path);
  if (!module_) notFound();

  return <ModulePlaceholder module={module_} />;
}
