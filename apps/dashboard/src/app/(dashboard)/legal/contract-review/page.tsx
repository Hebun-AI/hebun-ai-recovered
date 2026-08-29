import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { contracts, clauses } from "@/features/legal/mock";
import type { RiskLevel } from "@/types";

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "error",
};

const clauseTone: Record<string, string> = {
  present: "bg-success",
  review: "bg-warning",
  missing: "bg-error",
};

export default function ContractReviewPage() {
  const underReview = contracts.filter((c) => c.status === "review");
  const missing = clauses.filter((c) => c.status !== "present");

  return (
    <>
      <PageHeader
        title="Contract Review"
        context="Automated review by the Contract Review Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Contracts under review */}
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>Contracts Under Review</CardTitle>
              <span className="text-xs tabular-nums text-fg-muted">
                {underReview.length} in queue
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {underReview.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-surface-sunken p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{c.title}</p>
                    <p className="text-xs text-fg-muted">
                      {c.counterparty} · {c.type} · updated {c.updated}
                    </p>
                  </div>
                  <Badge variant={riskVariant[c.risk]}>{c.risk} risk</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Clause analysis */}
        <div className="col-span-12 xl:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Clause Analysis</CardTitle>
              <Badge variant="warning">{missing.length} need attention</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {clauses.map((cl) => (
                <div key={cl.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-fg-secondary">{cl.name}</span>
                    <span className="font-medium tabular-nums text-fg">
                      {cl.coverage}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn("h-full rounded-full", clauseTone[cl.status])}
                      style={{ width: `${cl.coverage}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
