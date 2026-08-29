import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { reviews, performanceTrend } from "@/features/hr/mock";
import type { ReviewStatus } from "@/types";

const statusMeta: Record<ReviewStatus, { label: string; variant: BadgeVariant }> = {
  due: { label: "Due", variant: "warning" },
  "in-progress": { label: "In Progress", variant: "primary" },
  completed: { label: "Completed", variant: "success" },
};

export default function PerformancePage() {
  const maxScore = Math.max(...performanceTrend.map((t) => t.score));

  return (
    <>
      <PageHeader
        title="Performance Center"
        context="Reviews and goals tracked by the Performance Review Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="HR" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Trend */}
        <div className="col-span-12 xl:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <span className="text-xs text-fg-muted">avg score / quarter</span>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-end gap-4">
                {performanceTrend.map((t) => (
                  <div key={t.quarter} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium tabular-nums text-fg">{t.score}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-(image:--gradient-primary)"
                        style={{ height: `${(t.score / maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-fg-secondary">{t.quarter}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Review calendar + goal completion */}
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>Review Calendar</CardTitle>
              <span className="text-xs text-fg-muted">goal completion</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {reviews.map((r) => (
                <div key={r.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">
                      {r.employee}
                      <span className="ml-2 text-xs font-normal text-fg-muted">
                        {r.cycle} · {r.reviewer}
                      </span>
                    </span>
                    <Badge variant={statusMeta[r.status].variant}>
                      {statusMeta[r.status].label}
                    </Badge>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{ width: `${r.goalCompletion}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-fg-muted">
                    {r.goalCompletion}% goals complete
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Development plans placeholder */}
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Development Plans</CardTitle>
              <Badge variant="neutral">feedback summary</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-fg-secondary">
                Feedback summary and individual development plans are generated per
                completed review. Detailed plans wire up when review data is live.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
