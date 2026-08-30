/*
 * KID-1 — the Drive CONTENT capability, and the seam that spends a credential to answer it.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   READING A DOCUMENT IS NOT ADMITTING IT.
 *
 * INT-3 proved a credential existing is not a connection. INT-4 proved a connection is not a data
 * capability. This is the next distinction: content arriving in a server process is not
 * organizational Knowledge, and the capability that fetches it is not the capability that
 * discovers it.
 *
 *     METADATA READ != CONTENT READ     PROVIDER READ != KNOWLEDGE
 *     CONTENT != INSTRUCTION            AUTHORIZED READ != PERSISTENCE
 *
 * No network. Every transport call is a fake, and no assertion here claims real Google acceptance.
 */
import assert from "node:assert/strict";

import {
  GOOGLE_DRIVE_METADATA_CAPABILITY,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_DRIVE_CONTENT_CAPABILITY,
  GOOGLE_DRIVE_CONTENT_SCOPE,
  GOOGLE_DRIVE_READABLE_TYPES,
  GOOGLE_DRIVE_EXPORT_MIME,
  MAX_DRIVE_CONTENT_BYTES,
  extraScopesForCapability,
  GOOGLE_UPGRADEABLE_CAPABILITIES,
} from "../../src/features/provider-google/contracts";
import { readDriveFileContent } from "../../src/features/provider-google/google-transport.server";
import { readDriveContent } from "../../src/features/provider-google/read-drive-content.server";
import {
  PROVIDER_CATALOG,
  findProviderDefinition,
  listConnectableCapabilities,
} from "../../src/features/provider-catalog/catalog";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";

const TENANT = { tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as never;
const FILE_ID = "1AbCdEf_GhIjKlMnOp";

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

const withScopes = (scopes: readonly string[], overrides: Partial<IntegrationView> = {}) =>
  connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, ...scopes], ...overrides });

async function capabilityFor(connections: readonly IntegrationView[], capability: string) {
  const view = await getCapabilityAvailability(TENANT, { getDb: dbFor(connections) });
  return view.capabilities.find((c) => c.capability === capability)!;
}

/** A fake Drive: metadata response first, then the content response. */
function driveFake(
  meta: Record<string, unknown>,
  content: { body: string | ArrayBuffer; status?: number; json?: unknown },
  seen: string[] = [],
) {
  return async (url: string): Promise<Response> => {
    seen.push(url);
    if (!url.includes("alt=media") && !url.includes("/export")) {
      return new Response(JSON.stringify(meta), { status: 200 });
    }
    if (content.status && content.status !== 200) {
      return new Response(JSON.stringify(content.json ?? {}), { status: content.status });
    }
    return new Response(content.body as BodyInit, { status: 200 });
  };
}

const DOC_META = {
  id: FILE_ID,
  name: "Company Handbook",
  mimeType: "application/vnd.google-apps.document",
  trashed: false,
};

