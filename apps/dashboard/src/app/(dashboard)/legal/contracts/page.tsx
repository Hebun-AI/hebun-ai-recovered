import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { CommandAction } from "@/components/command/command-action";
import { cn } from "@/lib/utils";
import { usdCompact } from "@/lib/format";
import { contracts, contractStatuses, contractCount, clauses } from "@/features/legal/mock";
import type { ContractStatus, RiskLevel } from "@/types";

const statusMeta: Record<ContractStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  review: { label: "Under Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  signed: { label: "Signed", variant: "info" },
  rejected: { label: "Rejected", variant: "error" },
};

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "error",
};

const clauseTone: Record<string, string> = {
  present: "bg-success",
  review: "bg-warning",
  missing: "bg-error",
};

export default function ContractsPage() {
  const highRisk = contracts.filter(
    (c) => c.risk === "high" || c.risk === "critical"
  ).length;

  return (
    <>
      <PageHeader
        title="Contract Center"
        context="Contract lifecycle owned by Contract Review & Generation Agents."
        action={
          <CommandAction
            label="New Contract"
            commandType="contract.create"
            summary="Start a new contract — parties, terms, and review workflow."
          />
        }
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Status counts + high risk */}
        {contractStatuses.map((status) => (
          <div key={status} className="col-span-6 sm:col-span-4 xl:col-span-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {statusMeta[status].label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {contractCount(status)}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}
        <div className="col-span-6 sm:col-span-4 xl:col-span-2">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                High Risk
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-error">{highRisk}</p>
            </CardContent>
          </Card>
        </div>

        {/* Contract table */}
        <div className="col-span-12 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Contract Lifecycle</CardTitle>
              <span className="text-xs text-fg-muted">all contracts</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Contract</th>
                    <th className="hidden px-6 py-3 font-medium sm:table-cell">Counterparty</th>
                    <th className="px-6 py-3 text-right font-medium">Value</th>
                    <th className="px-6 py-3 font-medium">Risk</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3">
                        <span className="font-medium text-fg">{c.title}</span>
                        <span className="ml-2 font-mono text-xs text-fg-muted">{c.type}</span>
                      </td>
                      <td className="hidden px-6 py-3 text-fg-secondary sm:table-cell">
                        {c.counterparty}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-fg">
                        {c.value > 0 ? usdCompact(c.value) : "—"}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={riskVariant[c.risk]}>{c.risk}</Badge>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={statusMeta[c.status].variant}>
                          {statusMeta[c.status].label}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </CardContent>
          </Card>
        </div>

        {/* Clause coverage */}
        <div className="col-span-12 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Clause Coverage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {clauses.map((cl) => (
                <div key={cl.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-fg-secondary">{cl.name}</span>
                    <span className="font-medium tabular-nums text-fg">{cl.coverage}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn("h-full rounded-full", clauseTone[cl.status])}
                      style={{ width: `${cl.coverage}%` }}
                    />
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
