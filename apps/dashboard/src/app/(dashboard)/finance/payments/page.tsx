import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { usd } from "@/lib/format";
import { payments, paymentStatuses, paymentCount } from "@/features/finance/mock";
import type { PaymentStatus } from "@/types";

const statusMeta: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending", variant: "warning" },
  processing: { label: "Processing", variant: "info" },
  verified: { label: "Verified", variant: "primary" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "error" },
  refunded: { label: "Refunded", variant: "neutral" },
};

export default function PaymentsPage() {
  return (
    <>
      <PageHeader
        title="Payment Center"
        context="Payment verification owned by the Payment Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Finance" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {paymentStatuses.map((status) => (
          <div key={status} className="col-span-6 sm:col-span-4 xl:col-span-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {statusMeta[status].label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {paymentCount(status)}
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
                    <th className="px-6 py-3 font-medium">Payment</th>
                    <th className="px-6 py-3 font-medium">Counterparty</th>
                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                    <th className="hidden px-6 py-3 font-medium sm:table-cell">Method</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="hidden px-6 py-3 text-right font-medium sm:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3 font-mono text-xs text-fg">{p.id}</td>
                      <td className="px-6 py-3 text-fg-secondary">{p.counterparty}</td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums text-fg">
                        {usd(p.amount)}
                      </td>
                      <td className="hidden px-6 py-3 text-fg-secondary sm:table-cell">
                        {p.method}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={statusMeta[p.status].variant}>
                          {statusMeta[p.status].label}
                        </Badge>
                      </td>
                      <td className="hidden px-6 py-3 text-right text-xs text-fg-muted sm:table-cell">
                        {p.updated}
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
