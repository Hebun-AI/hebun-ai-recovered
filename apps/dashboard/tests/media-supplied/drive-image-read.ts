/*
 * MEDIA-SUPPLIED — the Drive IMAGE read: transport, seam gate, Drive-reference parsing, and the
 * firewall that keeps it a read. No network: every fetch is a fake.
 *
 *     PROVIDER READ != MEDIA ADMISSION
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  GOOGLE_DRIVE_CONTENT_SCOPE,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_IMAGE_TYPES,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_DRIVE_READABLE_TYPES,
  MAX_DRIVE_IMAGE_BYTES,
} from "../../src/features/provider-google/contracts";
import { readDriveFileImage } from "../../src/features/provider-google/google-transport.server";
import { readDriveImage } from "../../src/features/provider-google/read-drive-image.server";
import { sealPickerBinding } from "../../src/features/provider-google/picker-connection-binding.server";
import { authorizeMediaPickerSession } from "../../src/features/provider-content-admission/authorize-picker-session.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { MEDIA_ASSET_LIMITS } from "../../src/features/media-assets/contracts";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const ROOT = path.resolve(__dirname, "../..");
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
  const rows = async () =>
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
                }));
  /* `listConnections` orders then limits; `readConnection` limits directly. One fixture row either way. */
  return () =>
    ({
      select: () => ({
        from: () => ({
          where: () => ({ orderBy: () => ({ limit: rows }), limit: rows }),
        }),
      }),
    }) as never;
}

