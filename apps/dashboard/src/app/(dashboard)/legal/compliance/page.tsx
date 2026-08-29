import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { complianceSummary, violations } from "@/features/legal/mock";
import type { RiskLevel, ViolationStatus } from "@/types";

const severityVariant: Record<RiskLevel, BadgeVariant> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "error",
};

const statusVariant: Record<ViolationStatus, BadgeVariant> = {
  open: "warning",
  remediating: "info",
  resolved: "success",
};

export default function CompliancePage() {
  const stats = [
    { label: "Compliance Score", value: `${complianceSummary.score}%` },
    { label: "Open Violations", value: `${complianceSummary.openViolations}` },
    { label: "Critical Risks", value: `${complianceSummary.criticalRisks}` },
    { label: "Audit Readiness", value: `${complianceSummary.auditReadiness}%` },
  ];

  return (
    <>
      <PageHeader
        title="Compliance Center"
        context="Continuous compliance monitored by the Compliance Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="col-span-6 xl:col-span-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Policy adoption */}
        <div className="col-span-12 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Policy Adoption Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">
                {complianceSummary.policyAdoption}%
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-(image:--gradient-primary)"
                  style={{ width: `${complianceSummary.policyAdoption}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-fg-muted">
                {complianceSummary.remediationInProgress} remediations in progress.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Violations */}
        <div className="col-span-12 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Open Violations</CardTitle>
              <span className="text-xs text-fg-muted">remediation status</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Rule</th>
                    <th className="hidden px-6 py-3 font-medium sm:table-cell">Area</th>
                    <th className="px-6 py-3 font-medium">Severity</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3 text-fg">{v.rule}</td>
                      <td className="hidden px-6 py-3 text-fg-secondary sm:table-cell">
                        {v.area}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={severityVariant[v.severity]}>{v.severity}</Badge>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={statusVariant[v.status]}>{v.status}</Badge>
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
