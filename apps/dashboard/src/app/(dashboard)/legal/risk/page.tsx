import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { enterpriseRiskScore, riskCategories, risks } from "@/features/legal/mock";
import type { RiskLevel } from "@/types";

const levelVariant: Record<RiskLevel, BadgeVariant> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "error",
};

function scoreTone(score: number): string {
  if (score >= 65) return "bg-error";
  if (score >= 45) return "bg-warning";
  return "bg-success";
}

export default function RiskPage() {
  return (
    <>
      <PageHeader
        title="Risk Center"
        context="Enterprise risk scored by the Risk Assessment Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Enterprise score */}
        <div className="col-span-12 sm:col-span-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Enterprise Risk Score
              </p>
              <p
                className={cn(
                  "mt-1 text-3xl font-bold tabular-nums",
                  enterpriseRiskScore >= 65
                    ? "text-error"
                    : enterpriseRiskScore >= 45
                      ? "text-warning"
                      : "text-success"
                )}
              >
                {enterpriseRiskScore}
              </p>
              <p className="mt-1 text-xs text-fg-muted">lower is better · 0–100</p>
            </CardContent>
          </Card>
        </div>

        {/* Category breakdown */}
        <div className="col-span-12 sm:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Risk by Category</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {riskCategories.map((r) => (
                <div key={r.category} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-fg-secondary">{r.category}</span>
                    <span className="font-medium tabular-nums text-fg">{r.score}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn("h-full rounded-full", scoreTone(r.score))}
                      style={{ width: `${r.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Risk registry */}
        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Risk Registry</CardTitle>
              <span className="text-xs text-fg-muted">preview</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Risk</th>
                    <th className="hidden px-6 py-3 font-medium sm:table-cell">Category</th>
                    <th className="px-6 py-3 font-medium">Level</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="hidden px-6 py-3 font-medium md:table-cell">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3 text-fg">{r.title}</td>
                      <td className="hidden px-6 py-3 text-fg-secondary sm:table-cell">
                        {r.category}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={levelVariant[r.level]}>{r.level}</Badge>
                      </td>
                      <td className="px-6 py-3 text-fg-secondary">{r.status}</td>
                      <td className="hidden px-6 py-3 text-fg-secondary md:table-cell">
                        {r.owner}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
