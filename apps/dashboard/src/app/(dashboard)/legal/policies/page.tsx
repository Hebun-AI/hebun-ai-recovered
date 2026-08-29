import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { CommandAction } from "@/components/command/command-action";
import { policies, policyCount } from "@/features/legal/mock";
import type { PolicyStatus } from "@/types";

const statusMeta: Record<PolicyStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "success" },
  draft: { label: "Draft", variant: "neutral" },
  "pending-approval": { label: "Pending Approval", variant: "warning" },
  deprecated: { label: "Deprecated", variant: "neutral" },
};

export default function PoliciesPage() {
  const counts: { label: string; status: PolicyStatus }[] = [
    { label: "Active Policies", status: "active" },
    { label: "Draft Policies", status: "draft" },
    { label: "Pending Approval", status: "pending-approval" },
    { label: "Deprecated", status: "deprecated" },
  ];

  return (
    <>
      <PageHeader
        title="Policy Center"
        context="Policy lifecycle owned by the Policy Management Agent."
        action={
          <CommandAction
            label="New Policy"
            commandType="policy.create"
            variant="outline"
            summary="Author a new policy and route it for governance review."
          />
        }
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {counts.map((c) => (
          <div key={c.status} className="col-span-6 xl:col-span-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {c.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {policyCount(c.status)}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Policy table */}
        <div className="col-span-12 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Policies</CardTitle>
              <span className="text-xs text-fg-muted">version · owner</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Policy</th>
                    <th className="px-6 py-3 font-medium">Version</th>
                    <th className="hidden px-6 py-3 font-medium sm:table-cell">Owner</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3 font-medium text-fg">{p.name}</td>
                      <td className="px-6 py-3 font-mono text-xs text-fg-secondary">
                        {p.version}
                      </td>
                      <td className="hidden px-6 py-3 text-fg-secondary sm:table-cell">
                        {p.owner}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={statusMeta[p.status].variant}>
                          {statusMeta[p.status].label}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </CardContent>
          </Card>
        </div>

        {/* Dependency graph placeholder */}
        <div className="col-span-12 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Policy Dependency Graph</CardTitle>
              <Badge variant="neutral">placeholder</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-md border border-dashed bg-surface-sunken">
                <p className="px-6 text-center text-sm text-fg-muted">
                  Dependency graph renders when policy relationships are wired up.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
