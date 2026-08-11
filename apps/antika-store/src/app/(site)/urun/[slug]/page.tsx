import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductVisual } from "@/components/archive-plate";
import { AddToCart } from "@/components/cart/add-to-cart";
import { ProductCard } from "@/components/site/product-card";
import { getCategory, getProductBySlug, getProducts, getSettings } from "@/lib/db";
import { formatPrice } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Parça bulunamadı" };
  return {
    title: `${product.title} — ${product.reference}`,
    description: product.excerpt,
  };
}

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.status !== "yayinda") notFound();

  const [category, settings, siblings] = await Promise.all([
    getCategory(product.categorySlug),
    getSettings(),
    getProducts({ categorySlug: product.categorySlug }),
  ]);

  const related = siblings.filter((item) => item.id !== product.id).slice(0, 3);
  const paragraphs = product.description.split("\n").filter(Boolean);
  const freeShipping = product.priceKurus >= settings.freeShippingLimitKurus;

  return (
    <>
      <section className="mx-auto max-w-[1400px] px-5 pb-24 pt-10 md:px-10 lg:pt-14">
        <nav className="label-caps flex flex-wrap items-center gap-2 text-ink-faint">
          <Link href="/" className="link-underline">
            Ana sayfa
          </Link>
          <span aria-hidden>/</span>
          <Link href="/kategori" className="link-underline">
            Katalog
          </Link>
          {category ? (
            <>
              <span aria-hidden>/</span>
              <Link href={`/kategori/${category.slug}`} className="link-underline">
                {category.name}
              </Link>
            </>
          ) : null}
          <span aria-hidden>/</span>
          <span className="tnum text-ink">{product.reference}</span>
        </nav>

        <div className="mt-10 grid gap-14 lg:grid-cols-12 lg:gap-16">
          {/* görsel */}
          <div className="lg:col-span-7">
            <div className="fade-in relative aspect-[4/5] overflow-hidden border shadow-[0_50px_90px_-70px_rgba(24,19,16,0.9)]">
              <ProductVisual
                src={product.imageUrl}
                alt={product.title}
                seed={product.slug}
                monogram={product.title}
              />
              <span className="tnum label-caps absolute left-0 top-0 bg-ink px-3 py-2 text-paper">
                {product.reference}
              </span>
              {product.stock <= 0 ? (
                <span className="absolute right-4 top-4 rotate-6 border border-oxblood bg-paper/85 px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.24em] text-oxblood">
                  Satıldı
                </span>
              ) : null}
            </div>

            <p className="mt-4 text-xs text-ink-faint">
              Görseller parçanın kendisine aittir; ışık koşullarına göre renklerde küçük
              farklılıklar olabilir. Detay fotoğrafı talep edebilirsiniz.
            </p>
          </div>

          {/* künye + satın alma */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32">
              <p className="eyebrow">{category?.name ?? "Antika"}</p>
              <h1 className="display mt-3 text-[2.6rem] leading-[0.98] sm:text-[3.2rem]">
                {product.title}
              </h1>
              <p className="mt-5 text-[1.02rem] leading-relaxed text-ink-soft">
                {product.excerpt}
              </p>

              <p className="display tnum mt-8 text-[2.2rem] leading-none">
                {formatPrice(product.priceKurus)}
              </p>
              <p className="mt-2 text-xs text-ink-faint">
                KDV dâhil · {freeShipping ? "Kargo bedava" : `Kargo ${formatPrice(settings.shippingFeeKurus)}`}
              </p>

              <div className="mt-8 border-t pt-6">
                <AddToCart
                  line={{
                    productId: product.id,
                    slug: product.slug,
                    title: product.title,
                    reference: product.reference,
                    priceKurus: product.priceKurus,
                    imageUrl: product.imageUrl,
                    stock: product.stock,
                  }}
                />
              </div>

              <dl className="mt-10 border-t pt-6">
                <p className="eyebrow mb-4">Künye</p>
                {product.attributes.map((attribute) => (
                  <div
                    key={attribute.label}
                    className="flex items-baseline justify-between gap-6 border-b border-dotted border-ink/20 py-2.5"
                  >
                    <dt className="label-caps text-ink-faint">{attribute.label}</dt>
                    <dd className="text-right text-sm text-ink-soft">{attribute.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* açıklama */}
        <div className="mt-24 grid gap-12 border-t pt-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="display text-[2rem] leading-none">Parça hakkında</h2>
            <p className="eyebrow mt-4">Ekspertiz notu</p>
          </div>
          <div className="space-y-5 text-[1.02rem] leading-relaxed text-ink-soft lg:col-span-7">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}

            <div className="mt-8 grid gap-6 border-t pt-8 sm:grid-cols-2">
              <div>
                <p className="label-caps text-ink">Gönderim</p>
                <p className="mt-2 text-sm">
                  Sigortalı, özel ambalajlı kurye. İstanbul içi kırılgan parçalarda elden
                  teslim seçeneği sunulur.
                </p>
              </div>
              <div>
                <p className="label-caps text-ink">İade</p>
                <p className="mt-2 text-sm">
                  Teslimden itibaren 14 gün içinde, künyede belirtilmemiş bir kusur halinde
                  koşulsuz iade.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {related.length ? (
        <section className="border-t bg-paper-2/45">
          <div className="mx-auto max-w-[1400px] px-5 py-20 md:px-10">
            <div className="flex items-end justify-between gap-4">
              <h2 className="display text-[2.2rem] leading-none">Aynı bölümden</h2>
              {category ? (
                <Link
                  href={`/kategori/${category.slug}`}
                  className="link-underline label-caps text-ink-soft"
                >
                  {category.name} →
                </Link>
              ) : null}
            </div>
            <div className="mt-10 grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item, index) => (
                <ProductCard key={item.id} product={item} index={index} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
