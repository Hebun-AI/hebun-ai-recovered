import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { offboardings } from "@/features/hr/mock";
import type { OffboardingStep } from "@/types";

const stepLabel: Record<OffboardingStep, string> = {
  "access-revocation": "Access Revocation",
  "asset-return": "Asset Return",
  "knowledge-transfer": "Knowledge Transfer",
  "exit-interview": "Exit Interview",
  complete: "Complete",
};

const checklist: OffboardingStep[] = [
  "access-revocation",
  "asset-return",
  "knowledge-transfer",
  "exit-interview",
];

export default function OffboardingPage() {
  return (
    <>
      <PageHeader
        title="Offboarding Center"
        context="Exits managed by the Offboarding Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="HR" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 sm:col-span-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Active Offboarding
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {offboardings.length}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Active Offboarding</CardTitle>
              <span className="text-xs text-fg-muted">
                access · assets · knowledge · exit interview
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {offboardings.map((o) => {
                const currentIdx = checklist.indexOf(o.step as OffboardingStep);
                return (
                  <div key={o.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-fg">
                        {o.employee}
                        <span className="ml-2 text-xs font-normal text-fg-muted">
                          {o.role} · last day {o.lastDay}
                        </span>
                      </span>
                      <span className="tabular-nums text-fg-secondary">
                        {o.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-(image:--gradient-primary)"
                        style={{ width: `${o.progress}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {checklist.map((step, i) => (
                        <Badge
                          key={step}
                          variant={
                            i < currentIdx
                              ? "success"
                              : i === currentIdx
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {stepLabel[step]}
                        </Badge>
                      ))}
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
