const priceFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const priceWithKurusFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

/** Kuruşu "₺185.000" biçimine çevirir; kuruş hanesi varsa gösterir. */
export function formatPrice(kurus: number): string {
  const lira = kurus / 100;
  return Number.isInteger(lira)
    ? priceFormatter.format(lira)
    : priceWithKurusFormatter.format(lira);
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** "1.850,00" gibi bir kullanıcı girdisini kuruşa çevirir. */
export function parsePriceToKurus(input: string): number {
  const normalized = input
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

/** Kuruşu form alanında düzenlenebilir "1850.00" biçimine çevirir. */
export function kurusToInput(kurus: number): string {
  return (kurus / 100).toFixed(2);
}
