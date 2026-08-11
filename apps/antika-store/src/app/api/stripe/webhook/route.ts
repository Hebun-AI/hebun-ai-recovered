import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { markOrderPaid, setOrderCustomer, setOrderStatus } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

/**
 * Ödemenin tek doğruluk kaynağı burasıdır.
 * Kullanıcı başarı sayfasına hiç dönmese bile sipariş burada "ödendi" olur.
 *
 * Yerelde denemek için: stripe listen --forward-to localhost:3001/api/stripe/webhook
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe yapılandırılmamış." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "İmza yok." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (cause) {
    console.error("Webhook imzası doğrulanamadı", cause);
    return NextResponse.json({ error: "İmza doğrulanamadı." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await setOrderCustomer(orderId, {
          customerName: session.customer_details?.name ?? undefined,
          customerEmail: session.customer_details?.email ?? undefined,
        });
        await markOrderPaid(orderId);
      }
      break;
    }
    case "checkout.session.expired": {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await setOrderStatus(orderId, "iptal");
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
