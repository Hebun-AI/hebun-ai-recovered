/**
 * Oturum jetonu — Web Crypto ile imzalanır, böylece hem middleware (edge)
 * hem de sunucu tarafı aynı doğrulamayı kullanabilir.
 */

const MAX_AGE_SECONDS = 60 * 60 * 8;

export const ADMIN_COOKIE = "antika_admin";
export const ADMIN_SESSION_MAX_AGE = MAX_AGE_SECONDS;

function secretBytes(): ArrayBuffer {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "antika-demo-oturum-anahtari";
  const bytes = new TextEncoder().encode(secret);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "antika2026";
}

export async function createSessionValue(): Promise<string> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${await hmac(String(expiresAt))}`;
}

export async function isValidSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [rawExpiry, signature] = value.split(".");
  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !signature) return false;

  const expected = await hmac(rawExpiry);
  if (expected.length !== signature.length) return false;

  // Sabit süreli karşılaştırma — imza tahmininde zaman sızıntısını engeller.
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
