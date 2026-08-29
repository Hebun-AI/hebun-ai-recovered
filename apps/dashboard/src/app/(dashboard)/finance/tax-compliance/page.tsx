import { FileCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { taxCompliance } from "@/features/finance/mock";
import { financeEvents } from "@/features/finance/events";

const countryVariant: Record<"compliant" | "warning", BadgeVariant> = {
  compliant: "success",
  warning: "warning",
};

const riskVariant: Record<"low" | "medium" | "high", BadgeVariant> = {
  low: "success",
  medium: "warning",
  high: "error",
};

const taxEvents = financeEvents.filter((e) => e.type.startsWith("tax."));

export default function TaxCompliancePage() {
  return (
    <>
      <PageHeader
        title="Tax & Compliance Center"
        context="Managed by the Tax Agent via Country Rules Service + Compliance Engine (planned)."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Finance" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Score cards */}
        <div className="col-span-12 sm:col-span-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Tax Compliance Score
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-success">
                {taxCompliance.score}%
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-12 sm:col-span-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Audit Risk
              </p>
              <div className="mt-2">
                <Badge variant={riskVariant[taxCompliance.auditRisk]}>
                  {taxCompliance.auditRisk}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-12 sm:col-span-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-10 items-center justify-center rounded-md bg-primary-subtle text-primary">
                <FileCheck className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {taxCompliance.reportsReady}
                </p>
                <p className="text-xs text-fg-secondary">Reports Ready</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Country compliance */}
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>Country Compliance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {taxCompliance.countries.map((c) => (
                <div
                  key={c.country}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{c.country}</p>
                    <p className="text-xs text-fg-muted">{c.note}</p>
                  </div>
                  <Badge variant={countryVariant[c.status]}>{c.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Tax validation events */}
        <div className="col-span-12 xl:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Tax Validation Events</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {taxEvents.length > 0 ? (
                taxEvents.map((e) => (
                  <div key={e.id} className="rounded-md border bg-surface-sunken p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xs text-fg-muted">{e.type}</span>
                      <span className="text-xs text-fg-muted">{e.timestamp}</span>
                    </div>
                    <p className={cn("mt-1 text-sm", "text-fg-secondary")}>{e.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-fg-muted">No tax validation events.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
