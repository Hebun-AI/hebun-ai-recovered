"use client";

import { useEffect } from "react";

import { useCart } from "@/components/cart/cart-context";

/** Sipariş tamamlandığında sepeti boşaltır. */
export function ClearCart() {
  const { clear, ready, lines } = useCart();

  useEffect(() => {
    if (ready && lines.length > 0) clear();
  }, [ready, lines.length, clear]);

  return null;
}
