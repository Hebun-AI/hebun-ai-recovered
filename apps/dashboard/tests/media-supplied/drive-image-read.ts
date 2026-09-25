/*
 * MEDIA-SUPPLIED — the Drive IMAGE read: transport, seam gate, Drive-reference parsing, and the
 * firewall that keeps it a read. No network: every fetch is a fake.
 *
 *     PROVIDER READ != MEDIA ADMISSION
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  GOOGLE_DRIVE_CONTENT_SCOPE,
  GOOGLE_DRIVE_IMAGE_TYPES,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_DRIVE_READABLE_TYPES,
  MAX_DRIVE_IMAGE_BYTES,
} from "../../src/features/provider-google/contracts";
import { readDriveFileImage } from "../../src/features/provider-google/google-transport.server";
import { readDriveImage } from "../../src/features/provider-google/read-drive-image.server";
import { driveFileIdFrom } from "../../src/features/media-assets/drive-file-ref";
import { MEDIA_ASSET_LIMITS } from "../../src/features/media-assets/contracts";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const ROOT = path.resolve(__dirname, "../..");
const TENANT = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as never;
const FILE_ID = "1AbCdEf_GhIjKlMnOp";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

type Call = { url: string; headers: Record<string, string> };

function driveFake(meta: Record<string, unknown>, body: Uint8Array | null, calls: Call[] = []) {
  return async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (new URL(url).searchParams.get("alt") === "media") {
      return body === null ? new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }) : new Response(body as BodyInit, { status: 200 });
    }
    return new Response(JSON.stringify(meta), { status: 200, headers: { "content-type": "application/json" } });
  };
}

function dbFor(connections: readonly IntegrationView[]) {
  return () =>
    ({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () =>
                connections.map((c) => ({
                  id: c.integrationId,
                  name: c.name,
                  providerKey: c.providerKey,
                  connectionState: c.connectionState,
                  health: c.health,
                  scopes: c.scopes,
                  externalAccountId: c.externalAccountId,
                  externalAccountLabel: c.externalAccountLabel,
                  lastVerifiedAt: c.lastVerifiedAt ? new Date(c.lastVerifiedAt) : null,
                  lastSuccessAt: c.lastSuccessAt ? new Date(c.lastSuccessAt) : null,
                  lastErrorAt: c.lastErrorAt ? new Date(c.lastErrorAt) : null,
                  failureReason: c.failureReason,
                  revokedAt: c.revokedAt ? new Date(c.revokedAt) : null,
                  createdAt: new Date(c.createdAt),
                })),
            }),
          }),
        }),
      }),
    }) as never;
}

async function main(): Promise<void> {
  /* ── 1 · THE CLOSED IMAGE MAP IS SEPARATE FROM THE TEXT MAP, AND BOUNDED LIKE MEDIA ── */
  assert.deepEqual([...GOOGLE_DRIVE_IMAGE_TYPES].sort(), ["image/jpeg", "image/png", "image/webp"]);
  for (const t of GOOGLE_DRIVE_IMAGE_TYPES) assert.ok(!(t in GOOGLE_DRIVE_READABLE_TYPES), `${t} is not a KID-1 text type`);
  assert.equal(MAX_DRIVE_IMAGE_BYTES, MEDIA_ASSET_LIMITS.maxByteSize, "the Drive bound equals the Media admission ceiling");

  /* ── 2 · A STORED JPEG IS READ, metadata first, one download, no shared drives ── */
  {
    const calls: Call[] = [];
    const r = await readDriveFileImage("tok", FILE_ID, {
      fetchImpl: driveFake({ id: FILE_ID, name: "kilim.jpg", mimeType: "image/jpeg", size: "8" }, JPEG, calls) as never,
    });
    assert.ok(r.ok, JSON.stringify(r));
    if (r.ok) {
      assert.equal(r.image.fileId, FILE_ID);
      assert.equal(r.image.providerMimeType, "image/jpeg");
      assert.deepEqual([...r.image.bytes], [...JPEG]);
      assert.equal(r.image.byteLength, JPEG.length);
      assert.ok(!("url" in r.image) && !("token" in r.image), "no URL or credential in the result");
    }
    assert.equal(calls.length, 2);
    assert.equal(new URL(calls[0]!.url).searchParams.get("alt"), null, "metadata first");
    assert.equal(new URL(calls[1]!.url).searchParams.get("alt"), "media");
    for (const c of calls) assert.equal(new URL(c.url).searchParams.get("supportsAllDrives"), "false");
    for (const c of calls) assert.equal(new URL(c.url).searchParams.get("q"), null);
  }

  /* ── 3 · REFUSED BEFORE ANY BODY MOVES ── */
  for (const [label, meta, reason] of [
    ["a Google Doc", { id: FILE_ID, name: "d", mimeType: "application/vnd.google-apps.document" }, "google-file-type-unsupported"],
    ["a PDF", { id: FILE_ID, name: "d.pdf", mimeType: "application/pdf", size: "10" }, "google-file-type-unsupported"],
    ["a HEIC", { id: FILE_ID, name: "p.heic", mimeType: "image/heic", size: "10" }, "google-file-type-unsupported"],
    ["a trashed image", { id: FILE_ID, name: "p.jpg", mimeType: "image/jpeg", size: "10", trashed: true }, "google-file-trashed"],
    ["an over-large image", { id: FILE_ID, name: "p.jpg", mimeType: "image/jpeg", size: String(MAX_DRIVE_IMAGE_BYTES + 1) }, "google-file-too-large"],
  ] as const) {
    const calls: Call[] = [];
    const r = await readDriveFileImage("tok", FILE_ID, { fetchImpl: driveFake(meta, JPEG, calls) as never });
    assert.ok(!r.ok && r.reason === reason, `${label}: ${JSON.stringify(r)}`);
    assert.equal(calls.length, 1, `${label}: no body was fetched`);
  }

  /* ── 4 · THE MEASUREMENT, NOT THE CLAIM ── */
  {
    const big = new Uint8Array(MAX_DRIVE_IMAGE_BYTES + 1);
    const r = await readDriveFileImage("tok", FILE_ID, {
      fetchImpl: driveFake({ id: FILE_ID, name: "p.jpg", mimeType: "image/jpeg", size: "8" }, big) as never,
    });
    assert.ok(!r.ok && r.reason === "google-file-too-large", "a lying size is caught on the bytes");
    const empty = await readDriveFileImage("tok", FILE_ID, {
      fetchImpl: driveFake({ id: FILE_ID, name: "p.jpg", mimeType: "image/jpeg" }, new Uint8Array()) as never,
    });
    assert.ok(!empty.ok && empty.reason === "google-content-empty");
    for (const bad of ["", "  ", "../x", "a/b", "x?alt=media", "y&fields=*"]) {
      const m = await readDriveFileImage("tok", bad, { fetchImpl: driveFake({}, JPEG) as never });
      assert.ok(!m.ok, `malformed id ${JSON.stringify(bad)} refused`);
    }
  }

  /* ── 5 · THE SEAM GATES ON THE CAPABILITY BEFORE SPENDING A CREDENTIAL ── */
  {
    let spent = false;
    const spy = {
      getDb: dbFor([connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_METADATA_SCOPE] })]),
      fetchImpl: (async () => {
        spent = true;
        return new Response("{}", { status: 200 });
      }) as never,
    };
    assert.deepEqual(await readDriveImage(TENANT, { fileId: FILE_ID }, spy), { status: "refused", reason: "capability-not-available" });
    assert.equal(spent, false, "a metadata-only grant spends nothing");
    assert.deepEqual(await readDriveImage(null, { fileId: FILE_ID }, spy), { status: "refused", reason: "no-authorized-tenant-context" });
    assert.deepEqual(await readDriveImage(TENANT, { fileId: " " }, spy), { status: "refused", reason: "no-document-selected" });
    assert.deepEqual(
      await readDriveImage(TENANT, { fileId: FILE_ID, capability: "google.drive.metadata.read" }, spy),
      { status: "refused", reason: "unknown-capability" },
      "only a content capability, never a scope and never metadata",
    );
    void GOOGLE_DRIVE_CONTENT_SCOPE;
  }

  /* ── 6 · A HUMAN'S DRIVE REFERENCE → THE ID, AND NOTHING ELSE ── */
  assert.equal(driveFileIdFrom("1AbCdEf_GhIjKlMnOp"), "1AbCdEf_GhIjKlMnOp");
  assert.equal(driveFileIdFrom("https://drive.google.com/file/d/1AbCdEf_GhIjKlMnOp/view?usp=sharing"), "1AbCdEf_GhIjKlMnOp");
  assert.equal(driveFileIdFrom("https://drive.google.com/open?id=1AbCdEf_GhIjKlMnOp"), "1AbCdEf_GhIjKlMnOp");
  for (const bad of [
    "http://drive.google.com/file/d/1AbCdEf_GhIjKlMnOp/view",
    "https://evil.example/file/d/1AbCdEf_GhIjKlMnOp/view",
    "https://drive.google.com.evil.example/file/d/1AbCdEf_GhIjKlMnOp",
    "short",
    "../../etc/passwd",
    "",
  ]) {
    assert.equal(driveFileIdFrom(bad), null, `not a Drive reference: ${bad}`);
  }

  /* ── 7 · FIREWALL: the read writes nothing; the admission grants nothing ── */
  const code = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
  for (const f of ["src/features/provider-google/read-drive-image.server.ts"]) {
    const c = code(f);
    for (const banned of [".insert(", ".update(", ".delete(", "transaction(", "@/db/schema", "media-assets", "knowledge"]) {
      assert.ok(!c.includes(banned), `${f} must not contain ${banned}`);
    }
  }
  const admission = code("src/features/media-assets/admit-supplied-drive-image.server.ts");
  for (const banned of [
    "action-authorization",
    "action-execution",
    "governance-decision",
    "media-asset-review",
    "instagram",
    "decision_records",
    "action_permits",
    "tenant-arm",
    "external-send",
  ]) {
    assert.ok(!admission.includes(banned), `supplied admission must not reach ${banned}`);
  }
  /* `createHash(...).update(` is hashing, not a write — so the ban is on the database handle. */
  assert.ok(!/\b(db|tx)\s*\.\s*(update|delete)\(/.test(admission), "admission only inserts; it never mutates an asset");
  assert.ok(/\bdb\s*\.\s*insert\(/.test(admission), "the ban above is looking at the right handle");

  console.log("PASS media-supplied drive image read (no network)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
