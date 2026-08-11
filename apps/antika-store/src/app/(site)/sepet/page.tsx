import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";
import { getSettings } from "@/lib/db";

export const metadata: Metadata = {
  title: "Sepet",
  description: "Sepetinizdeki antika parçalar ve ödeme özeti.",
};

export default async function CartPage() {
  const settings = await getSettings();

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-16 md:px-10">
      <p className="eyebrow">Sipariş</p>
      <h1 className="display mt-3 text-[3rem] leading-none sm:text-[4rem]">Sepet</h1>
      <div className="mt-14">
        <CartView settings={settings} />
      </div>
    </section>
  );
}
