/** Compact USD, e.g. 184200 → "$184.2K", 342500 → "$342.5K". */
export function usdCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Full USD, e.g. 9600 → "$9,600". */
export function usd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const UTC_INSTANT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/**
 * A stored instant as "25 Oct 2026, 10:21 UTC". Fixed locale and zone: a server-rendered time must read
 * the same in the browser, or hydration fails (React #418). The stored value is not changed or rounded
 * anywhere but in this text; an unparseable value is shown as stored.
 */
export function utcInstant(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : `${UTC_INSTANT.format(parsed)} UTC`;
}
