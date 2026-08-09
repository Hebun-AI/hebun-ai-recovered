import { Sparkles, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { InsightsModel } from "@/features/intelligence-surfaces/workspace-model";

/*
 * Intelligence · Insights (Hebun UI Phase 20C rebuild) — the validated-intelligence reading
 * surface. It retires the mock-backed "Strategic Forecasts" page. An insight is a candidate
 * (learning or optimization) that has crossed the runtime validation stage carrying evidence and
 * declared confidence — the Runtime surfaces none, so this is an honest empty state. No fabricated
 * forecast, confidence %, trend, causal claim, score, or business outcome. Insights stay
 * evidence/provenance/uncertainty aware. Heby advisory only.
 */

export function Insights({ model }: { model: InsightsModel }) {
  return (
    <>
      <PageHeader
        title="Insights"
        context="Validated intelligence — understanding that has crossed the runtime's validation boundary carrying its evidence and uncertainty."
        action={<Badge variant="neutral">Validated</Badge>}
      />

      {/* The validation boundary */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm leading-6 text-fg-secondary">
                A candidate becomes an insight only when it passes{" "}
                <span className="font-medium text-fg">{model.validationStage?.label ?? "validation"}</span> with an evidence basis.
                Validated ≠ decision; an insight informs, it does not authorize.
              </p>
            </div>
            <span className="ml-auto">
              <HebyWhy label="Summarize" variant="icon" region={{ key: "insights", label: "Insights" }} intent="SUMMARIZE" />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Honest empty */}
      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Sparkles className="size-6 text-fg-muted" />
          <p className="text-sm font-medium text-fg">No validated intelligence is available</p>
          <p className="max-w-md text-xs leading-5 text-fg-muted">
            No candidate has been validated — the runtime inputs are not connected. An insight appears here
            only when a real candidate crosses validation with evidence; nothing is fabricated.
          </p>
        </CardContent>
      </Card>

      {/* Where validated intelligence comes from */}
      <h2 className="mb-3 text-sm font-semibold text-fg">Where validated intelligence comes from</h2>
      <section aria-label="Validated intelligence kinds" className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {model.validatedKinds.map((kind) => (
          <Card key={kind.kind} className="h-full">
            <CardContent className="flex h-full flex-col gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <span className="text-sm font-semibold text-fg">{kind.label}</span>
              </div>
              <p className="text-xs leading-5 text-fg-secondary">{kind.describes}</p>
              <div className="mt-auto pt-1">
                <Badge variant="neutral">Evidence-based</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Confidence — ordinal */}
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-fg">Confidence an insight carries</p>
          <div className="flex flex-wrap gap-2">
            {model.confidenceLevels.map((c) => (
              <span key={c.level} className="rounded-md border border-border bg-surface-sunken px-2 py-1 text-[0.7rem] font-medium text-fg-secondary">
                {c.label}
              </span>
            ))}
          </div>
          <p className="text-[0.7rem] leading-5 text-fg-muted">An ordinal level with its evidence — never a percentage, never a bare score.</p>
        </CardContent>
      </Card>
    </>
  );
}
