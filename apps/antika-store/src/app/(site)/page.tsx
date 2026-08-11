import Link from "next/link";

import { ArchivePlate, ProductVisual } from "@/components/archive-plate";
import { ProductCard } from "@/components/site/product-card";
import { getCategories, getProducts, getSettings } from "@/lib/db";
import { formatPrice } from "@/lib/format";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export default async function HomePage() {
  const [categories, featured, all, settings] = await Promise.all([
    getCategories(),
    getProducts({ featuredOnly: true }),
    getProducts(),
    getSettings(),
  ]);

  const hero = featured[0] ?? all[0];
  const showcase = featured.slice(0, 4);
  const eras = all
    .map((product) => Number.parseInt(product.attributes.find((a) => a.label === "Dönem")?.value.replace(/\D/g, "") ?? "", 10))
    .filter((year) => Number.isFinite(year) && year > 1000);
  const oldest = eras.length ? Math.min(...eras) : 1750;

  return (
    <>
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative overflow-hidden border-b">
        {/* arka planda ince dikey cetvel çizgileri */}
        <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto grid max-w-[1400px] grid-cols-4 px-5 md:grid-cols-8 md:px-10">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="border-l border-ink/[0.06] last:border-r" />
          ))}
        </div>

        <div className="relative mx-auto grid max-w-[1400px] gap-14 px-5 pb-24 pt-16 md:px-10 lg:grid-cols-12 lg:gap-10 lg:pb-32 lg:pt-24">
          <div className="lg:col-span-7 lg:pr-10">
            <div className="rise flex items-center gap-4" style={{ animationDelay: "60ms" }}>
              <span className="eyebrow">Katalog XXVI</span>
              <span className="h-px w-16 origin-left bg-ink/30 line-draw" style={{ animationDelay: "300ms" }} />
              <span className="eyebrow">Kış 2026</span>
            </div>

            <h1 className="display rise mt-8 text-[3.4rem] leading-[0.92] sm:text-[4.6rem] lg:text-[6.1rem]" style={{ animationDelay: "160ms" }}>
              Zamanın
              <br />
              elinden geçmiş
              <br />
              <span className="display-italic text-oxblood">parçalar.</span>
            </h1>

            <p className="rise mt-9 max-w-lg text-[1.05rem] leading-relaxed text-ink-soft" style={{ animationDelay: "280ms" }}>
              Çukurcuma'daki dükkânımızda {oldest}'lerden bu yana yaşamış eşyaları topluyor,
              ekspertizini yapıyor ve künyesiyle birlikte yeni evine gönderiyoruz. Her parça
              tek; ikincisi yok.
            </p>

            <div className="rise mt-10 flex flex-wrap items-center gap-4" style={{ animationDelay: "380ms" }}>
              <Link href="/kategori" className="btn">
                Kataloğu gez
              </Link>
              <Link href="/iletisim" className="btn btn-ghost">
                Ekspertiz talebi
              </Link>
            </div>

            <dl className="rise mt-16 grid max-w-lg grid-cols-3 gap-6 border-t pt-6" style={{ animationDelay: "480ms" }}>
              {[
                { value: String(all.length).padStart(2, "0"), label: "Vitrindeki parça" },
                { value: `${oldest}+`, label: "En eski kayıt" },
                { value: "52", label: "Yıllık dükkân" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="display tnum text-[2rem] leading-none">{stat.value}</dt>
                  <dd className="eyebrow mt-2 leading-tight">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* öne çıkan parça — künye kartı taşacak şekilde bindirilmiş */}
          {hero ? (
            <div className="fade-in relative lg:col-span-5" style={{ animationDelay: "300ms" }}>
              <span className="eyebrow vertical-text absolute -left-8 top-10 hidden xl:block">
                Vitrin · {hero.reference}
              </span>

              <Link href={`/urun/${hero.slug}`} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden border shadow-[0_50px_90px_-60px_rgba(24,19,16,0.9)]">
                  <div className="h-full w-full transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]">
                    <ProductVisual
                      src={hero.imageUrl}
                      alt={hero.title}
                      seed={hero.slug}
                      monogram={hero.title}
                    />
                  </div>
                  <div className="scrim-top absolute inset-x-0 top-0 h-24" />
                  <span className="label-caps absolute left-4 top-4 text-paper">
                    Öne çıkan
                  </span>
                </div>

                <div className="relative z-10 -mt-16 ml-4 max-w-xs border bg-paper p-6 shadow-[0_30px_60px_-45px_rgba(24,19,16,0.9)] sm:-mt-20 sm:ml-8">
                  <p className="eyebrow">{hero.reference}</p>
                  <h2 className="display mt-2 text-[1.7rem] leading-[1.05]">{hero.title}</h2>
                  <div className="mt-4 space-y-1.5">
                    {hero.attributes.slice(0, 3).map((attribute) => (
                      <div
                        key={attribute.label}
                        className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink/20 pb-1 text-[0.8rem]"
                      >
                        <span className="label-caps text-ink-faint">{attribute.label}</span>
                        <span className="text-ink-soft">{attribute.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="display tnum mt-5 text-[1.4rem]">
                    {formatPrice(hero.priceKurus)}
                  </p>
                </div>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {/* --------------------------- güvence şeridi -------------------------- */}
      <section className="section-dark">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-4 md:px-10">
          {[
            "Ekspertiz raporu",
            "Sigortalı özel kurye",
            "14 gün cayma hakkı",
            "Stripe ile güvenli ödeme",
            "Tek parça — kopyası yok",
          ].map((item, index) => (
            <span key={item} className="label-caps flex items-center gap-10 text-paper/70">
              {index > 0 ? <span aria-hidden className="text-brass">◆</span> : null}
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ---------------------------- kategoriler ---------------------------- */}
      <section className="mx-auto max-w-[1400px] px-5 py-24 md:px-10 lg:py-32">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Bölümler</p>
            <h2 className="display mt-3 text-[2.6rem] leading-none sm:text-[3.4rem]">
              Kataloğun defteri
            </h2>
          </div>
          <p className="max-w-sm text-sm text-ink-soft">
            Parçalar beş bölümde toplanır. Her bölümün kendi ekspertiz ölçütü, kendi dönem
            aralığı vardır.
          </p>
        </div>

        <div className="mt-14 border-t">
          {categories.map((category, index) => (
            <Link
              key={category.slug}
              href={`/kategori/${category.slug}`}
              className="ledger-row group grid grid-cols-[3rem_1fr] items-baseline gap-4 border-b py-7 md:grid-cols-[4rem_1.1fr_1fr_auto] md:gap-8"
            >
              <span className="display tnum text-[1.1rem] text-ink-faint">
                {ROMAN[index] ?? index + 1}
              </span>
              <h3 className="display text-[1.9rem] leading-none transition-colors group-hover:text-oxblood sm:text-[2.4rem]">
                {category.name}
              </h3>
              <p className="col-start-2 max-w-md text-sm text-ink-soft md:col-start-3">
                {category.description}
              </p>
              <span className="label-caps col-start-2 flex items-center gap-6 text-ink-faint md:col-start-4">
                <span className="tnum">{category.era}</span>
                <span className="ledger-arrow text-oxblood">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------- vitrin ------------------------------ */}
      <section className="border-y bg-paper-2/45">
        <div className="mx-auto max-w-[1400px] px-5 py-24 md:px-10 lg:py-32">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Seçki</p>
              <h2 className="display mt-3 text-[2.6rem] leading-none sm:text-[3.4rem]">
                Bu ayın vitrini
              </h2>
            </div>
            <Link href="/kategori" className="link-underline label-caps text-ink-soft">
              Tüm katalog →
            </Link>
          </div>

          <div className="mt-14 grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
            {showcase.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ hikâye ------------------------------- */}
      <section className="mx-auto max-w-[1400px] px-5 py-24 md:px-10 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-12 lg:items-center">
          <div className="relative lg:col-span-5">
            <div className="aspect-[3/4] overflow-hidden border">
              <ArchivePlate seed="cukurcuma-dukkan-1974" monogram="M" />
            </div>
            <div className="absolute -bottom-8 -right-4 hidden max-w-[220px] border bg-paper p-5 shadow-[0_30px_60px_-45px_rgba(24,19,16,0.9)] sm:block">
              <p className="eyebrow">Dükkân</p>
              <p className="mt-2 text-sm leading-snug text-ink-soft">
                {settings.address}
              </p>
              <p className="tnum mt-3 text-xs text-ink-faint">{settings.workingHours}</p>
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <p className="eyebrow">1974'ten beri</p>
            <p className="display-italic mt-6 text-[2rem] leading-[1.15] sm:text-[2.6rem]">
              “Antika, eskimiş eşya değildir. Sağ kalmayı başarmış işçiliktir.”
            </p>
            <div className="mt-8 space-y-5 text-[1.02rem] leading-relaxed text-ink-soft">
              <p>
                Dedemin Çukurcuma'da açtığı dükkânda üç kuşaktır aynı işi yapıyoruz: iyi
                yapılmış olanı bulmak, doğrulamak ve doğru eve göndermek.
              </p>
              <p>
                Vitrine giren her parça önce elden geçer. Dönemi, menşei, onarım geçmişi
                yazılır; kusuru varsa künyesinde açıkça belirtilir. Bir parçanın hikâyesini
                gizlemek, o parçaya yapılabilecek en büyük saygısızlıktır.
              </p>
            </div>
            <Link href="/iletisim" className="btn btn-ghost mt-10">
              Randevu al
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------- süreç ------------------------------- */}
      <section className="border-t">
        <div className="mx-auto max-w-[1400px] px-5 py-24 md:px-10">
          <div className="grid gap-12 md:grid-cols-3">
            {[
              {
                title: "Bulunur",
                text: "Müzayede, koleksiyon tasfiyesi ve aile arşivlerinden gelen parçalar dükkâna alınır.",
              },
              {
                title: "Belgelenir",
                text: "Dönem, menşe, malzeme ve onarım geçmişi çıkarılır; her parçanın künyesi yazılır.",
              },
              {
                title: "Yolculanır",
                text: "Sigortalı, özel ambalajlı kurye ile gönderilir; kırılganlar için elden teslim.",
              },
            ].map((step, index) => (
              <div key={step.title} className="border-t pt-6">
                <span className="display text-[1.1rem] text-brass">{ROMAN[index]}</span>
                <h3 className="display mt-4 text-[1.8rem] leading-none">{step.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- çağrı ------------------------------- */}
      <section className="section-dark">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start gap-8 px-5 py-24 md:flex-row md:items-end md:justify-between md:px-10">
          <div>
            <p className="eyebrow">Değerlendirme</p>
            <h2 className="display mt-4 max-w-xl text-[2.6rem] leading-[0.98] sm:text-[3.6rem]">
              Elinizdeki parçanın
              <span className="display-italic text-brass-light"> değerini</span> birlikte
              okuyalım.
            </h2>
          </div>
          <div className="max-w-sm">
            <p className="text-sm leading-relaxed text-paper/70">
              Fotoğrafını gönderin; dönem, menşe ve piyasa aralığı için ilk görüşümüzü 48
              saat içinde yazalım. Ücretsizdir.
            </p>
            <Link href="/iletisim#ekspertiz" className="btn btn-brass mt-7">
              Parçamı değerlendirin
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
