import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { usd } from "@/lib/format";
import { expenses, expenseCategories } from "@/features/finance/mock";
import type { ExpenseApproval } from "@/types";

const approvalMeta: Record<ExpenseApproval, { label: string; variant: BadgeVariant }> = {
  approved: { label: "Approved", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  rejected: { label: "Rejected", variant: "error" },
};

export default function ExpensesPage() {
  return (
    <>
      <PageHeader
        title="Expense Center"
        context="Expenses categorized by the Expense Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Finance" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <div className="flex flex-wrap gap-2">
            {expenseCategories.map((c) => (
              <Badge key={c} variant="neutral">
                {c}
              </Badge>
            ))}
          </div>
        </div>

        <div className="col-span-12">
          <Card>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Vendor</th>
                    <th className="hidden px-6 py-3 font-medium sm:table-cell">Category</th>
                    <th className="hidden px-6 py-3 font-medium md:table-cell">Department</th>
                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Approval</th>
                    <th className="hidden px-6 py-3 font-medium lg:table-cell">Budget Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3">
                        <span className="font-medium text-fg">{e.vendor}</span>
                        <span className="ml-2 font-mono text-xs text-fg-muted">{e.id}</span>
                      </td>
                      <td className="hidden px-6 py-3 text-fg-secondary sm:table-cell">
                        {e.category}
                      </td>
                      <td className="hidden px-6 py-3 text-fg-secondary md:table-cell">
                        {e.department}
                      </td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums text-fg">
                        {usd(e.amount)}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={approvalMeta[e.approval].variant}>
                          {approvalMeta[e.approval].label}
                        </Badge>
                      </td>
                      <td className="hidden px-6 py-3 text-xs text-fg-muted lg:table-cell">
                        {e.budgetImpact}
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
