import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { ExecutionTable } from "@/components/director/execution-table";
import { executions, executionStatusCounts } from "@/features/director/mock";

/*
 * Active Executions — L1 TRUTH-1.
 *
 * This page rendered `features/director/mock.ts` under the context line "Live execution runs across
 * the platform" and a primary-toned "N runs" badge. Every run, owner, status and graph position was
 * a compiled-in fixture, and nothing on the page said so. For an authenticated tenant that is a
 * false claim about their organization's work.
 *
 * The fixture is retained and relabelled rather than withheld, which is the treatment already
 * released for the other pure-fixture surfaces in this product (`/director` carries
 * ProjectionSourceNotice; `/director/registries/agents` carries the AGENT-ID-0.1 disclosure). No
 * capability is removed and no number is fabricated or zeroed — Hebun has no execution-history
 * authority, so it cannot say this organization has no runs either.
 */

export default function ActiveExecutionsPage() {
  const c = executionStatusCounts;
  const tiles = [
    { label: "Running", value: c.running },
    { label: "Waiting", value: c.waiting },
    { label: "Retrying", value: c.retrying },
    { label: "Blocked", value: c.blocked },
    { label: "Completed", value: c.completed },
    { label: "Failed", value: c.failed },
  ];

  return (
    <>
      <PageHeader
        title="Active Executions"
        context="Fixed example execution runs — a compiled-in fixture, not this organization's work. Nothing here was executed, scheduled or observed; no run below has an owner in your organization."
        action={<Badge variant="warning">{executions.length} example runs</Badge>}
      />

      <p className="mb-6 text-xs leading-5 text-fg-muted">
        Hebun has no execution history authority, so it cannot say what has run for this
        organization. These runs are illustrative content compiled into the product; an empty
        screen here would be its own false claim, so the example is shown and labelled instead.
      </p>

      <div className="grid grid-cols-12 gap-6">
        {tiles.map((t) => (
          <div key={t.label} className="col-span-6 sm:col-span-4 xl:col-span-2">
            <StatCard label={t.label} value={`${t.value}`} />
          </div>
        ))}

        <div className="col-span-12">
          <ExecutionTable runs={executions} />
        </div>
      </div>
    </>
  );
}
