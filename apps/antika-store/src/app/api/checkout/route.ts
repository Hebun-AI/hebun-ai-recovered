import { NextResponse } from "next/server";

import {
  attachSessionToOrder,
  createOrder,
  getProductsByIds,
  getSettings,
} from "@/lib/db";
import { getStripe, siteUrl } from "@/lib/stripe";
import type { OrderItem } from "@/lib/types";

type Body = { items?: { productId?: string; quantity?: number }[] };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const requested = (body.items ?? []).filter(
    (item): item is { productId: string; quantity: number } =>
      typeof item.productId === "string" && Number.isFinite(item.quantity),
  );

  if (requested.length === 0) {
    return NextResponse.json({ error: "Sepet boş." }, { status: 400 });
  }

  // Fiyat ve stok her zaman sunucudaki kayıttan okunur; istemciden gelen tutara güvenilmez.
  const products = await getProductsByIds(requested.map((item) => item.productId));
  const settings = await getSettings();

  const items: OrderItem[] = [];
  for (const line of requested) {
    const product = products.find((candidate) => candidate.id === line.productId);
    if (!product || product.status !== "yayinda") {
      return NextResponse.json(
        { error: "Sepetteki bir parça artık satışta değil. Sepeti tazeleyin." },
        { status: 409 },
      );
    }
    const quantity = Math.max(1, Math.min(Math.floor(line.quantity), product.stock));
    if (product.stock <= 0) {
      return NextResponse.json(
        { error: `${product.title} satılmış. Sepetten çıkarın.` },
        { status: 409 },
      );
    }
    items.push({
      productId: product.id,
      title: product.title,
      reference: product.reference,
      slug: product.slug,
      unitPriceKurus: product.priceKurus,
      quantity,
    });
  }

  const subtotal = items.reduce((total, item) => total + item.unitPriceKurus * item.quantity, 0);
  const shipping = subtotal >= settings.freeShippingLimitKurus ? 0 : settings.shippingFeeKurus;

  const order = await createOrder({
    status: "beklemede",
    items,
    totalKurus: subtotal + shipping,
    customerName: "",
    customerEmail: "",
    stripeSessionId: "",
  });

  const stripe = getStripe();
  const base = siteUrl();

  // Stripe anahtarı yoksa örnek demo moduna düşer: sipariş kaydı oluşur, kart çekilmez.
  if (!stripe) {
    await attachSessionToOrder(order.id, "demo");
    return NextResponse.json({
      url: `${base}/siparis/tamamlandi?siparis=${order.id}&demo=1`,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "tr",
      currency: "try",
      line_items: [
        ...items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "try",
            unit_amount: item.unitPriceKurus,
            product_data: {
              name: `${item.title} (${item.reference})`,
              metadata: { productId: item.productId },
            },
          },
        })),
        ...(shipping > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "try" as const,
                  unit_amount: shipping,
                  product_data: { name: "Sigortalı kargo" },
                },
              },
            ]
          : []),
      ],
      metadata: { orderId: order.id, orderNumber: order.number },
      success_url: `${base}/siparis/tamamlandi?siparis=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/sepet`,
    });

    await attachSessionToOrder(order.id, session.id);
    return NextResponse.json({ url: session.url });
  } catch (cause) {
    console.error("Stripe oturumu açılamadı", cause);
    return NextResponse.json(
      { error: "Ödeme sağlayıcısına ulaşılamadı. Lütfen tekrar deneyin." },
      { status: 502 },
    );
  }
}
