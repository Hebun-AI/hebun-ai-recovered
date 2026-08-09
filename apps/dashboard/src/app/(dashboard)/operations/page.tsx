import { PageHeader } from "@/components/layout/page-header";
import { OperationsOverview } from "@/components/operations-overview/operations-overview";

export const metadata = { title: "Operations — Hebun AI" };

/*
 * Operations Overview (Hebun UI Phase 22B rebuild).
 *
 * The operational truth surface: what operational state Hebun can actually observe today,
 * and where the execution boundary sits. It states honest availability per subsystem and
 * the real prepared→executed boundary (counts from the Phase 17 action registry). It no
 * longer presents the seeded/derived Executive Overview record counts as live operational
 * detail. No aggregate Operations Health %, no fabricated run/queue/incident/agent counts,
 * no execution controls. Read-only.
 */

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Operations"
        context="What operational state Hebun can observe today — and where the execution boundary sits."
      />
      <OperationsOverview />
    </>
  );
}
