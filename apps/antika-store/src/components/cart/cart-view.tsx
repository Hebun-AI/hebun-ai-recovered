"use client";

import Link from "next/link";
import { useState } from "react";

import { ProductVisual } from "@/components/archive-plate";
import { useCart } from "@/components/cart/cart-context";
import { startCheckout } from "@/lib/checkout-client";
import { formatPrice } from "@/lib/format";
import type { Settings } from "@/lib/types";

export function CartView({ settings }: { settings: Settings }) {
  const { lines, ready, subtotalKurus, setQuantity, remove, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shipping =
    subtotalKurus === 0 || subtotalKurus >= settings.freeShippingLimitKurus
      ? 0
      : settings.shippingFeeKurus;
  const total = subtotalKurus + shipping;

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      await startCheckout(
        lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ödeme başlatılamadı.");
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="h-64 animate-pulse border bg-paper-2/40" aria-hidden />;
  }

  if (lines.length === 0) {
    return (
      <div className="border py-24 text-center">
        <p className="display text-[2.2rem]">Sepetiniz henüz boş.</p>
        <p className="mt-3 text-sm text-ink-soft">
          Katalogdaki her parça tektir — beğendiğinizi bekletmeyin.
        </p>
        <Link href="/kategori" className="btn mt-8">
          Kataloğa dön
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-14 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <div className="border-t">
          {lines.map((line) => (
            <div key={line.productId} className="grid grid-cols-[88px_1fr] gap-5 border-b py-6 sm:grid-cols-[110px_1fr]">
              <Link href={`/urun/${line.slug}`} className="block aspect-[4/5] overflow-hidden border">
                <ProductVisual
                  src={line.imageUrl}
                  alt={line.title}
                  seed={line.slug}
                  monogram={line.title}
                />
              </Link>

              <div className="flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow tnum">{line.reference}</p>
                    <h2 className="display mt-1 text-[1.5rem] leading-tight">
                      <Link href={`/urun/${line.slug}`} className="link-underline">
                        {line.title}
                      </Link>
                    </h2>
                  </div>
                  <p className="display tnum text-[1.25rem]">
                    {formatPrice(line.priceKurus * line.quantity)}
                  </p>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-5">
                  <div className="flex items-center border border-ink/30">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.productId, line.quantity - 1)}
                      className="px-3.5 py-2 leading-none transition-colors hover:bg-ink hover:text-paper"
                      aria-label="Adet azalt"
                    >
                      −
                    </button>
                    <span className="tnum w-9 text-center text-sm">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.productId, line.quantity + 1)}
                      disabled={line.quantity >= line.stock}
                      className="px-3.5 py-2 leading-none transition-colors hover:bg-ink hover:text-paper disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink"
                      aria-label="Adet artır"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.productId)}
                    className="link-underline label-caps text-ink-faint hover:text-oxblood"
                  >
                    Çıkar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={clear}
          className="link-underline label-caps mt-6 text-ink-faint hover:text-oxblood"
        >
          Sepeti boşalt
        </button>
      </div>

      <aside className="lg:col-span-5 lg:col-start-8">
        <div className="border bg-paper-2/40 p-7 lg:sticky lg:top-32">
          <p className="eyebrow">Özet</p>

          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between border-b border-dotted border-ink/20 pb-2">
              <dt className="text-ink-soft">Ara toplam</dt>
              <dd className="tnum">{formatPrice(subtotalKurus)}</dd>
            </div>
            <div className="flex justify-between border-b border-dotted border-ink/20 pb-2">
              <dt className="text-ink-soft">Kargo</dt>
              <dd className="tnum">{shipping === 0 ? "Bedava" : formatPrice(shipping)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex items-end justify-between border-t pt-5">
            <span className="label-caps">Toplam</span>
            <span className="display tnum text-[1.9rem] leading-none">{formatPrice(total)}</span>
          </div>

          <button type="button" onClick={checkout} disabled={busy} className="btn mt-7 w-full">
            {busy ? "Ödeme sayfası açılıyor…" : "Ödemeye geç"}
          </button>

          {error ? <p className="mt-3 text-sm text-oxblood">{error}</p> : null}

          <p className="mt-5 text-xs leading-relaxed text-ink-faint">
            Ödeme Stripe üzerinden alınır; kart bilgileri sunucularımıza hiç uğramaz. Stripe
            anahtarı tanımlı değilse sipariş demo modunda kaydedilir.
          </p>
        </div>
      </aside>
    </div>
  );
}
