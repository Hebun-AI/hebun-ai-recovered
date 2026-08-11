import type { Metadata } from "next";
import Link from "next/link";

import { Box, PageHeader, StatusBadge } from "@/components/admin/ui";
import { getMessages, getOrders, getProducts } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { stripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };

export default async function AdminHome() {
  const [products, orders, messages] = await Promise.all([
    getProducts({ includeDrafts: true }),
    getOrders(),
    getMessages(),
  ]);

  const published = products.filter((product) => product.status === "yayinda");
  const drafts = products.filter((product) => product.status === "taslak");
  const soldOut = products.filter((product) => product.stock <= 0);
  const paid = orders.filter((order) => order.status === "odendi");
  const revenue = paid.reduce((total, order) => total + order.totalKurus, 0);
  const unread = messages.filter((message) => !message.read);

  const stats = [
    { label: "Yayındaki ürün", value: String(published.length), href: "/admin/urunler?durum=yayinda" },
    { label: "Taslak", value: String(drafts.length), href: "/admin/urunler?durum=taslak" },
    { label: "Bekleyen sipariş", value: String(orders.length - paid.length), href: "/admin/siparisler" },
    { label: "Tahsil edilen", value: formatPrice(revenue), href: "/admin/siparisler" },
  ];

  return (
    <>
      <PageHeader title="Panel" description="Dükkânın bugünkü hâli." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="admin-box block p-4 transition-colors hover:border-brass">
            <p className="admin-label mb-2">{stat.label}</p>
            <p className="display tnum text-[1.9rem] leading-none">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Box
            title="Son siparişler"
            footer={
              <Link href="/admin/siparisler" className="text-sm text-verdigris hover:underline">
                Tüm siparişler →
              </Link>
            }
          >
            {orders.length === 0 ? (
              <p className="text-sm text-ink-faint">Henüz sipariş yok.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sipariş</th>
                    <th>Müşteri</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((order) => (
                    <tr key={order.id}>
                      <td className="tnum">{order.number}</td>
                      <td>{order.customerName || <span className="text-ink-faint">—</span>}</td>
                      <td className="tnum">{formatPrice(order.totalKurus)}</td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="tnum text-ink-faint">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Box>

          <div className="mt-6">
            <Box
              title="Okunmamış mesajlar"
              footer={
                <Link href="/admin/mesajlar" className="text-sm text-verdigris hover:underline">
                  Gelen kutusu →
                </Link>
              }
            >
              {unread.length === 0 ? (
                <p className="text-sm text-ink-faint">Okunmamış mesaj yok.</p>
              ) : (
                <ul className="space-y-3">
                  {unread.slice(0, 4).map((message) => (
                    <li key={message.id} className="border-b border-[#ece4d6] pb-3 last:border-none">
                      <p className="text-sm font-medium">
                        {message.subject}{" "}
                        <span className="text-ink-faint">— {message.name}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{message.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Box>
          </div>
        </div>

        <div className="space-y-6">
          <Box title="Hızlı işlem">
            <div className="space-y-2">
              <Link href="/admin/urunler/yeni" className="admin-btn w-full">
                + Yeni ürün ekle
              </Link>
              <Link href="/admin/kategoriler" className="admin-btn admin-btn-secondary w-full">
                Kategorileri düzenle
              </Link>
              <Link href="/" target="_blank" className="admin-btn admin-btn-secondary w-full">
                Siteyi görüntüle ↗
              </Link>
            </div>
          </Box>

          <Box title="Ödeme altyapısı">
            {stripeEnabled() ? (
              <p className="text-sm text-ink-soft">
                <span className="badge badge-odendi">Stripe bağlı</span>
                <br />
                <span className="mt-3 block">
                  Ödemeler Stripe Checkout üzerinden alınıyor. Webhook adresi:{" "}
                  <code className="text-ink">/api/stripe/webhook</code>
                </span>
              </p>
            ) : (
              <p className="text-sm text-ink-soft">
                <span className="badge badge-beklemede">Demo modu</span>
                <br />
                <span className="mt-3 block">
                  <code className="text-ink">STRIPE_SECRET_KEY</code> tanımlı değil. Ödeme
                  akışı sonuna kadar çalışır, sipariş kaydedilir; kart çekilmez.
                </span>
              </p>
            )}
          </Box>

          <Box title="Stok uyarısı">
            {soldOut.length === 0 ? (
              <p className="text-sm text-ink-faint">Tükenen parça yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {soldOut.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/urunler/${product.id}`}
                      className="text-verdigris hover:underline"
                    >
                      {product.title}
                    </Link>
                    <span className="tnum text-ink-faint">{product.reference}</span>
                  </li>
                ))}
              </ul>
            )}
          </Box>
        </div>
      </div>
    </>
  );
}
