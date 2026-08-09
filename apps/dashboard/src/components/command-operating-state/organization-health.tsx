import { Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { OrganizationOperatingStateModel } from "@/features/command-operating-state/workspace-model";

/*
 * Command · Organization Health (Hebun UI Phase 20B) — the organizational OPERATING-STATE
 * matrix. It replaces the retired fake `companyHealth = 94` gauge: there is no percentage, no
 * efficiency/utilization figure, and NO aggregate organization score. Each domain's state is
 * honestly Unknown / Not connected; missing data is never rendered as "Healthy". Heby advisory only.
 */

export function OrganizationHealth({ model }: { model: OrganizationOperatingStateModel }) {
  return (
    <>
      <PageHeader
        title="Organization Health"
        context="Is the organization operating coherently? A composed operating-state across domains — not a score, not system uptime."
        action={<Badge variant="neutral">Operating state</Badge>}
      />

      {/* Honest global state — no score */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Overall</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
            <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
            Unknown — no domain source connected
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
        <span className="text-xs text-fg-muted">Unknown is not unhealthy. No overall score is computed.</span>
        <span className="ml-auto">
          <HebyWhy
            label="Why unknown?"
            variant="icon"
            region={{ key: "organization-health", label: "Organization Health" }}
            intent="ASSESS_UNCERTAINTY"
          />
        </span>
      </div>

      {/* Domain operating-state matrix */}
      <section aria-label="Domain operating state" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {model.domains.map((domain) => (
          <Card key={domain.domain} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Activity className="size-4 shrink-0 text-fg-muted" />
                {domain.domain}
              </span>
              <p className="text-xs leading-5 text-fg-secondary">{domain.question}</p>
              <p className="text-[0.7rem] leading-5 text-fg-muted">{domain.describes}</p>
              <div className="mt-auto pt-1">
                <Badge variant="neutral">
                  {domain.state === "not-connected" ? "Not connected" : "Unknown"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
