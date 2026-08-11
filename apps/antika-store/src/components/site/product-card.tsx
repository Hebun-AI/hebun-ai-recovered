import Link from "next/link";

import { ProductVisual } from "@/components/archive-plate";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const soldOut = product.stock <= 0;

  return (
    <article
      className="card-archive rise group flex h-full flex-col"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <Link href={`/urun/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden border-b">
          <div className="plate-zoom h-full w-full">
            <ProductVisual
              src={product.imageUrl}
              alt={product.title}
              seed={product.slug}
              monogram={product.title}
            />
          </div>

          <span className="tnum label-caps absolute left-0 top-0 bg-ink px-2.5 py-1.5 text-paper">
            {product.reference}
          </span>

          {soldOut ? (
            <span className="absolute right-3 top-3 rotate-6 border border-oxblood px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-oxblood">
              Satıldı
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow">{product.attributes[0]?.value ?? "Antika"}</p>
        <h3 className="display mt-2 text-[1.45rem] leading-[1.08]">
          <Link href={`/urun/${product.slug}`} className="link-underline">
            {product.title}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{product.excerpt}</p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <p className="display tnum text-[1.3rem]">{formatPrice(product.priceKurus)}</p>
          <Link
            href={`/urun/${product.slug}`}
            className="label-caps text-ink-faint transition-colors group-hover:text-oxblood"
          >
            İncele →
          </Link>
        </div>
      </div>
    </article>
  );
}