/* A configured Google OAuth environment — only its state secret is used, to sign a Picker binding. */
const ENV = {
  GOOGLE_OAUTH_CLIENT_ID: "client-id.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  GOOGLE_OAUTH_REDIRECT_URI: "https://hebuntech.com/api/integrations/google/callback",
  HEBUN_GOOGLE_OAUTH_STATE_SECRET: "s".repeat(44),
};
const BOUND_TENANT = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sessionContextId: "session" } as never;
const BINDING = () =>
  sealPickerBinding(BOUND_TENANT, { integrationId: connectedFixture().integrationId, externalAccountId: connectedFixture().externalAccountId! }, { env: ENV })!;

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

  /*
   * ── 5 · THE SEAM OPENS ONLY THROUGH A BOUND CONNECTION HOLDING THE PER-FILE GRANT, BEFORE SPENDING A
   *        CREDENTIAL (GOOGLE-DRIVE-PICKER-CONNECTION-INTEGRITY-1) ──
   */
  {
    for (const [label, scopes] of [
      ["identity-only connection", [] as string[]],
      ["metadata-only grant", [GOOGLE_DRIVE_METADATA_SCOPE]],
      ["Drive-wide drive.readonly grant", [GOOGLE_DRIVE_CONTENT_SCOPE]],
    ] as const) {
      let spent = false;
      const spy = {
        env: ENV,
        getDb: dbFor([connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, ...scopes] })]),
        fetchImpl: (async () => {
          spent = true;
          return new Response("{}", { status: 200 });
        }) as never,
      };
      assert.deepEqual(
        await readDriveImage(BOUND_TENANT, { fileId: FILE_ID, binding: BINDING() }, spy),
        { status: "refused", reason: "bound-connection-unavailable" },
        `${label}: the bound connection lacks the per-file grant — no Drive image read`,
      );
      assert.equal(spent, false, `${label}: no credential spent`);
    }
    const none = { getDb: dbFor([]), env: ENV };
    assert.deepEqual(await readDriveImage(BOUND_TENANT, { fileId: FILE_ID, binding: BINDING() }, none), { status: "refused", reason: "bound-connection-unavailable" });
    assert.deepEqual(await readDriveImage(null, { fileId: FILE_ID, binding: BINDING() }, none), { status: "refused", reason: "no-authorized-tenant-context" });
    assert.deepEqual(await readDriveImage(BOUND_TENANT, { fileId: " ", binding: BINDING() }, none), { status: "refused", reason: "no-document-selected" });
    /* No binding, no read: there is no "first available connection" to fall back to. */
    const perFile = { env: ENV, getDb: dbFor([connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_FILE_SCOPE] })]) };
    assert.deepEqual(await readDriveImage(BOUND_TENANT, { fileId: FILE_ID } as never, perFile), { status: "refused", reason: "binding-missing" });
    /* A caller cannot name a wider grant: the parameter does not exist, and an extra field is ignored. */
    assert.deepEqual(
      await readDriveImage(BOUND_TENANT, { fileId: FILE_ID, binding: BINDING(), capability: "google.drive.content.read" } as never, {
        env: ENV,
        getDb: dbFor([connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, GOOGLE_DRIVE_CONTENT_SCOPE] })]),
      }),
      { status: "refused", reason: "bound-connection-unavailable" },
      "an injected capability field cannot select the Drive-wide grant",
    );
  }

  /* ── 6 · THE MEDIA PICKER ENTRY: per-file grant only, no Knowledge authority asked or given ── */
  {
    const human = asHumanTenantContext({
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      authIdentityId: "identity",
      membershipId: "membership",
      membershipVersion: 1,
      roleId: "role",
      sessionContextId: "session",
      provider: "local",
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: "media-picker",
      authenticatedAt: "2026-09-25T09:00:00.000Z",
    });
    const configured = () => ({ status: "configured" as const, apiKey: "picker-key", appId: "1234567890" });
    let knowledgeAsked = false;
    const knowledgeDenied = async () => {
      knowledgeAsked = true;
      return { authorized: false, roleType: "member" } as never;
    };
    const run = (scopes: readonly string[] | null, over: Record<string, unknown> = {}) =>
      authorizeMediaPickerSession(human, {
        picker: configured,
        resolveAuthority: knowledgeDenied,
        env: {},
        getDb: dbFor(scopes === null ? [] : [connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, ...scopes] })]),
        ...over,
      } as never);

    const unauth = await authorizeMediaPickerSession(null, { picker: configured, getDb: dbFor([]) });
    assert.equal(unauth.status === "refused" && unauth.reason, "not-authenticated");
    for (const [label, scopes] of [
      ["no Google connection", null],
      ["identity-only connection", []],
      ["Drive-wide drive.readonly grant", [GOOGLE_DRIVE_CONTENT_SCOPE]],
      ["metadata-only grant", [GOOGLE_DRIVE_METADATA_SCOPE]],
    ] as const) {
      const r = await run(scopes);
      assert.equal(r.status === "refused" && r.reason, "capability-not-available", `${label}: no chooser, no token`);
    }
    const unconfigured = await run([GOOGLE_DRIVE_FILE_SCOPE], { picker: () => ({ status: "unconfigured", missingKeys: ["GOOGLE_PICKER_API_KEY"] }) });
    assert.equal(unconfigured.status === "refused" && unconfigured.reason, "picker-not-configured");
    /*
     * drive.file AVAILABLE: the capability gate is passed and the ceremony reaches the binding. With no
     * OAuth environment there is no secret to sign the binding with, so it refuses as unconfigured
     * BEFORE any credential is spent — a capability refusal would say `capability-not-available`.
     */
    const passed = await run([GOOGLE_DRIVE_FILE_SCOPE]);
    assert.equal(passed.status === "refused" && passed.reason, "picker-not-configured", JSON.stringify(passed));
    assert.match(passed.status === "refused" ? passed.detail : "", /could not be bound/, "the capability gate opened; the binding could not be signed");
    assert.equal(knowledgeAsked, false, "the Media entry neither asks for nor depends on Knowledge authority");
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

  /* ── 8 · LEAST PRIVILEGE, STRUCTURALLY: no Drive-wide path reaches supplied Media ── */
  for (const f of [
    "src/features/media-assets/admit-supplied-drive-image.server.ts",
    "src/features/provider-google/read-drive-image.server.ts",
    "src/components/operations-preparation/supply-image-from-drive.tsx",
  ]) {
    const c = code(f);
    for (const banned of ["GOOGLE_DRIVE_CONTENT_CAPABILITY", "GOOGLE_DRIVE_CONTENT_SCOPE", "GOOGLE_DRIVE_METADATA", "auth/drive.readonly", "auth/drive.metadata"]) {
      assert.ok(!c.includes(banned), `${f} must not reach ${banned}`);
    }
  }
  assert.ok(code("src/features/provider-google/read-drive-image.server.ts").includes("GOOGLE_DRIVE_FILE_CAPABILITY"), "the image seam names the per-file capability");
  const door = code("src/components/operations-preparation/supply-image-from-drive.tsx");
  assert.ok(door.includes("openGooglePicker"), "the Media door is Google's chooser");
  assert.ok(!/drive\.google\.com|driveFileIdFrom|drive-file-ref/.test(door), "no pasted Drive link is a Media path any more");
  assert.ok(/accessToken:\s*session\.accessToken/.test(door), "the token goes from the server answer straight into the chooser");
  assert.ok(!/useState[^\n]*accessToken|setAccessToken|localStorage|sessionStorage/.test(door), "the door keeps no token");
  assert.ok(!existsSync(path.join(ROOT, "src/features/media-assets/drive-file-ref.ts")), "the link parser is gone");

  console.log("PASS media-supplied drive image read (no network)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
