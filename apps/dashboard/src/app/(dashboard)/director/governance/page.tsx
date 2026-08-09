import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Governance — Hebun AI" };

/*
 * Legacy Governance Center hub — retired in Hebun UI Phase 23D.
 *
 * This mock console presented fabricated governance health, approval queues, risk heatmaps, and
 * compliance scores as organizational truth. The authoritative Governance entry point is the
 * honest Overview at /governance (Phase 23B). This route permanently redirects there. Single hop,
 * no loop (the target is a distinct real page that does not redirect), no chain.
 */

export default function GovernanceCenterLegacyPage(): never {
  permanentRedirect("/governance");
}
