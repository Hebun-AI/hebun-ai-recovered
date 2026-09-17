import { PageHeader } from "@/components/layout/page-header";
import { OperationsOverview } from "@/components/operations-overview/operations-overview";
import { OperationsPreparation } from "@/components/operations-preparation/operations-preparation";

/*
 * MEDIA-2B. The generation action defined in this route's `actions.ts` awaits a real OpenAI image
 * call whose transport pins a 150 s timeout (`OPENAI_IMAGE_TIMEOUT_MS`). Server Actions execute in
 * THIS route's function, so the route's duration is the one that has to outlast the transport.
 *
 * It is stated here rather than inherited. The platform default is 300 s only while Fluid compute
 * is on; without it the legacy default is far shorter, and the deployment API does not report which
 * regime applies. 180 s is valid under BOTH (it is under the 300 s legacy ceiling and far under the
 * 800 s Fluid one) and leaves 30 s of headroom over the transport, so the transport's own abort —
 * which records `timeout` on the invocation — always fires BEFORE the platform kills the function
 * and leaves the row stranded in `registered`.
 */
export const maxDuration = 180;

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
