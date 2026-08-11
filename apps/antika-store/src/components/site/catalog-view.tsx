import Link from "next/link";

import { ProductCard } from "@/components/site/product-card";
import type { Category, Product } from "@/lib/types";

const SORTS = [
  { key: "yeni", label: "Yeni gelenler" },
  { key: "artan", label: "Fiyat ↑" },
  { key: "azalan", label: "Fiyat ↓" },
] as const;

type Props = {
  categories: Category[];
  products: Product[];
  activeCategory?: Category;
  sort: string;
  title: string;
  description: string;
  eyebrow: string;
};

export function CatalogView({
  categories,
  products,
  activeCategory,
  sort,
  title,
  description,
  eyebrow,
}: Props) {
  const basePath = activeCategory ? `/kategori/${activeCategory.slug}` : "/kategori";
  const sortHref = (key: string) => (key === "yeni" ? basePath : `${basePath}?sirala=${key}`);

  return (
    <>
      <section className="border-b">
        <div className="mx-auto max-w-[1400px] px-5 pb-14 pt-16 md:px-10 lg:pt-20">
          <nav className="label-caps flex items-center gap-2 text-ink-faint">
            <Link href="/" className="link-underline">
              Ana sayfa
            </Link>
            <span aria-hidden>/</span>
            <Link href="/kategori" className="link-underline">
              Katalog
            </Link>
            {activeCategory ? (
              <>
                <span aria-hidden>/</span>
                <span className="text-ink">{activeCategory.name}</span>
              </>
            ) : null}
          </nav>

          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="display mt-4 text-[3rem] leading-[0.95] sm:text-[4.2rem]">
                {title}
              </h1>
            </div>
            <p className="max-w-md text-[0.98rem] leading-relaxed text-ink-soft lg:col-span-5">
              {description}
            </p>
          </div>
        </div>
      </section>

      <section className="sticky top-[104px] z-30 border-b bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-5 py-3 md:px-10">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/kategori"
              data-active={!activeCategory}
              className="link-underline label-caps data-[active=true]:text-ink text-ink-faint hover:text-ink"
            >
              Tümü
            </Link>
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/kategori/${category.slug}`}
                data-active={activeCategory?.slug === category.slug}
                className="link-underline label-caps data-[active=true]:text-ink text-ink-faint hover:text-ink"
              >
                {category.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="label-caps tnum text-ink-faint">
              {String(products.length).padStart(2, "0")} parça
            </span>
            <span aria-hidden className="h-4 w-px bg-ink/20" />
            {SORTS.map((option) => (
              <Link
                key={option.key}
                href={sortHref(option.key)}
                data-active={sort === option.key}
                className="link-underline label-caps data-[active=true]:text-ink text-ink-faint hover:text-ink"
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 py-14 md:px-10">
        {products.length === 0 ? (
          <div className="border py-24 text-center">
            <p className="display text-[2rem]">Bu bölümde şu an parça yok.</p>
            <p className="mt-3 text-sm text-ink-soft">
              Yeni gelenler için bültene yazılın ya da aradığınızı bize söyleyin; bulalım.
            </p>
            <Link href="/iletisim" className="btn btn-ghost mt-8">
              Aradığımı arayın
            </Link>
          </div>
        ) : (
          <div className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
