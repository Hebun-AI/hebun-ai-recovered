import type { Metadata } from "next";
import Link from "next/link";

import { changeOrderStatus } from "@/app/admin/(panel)/actions";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { getOrders } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { stripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = { title: "Siparişler", robots: { index: false } };

export default async function AdminOrders() {
  const orders = await getOrders();
  const paidTotal = orders
    .filter((order) => order.status === "odendi")
    .reduce((total, order) => total + order.totalKurus, 0);

  return (
    <>
      <PageHeader
        title="Siparişler"
        description={`${orders.length} kayıt · Tahsil edilen ${formatPrice(paidTotal)}`}
      />

      {!stripeEnabled() ? (
        <div className="notice mb-6">
          Stripe anahtarı tanımlı değil — siparişler demo modunda oluşuyor. Gerçek ödemeler
          için <code>STRIPE_SECRET_KEY</code> ve <code>STRIPE_WEBHOOK_SECRET</code>{" "}
          değerlerini ekleyin.
        </div>
      ) : null}

      <div className="admin-box overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Sipariş</th>
              <th>Müşteri</th>
              <th>Parçalar</th>
              <th>Tutar</th>
              <th>Durum</th>
              <th>Tarih</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-ink-faint">
                  Henüz sipariş yok.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="tnum font-medium">{order.number}</span>
                    <p className="mt-1 text-xs text-ink-faint">
                      {order.stripeSessionId === "demo"
                        ? "demo ödeme"
                        : order.stripeSessionId || "—"}
                    </p>
                  </td>
                  <td>
                    {order.customerName || <span className="text-ink-faint">—</span>}
                    {order.customerEmail ? (
                      <p className="text-xs text-ink-faint">{order.customerEmail}</p>
                    ) : null}
                  </td>
                  <td>
                    <ul className="space-y-1">
                      {order.items.map((item) => (
                        <li key={item.productId} className="text-sm">
                          <Link
                            href={`/urun/${item.slug}`}
                            target="_blank"
                            className="text-verdigris hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="tnum text-ink-faint"> × {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="tnum">{formatPrice(order.totalKurus)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="tnum text-ink-faint">{formatDateTime(order.createdAt)}</td>
                  <td>
                    <form action={changeOrderStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={order.id} />
                      <select
                        name="status"
                        defaultValue={order.status}
                        className="admin-field w-32 py-1"
                      >
                        <option value="beklemede">Beklemede</option>
                        <option value="odendi">Ödendi</option>
                        <option value="iptal">İptal</option>
                      </select>
                      <button type="submit" className="admin-btn admin-btn-secondary">
                        Uygula
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-ink-faint">
        Ödeme onayı Stripe webhook'undan gelir. Buradaki durum değişikliği yalnız kaydı
        günceller, tahsilat yapmaz; stok yalnız “ödendi”ye ilk geçişte düşer.
      </p>
    </>
  );
}
