/*
 * compliance-risk-surface.tsx — read-only Compliance & Risk inspection (Hebun UI Phase 23C).
 *
 * Surfaces the real compliance/risk EVALUATION structure with an explicit DERIVED · SEEDED INPUT
 * state. Renders NO fabricated compliance %, compliance/risk score, violation/incident count, or
 * trend, and NO approve/reject/enforce/resolve control. Compliance evaluation is not
 * certification; risk evaluation is not an incident.
 *
 * Server component — no client state, no mutation affordance.
 */

import { AlertTriangle, GitBranch, ListChecks, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getComplianceRiskModel, type EvaluationStageView } from "@/features/governance-compliance-risk";

function Stages({ stages }: { stages: readonly EvaluationStageView[] }) {
  return (
    <div className="flex flex-col gap-2">
      {stages.map((stage) => (
        <div key={stage.id} className="rounded-md border border-border bg-surface-sunken p-3">
          <p className="text-sm font-semibold text-fg">{stage.label}</p>
          <p className="mt-0.5 text-xs leading-5 text-fg-muted">{stage.description}</p>
        </div>
      ))}
    </div>
  );
}

export function ComplianceRiskSurface() {
  const model = getComplianceRiskModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* State */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <AlertTriangle className="size-4 text-fg-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-fg">{model.state.headline}</h2>
              <Badge variant="warning">DERIVED · SEEDED INPUT</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-fg-secondary">{model.state.detail}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4 text-fg-muted" aria-hidden="true" />
              Compliance evaluation
            </CardTitle>
            <span className="text-xs text-fg-muted">Real deterministic stages — structure, not scores.</span>
          </CardHeader>
          <CardContent>
            <Stages stages={model.complianceStages} />
            <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">Frameworks evaluated (reference)</p>
            <div className="mt-1 flex flex-col gap-1.5">
              {model.frameworks.map((f) => (
                <div key={f.name} className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold text-fg">{f.name}</span>
                  <span className="text-fg-muted">{f.note}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.7rem] text-fg-muted">Scored over seeded data — not a live compliance certification. No score is surfaced.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-fg-muted" aria-hidden="true" />
              Risk evaluation
            </CardTitle>
            <span className="text-xs text-fg-muted">Real deterministic stage — a posture, not an incident.</span>
          </CardHeader>
          <CardContent>
            <Stages stages={model.riskStages} />
            <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">Risk levels</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {model.riskModel.levels.map((level) => (
                <Badge key={level} variant="neutral">{level}</Badge>
              ))}
            </div>
            <p className="mt-2 text-[0.7rem] leading-5 text-fg-muted">{model.riskModel.note}</p>
          </CardContent>
        </Card>
      </div>

      {/* Distinctions */}
      <Card>
        <CardHeader>
          <CardTitle>What this means</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {model.distinctions.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm leading-6 text-fg-secondary">
                <GitBranch className="mt-1 size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Compliance &amp; Risk is read-only. It inspects evaluation structure; it never certifies compliance, resolves a risk, approves, enforces, or executes.
      </p>
    </div>
  );
}
