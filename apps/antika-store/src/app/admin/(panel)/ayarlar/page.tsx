import type { Metadata } from "next";

import { saveSettings } from "@/app/admin/(panel)/actions";
import { Notice, PageHeader } from "@/components/admin/ui";
import { getSettings } from "@/lib/db";
import { kurusToInput } from "@/lib/format";
import { stripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = { title: "Ayarlar", robots: { index: false } };

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<{ bildirim?: string }>;
}) {
  const [{ bildirim }, settings] = await Promise.all([searchParams, getSettings()]);

  return (
    <>
      <PageHeader title="Ayarlar" description="Sitenin künyesi ve kargo kuralları." />
      <Notice code={bildirim} />

      <form action={saveSettings} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="admin-box">
            <h2 className="admin-box-title">Site kimliği</h2>
            <div className="admin-box-body space-y-3">
              <div>
                <label className="admin-label" htmlFor="siteTitle">
                  Site adı
                </label>
                <input
                  id="siteTitle"
                  name="siteTitle"
                  defaultValue={settings.siteTitle}
                  className="admin-field"
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="tagline">
                  Slogan (üst şerit)
                </label>
                <input
                  id="tagline"
                  name="tagline"
                  defaultValue={settings.tagline}
                  className="admin-field"
                />
              </div>
            </div>
          </section>

          <section className="admin-box">
            <h2 className="admin-box-title">İletişim</h2>
            <div className="admin-box-body grid gap-3 sm:grid-cols-2">
              <div>
                <label className="admin-label" htmlFor="email">
                  E-posta
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={settings.email}
                  className="admin-field"
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="phone">
                  Telefon
                </label>
                <input
                  id="phone"
                  name="phone"
                  defaultValue={settings.phone}
                  className="admin-field tnum"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="admin-label" htmlFor="address">
                  Adres
                </label>
                <input
                  id="address"
                  name="address"
                  defaultValue={settings.address}
                  className="admin-field"
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="workingHours">
                  Çalışma saatleri
                </label>
                <input
                  id="workingHours"
                  name="workingHours"
                  defaultValue={settings.workingHours}
                  className="admin-field"
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="instagram">
                  Instagram
                </label>
                <input
                  id="instagram"
                  name="instagram"
                  defaultValue={settings.instagram}
                  className="admin-field"
                />
              </div>
            </div>
          </section>

          <section className="admin-box">
            <h2 className="admin-box-title">Kargo</h2>
            <div className="admin-box-body grid gap-3 sm:grid-cols-2">
              <div>
                <label className="admin-label" htmlFor="shippingFee">
                  Kargo ücreti (₺)
                </label>
                <input
                  id="shippingFee"
                  name="shippingFee"
                  inputMode="decimal"
                  defaultValue={kurusToInput(settings.shippingFeeKurus)}
                  className="admin-field tnum"
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="freeShippingLimit">
                  Ücretsiz kargo eşiği (₺)
                </label>
                <input
                  id="freeShippingLimit"
                  name="freeShippingLimit"
                  inputMode="decimal"
                  defaultValue={kurusToInput(settings.freeShippingLimitKurus)}
                  className="admin-field tnum"
                />
              </div>
              <p className="text-xs text-ink-faint sm:col-span-2">
                Sepet tutarı eşiği geçtiğinde kargo ücretsiz olur; ödeme sayfasındaki satır da
                buna göre kaldırılır.
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="admin-box">
            <h2 className="admin-box-title">Kaydet</h2>
            <div className="admin-box-body">
              <button type="submit" className="admin-btn w-full">
                Değişiklikleri kaydet
              </button>
            </div>
          </section>

          <section className="admin-box">
            <h2 className="admin-box-title">Ödeme (Stripe)</h2>
            <div className="admin-box-body space-y-3 text-sm text-ink-soft">
              <p>
                {stripeEnabled() ? (
                  <span className="badge badge-odendi">Bağlı</span>
                ) : (
                  <span className="badge badge-beklemede">Demo modu</span>
                )}
              </p>
              <p>
                Anahtarlar güvenlik gereği panelden değil, ortam değişkenlerinden okunur:
              </p>
              <ul className="space-y-1 text-xs">
                <li>
                  <code className="text-ink">STRIPE_SECRET_KEY</code>
                </li>
                <li>
                  <code className="text-ink">STRIPE_WEBHOOK_SECRET</code>
                </li>
                <li>
                  <code className="text-ink">NEXT_PUBLIC_SITE_URL</code>
                </li>
              </ul>
              <p className="text-xs">
                Webhook adresi: <code className="text-ink">/api/stripe/webhook</code>
              </p>
            </div>
          </section>
        </div>
      </form>
    </>
  );
}
