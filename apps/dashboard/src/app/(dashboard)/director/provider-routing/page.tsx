import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Provider Runtime — Hebun AI" };

/*
 * Legacy Provider Routing Engine console — retired in Hebun UI Phase 24D.
 *
 * This page presented a fabricated "Routing X%" health badge. Routing is part of the provider runtime
 * machinery — a routing decision is not a dispatch. Its truth belongs to Provider Runtime at
 * /director/provider-invocation (Phase 24C). This route permanently redirects there. Single hop, no
 * loop, no chain.
 */

export default function ProviderRoutingLegacyPage(): never {
  permanentRedirect("/director/provider-invocation");
}
