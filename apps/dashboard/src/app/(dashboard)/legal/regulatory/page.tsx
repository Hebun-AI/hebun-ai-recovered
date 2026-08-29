import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { regulatorySummary, regulations } from "@/features/legal/mock";
import type { RegulationImpact } from "@/types";

const impactVariant: Record<RegulationImpact, BadgeVariant> = {
  low: "neutral",
  medium: "info",
  high: "warning",
};

export default function RegulatoryPage() {
  const stats = [
    { label: "Regulations Monitored", value: `${regulatorySummary.monitored}` },
    { label: "High Impact Changes", value: `${regulatorySummary.highImpact}` },
    { label: "Pending Reviews", value: `${regulatorySummary.pendingReviews}` },
    { label: "Policy Update Required", value: `${regulatorySummary.policyUpdateRequired}` },
  ];

  return (
    <>
      <PageHeader
        title="Regulatory Monitoring Center"
        context="Regulation tracking by the Regulatory Monitoring Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="col-span-6 xl:col-span-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Regulatory feed */}
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Regulatory Feed</CardTitle>
              <span className="text-xs text-fg-muted">preview</span>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {regulations.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{r.name}</p>
                    <p className="text-xs text-fg-muted">
                      {r.region} · {r.action} · {r.updated}
                    </p>
                  </div>
                  <Badge variant={impactVariant[r.impact]}>{r.impact} impact</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
