import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usdCompact } from "@/lib/format";
import { budgets, budgetSummary } from "@/features/finance/mock";

export default function BudgetsPage() {
  return (
    <>
      <PageHeader
        title="Budget Center"
        context="Department budgets monitored by the Budget Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Finance" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 sm:col-span-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Total Budget
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {usdCompact(budgetSummary.total)}
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-12 sm:col-span-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Remaining
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {usdCompact(budgetSummary.remaining)}
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-12 sm:col-span-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Departments Over Budget
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums",
                  budgetSummary.departmentsOverBudget > 0 && "text-error"
                )}
              >
                {budgetSummary.departmentsOverBudget}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Department Budgets</CardTitle>
              <span className="text-xs text-fg-muted">
                usage · remaining · forecast
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {budgets.map((b) => {
                const usage = Math.round((b.used / b.total) * 100);
                const over = usage >= 100;
                const warning = usage >= 85 && usage < 100;
                return (
                  <div key={b.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-fg">{b.department}</span>
                      <span className="tabular-nums text-fg-secondary">
                        {usdCompact(b.used)} / {usdCompact(b.total)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          over
                            ? "bg-error"
                            : warning
                              ? "bg-warning"
                              : "bg-(image:--gradient-primary)"
                        )}
                        style={{ width: `${Math.min(usage, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="tabular-nums text-fg-muted">{usage}% used</span>
                      <Badge variant={over ? "error" : warning ? "warning" : "neutral"}>
                        {b.forecastExhaustion}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
