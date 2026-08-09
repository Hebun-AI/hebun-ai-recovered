import { Activity, GitBranch } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { ReadinessPathwaysModel } from "@/features/intelligence-surfaces/workspace-model";

/*
 * Intelligence · Readiness & Pathways (Hebun UI Phase 20C) — the readiness + transition
 * architecture, mapped to the real runtime kinds evolution-readiness + evolution-pathway. The
 * Runtime surfaces none, so both render honest empty states — no fabricated maturity %, readiness
 * %, transformation score, roadmap date, owner, or projected impact. Readiness ≠ recommendation;
 * a pathway ≠ an execution plan ≠ an authorized action. Heby advisory only.
 */

export function ReadinessPathways({ model }: { model: ReadinessPathwaysModel }) {
  const readinessKind = model.kinds.find((k) => k.kind === "evolution-readiness");
  const pathwayKind = model.kinds.find((k) => k.kind === "evolution-pathway");

  return (
    <>
      <PageHeader
        title="Readiness & Pathways"
        context="Whether the organization is ready to change, and what transition path is being considered — advisory, not a roadmap."
        action={<Badge variant="neutral">Evolution</Badge>}
      />

      {/* Honest state */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Evolution intelligence</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
            <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
            Not connected
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
        <span className="text-xs text-fg-muted">A pathway is not an execution plan or an authorized action.</span>
        <span className="ml-auto">
          <HebyWhy label="Compare" variant="icon" region={{ key: "readiness-pathways", label: "Readiness & Pathways" }} intent="COMPARE" />
        </span>
      </div>

      {/* Two-column architecture */}
      <section aria-label="Readiness and pathways" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 shrink-0 text-fg-muted" />
              <span className="text-sm font-semibold text-fg">{readinessKind?.label ?? "Readiness"}</span>
              <Badge variant="neutral" className="ml-auto">Not connected</Badge>
            </div>
            <p className="text-xs leading-5 text-fg-secondary">{readinessKind?.describes}</p>
            <div className="mt-auto rounded-md border border-dashed border-border bg-surface-sunken px-3 py-4 text-center">
              <p className="text-xs text-fg-muted">No readiness intelligence is available.</p>
            </div>
            <p className="text-[0.7rem] leading-5 text-fg-muted">Readiness is a read, not a recommendation.</p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 shrink-0 text-fg-muted" />
              <span className="text-sm font-semibold text-fg">{pathwayKind?.label ?? "Pathway"}</span>
              <Badge variant="neutral" className="ml-auto">Not connected</Badge>
            </div>
            <p className="text-xs leading-5 text-fg-secondary">{pathwayKind?.describes}</p>
            <div className="mt-auto rounded-md border border-dashed border-border bg-surface-sunken px-3 py-4 text-center">
              <p className="text-xs text-fg-muted">No pathway intelligence is available.</p>
            </div>
            <p className="text-[0.7rem] leading-5 text-fg-muted">A described route — not a plan authorized for execution.</p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
