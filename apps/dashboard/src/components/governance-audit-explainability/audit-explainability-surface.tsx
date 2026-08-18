/*
 * audit-explainability-surface.tsx — read-only Audit & Explainability inspection (Hebun UI Phase 23C).
 *
 * Surfaces the structure of the real engine's audit trace and governance explanation with an
 * honest state. Renders NO synthetic audit event, NO fabricated timestamp, and NO model
 * chain-of-thought; this surface reads no durable audit record. Explainability is inspectable
 * provenance, not hidden reasoning. It does not duplicate Security Center.
 *
 * Server component — no client state, no mutation affordance.
 */

import { Ban, GitBranch, ListOrdered, ScrollText, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuditExplainabilityModel } from "@/features/governance-audit-explainability";

export function AuditExplainabilitySurface() {
  const model = getAuditExplainabilityModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* State */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <ScrollText className="size-4 text-fg-secondary" aria-hidden="true" />
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

      {/* Audit pipeline stages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="size-4 text-fg-muted" aria-hidden="true" />
            Audit &amp; explanation stages
          </CardTitle>
          <span className="text-xs text-fg-muted">Real deterministic stages — structure, not persisted records.</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {model.auditStages.map((stage) => (
            <div key={stage.id} className="rounded-md border border-border bg-surface-sunken p-3">
              <p className="text-sm font-semibold text-fg">{stage.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-fg-muted">{stage.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Audit trace model + durable records honest-empty */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Audit trace</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-5 text-fg-muted">{model.auditModel.note}</p>
            <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">A trace records</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {model.auditModel.recordFields.map((field) => (
                <Badge key={field} variant="neutral">{field}</Badge>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-sunken p-3 text-xs text-fg-secondary">
              <Ban className="size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
              {model.durableRecords.note}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Explainability</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-5 text-fg-muted">{model.explainabilityNote}</p>
            <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">An explanation exposes</p>
            <div className="mt-1 flex flex-col gap-1.5">
              {model.explanationTraces.map((trace) => (
                <div key={trace.name} className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold text-fg">{trace.name}</span>
                  <span className="text-fg-muted">{trace.describes}</span>
                </div>
              ))}
            </div>
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
        Audit &amp; Explainability is read-only. It inspects provenance and structure; it never records, approves, enforces, or executes, and it does not duplicate Security Center.
      </p>
    </div>
  );
}
