import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { employees, accessRequests, equipmentStatus } from "@/features/hr/mock";

const accessVariant: Record<string, BadgeVariant> = {
  pending: "warning",
  granted: "success",
};

const equipmentVariant: Record<string, BadgeVariant> = {
  shipped: "warning",
  delivered: "success",
};

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Onboarding Center"
        context="New-hire onboarding run by the Onboarding Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="HR" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* New employees + progress */}
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>New Employees</CardTitle>
              <span className="text-xs tabular-nums text-fg-muted">
                {employees.length} in onboarding
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {employees.map((e) => (
                <div key={e.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-fg">
                      {e.name}
                      <span className="ml-2 text-xs font-normal text-fg-muted">
                        {e.role} · starts {e.startDate}
                      </span>
                    </span>
                    <span className="tabular-nums text-fg-secondary">
                      {e.onboardingProgress}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-(image:--gradient-primary)"
                      style={{ width: `${e.onboardingProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-fg-muted">
                    First-week stage: {e.onboardingStage}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Access + equipment */}
        <div className="col-span-12 xl:col-span-5 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Access Requests</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {accessRequests.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{a.employee}</p>
                    <p className="text-xs text-fg-muted">{a.system}</p>
                  </div>
                  <Badge variant={accessVariant[a.status]}>{a.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Equipment Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {equipmentStatus.map((eq) => (
                <div key={eq.employee} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{eq.employee}</p>
                    <p className="text-xs text-fg-muted">{eq.item}</p>
                  </div>
                  <Badge variant={equipmentVariant[eq.status]}>{eq.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
