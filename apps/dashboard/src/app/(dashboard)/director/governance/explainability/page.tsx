import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Audit & Explainability — Hebun AI" };

/*
 * Legacy Explainability Center — retired in Hebun UI Phase 23D; Explainability is folded into
 * Audit & Explainability.
 *
 * This page presented fabricated "AI decisions" with invented confidence and coverage percentages as
 * organizational truth. Explainability is inspectable provenance, not an independent authoritative
 * surface and not a model chain-of-thought. The authoritative surface is Audit & Explainability at
 * /director/governance/audit (Phase 23C). This route permanently redirects there. Single hop, no loop,
 * no chain.
 */

export default function GovernanceExplainabilityLegacyPage(): never {
  permanentRedirect("/director/governance/audit");
}
