import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { interviews } from "@/features/hr/mock";
import type { InterviewStatus } from "@/types";

const statusMeta: Record<InterviewStatus, { label: string; variant: BadgeVariant }> = {
  scheduled: { label: "Scheduled", variant: "primary" },
  completed: { label: "Completed", variant: "success" },
  "feedback-pending": { label: "Feedback Pending", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

export default function InterviewsPage() {
  const today = interviews.filter((i) => i.when.startsWith("Today"));
  const upcoming = interviews.filter(
    (i) => i.status === "scheduled" && !i.when.startsWith("Today")
  );
  const feedbackPending = interviews.filter((i) => i.status === "feedback-pending");

  const counts = [
    { label: "Today's Interviews", value: today.length },
    { label: "Upcoming", value: upcoming.length },
    { label: "Feedback Pending", value: feedbackPending.length },
  ];

  return (
    <>
      <PageHeader
        title="Interview Center"
        context="Coordinated by the Interview Scheduling Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="HR" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {counts.map((c) => (
          <div key={c.label} className="col-span-12 sm:col-span-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {c.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Today */}
        <div className="col-span-12 xl:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Interviews</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {today.length > 0 ? (
                today.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">{i.candidate}</p>
                      <p className="text-xs text-fg-muted">
                        {i.role} · {i.interviewer}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-fg-secondary">
                      {i.when.replace("Today · ", "")}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-fg-muted">No interviews today.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All / calendar */}
        <div className="col-span-12 xl:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
              <span className="text-xs text-fg-muted">all scheduled</span>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {interviews.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{i.candidate}</p>
                    <p className="text-xs text-fg-muted">{i.when}</p>
                  </div>
                  <Badge variant={statusMeta[i.status].variant}>
                    {statusMeta[i.status].label}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
