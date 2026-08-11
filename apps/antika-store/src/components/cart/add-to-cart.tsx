"use client";

import Link from "next/link";
import { useState } from "react";

import { useCart, type CartLine } from "@/components/cart/cart-context";
import { startCheckout } from "@/lib/checkout-client";

export function AddToCart({ line }: { line: Omit<CartLine, "quantity"> }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const soldOut = line.stock <= 0;

  if (soldOut) {
    return (
      <div className="border border-oxblood/40 bg-oxblood/5 p-6">
        <p className="label-caps text-oxblood">Bu parça satıldı</p>
        <p className="mt-3 text-sm text-ink-soft">
          Benzer bir parça geldiğinde haber verelim mi? Bize referans numarasıyla yazın.
        </p>
        <Link href="/iletisim" className="btn btn-ghost mt-5">
          Benzerini arayın
        </Link>
      </div>
    );
  }

  async function buyNow() {
    setBusy(true);
    setError(null);
    try {
      await startCheckout([{ productId: line.productId, quantity }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ödeme başlatılamadı.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex items-center border border-ink/30">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="px-4 py-3 text-lg leading-none transition-colors hover:bg-ink hover:text-paper"
            aria-label="Adet azalt"
          >
            −
          </button>
          <span className="tnum w-10 text-center text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(line.stock, value + 1))}
            className="px-4 py-3 text-lg leading-none transition-colors hover:bg-ink hover:text-paper"
            aria-label="Adet artır"
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="btn flex-1"
          onClick={() => {
            add(line, quantity);
            setAdded(true);
            window.setTimeout(() => setAdded(false), 2600);
          }}
        >
          {added ? "Sepete eklendi ✓" : "Sepete ekle"}
        </button>

        <button type="button" className="btn btn-brass" onClick={buyNow} disabled={busy}>
          {busy ? "Yönlendiriliyor…" : "Hemen al"}
        </button>
      </div>

      {added ? (
        <p className="mt-3 text-sm text-ink-soft">
          <Link href="/sepet" className="link-underline text-oxblood">
            Sepete git →
          </Link>
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-oxblood">{error}</p> : null}

      <p className="mt-4 text-xs text-ink-faint">
        Stokta {line.stock} adet · Sipariş sonrası 2 iş günü içinde sigortalı kargoya verilir.
      </p>
    </div>
  );
}
