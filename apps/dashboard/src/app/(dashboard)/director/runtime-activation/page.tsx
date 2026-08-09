import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Provider Runtime — Hebun AI" };

/*
 * Legacy Live Runtime Activation console — retired in Hebun UI Phase 24D.
 *
 * This page presented a fabricated activation "Health X%" badge. Runtime activation is part of the
 * offline provider runtime eligibility machinery (it keeps every provider in simulation/blocked). Its
 * truth belongs to Provider Runtime at /director/provider-invocation (Phase 24C), where live
 * eligibility is shown as blocked. This route permanently redirects there. Single hop, no loop, no chain.
 */

export default function RuntimeActivationLegacyPage(): never {
  permanentRedirect("/director/provider-invocation");
}
