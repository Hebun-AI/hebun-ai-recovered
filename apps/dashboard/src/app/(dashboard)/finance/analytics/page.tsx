import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usdCompact } from "@/lib/format";
import {
  revenueTrend,
  profitByDepartment,
  financeOverview,
  financeAlerts,
} from "@/features/finance/mock";

const costAnomalies = financeAlerts.filter((a) => a.kind === "cost-anomaly");

export default function AnalyticsPage() {
  const maxRevenue = Math.max(...revenueTrend.map((r) => r.revenue));
  const maxProfit = Math.max(...profitByDepartment.map((p) => p.profit));

  return (
    <>
      <PageHeader
        title="Financial Analytics Center"
        context="Trends and anomalies surfaced by the Financial Analytics Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Finance" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Revenue trend */}
        <div className="col-span-12 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <span className="text-xs text-success">
                +{financeOverview.grossMargin}% margin
              </span>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-end gap-4">
                {revenueTrend.map((r) => (
                  <div key={r.month} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium tabular-nums text-fg">
                      {usdCompact(r.revenue)}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-(image:--gradient-primary)"
                        style={{ height: `${(r.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-fg-secondary">{r.month}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost anomaly */}
        <div className="col-span-12 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Anomalies</CardTitle>
              <Badge variant="warning">{costAnomalies.length}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {costAnomalies.map((a) => (
                <div key={a.id} className="rounded-md border bg-surface-sunken p-3">
                  <p className="text-sm font-medium text-fg">{a.title}</p>
                  <p className="text-xs text-fg-secondary">{a.detail}</p>
                </div>
              ))}
              <p className="text-xs text-fg-muted">
                Margin analysis: gross {financeOverview.grossMargin}%, net{" "}
                {Math.round((financeOverview.netProfit / financeOverview.monthlyRevenue) * 100)}%.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Profit by department */}
        <div className="col-span-12 xl:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle>Profit by Department</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {profitByDepartment.map((p) => (
                <div key={p.department} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-fg-secondary">{p.department}</span>
                    <span className="font-medium tabular-nums text-fg">
                      {usdCompact(p.profit)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-(image:--gradient-primary)"
                      style={{ width: `${(p.profit / maxProfit) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Revenue by product/country placeholder */}
        <div className="col-span-12 xl:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Product / Country</CardTitle>
              <Badge variant="neutral">placeholder</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-center justify-center rounded-md border border-dashed bg-surface-sunken">
                <p className="text-sm text-fg-muted">
                  Breakdown chart — wired when ERP / Data Warehouse lands.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
