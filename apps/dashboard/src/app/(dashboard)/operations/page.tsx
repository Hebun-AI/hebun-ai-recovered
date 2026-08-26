import { PageHeader } from "@/components/layout/page-header";
import { OperationsOverview } from "@/components/operations-overview/operations-overview";
import { OperationsPreparation } from "@/components/operations-preparation/operations-preparation";

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
 *
 * OPS-P1 adds the PREPARATION surface beneath it — Recipients and Prepared work — which completes
 * the R3R and R3W authorities that shipped with server actions and no interface. It changes nothing
 * about the Overview above: preparation is not execution, records an address and a draft and
 * nothing else, and files no proposal. `/send` in Heby remains the only way a proposal is created.
 *
 * It renders INSIDE this route rather than beside it: the released Operations L2 is exactly
 * `Overview · Execution · Runtime & Signals · Execution Substrate`, pinned by deepEqual, and no
 * fifth destination is introduced.
 */

export default function OperationsPage() {
  return (
    <>
      <PageHeader
        title="Operations"
        context="What operational state Hebun can observe today — and where the execution boundary sits."
      />
      <OperationsOverview />
      <OperationsPreparation />
    </>
  );
}
