import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Policies & Rules — Hebun AI" };

/*
 * Legacy Policy & Governance Engine console — retired in Hebun UI Phase 23D.
 *
 * The authoritative policy surface is Policies & Rules at /director/governance/policies (Phase 23B),
 * which reads the real policy engine structure with an explicit DERIVED · SEEDED INPUT state instead
 * of the fabricated policy health metric this page rendered. Single hop, no loop, no chain.
 */

export default function PolicyLegacyPage(): never {
  permanentRedirect("/director/governance/policies");
}
