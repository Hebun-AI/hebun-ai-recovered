import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Company Memory — Hebun AI" };

/*
 * Legacy /memory — retired in Hebun UI Phase 21D.
 *
 * Phase 21A/21B established that /director/memory is the single authoritative Company
 * Memory surface (real Enterprise Memory read, read-only). This legacy route was an
 * orphan duplicate backed by the seeded memory-runtime projection and even exposed a
 * memory.create action — a second, non-authoritative memory product. It has no inbound
 * product links. It now issues a direct, permanent, framework-native redirect to the
 * authoritative surface. No memory-runtime, no seeded data, no create action, no loop
 * (the target is a distinct real route), no chain.
 */

export default function LegacyMemoryPage(): never {
  permanentRedirect("/director/memory");
}
