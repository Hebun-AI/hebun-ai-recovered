"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartLine = {
  productId: string;
  slug: string;
  title: string;
  reference: string;
  priceKurus: number;
  imageUrl: string;
  quantity: number;
  stock: number;
};

type CartState = {
  lines: CartLine[];
  /** localStorage okunana kadar false — sunucu/istemci uyuşmazlığını önler. */
  ready: boolean;
  count: number;
  subtotalKurus: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "miras-sepet-v1";

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      // bozuk kayıt: sepeti boş başlat
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((item) => item.productId === line.productId);
      if (!existing) return [...current, { ...line, quantity }];
      return current.map((item) =>
        item.productId === line.productId
          ? { ...item, quantity: Math.min(item.stock, item.quantity + quantity) }
          : item,
      );
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((item) => item.productId !== productId)
        : current.map((item) =>
            item.productId === productId
              ? { ...item, quantity: Math.min(item.stock, quantity) }
              : item,
          ),
    );
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartState>(() => {
    const count = lines.reduce((total, line) => total + line.quantity, 0);
    const subtotalKurus = lines.reduce(
      (total, line) => total + line.priceKurus * line.quantity,
      0,
    );
    return { lines, ready, count, subtotalKurus, add, setQuantity, remove, clear };
  }, [lines, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart, CartProvider içinde kullanılmalı.");
  return context;
}
