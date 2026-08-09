import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Providers & Models — Hebun AI" };

/*
 * Legacy Provider Adapter Framework console — retired in Hebun UI Phase 24D.
 *
 * This page presented a fabricated conformance/health badge over the provider framework. The provider
 * framework is a real deterministic offline substrate consumed read-only by the authoritative surfaces;
 * its capability truth belongs to Providers & Models at /director/provider-matrix (Phase 24B). This
 * route permanently redirects there. Single hop, no loop (the target is a distinct real page), no chain.
 */

export default function ProviderFrameworkLegacyPage(): never {
  permanentRedirect("/director/provider-matrix");
}