async function main(): Promise<void> {
  /* ── 1 · THE CAPABILITY MAPS TO EXACTLY ONE SCOPE, AND IT IS NOT THE METADATA ONE ── */
  {
    assert.deepEqual(
      [...extraScopesForCapability(GOOGLE_DRIVE_CONTENT_CAPABILITY)!],
      [GOOGLE_DRIVE_CONTENT_SCOPE],
      "the content capability requests exactly one scope",
    );
    assert.deepEqual(
      [...extraScopesForCapability(GOOGLE_DRIVE_METADATA_CAPABILITY)!],
      [GOOGLE_DRIVE_METADATA_SCOPE],
      "and it did not widen the metadata capability",
    );
    assert.notEqual(GOOGLE_DRIVE_CONTENT_SCOPE, GOOGLE_DRIVE_METADATA_SCOPE);
    assert.ok(GOOGLE_UPGRADEABLE_CAPABILITIES.includes(GOOGLE_DRIVE_CONTENT_CAPABILITY));
    assert.ok(listConnectableCapabilities().includes(GOOGLE_DRIVE_CONTENT_CAPABILITY));

    /* The route accepts a CAPABILITY. An unknown one, or a raw scope, resolves to nothing. */
    assert.equal(extraScopesForCapability(GOOGLE_DRIVE_CONTENT_SCOPE), null);
    assert.equal(extraScopesForCapability("google.drive.write"), null);
  }

  /* ── 2 · METADATA AND CONTENT ARE INDEPENDENT GRANTS ─────────────────────── */
  {
    const metaOnly = [withScopes([GOOGLE_DRIVE_METADATA_SCOPE])];
    assert.equal((await capabilityFor(metaOnly, GOOGLE_DRIVE_METADATA_CAPABILITY)).state, "available");
    assert.notEqual(
      (await capabilityFor(metaOnly, GOOGLE_DRIVE_CONTENT_CAPABILITY)).state,
      "available",
      "a metadata grant must NOT confer content access",
    );

    const contentOnly = [withScopes([GOOGLE_DRIVE_CONTENT_SCOPE])];
    assert.equal((await capabilityFor(contentOnly, GOOGLE_DRIVE_CONTENT_CAPABILITY)).state, "available");

    const identityOnly = [withScopes([])];
    assert.notEqual((await capabilityFor(identityOnly, GOOGLE_DRIVE_CONTENT_CAPABILITY)).state, "available");
  }

  /* ── 3 · WRITE STAYS EMPTY, SO NO GRANT MAKES THIS CONNECTION WRITE-CAPABLE ─ */
  {
    const google = findProviderDefinition("google-workspace")!;
    for (const [capability, scopes] of Object.entries(google.capabilityScopes)) {
      assert.equal(scopes.write.length, 0, `${capability} declares no write scope`);
    }
    assert.ok(PROVIDER_CATALOG.length >= 1);
  }

  /* ── 4 · A GOOGLE DOC IS EXPORTED, NEVER DOWNLOADED ──────────────────────── */
  {
    const seen: string[] = [];
    const result = await readDriveFileContent(
      "token",
      FILE_ID,
      { fetchImpl: driveFake(DOC_META, { body: "Handbook body." }, seen) as never },
    );
    assert.ok(result.ok, "a supported Google Doc reads");
    assert.equal(result.content.text, "Handbook body.");
    assert.equal(result.content.contentKind, "google-doc-text");
    assert.equal(result.content.providerMimeType, "application/vnd.google-apps.document");
    assert.equal(result.content.returnedMimeType, GOOGLE_DRIVE_EXPORT_MIME);
    assert.equal(result.content.byteLength, 14);
    assert.equal(result.content.name, "Company Handbook");

    const contentUrl = seen.find((u) => u.includes("/export") || u.includes("alt=media"))!;
    assert.match(contentUrl, /\/export\?/, "a Workspace document goes through files.export");
    assert.ok(!contentUrl.includes("alt=media"), "and never through alt=media");
    assert.match(contentUrl, /mimeType=text%2Fplain/, "the export type is the frozen constant");
  }

  /* ── 5 · A STORED TEXT FILE IS DOWNLOADED, NEVER EXPORTED ────────────────── */
  {
    for (const [mime, kind] of [["text/plain", "plain-text"], ["text/markdown", "markdown"]] as const) {
      const seen: string[] = [];
      const result = await readDriveFileContent(
        "token",
        FILE_ID,
        {
          fetchImpl: driveFake(
            { id: FILE_ID, name: `notes${mime === "text/plain" ? ".txt" : ".md"}`, mimeType: mime, trashed: false, size: "9" },
            { body: "some text" },
            seen,
          ) as never,
        },
      );
      assert.ok(result.ok, `${mime} reads`);
      assert.equal(result.content.contentKind, kind);
      assert.equal(result.content.returnedMimeType, mime);
      const contentUrl = seen.find((u) => u.includes("alt=media") || u.includes("/export"))!;
      assert.match(contentUrl, /alt=media/, "a stored file goes through alt=media");
      assert.ok(!contentUrl.includes("/export"), "and never through files.export");
    }
  }

  /* ── 6 · THE READABLE-TYPE MAP IS CLOSED, AND EVERYTHING ELSE FAILS CLOSED ── */
  {
    for (const mime of [
      "application/vnd.google-apps.spreadsheet",
      "application/vnd.google-apps.presentation",
      "application/pdf",
      "image/png",
      "application/octet-stream",
      "text/html",
      "",
    ]) {
      const result = await readDriveFileContent(
        "token",
        FILE_ID,
        { fetchImpl: driveFake({ id: FILE_ID, name: "x", mimeType: mime, trashed: false }, { body: "x" }) as never },
      );
      assert.ok(!result.ok, `${mime || "(empty)"} must be refused`);
    }
    assert.deepEqual(
      Object.keys(GOOGLE_DRIVE_READABLE_TYPES).sort(),
      ["application/vnd.google-apps.document", "text/markdown", "text/plain", "text/x-markdown"],
      "the readable set is exactly the KID-0 bounded set — PDF, DOCX, Sheets and Slides are absent",
    );
  }

  /* ── 7 · SIZE IS BOUNDED TWICE: THE CLAIM AND THE MEASUREMENT ────────────── */
  {
    /* (a) Drive's declared size gates the request before any body moves. */
    const seen: string[] = [];
    const declared = await readDriveFileContent(
      "token",
      FILE_ID,
      {
        fetchImpl: driveFake(
          { id: FILE_ID, name: "big.txt", mimeType: "text/plain", trashed: false, size: String(MAX_DRIVE_CONTENT_BYTES + 1) },
          { body: "never fetched" },
          seen,
        ) as never,
      },
    );
    assert.ok(!declared.ok, "an over-large declared size is refused");
    assert.ok(
      !seen.some((u) => u.includes("alt=media") || u.includes("/export")),
      "and the body was never requested",
    );

    /* (b) A Workspace document declares NO size, so only the measurement can catch it. */
    const measured = await readDriveFileContent(
      "token",
      FILE_ID,
      { fetchImpl: driveFake(DOC_META, { body: "x".repeat(MAX_DRIVE_CONTENT_BYTES + 1) }) as never },
    );
    assert.ok(!measured.ok, "an over-large received body is refused even with no declared size");
  }

  /* ── 8 · PROVIDER FAILURE AND MALFORMED INPUT FAIL CLOSED ────────────────── */
  {
    const notUtf8 = await readDriveFileContent(
      "token",
      FILE_ID,
      { fetchImpl: driveFake({ id: FILE_ID, name: "b.txt", mimeType: "text/plain", trashed: false }, { body: new Uint8Array([0xff, 0xfe, 0xfd]).buffer }) as never },
    );
    assert.ok(!notUtf8.ok, "non-UTF-8 bytes are refused rather than replaced");

    const trashed = await readDriveFileContent(
      "token",
      FILE_ID,
      { fetchImpl: driveFake({ ...DOC_META, trashed: true }, { body: "x" }) as never },
    );
    assert.ok(!trashed.ok, "a trashed document is refused");

    const failed = await readDriveFileContent(
      "token",
      FILE_ID,
      { fetchImpl: driveFake(DOC_META, { body: "", status: 403, json: { error: { errors: [{ reason: "forbidden" }] } } }) as never },
    );
    assert.ok(!failed.ok, "a provider error is a failure, never empty content");

    const unreachable = await readDriveFileContent("token", FILE_ID, {
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as never,
    });
    assert.ok(!unreachable.ok);
    assert.equal(unreachable.failure, "transport");

    /* The file id is the only caller input, and it cannot steer the request path. */
    for (const bad of ["", "   ", "../../etc/passwd", "a/b", "x?alt=media", "y&fields=*"]) {
      const r = await readDriveFileContent("token", bad, { fetchImpl: driveFake(DOC_META, { body: "x" }) as never });
      assert.ok(!r.ok, `a malformed file id (${JSON.stringify(bad)}) is refused`);
    }
  }

  /* ── 9 · THE SEAM GATES ON THE CAPABILITY BEFORE SPENDING A CREDENTIAL ───── */
  {
    let tokenSpent = false;
    const spy = {
      getDb: dbFor([withScopes([GOOGLE_DRIVE_METADATA_SCOPE])]),
      fetchImpl: (async () => {
        tokenSpent = true;
        return new Response("{}", { status: 200 });
      }) as never,
    };
    const refused = await readDriveContent(TENANT, { fileId: FILE_ID }, spy);
    assert.equal(refused.status, "refused");
    assert.equal(refused.reason, "capability-not-available");
    assert.equal(tokenSpent, false, "a metadata-only grant spends nothing");

    const noTenant = await readDriveContent(null, { fileId: FILE_ID }, spy);
    assert.equal(noTenant.status, "refused");
    assert.equal(noTenant.reason, "no-authorized-tenant-context");

    const noDoc = await readDriveContent(TENANT, { fileId: "  " }, spy);
    assert.equal(noDoc.status, "refused");
    assert.equal(noDoc.reason, "no-document-selected");
  }

  /* ── 10 · NO TENANT ID AND NO INTEGRATION ID IS REPRESENTABLE ────────────── */
  {
    const source = readDriveContent.toString();
    assert.ok(!/tenantId\s*:\s*string/.test(source), "the seam takes no tenant id");
    assert.ok(!/integrationId\s*:/.test(source.split("withGoogleAccessToken")[0] ?? ""), "and no integration id");
    /* `deps` carries a default, so `length` stops at it: two REQUIRED parameters, and neither
       is an identity. */
    assert.equal(readDriveContent.length, 2, "(tenant, input) are the only required parameters");
  }

  console.log("kid1-drive-content-read/capability-and-seam: OK");
}

void main();
