/*
 * media-storage-acceptance/run-storage-acceptance.server.ts — prove, from inside the deployed
 * runtime, that the configured storage port reaches the VPS store and behaves as the port promises.
 *
 * WHY THIS EXISTS: MEDIA-1 has no human door, so nothing in a deployment ever evaluates the storage
 * resolver, and Vercel's sensitive variables cannot be read back. Without a caller inside the
 * runtime, "production is connected" would be an assertion about configuration nobody exercised.
 *
 * ── WHAT IT TOUCHES ─────────────────────────────────────────────────────────
 *
 * The storage PORT only, through the released resolver. It reads no row and writes no row: no
 * `media_assets`, no invocation, no Governance decision, no request, permit or execution. It calls no
 * generation transport. It is not an authority and admits nothing.
 *
 * ── THE FIXTURE ─────────────────────────────────────────────────────────────
 *
 * One synthetic object per run, a few dozen bytes, under a tenant id in the reserved acceptance
 * namespace `00000000-0000-4000-8000-xxxxxxxxxxxx` — never a real tenant, and recognisable on the VPS
 * so an operator can remove it. The port has no delete verb and this module adds none.
 *
 * ── THE CHECKS, IN ORDER; THE FIRST FAILURE STOPS THE RUN ───────────────────
 *
 *   resolved                  the resolver answers `available`, backend `hebun-vps`
 *   absentBeforePut           the fresh key does not exist
 *   put                       write succeeds
 *   verifiedDigestAndSize     stored size and SHA-256 equal the fixture's
 *   signedReadExactBytes      the read grant is https, and fetching it returns exactly the fixture
 *   grantShortLived           the grant expires within the authority's TTL
 *   writeOnceRefused          a second put of the same key is refused with 409
 *   otherTenantAbsent         the same asset id under another tenant does not exist
 *   otherTenantGrantEmpty     a valid grant for that other key serves nothing (404)
 *   tamperedGrantRefused      the fixture's grant with its content type changed is refused (403)
 *
 * The result carries check names and booleans only — never a key, URL, grant, secret or byte.
 *
 * Server-only.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mediaAssetStorageKey } from "@/features/media-assets/contracts";
import {
  MEDIA_READ_ACCESS_TTL_SECONDS,
  type MediaStorageResolution,
} from "@/features/media-assets/media-object-store";
import { resolveMediaObjectStore } from "@/features/media-assets/media-storage.server";

export const STORAGE_ACCEPTANCE_TENANT_PREFIX = "00000000-0000-4000-8000-";
export const EXPECTED_STORAGE_BACKEND = "hebun-vps";

export const STORAGE_ACCEPTANCE_CHECKS = [
  "resolved",
  "absentBeforePut",
  "put",
  "verifiedDigestAndSize",
  "signedReadExactBytes",
  "grantShortLived",
  "writeOnceRefused",
  "otherTenantAbsent",
  "otherTenantGrantEmpty",
  "tamperedGrantRefused",
] as const;

export type StorageAcceptanceCheck = (typeof STORAGE_ACCEPTANCE_CHECKS)[number];

export type StorageAcceptanceResult =
  | { readonly status: "not-connected"; readonly reason: "storage-not-connected" | "storage-misconfigured" }
  | { readonly status: "failed"; readonly failedCheck: StorageAcceptanceCheck; readonly passed: readonly StorageAcceptanceCheck[] }
  | { readonly status: "accepted"; readonly backend: string; readonly passed: readonly StorageAcceptanceCheck[] };

export interface StorageAcceptanceDeps {
  readonly resolveStorage?: () => MediaStorageResolution;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}

const FETCH_TIMEOUT_MS = 15_000;

function acceptanceTenantId(): string {
  return STORAGE_ACCEPTANCE_TENANT_PREFIX + randomBytes(6).toString("hex");
}

function fixtureBytes(): Uint8Array {
  const marker = new TextEncoder().encode(`HEBUN-MEDIA-STORAGE-ACCEPTANCE ${randomBytes(8).toString("hex")}`);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return new Uint8Array([...signature, ...marker]);
}

const sha256Hex = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function runStorageAcceptance(deps: StorageAcceptanceDeps = {}): Promise<StorageAcceptanceResult> {
  if (typeof window !== "undefined") {
    throw new Error("Storage acceptance is server-only.");
  }
  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const passed: StorageAcceptanceCheck[] = [];
  const fail = (failedCheck: StorageAcceptanceCheck): StorageAcceptanceResult => ({ status: "failed", failedCheck, passed: [...passed] });

  const resolution = (deps.resolveStorage ?? resolveMediaObjectStore)();
  if (resolution.status !== "available") return { status: "not-connected", reason: resolution.reason };
  const store = resolution.store;
  if (store.backend !== EXPECTED_STORAGE_BACKEND) return fail("resolved");
  passed.push("resolved");

  const tenantA = acceptanceTenantId();
  const tenantB = acceptanceTenantId();
  const assetId = randomUUID();
  const key = mediaAssetStorageKey(tenantA, assetId);
  const otherKey = mediaAssetStorageKey(tenantB, assetId);
  const bytes = fixtureBytes();
  const digest = sha256Hex(bytes);
  const get = (url: string) =>
    doFetch(url, { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  try {
    if ((await store.verify(key)).status !== "absent") return fail("absentBeforePut");
    passed.push("absentBeforePut");
  } catch {
    return fail("absentBeforePut");
  }

  try {
    await store.put({ key, bytes, contentType: "image/png", sha256Hex: digest });
    passed.push("put");
  } catch {
    return fail("put");
  }

  try {
    const stored = await store.verify(key);
    if (stored.status !== "present" || stored.byteSize !== bytes.length || stored.sha256Hex !== digest) {
      return fail("verifiedDigestAndSize");
    }
    passed.push("verifiedDigestAndSize");
  } catch {
    return fail("verifiedDigestAndSize");
  }

  let grantUrl: string;
  try {
    const grant = await store.createReadAccess({ key, contentType: "image/png", ttlSeconds: MEDIA_READ_ACCESS_TTL_SECONDS });
    grantUrl = grant.url;
    if (new URL(grant.url).protocol !== "https:") return fail("signedReadExactBytes");
    const response = await get(grant.url);
    const served = new Uint8Array(await response.arrayBuffer());
    if (response.status !== 200 || !sameBytes(served, bytes) || sha256Hex(served) !== digest) {
      return fail("signedReadExactBytes");
    }
    passed.push("signedReadExactBytes");
    const lifetime = Date.parse(grant.expiresAt) - now();
    if (!(lifetime > 0 && lifetime <= (MEDIA_READ_ACCESS_TTL_SECONDS + 1) * 1000)) return fail("grantShortLived");
    passed.push("grantShortLived");
  } catch {
    return fail(passed.includes("signedReadExactBytes") ? "grantShortLived" : "signedReadExactBytes");
  }

  try {
    await store.put({ key, bytes, contentType: "image/png", sha256Hex: digest });
    return fail("writeOnceRefused");
  } catch (error) {
    if (!(error instanceof Error) || !/\(409\)/.test(error.message)) return fail("writeOnceRefused");
    passed.push("writeOnceRefused");
  }

  try {
    if ((await store.verify(otherKey)).status !== "absent") return fail("otherTenantAbsent");
    passed.push("otherTenantAbsent");
  } catch {
    return fail("otherTenantAbsent");
  }

  try {
    const otherGrant = await store.createReadAccess({ key: otherKey, contentType: "image/png", ttlSeconds: MEDIA_READ_ACCESS_TTL_SECONDS });
    const response = await get(otherGrant.url);
    await response.body?.cancel().catch(() => undefined);
    if (response.status !== 404) return fail("otherTenantGrantEmpty");
    passed.push("otherTenantGrantEmpty");
  } catch {
    return fail("otherTenantGrantEmpty");
  }

  try {
    const tampered = new URL(grantUrl);
    tampered.searchParams.set("ct", "image/jpeg");
    const response = await get(tampered.toString());
    await response.body?.cancel().catch(() => undefined);
    if (response.status !== 403) return fail("tamperedGrantRefused");
    passed.push("tamperedGrantRefused");
  } catch {
    return fail("tamperedGrantRefused");
  }

  return { status: "accepted", backend: store.backend, passed: [...passed] };
}
