import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { CommandAction } from "@/components/command/command-action";
import { contracts } from "@/features/legal/mock";
import type { ContractStatus } from "@/types";

const statusMeta: Record<ContractStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  review: { label: "Under Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  signed: { label: "Signed", variant: "info" },
  rejected: { label: "Rejected", variant: "error" },
};

const templates = [
  { id: "TPL-1", name: "Mutual NDA", clauses: 8, uses: 42 },
  { id: "TPL-2", name: "Enterprise MSA", clauses: 24, uses: 17 },
  { id: "TPL-3", name: "Data Processing Addendum", clauses: 14, uses: 21 },
  { id: "TPL-4", name: "Statement of Work", clauses: 11, uses: 33 },
  { id: "TPL-5", name: "Reseller Agreement", clauses: 19, uses: 6 },
];

export default function ContractGenerationPage() {
  const drafts = contracts.filter((c) => c.status === "draft");

  return (
    <>
      <PageHeader
        title="Contract Generation"
        context="Draft generation from templates by the Contract Generation Agent."
        action={
          <CommandAction
            label="Generate Draft"
            commandType="contract.generate"
            summary="Generate a contract draft from a template and structured inputs."
          />
        }
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Templates */}
        <div className="col-span-12 xl:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <span className="text-xs text-fg-muted">clause-backed</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Template</th>
                    <th className="px-6 py-3 text-right font-medium">Clauses</th>
                    <th className="px-6 py-3 text-right font-medium">Uses</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3 font-medium text-fg">{t.name}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-fg-secondary">
                        {t.clauses}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-fg-secondary">
                        {t.uses}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </CardContent>
          </Card>
        </div>

        {/* Recent drafts */}
        <div className="col-span-12 xl:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Recent Drafts</CardTitle>
              <span className="text-xs tabular-nums text-fg-muted">{drafts.length}</span>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border">
              {drafts.length > 0 ? (
                drafts.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">{c.title}</p>
                      <p className="text-xs text-fg-muted">{c.counterparty}</p>
                    </div>
                    <Badge variant={statusMeta[c.status].variant}>
                      {statusMeta[c.status].label}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-fg-muted">No drafts in progress.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
