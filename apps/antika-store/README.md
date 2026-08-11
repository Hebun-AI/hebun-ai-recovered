# MİRÂS — Antika E-Ticaret Örneği

Antika ve koleksiyon parçaları satan bir dükkân için uçtan uca çalışan örnek mağaza.
Vitrin + katalog + ürün + iletişim sayfaları, Stripe Checkout ile ödeme ve WordPress
düzenini izleyen bir yönetim paneli içerir.

**Yığın:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Stripe

---

## Hızlı başlangıç

```bash
cd apps/antika-store
npm install
cp .env.example .env.local     # Stripe anahtarları olmadan da çalışır
npm run dev                    # http://localhost:3001
```

Yönetim paneli: <http://localhost:3001/admin> — örnek parola `antika2026`
(`ADMIN_PASSWORD` ile değiştirin).

İlk çalıştırmada `data/seed.json` kopyalanarak `data/db.json` üretilir. Sıfırdan
başlamak için `data/db.json` dosyasını silmek yeterlidir.

---

## Sayfalar

| Yol | İçerik |
|---|---|
| `/` | Ana sayfa: vitrin, kategori defteri, seçki, hikâye, süreç, değerlendirme çağrısı |
| `/kategori` | Tüm katalog — bölüm süzgeci ve fiyat sıralaması |
| `/kategori/[slug]` | Bölüm sayfası (Mobilya, Halı, Gümüş, Seramik, Saat) |
| `/urun/[slug]` | Ürün: künye tablosu, ekspertiz notu, sepete ekle / hemen al |
| `/sepet` | Sepet ve sipariş özeti (kargo eşiği dâhil) |
| `/siparis/tamamlandi` | Ödeme dönüşü, sipariş fişi |
| `/iletisim` | Dükkân künyesi, mesaj formu, ekspertiz / kargo / satın alma koşulları |
| `/admin/*` | Yönetim paneli |

## Yönetim paneli

WordPress alışkanlığını bilerek taklit eder: üst yönetim çubuğu, koyu sol menü,
liste tablosunda satır işlemleri (Düzenle · Taslağa al · Görüntüle · Sil), ürün
düzenleme ekranında solda içerik / sağda **Yayınla**, **Kategori**, **Ürün verisi**,
**Öne çıkan görsel** kutuları.

- **Panel** — yayındaki ürün, taslak, bekleyen sipariş, tahsil edilen tutar; son
  siparişler, okunmamış mesajlar, stok uyarısı.
- **Ürünler** — arama, durum süzgeci, tekil düzenleme, künye satırları (Dönem, Menşe,
  Malzeme…), taslak/yayında durumu, ana sayfa vitrini işareti.
- **Kategoriler** — ad/kısa ad/dönem/açıklama; kısa ad değişince ürün bağları güncellenir.
- **Siparişler** — durum değiştirme; "ödendi"ye geçiş stoktan düşer.
- **Mesajlar** — iletişim formundan gelen kutusu, okundu/sil.
- **Ayarlar** — site künyesi, iletişim bilgileri, kargo ücreti ve ücretsiz kargo eşiği.

Oturum, HMAC ile imzalanmış bir çerezdir; `middleware.ts` `/admin` altını korur.

## Ödeme

`POST /api/checkout` sepeti alır, **fiyat ve stoku sunucudaki kayıttan** doğrular,
siparişi `beklemede` olarak yazar ve Stripe Checkout oturumu açar.

- `STRIPE_SECRET_KEY` tanımlıysa: gerçek Stripe Checkout (TRY, Türkçe arayüz).
  Ödemenin doğruluk kaynağı `POST /api/stripe/webhook` → `checkout.session.completed`.
  Yerelde: `stripe listen --forward-to localhost:3001/api/stripe/webhook`
- Tanımlı değilse: **demo modu**. Akış sonuna kadar çalışır, sipariş kaydedilir,
  kart çekilmez. Panelde "Demo modu" rozeti görünür.

## Görseller

Ürüne fotoğraf girilmemişse gri kutu yerine, slug'dan türetilen deterministik bir
**arşiv plakası** çizilir (`src/components/archive-plate.tsx`): beş bezeme ailesi
(rozet, kilim göbeği, guilloş, yivli sütun, kafes) ve beş renk tonu. Aynı ürün her
zaman aynı plakayı alır. Admin panelinden görsel adresi girildiğinde fotoğraf öne geçer.

## Veri katmanı

Örneği tek komutla çalıştırabilmek için depo dosya tabanlıdır (`src/lib/db.ts`,
`data/db.json`). Yazmalar tek sıradan geçer ve dosya atomik olarak değiştirilir.

**Üretim notu:** Dosya deposu tek sunucu içindir; birden çok örneğin (serverless,
yatay ölçek) aynı dosyayı paylaşamayacağını varsayın. `src/lib/db.ts` bilerek dar bir
arayüz sunar — yerine Postgres/Drizzle repository konduğunda çağıran taraf değişmez.

## Komutlar

```bash
npm run dev        # geliştirme (3001)
npm run build      # üretim derlemesi
npm run start      # üretim sunucusu
npm run typecheck  # tsc --noEmit
```
