import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Infrastructure & Settings — Hebun AI" };

/*
 * Legacy Execution Adapter SDK console — retired in Hebun UI Phase 24D.
 *
 * This page presented the adapter registry with a fabricated health/registered badge. The adapter
 * registry is real offline infrastructure; its honest state (a structural count, no authentication)
 * belongs to Infrastructure & Settings at /settings (Phase 24C). This route permanently redirects
 * there. Single hop, no loop, no chain.
 */

export default function AdaptersLegacyPage(): never {
  permanentRedirect("/settings");
}
