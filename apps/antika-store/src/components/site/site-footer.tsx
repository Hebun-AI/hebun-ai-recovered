import Link from "next/link";

import type { Category, Settings } from "@/lib/types";

export function SiteFooter({
  categories,
  settings,
}: {
  categories: Category[];
  settings: Settings;
}) {
  return (
    <footer className="section-dark no-print mt-32">
      <div className="mx-auto max-w-[1400px] px-5 py-20 md:px-10">
        <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <div>
            <p className="wordmark text-[1.6rem]">{settings.siteTitle}</p>
            <p className="display-italic mt-6 max-w-xs text-[1.35rem] leading-tight text-paper/75">
              “Bir eve giren her eski parça, oraya bir hikâye taşır.”
            </p>
            <p className="mt-6 max-w-xs text-sm text-paper/55">
              1974'ten bu yana Çukurcuma'da; ekspertizli antika mobilya, halı, gümüş ve
              koleksiyon parçaları.
            </p>
          </div>

          <div>
            <p className="eyebrow">Katalog</p>
            <ul className="mt-5 space-y-3">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/kategori/${category.slug}`}
                    className="link-underline text-sm text-paper/75 hover:text-paper"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/kategori"
                  className="link-underline text-sm text-brass-light"
                >
                  Tüm parçalar
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="eyebrow">Kurumsal</p>
            <ul className="mt-5 space-y-3 text-sm text-paper/75">
              <li>
                <Link href="/iletisim" className="link-underline hover:text-paper">
                  İletişim & Randevu
                </Link>
              </li>
              <li>
                <Link href="/iletisim#ekspertiz" className="link-underline hover:text-paper">
                  Ekspertiz talebi
                </Link>
              </li>
              <li>
                <Link href="/iletisim#kargo" className="link-underline hover:text-paper">
                  Kargo & iade
                </Link>
              </li>
              <li>
                <Link href="/admin" className="link-underline hover:text-paper">
                  Yönetim paneli
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="eyebrow">Dükkân</p>
            <address className="mt-5 space-y-3 text-sm not-italic text-paper/75">
              <p>{settings.address}</p>
              <p className="tnum">{settings.workingHours}</p>
              <p>
                <a href={`mailto:${settings.email}`} className="link-underline hover:text-paper">
                  {settings.email}
                </a>
              </p>
              <p className="tnum">
                <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="link-underline hover:text-paper">
                  {settings.phone}
                </a>
              </p>
            </address>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-paper/20 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="label-caps text-paper/50">
            © {new Date().getFullYear()} {settings.siteTitle} Antika — Tüm hakları saklıdır.
          </p>
          <p className="label-caps text-paper/50">
            Ödeme altyapısı: Stripe · 3D Secure · TRY
          </p>
        </div>
      </div>
    </footer>
  );
}
