import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { candidates, skillGaps } from "@/features/hr/mock";
import type { CandidateStage } from "@/types";

const stageMeta: Record<CandidateStage, BadgeVariant> = {
  applied: "neutral",
  screening: "warning",
  interview: "primary",
  offer: "success",
  hired: "success",
  rejected: "error",
};

function Match({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 80 ? "bg-success" : value >= 60 ? "bg-warning" : "bg-error";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="font-medium tabular-nums text-fg">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function CandidateScreeningPage() {
  const maxGap = Math.max(...skillGaps.map((s) => s.gap));

  return (
    <>
      <PageHeader
        title="Candidate Screening Center"
        context="Match scoring by the Candidate Screening Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="HR" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Skill gap */}
        <div className="col-span-12 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Skill Gap</CardTitle>
              <span className="text-xs text-fg-muted">across pipeline</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {skillGaps.map((s) => (
                <div key={s.skill} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-fg-secondary">{s.skill}</span>
                    <span className="font-medium tabular-nums text-fg">{s.gap}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: `${(s.gap / maxGap) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Screening queue */}
        <div className="col-span-12 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Screening Queue</CardTitle>
              <span className="text-xs tabular-nums text-fg-muted">
                {candidates.length} candidates
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {candidates.map((c) => (
                <div key={c.id} className="rounded-md border bg-surface-sunken p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-semibold text-fg">{c.name}</span>
                      <span className="ml-2 text-xs text-fg-muted">
                        {c.role} · {c.source}
                      </span>
                    </div>
                    <Badge variant={stageMeta[c.stage]}>{c.stage}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Match label="Technical" value={c.technicalMatch} />
                    <Match label="Experience" value={c.experienceMatch} />
                    <Match label="Domain" value={c.domainMatch} />
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
