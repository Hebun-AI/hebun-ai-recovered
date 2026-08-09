import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Provider Runtime — Hebun AI" };

/*
 * Legacy Provider Runtime Boundary console — retired in Hebun UI Phase 24D.
 *
 * This page presented a fabricated "Runtime X%" health badge. The runtime boundary is part of the
 * offline provider runtime machinery (it gates a future live crossing that never occurs). Its truth
 * belongs to Provider Runtime at /director/provider-invocation (Phase 24C). This route permanently
 * redirects there. Single hop, no loop, no chain. Execution/runtime observation remains Operations'
 * authority, not Platform's.
 */

export default function RuntimeBoundaryLegacyPage(): never {
  permanentRedirect("/director/provider-invocation");
}
