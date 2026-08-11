import type { Metadata } from "next";

import { ArchivePlate } from "@/components/archive-plate";
import { ContactForm } from "@/components/site/contact-form";
import { getSettings } from "@/lib/db";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "Çukurcuma'daki dükkânımız, randevu saatleri, ekspertiz talebi ve kargo-iade koşulları.",
};

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <>
      <section className="border-b">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-5 pb-16 pt-16 md:px-10 lg:grid-cols-12 lg:items-end lg:pt-20">
          <div className="lg:col-span-7">
            <p className="eyebrow">Çukurcuma · Beyoğlu</p>
            <h1 className="display mt-4 text-[3rem] leading-[0.95] sm:text-[4.4rem]">
              Kapımız
              <span className="display-italic text-oxblood"> açık.</span>
            </h1>
          </div>
          <p className="max-w-md text-[1.02rem] leading-relaxed text-ink-soft lg:col-span-5">
            Bir parçayı sormak, elinizdekini değerlendirmek ya da sadece bakmak için
            uğrayın. Randevu şart değil; ama haber verirseniz kahve hazır olur.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 py-20 md:px-10">
        <div className="grid gap-16 lg:grid-cols-12">
          {/* künye sütunu */}
          <div className="lg:col-span-4">
            <div className="border-t pt-6">
              <p className="eyebrow">Dükkân</p>
              <address className="mt-4 space-y-1 text-[1.05rem] not-italic leading-relaxed">
                <p>{settings.address}</p>
              </address>
              <p className="tnum mt-4 text-sm text-ink-soft">{settings.workingHours}</p>
              <p className="mt-1 text-sm text-ink-faint">Pazar & Pazartesi kapalı</p>
            </div>

            <div className="mt-10 border-t pt-6">
              <p className="eyebrow">Doğrudan</p>
              <ul className="mt-4 space-y-2 text-[1.05rem]">
                <li>
                  <a href={`mailto:${settings.email}`} className="link-underline">
                    {settings.email}
                  </a>
                </li>
                <li className="tnum">
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, "")}`}
                    className="link-underline"
                  >
                    {settings.phone}
                  </a>
                </li>
                <li>
                  <span className="text-ink-soft">{settings.instagram}</span>
                </li>
              </ul>
            </div>

            <div className="mt-10 aspect-[4/3] overflow-hidden border">
              <ArchivePlate seed="miras-dukkan-haritasi" monogram="Ç" />
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              Çukurcuma Caddesi, Galatasaray'dan yokuş aşağı üçüncü dükkân.
            </p>
          </div>

          {/* form */}
          <div className="lg:col-span-7 lg:col-start-6">
            <div className="border-t pt-6">
              <h2 className="display text-[2.2rem] leading-none">Bize yazın</h2>
              <p className="mt-3 max-w-lg text-sm text-ink-soft">
                Katalogdaki bir parça hakkında soru, detay fotoğraf isteği ya da kendi
                parçanız için ekspertiz — hepsi aynı formdan.
              </p>
            </div>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* sık sorulanlar */}
      <section className="border-t bg-paper-2/45">
        <div className="mx-auto max-w-[1400px] px-5 py-20 md:px-10">
          <div className="grid gap-12 lg:grid-cols-3">
            <div id="ekspertiz" className="scroll-mt-32 border-t pt-6">
              <p className="eyebrow">01</p>
              <h3 className="display mt-3 text-[1.8rem] leading-none">Ekspertiz</h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Parçanın önden, arkadan ve varsa damga/imza bölgesinden net fotoğraflarını
                gönderin. Dönem, menşe ve piyasa aralığı için ilk görüşümüzü 48 saat içinde
                yazıyoruz. Ön değerlendirme ücretsizdir; yazılı rapor gerekiyorsa ücret
                önceden bildirilir.
              </p>
            </div>

            <div id="kargo" className="scroll-mt-32 border-t pt-6">
              <p className="eyebrow">02</p>
              <h3 className="display mt-3 text-[1.8rem] leading-none">Kargo & iade</h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Tüm gönderiler sigortalıdır ve özel ambalajla hazırlanır. Kırılgan parçalarda
                İstanbul içi elden teslim yapılır. Teslimden itibaren 14 gün içinde, künyede
                belirtilmemiş bir kusur halinde koşulsuz iade geçerlidir.
              </p>
            </div>

            <div id="satis" className="scroll-mt-32 border-t pt-6">
              <p className="eyebrow">03</p>
              <h3 className="display mt-3 text-[1.8rem] leading-none">Bize satmak</h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Tek parça ya da koleksiyon alıyoruz. Koleksiyon tasfiyelerinde yerinde
                değerlendirme yapıyor, uygun parçaları peşin bedelle alıyoruz. Kültür varlığı
                niteliğindeki eserlerde mevzuat gereği yurt dışı satışı yapılmaz.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
