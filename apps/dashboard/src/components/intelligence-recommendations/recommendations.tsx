import { Lightbulb, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { RecommendationsModel } from "@/features/intelligence-surfaces/workspace-model";

/*
 * Intelligence · Recommendations (Hebun UI Phase 20C rebuild) — a strictly advisory surface. It
 * retires the mock-backed recommendations. A recommendation is a suggested course of action; it is
 * NOT a decision, approval, prepared action, authorized action, or execution. The Runtime surfaces
 * none, so the queue is an honest empty state — no fabricated recommendation, impact %, confidence %,
 * ROI, urgency, owner, deadline, or status, and no inline execution. Heby advisory only.
 */

export function Recommendations({ model }: { model: RecommendationsModel }) {
  return (
    <>
      <PageHeader
        title="Recommendations"
        context="What Intelligence suggests the Director consider — advisory only, and always distinct from a decision."
        action={<Badge variant="neutral">Advisory</Badge>}
      />

      {/* Honest state */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Recommendations</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
            <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
            None available — Runtime not connected
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
        <span className="text-xs text-fg-muted">No recommendation ≠ no improvement exists.</span>
        <span className="ml-auto">
          <HebyWhy label="Explain" variant="icon" region={{ key: "recommendations", label: "Recommendations" }} intent="EXPLAIN" />
        </span>
      </div>

      {/* Empty advisory queue */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Lightbulb className="size-6 text-fg-muted" />
          <p className="text-sm font-medium text-fg">No recommendations are available</p>
          <p className="max-w-md text-xs leading-5 text-fg-muted">
            No validated intelligence has produced an advisory recommendation — the runtime is not connected.
            Each future recommendation carries its evidence and remains advisory; none is fabricated.
          </p>
        </CardContent>
      </Card>

      {/* The chain — recommendation is not a decision or an execution */}
      <h2 className="mb-3 text-sm font-semibold text-fg">A recommendation is not a decision</h2>
      <Card className="mb-6">
        <CardContent>
          <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {model.chain.map((step, index, arr) => (
              <li key={step.order} className="flex items-center gap-2">
                <span className="rounded-md border border-border bg-surface-sunken px-2 py-1 text-[0.7rem] font-medium text-fg-secondary">
                  {step.label}
                  <span className="ml-1.5 text-fg-muted">· {step.owner}</span>
                </span>
                {index < arr.length - 1 && <ArrowRight className="hidden size-3 shrink-0 text-fg-muted sm:block" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-5 text-fg-muted">
            Intelligence only owns the first two steps. Everything downstream terminates at human authority; execution happens elsewhere.
          </p>
        </CardContent>
      </Card>

      {/* Where recommendations come from + confidence */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-fg">Where recommendations come from</p>
            <div className="flex flex-col gap-2">
              {model.advisoryKinds.map((kind) => (
                <div key={kind.kind}>
                  <span className="text-xs font-semibold text-fg">{kind.label}</span>
                  <p className="text-[0.7rem] leading-5 text-fg-muted">{kind.describes}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-fg">Confidence (ordinal — not a score)</p>
            <div className="flex flex-wrap gap-2">
              {model.confidenceLevels.map((c) => (
                <span key={c.level} className="rounded-md border border-border bg-surface-sunken px-2 py-1 text-[0.7rem] font-medium text-fg-secondary">
                  {c.label}
                </span>
              ))}
            </div>
            <p className="text-[0.7rem] leading-5 text-fg-muted">No impact %, no ROI, no urgency score — advisory with evidence and declared uncertainty.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
