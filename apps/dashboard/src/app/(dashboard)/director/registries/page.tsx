import { PageHeader } from "@/components/layout/page-header";
import { RegistriesDirectory } from "@/components/registries/registries-directory";

export const metadata = { title: "Registries — Hebun AI" };

/*
 * Registries hub (Knowledge L2 · Hebun UI Phase 21C rebuild).
 *
 * A read-only reference directory of the organizational registries and who owns their
 * authority. It no longer renders the fabricated registry metrics (totalRecords,
 * dailyGrowth, health %, synchronization %, coverage %, freshness) or seeded sample
 * records as truth. Structural facts only; each registry's authority lives in the
 * owning system, and mock-backed legacy detail is labelled, not presented as
 * authoritative. Knowledge is a directory here, not a second authority.
 *
 * The 15 legacy L3 detail routes are untouched in Phase 21C (their disposition is
 * Phase 21D); the hub does not present them as authoritative.
 */

export default function RegistriesPage() {
  return (
    <>
      <PageHeader
        title="Registries"
        context="What organizational registries exist, who owns them, and their connection state — a read-only reference directory."
      />
      <RegistriesDirectory />
    </>
  );
}
