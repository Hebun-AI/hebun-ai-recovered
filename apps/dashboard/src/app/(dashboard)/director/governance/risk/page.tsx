import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Compliance & Risk — Hebun AI" };

/*
 * Legacy Risk Center — retired in Hebun UI Phase 23D; the Risk concept is folded into Compliance & Risk.
 *
 * This page presented a fabricated risk register (critical counts, mitigation ownership, trends) as
 * organizational truth. Risk is not an independent authoritative surface: the engine evaluates risk in
 * the same pipeline as compliance. The authoritative surface is Compliance & Risk at
 * /director/governance/compliance (Phase 23C). This route permanently redirects there. Single hop, no
 * loop (the target is a distinct real page that does not redirect), no chain.
 */

export default function GovernanceRiskLegacyPage(): never {
  permanentRedirect("/director/governance/compliance");
}
