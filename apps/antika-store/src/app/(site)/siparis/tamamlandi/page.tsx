import type { Metadata } from "next";
import Link from "next/link";

import { ClearCart } from "@/components/cart/clear-cart";
import { getOrderById, markOrderPaid, setOrderCustomer } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Siparişiniz alındı",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function OrderCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ siparis?: string; session_id?: string; demo?: string }>;
}) {
  const { siparis, session_id: sessionId, demo } = await searchParams;

  let order = siparis ? await getOrderById(siparis) : undefined;

  if (order && order.status === "beklemede") {
    if (demo === "1") {
      // Demo modu: Stripe anahtarı yokken akışın sonunu görebilmek için.
      await setOrderCustomer(order.id, {
        customerName: order.customerName || "Demo Müşteri",
        customerEmail: order.customerEmail || "demo@miras-antika.com",
      });
      order = (await markOrderPaid(order.id)) ?? order;
    } else if (sessionId) {
      const stripe = getStripe();
      const session = await stripe?.checkout.sessions.retrieve(sessionId).catch(() => null);
      if (session?.payment_status === "paid") {
        await setOrderCustomer(order.id, {
          customerName: session.customer_details?.name ?? undefined,
          customerEmail: session.customer_details?.email ?? undefined,
        });
        order = (await markOrderPaid(order.id)) ?? order;
      }
    }
  }

  if (!order) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-32 text-center">
        <p className="eyebrow">Kayıt bulunamadı</p>
        <h1 className="display mt-4 text-[2.6rem] leading-none">Bu siparişe ulaşamadık.</h1>
        <p className="mt-4 text-sm text-ink-soft">
          Bağlantı eksik ya da sipariş kaydı silinmiş olabilir. Yardım için bize yazın.
        </p>
        <Link href="/iletisim" className="btn mt-8">
          İletişime geç
        </Link>
      </section>
    );
  }

  const paid = order.status === "odendi";

  return (
    <section className="mx-auto max-w-3xl px-5 py-20 md:px-10">
      <ClearCart />

      <div className="border bg-paper-2/40 p-8 sm:p-12">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <p className="eyebrow">{paid ? "Ödeme alındı" : "Ödeme bekleniyor"}</p>
            <h1 className="display mt-3 text-[2.6rem] leading-none sm:text-[3.2rem]">
              Teşekkürler.
            </h1>
          </div>
          <div className="text-right">
            <p className="label-caps text-ink-faint">Sipariş no</p>
            <p className="display tnum mt-1 text-[1.4rem]">{order.number}</p>
            <p className="tnum mt-1 text-xs text-ink-faint">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>

        <p className="mt-6 text-[1.02rem] leading-relaxed text-ink-soft">
          {paid
            ? "Siparişiniz kaydedildi. Parçalarınız ekspertiz dosyalarıyla birlikte 2 iş günü içinde sigortalı kargoya verilir; takip numarası e-postanıza gelir."
            : "Ödemeniz henüz doğrulanmadı. Kartınızdan çekim yapıldıysa birkaç dakika içinde bu kayıt otomatik güncellenir."}
        </p>

        <div className="mt-10 border-t pt-6">
          <p className="eyebrow">Parçalar</p>
          <ul className="mt-4">
            {order.items.map((item) => (
              <li
                key={item.productId}
                className="flex items-baseline justify-between gap-4 border-b border-dotted border-ink/20 py-3"
              >
                <span>
                  <Link href={`/urun/${item.slug}`} className="link-underline">
                    {item.title}
                  </Link>
                  <span className="tnum ml-3 text-xs text-ink-faint">
                    {item.reference} · {item.quantity} adet
                  </span>
                </span>
                <span className="tnum text-sm">
                  {formatPrice(item.unitPriceKurus * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-end justify-between">
            <span className="label-caps">Toplam</span>
            <span className="display tnum text-[1.9rem] leading-none">
              {formatPrice(order.totalKurus)}
            </span>
          </div>
        </div>

        {order.customerEmail ? (
          <p className="mt-8 text-xs text-ink-faint">
            Onay {order.customerEmail} adresine gönderildi.
          </p>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/kategori" className="btn btn-ghost">
            Kataloğa dön
          </Link>
          <Link href="/iletisim" className="btn btn-ghost">
            Sipariş hakkında yaz
          </Link>
        </div>
      </div>
    </section>
  );
}
