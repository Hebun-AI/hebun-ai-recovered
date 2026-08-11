export type CheckoutLine = { productId: string; quantity: number };

/**
 * Ödeme oturumunu sunucuda açar ve tarayıcıyı yönlendirir.
 * Fiyat hesabı bilerek sunucuda yapılır — istemciden yalnız ürün ve adet gider.
 */
export async function startCheckout(items: CheckoutLine[]): Promise<void> {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });

  const payload = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Ödeme oturumu açılamadı.");
  }

  window.location.href = payload.url;
}
