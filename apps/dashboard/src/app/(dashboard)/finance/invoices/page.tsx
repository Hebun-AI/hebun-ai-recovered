import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { CommandAction } from "@/components/command/command-action";
import { usd } from "@/lib/format";
import { invoices, invoiceStatuses, invoiceCount } from "@/features/finance/mock";
import type { InvoiceStatus } from "@/types";

const statusMeta: Record<InvoiceStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  review: { label: "Review", variant: "warning" },
  approved: { label: "Approved", variant: "primary" },
  issued: { label: "Issued", variant: "info" },
  sent: { label: "Sent", variant: "info" },
  paid: { label: "Paid", variant: "success" },
  archived: { label: "Archived", variant: "neutral" },
};

export default function InvoicesPage() {
  return (
    <>
      <PageHeader
        title="Invoice Center"
        context="Invoice lifecycle owned by the Invoice Agent."
        action={
          <CommandAction
            label="New Invoice"
            commandType="invoice.create"
            summary="Draft a new invoice — customer, line items, and due date."
          />
        }
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Finance" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {invoiceStatuses.map((status) => (
          <div key={status} className="col-span-6 sm:col-span-4 xl:col-span-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {statusMeta[status].label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {invoiceCount(status)}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}

        <div className="col-span-12">
          <Card>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Invoice</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="hidden px-6 py-3 font-medium sm:table-cell">Issued</th>
                    <th className="hidden px-6 py-3 text-right font-medium sm:table-cell">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3 font-mono text-xs text-fg">{inv.id}</td>
                      <td className="px-6 py-3 text-fg-secondary">{inv.customer}</td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums text-fg">
                        {usd(inv.amount)}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={statusMeta[inv.status].variant}>
                          {statusMeta[inv.status].label}
                        </Badge>
                      </td>
                      <td className="hidden px-6 py-3 text-fg-secondary sm:table-cell">
                        {inv.issued}
                      </td>
                      <td className="hidden px-6 py-3 text-right text-fg-secondary sm:table-cell">
                        {inv.due}
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
