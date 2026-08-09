import { Activity, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { SignalsAssessmentsModel } from "@/features/intelligence-surfaces/workspace-model";

/*
 * Intelligence · Signals & Assessments (Hebun UI Phase 20C) — the observation → signal →
 * assessment flow, mapped to the real runtime kinds awareness-signal + awareness-assessment.
 * The Runtime surfaces no instances, so signals and assessments render honest empty states —
 * no fabricated anomaly, risk, trend, source, or timestamp. Observation ≠ signal ≠ assessment
 * ≠ finding ≠ decision. Heby advisory only.
 */

export function SignalsAssessments({ model }: { model: SignalsAssessmentsModel }) {
  return (
    <>
      <PageHeader
        title="Signals & Assessments"
        context="What the organization has observed, and how it is being interpreted — grounded in the real intelligence runtime."
        action={<Badge variant="neutral">Emerging</Badge>}
      />

      {/* Honest state */}
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Runtime</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
            <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
            Contract-only — inputs not connected
          </span>
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
        <span className="text-xs text-fg-muted">No signal ≠ everything is healthy.</span>
        <span className="ml-auto">
          <HebyWhy label="Investigate" variant="icon" region={{ key: "signals-assessments", label: "Signals & Assessments" }} intent="INVESTIGATE" />
        </span>
      </div>

      {/* Observation → signal → assessment pipeline */}
      <Card className="mb-6">
        <CardContent>
          <p className="mb-3 text-sm font-semibold text-fg">How an observation becomes an assessment</p>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {model.pipeline.map((stage, index, arr) => (
              <li key={stage.stage} className="flex items-center gap-2">
                <span className="rounded-md border border-border bg-surface-sunken px-2 py-1 text-[0.7rem] font-medium text-fg-secondary">
                  {stage.label}
                </span>
                {index < arr.length - 1 && <ArrowRight className="size-3 text-fg-muted" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* The two real kinds */}
      <section aria-label="Signal and assessment kinds" className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {model.kinds.map((kind) => (
          <Card key={kind.kind} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <div className="flex items-center gap-2">
                <Activity className="size-4 shrink-0 text-fg-muted" />
                <span className="text-sm font-semibold text-fg">{kind.label}</span>
              </div>
              <p className="text-xs leading-5 text-fg-secondary">{kind.describes}</p>
              <div className="mt-auto pt-1">
                <Badge variant="neutral">0 surfaced</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Honest empty instance region */}
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Activity className="size-6 text-fg-muted" />
          <p className="text-sm font-medium text-fg">No organizational signals are surfaced yet</p>
          <p className="max-w-md text-xs leading-5 text-fg-muted">
            The intelligence runtime is contract-only — its inputs are not connected, so no signal or
            assessment is produced. Real, evidence-bearing observations appear here when they exist.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
