/*
 * GOOGLE LEAST-PRIVILEGE ADAPTATION — the per-file capability, and the one token boundary.
 *
 * ── THE SENTENCES THIS SUITE DEFENDS ────────────────────────────────────────
 *
 *   USER-SELECTED FILE != ALL DRIVE FILES
 *   THE PRODUCTION ADMISSION PATH NEEDS NO RESTRICTED DRIVE SCOPE.
 *   SELECTION != ADMISSION.
 *   A BROWSER GETS ONE SHORT-LIVED ACCESS TOKEN, AND ONLY WHEN THE NARROW GRANT IS THE ONE HELD.
 *
 * The strongest proof here is behavioural rather than textual: a connection granted ONLY the
 * identity scopes plus `drive.file` is driven through both admission entry points. The per-file one
 * proceeds; the Drive-wide one is refused on the SAME connection. That is what "independent of the
 * restricted scopes" means, and no comment can substitute for it.
 *
 * No database, no network, no credential, no key. Every Google answer is fabricated.
 */
import assert from "node:assert/strict";

import {
  GOOGLE_CAPABILITY_SCOPE_REQUESTS,
  GOOGLE_DRIVE_CONTENT_CAPABILITIES,
  GOOGLE_DRIVE_CONTENT_CAPABILITY,
  GOOGLE_DRIVE_CONTENT_SCOPE,
  GOOGLE_DRIVE_FILE_CAPABILITY,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_METADATA_CAPABILITY,
  GOOGLE_DRIVE_METADATA_SCOPE,
  GOOGLE_DRIVE_READABLE_TYPES,
  extraScopesForCapability,
} from "../../src/features/provider-google/contracts";
import { readDriveContent } from "../../src/features/provider-google/read-drive-content.server";
import { authorizePickerSession } from "../../src/features/provider-content-admission/authorize-picker-session.server";
import {
  admitPickedProviderDocument,
  admitProviderDocument,
  providerDocumentReference,
} from "../../src/features/provider-content-admission/admit-provider-document.server";
import { findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import { resolveGooglePickerEnvironment } from "../../src/features/provider-google/picker-environment.server";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";
import { connectedFixture, GOOGLE_IDENTITY_SCOPES } from "../helpers/integration-connection-fixtures";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

/**
 * Google's two RESTRICTED Drive scopes, as LITERALS. Verified against Google's current scope guide.
 *
 * Deliberately NOT derived from Hebun's constants. Google's classification is a fact about Google,
 * and a list built from the constants under test would move whenever they moved — so repointing a
 * capability at a restricted scope would silently redefine what "restricted" means here instead of
 * failing. Written out, the pin below is what ties Hebun's names to Google's classification.
 */
const RESTRICTED_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

const TENANT_ID = "70000000-0000-4000-8000-0000000000f1";
const USER_ID = "80000000-0000-4000-8000-0000000000f1";

function tenantContext(): TenantContext {
  return asHumanTenantContext({
    tenantId: TENANT_ID,
    userId: USER_ID,
    authIdentityId: "identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "session",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "glp",
    authenticatedAt: "2026-08-30T09:00:00.000Z",
  });
}

/** A fake control plane that answers the availability seam's one query. Counts its own use. */
function dbFor(connections: readonly IntegrationView[], calls?: { n: number }) {
  return () => {
    if (calls) calls.n += 1;
    return {
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
    } as never;
  };
}

const withScopes = (scopes: readonly string[]) =>
  connectedFixture({ scopes: [...GOOGLE_IDENTITY_SCOPES, ...scopes] });

const authorized = async () => ({ authorized: true, roleType: "owner" });
const denied = async () => ({ authorized: false, roleType: "member" });
const pickerConfigured = () =>
  ({ status: "configured" as const, apiKey: "picker-key", appId: "1234567890" });

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE CAPABILITY MAPS TO THE NON-SENSITIVE SCOPE, AND TO NOTHING WIDER.
 * ═════════════════════════════════════════════════════════════════════════ */
function theMappingIsNarrow(): void {
  assert.deepEqual(
    [...extraScopesForCapability(GOOGLE_DRIVE_FILE_CAPABILITY)!],
    [GOOGLE_DRIVE_FILE_SCOPE],
    "the per-file capability requests exactly one scope, and it is the non-sensitive one",
  );
  assert.equal(
    GOOGLE_DRIVE_FILE_SCOPE,
    "https://www.googleapis.com/auth/drive.file",
    "spelled as Google spells it",
  );

  /* THE THREE ARE DISTINCT KEYS. A rename that collapsed two would be caught here. */
  assert.equal(
    new Set([
      GOOGLE_DRIVE_METADATA_CAPABILITY,
      GOOGLE_DRIVE_CONTENT_CAPABILITY,
      GOOGLE_DRIVE_FILE_CAPABILITY,
    ]).size,
    3,
    "the per-file capability is its own key, never a remapping of a released one",
  );

  /* HEBUN'S NAMES ARE TIED TO GOOGLE'S CLASSIFICATION, so the list above cannot drift silently. */
  assert.deepEqual(
    [GOOGLE_DRIVE_CONTENT_SCOPE, GOOGLE_DRIVE_METADATA_SCOPE].sort(),
    [...RESTRICTED_DRIVE_SCOPES].sort(),
    "the two historical capabilities map to exactly Google's two restricted Drive scopes",
  );
  assert.ok(
    !RESTRICTED_DRIVE_SCOPES.includes(GOOGLE_DRIVE_FILE_SCOPE),
    "and the per-file scope is not one of them — that is the whole adaptation, in one line",
  );

  /* THE HISTORICAL MAPPINGS ARE UNTOUCHED — production records name them. */
  assert.deepEqual(
    [...extraScopesForCapability(GOOGLE_DRIVE_CONTENT_CAPABILITY)!],
    [GOOGLE_DRIVE_CONTENT_SCOPE],
    "KID-1's capability still means what it meant when it was released",
  );
  assert.deepEqual(
    [...extraScopesForCapability(GOOGLE_DRIVE_METADATA_CAPABILITY)!],
    [GOOGLE_DRIVE_METADATA_SCOPE],
    "and INT-4's does too",
  );

  /* NO ARBITRARY SCOPE INPUT. The route resolves a capability; nothing resolves a scope. */
  for (const hostile of [
    GOOGLE_DRIVE_FILE_SCOPE,
    "https://www.googleapis.com/auth/drive",
    "__proto__",
    "constructor",
    "toString",
    "",
  ]) {
    assert.equal(
      extraScopesForCapability(hostile),
      null,
      `a caller-supplied "${hostile}" resolves to no scopes at all`,
    );
  }

  /* AND THE CATALOG AGREES, because the availability seam reads the catalog and not the map above. */
  const google = findProviderDefinition("google-workspace")!;
  assert.deepEqual(
    [...google.capabilityScopes[GOOGLE_DRIVE_FILE_CAPABILITY]!.read],
    [GOOGLE_DRIVE_FILE_SCOPE],
    "the catalog maps the per-file capability to the per-file scope",
  );
  assert.deepEqual(
    [...google.capabilityScopes[GOOGLE_DRIVE_FILE_CAPABILITY]!.write],
    [],
    "and to no write scope — `drive.file` could permit writing app-created files; Hebun declares none",
  );
  for (const restricted of RESTRICTED_DRIVE_SCOPES) {
    assert.ok(
      !google.capabilityScopes[GOOGLE_DRIVE_FILE_CAPABILITY]!.read.includes(restricted),
      `the per-file capability must never require ${restricted}`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE PRODUCTION PATH RUNS ON A CONNECTION THAT HOLDS NO RESTRICTED SCOPE.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theNewFlowNeedsNoRestrictedScope(): Promise<void> {
  /*
   * ONE CONNECTION, GRANTED ONLY IDENTITY + `drive.file`. This is the grant a customer would give
   * under the least-privilege model, and the whole adaptation is the claim that it is enough.
   */
  const perFileOnly = dbFor([withScopes([GOOGLE_DRIVE_FILE_SCOPE])]);
  const tenant = tenantContext();

  /* The per-file content read is AVAILABLE and proceeds to the provider. */
  const reached: string[] = [];
  const picked = await admitPickedProviderDocument(
    tenant,
    { fileId: "1PiCkEd_DoCuMeNt", sourceTitle: "Policy", domainKey: "finance", scope: "company-wide" },
    {
      resolveAuthority: authorized,
      provider: { getDb: perFileOnly },
      readContent: async (_t, input) => {
        reached.push(input.capability ?? "<default>");
        return {
          status: "read",
          content: {
            fileId: "1PiCkEd_DoCuMeNt",
            name: "Policy",
            providerMimeType: "application/vnd.google-apps.document",
            returnedMimeType: "text/plain",
            contentKind: "google-doc-text",
            text: "Bir cümle.",
            byteLength: 11,
          },
        };
      },
      ingest: async () => ({
        status: "ingested",
        source: { sourceDigest: "f".repeat(64), chunkCount: 1, factKeys: ["k"] },
      }),
      resolveFact: async () => ({ status: "not-found" }),
    },
  );
  assert.equal(picked.status, "admitted", "the per-file path admits under a per-file-only grant");
  assert.deepEqual(
    reached,
    [GOOGLE_DRIVE_FILE_CAPABILITY],
    "and the read is performed under the per-file capability, explicitly, never by default",
  );
  /*
   * AND THE REFERENCE THE BRIDGE ACTUALLY PRODUCED NAMES IT.
   *
   * Asserted on the bridge's OUTPUT rather than on `providerDocumentReference` directly — a bite
   * proof found that gap: dropping the capability argument at the call site left the helper's own
   * unit assertions passing while every real admission recorded the wrong permission.
   */
  if (picked.status !== "admitted") throw new Error("unreachable");
  assert.equal(
    picked.provenance.reference.capability,
    GOOGLE_DRIVE_FILE_CAPABILITY,
    "a document chosen in the Picker is RECORDED as having arrived under the per-file permission",
  );

  /*
   * THE SAME CONNECTION, THE DRIVE-WIDE ENTRY POINT — REFUSED. This is the half that makes the
   * assertion above mean something: the connection genuinely does not carry the restricted grant.
   */
  const wide = await readDriveContent(
    tenant,
    { fileId: "1PiCkEd_DoCuMeNt", capability: GOOGLE_DRIVE_CONTENT_CAPABILITY },
    { getDb: perFileOnly },
  );
  assert.equal(wide.status, "refused");
  if (wide.status !== "refused") throw new Error("unreachable");
  assert.equal(
    wide.reason,
    "capability-not-available",
    "a per-file grant is NOT a Drive-wide grant, and the seam says so",
  );

  /* And the per-file read on the same connection is not refused for lack of a grant. */
  const narrow = await readDriveContent(
    tenant,
    { fileId: "1PiCkEd_DoCuMeNt", capability: GOOGLE_DRIVE_FILE_CAPABILITY },
    { getDb: perFileOnly, fetchImpl: async () => new Response("{}", { status: 500 }) },
  );
  assert.notEqual(
    narrow.status === "refused" ? narrow.reason : null,
    "capability-not-available",
    "the per-file capability IS available on this connection — it got past the gate",
  );

  /* A CAPABILITY OUTSIDE THE CLOSED SET IS REFUSED, never defaulted to the wider one. */
  for (const hostile of ["google.drive.metadata.read", "drive.readonly", "__proto__", "toString"]) {
    const refused = await readDriveContent(
      tenant,
      { fileId: "1PiCkEd_DoCuMeNt", capability: hostile },
      { getDb: perFileOnly },
    );
    assert.equal(refused.status, "refused");
    if (refused.status !== "refused") throw new Error("unreachable");
    assert.equal(refused.reason, "unknown-capability", `"${hostile}" is not a content capability`);
  }
  assert.deepEqual(
    [...GOOGLE_DRIVE_CONTENT_CAPABILITIES].sort(),
    [GOOGLE_DRIVE_CONTENT_CAPABILITY, GOOGLE_DRIVE_FILE_CAPABILITY].sort(),
    "and the closed set is exactly the two content capabilities",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE TOKEN BOUNDARY — GATED, NARROW, AND NEVER REACHED BY THE UNAUTHORIZED.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theTokenBoundaryIsGated(): Promise<void> {
  /* ── 3a · NOT SIGNED IN — nothing is consulted at all. ───────────────────── */
  {
    const calls = { n: 0 };
    const refused = await authorizePickerSession(null, {
      resolveAuthority: authorized,
      picker: pickerConfigured,
      getDb: dbFor([withScopes([GOOGLE_DRIVE_FILE_SCOPE])], calls),
    });
    assert.equal(refused.status, "refused");
    if (refused.status !== "refused") throw new Error("unreachable");
    assert.equal(refused.reason, "not-authenticated");
    assert.equal(calls.n, 0, "no connection was read for an unauthenticated caller");
  }

  /* ── 3b · THE KNOWLEDGE BAND COMES FIRST, BEFORE ANY CONNECTION IS READ ─── */
  {
    const calls = { n: 0 };
    const refused = await authorizePickerSession(tenantContext(), {
      resolveAuthority: denied,
      picker: pickerConfigured,
      getDb: dbFor([withScopes([GOOGLE_DRIVE_FILE_SCOPE])], calls),
    });
    assert.equal(
      refused.status,
      "refused",
      "someone who may not author Knowledge never causes a connection read or a credential spend",
    );
    if (refused.status !== "refused") throw new Error("unreachable");
    assert.equal(refused.reason, "knowledge-not-authorized");
    assert.equal(
      calls.n,
      0,
      "someone who may not author Knowledge never causes a connection read or a credential spend",
    );
  }

  /* ── 3c · CONFIGURATION IS CHECKED BEFORE THE CONNECTION, AND COSTS NOTHING ─ */
  {
    const calls = { n: 0 };
    const refused = await authorizePickerSession(tenantContext(), {
      resolveAuthority: authorized,
      picker: () => ({ status: "unconfigured", missingKeys: ["GOOGLE_PICKER_API_KEY"] }),
      getDb: dbFor([withScopes([GOOGLE_DRIVE_FILE_SCOPE])], calls),
    });
    assert.equal(refused.status, "refused");
    if (refused.status !== "refused") throw new Error("unreachable");
    assert.equal(refused.reason, "picker-not-configured");
    assert.equal(calls.n, 0, "an unconfigured deployment reads no connection and spends nothing");
  }

  /* ── 3d · THE DRIVE-WIDE GRANT DOES NOT OPEN THIS DOOR ───────────────────── */
  {
    /*
     * THE ASSERTION THAT MAKES THE TOKEN EXCEPTION ACCEPTABLE. A tenant holding the RESTRICTED
     * Drive-wide grant — and not the per-file one — is refused a browser token. Releasing a token
     * on that grant would put a key to the customer's entire Drive in a web page, which is exactly
     * what the least-privilege adaptation exists to prevent.
     */
    const refused = await authorizePickerSession(tenantContext(), {
      resolveAuthority: authorized,
      picker: pickerConfigured,
      getDb: dbFor([withScopes([GOOGLE_DRIVE_CONTENT_SCOPE, GOOGLE_DRIVE_METADATA_SCOPE])]),
    });
    assert.equal(
      refused.status,
      "refused",
      "a Drive-wide grant must never be handed to a browser as a Picker token",
    );
    if (refused.status !== "refused") throw new Error("unreachable");
    assert.equal(
      refused.reason,
      "capability-not-available",
      "a Drive-wide grant must never be handed to a browser as a Picker token",
    );
  }

  /* ── 3e · NO CONNECTION AT ALL ───────────────────────────────────────────── */
  {
    const refused = await authorizePickerSession(tenantContext(), {
      resolveAuthority: authorized,
      picker: pickerConfigured,
      getDb: dbFor([]),
    });
    assert.equal(refused.status, "refused");
    if (refused.status !== "refused") throw new Error("unreachable");
    assert.equal(refused.reason, "capability-not-available");
  }

  /* ── 3f · THE SEAM TAKES NO PARAMETER A CALLER COULD WIDEN ──────────────── */
  {
    /*
     * Not read from source: exercised. The function's only arguments are a context and injectable
     * dependencies, so there is no capability, scope, tenant id or integration id to supply — a
     * caller cannot ask this for anything other than what it already decided to give.
     */
    assert.equal(
      authorizePickerSession.length,
      1,
      "the ceremony has exactly ONE required argument — the server-resolved context. `Function.length`" +
        " counts parameters before the first default, so this is the count of what a caller MUST" +
        " supply, and there is no capability, scope, tenant id or integration id among them.",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE PICKER'S CONFIGURATION IS CONFIG, NOT CREDENTIALS.
 * ═════════════════════════════════════════════════════════════════════════ */
function thePickerConfigurationFailsClosed(): void {
  assert.equal(
    resolveGooglePickerEnvironment({}).status,
    "unconfigured",
    "an unconfigured deployment says so rather than defaulting",
  );
  const partial = resolveGooglePickerEnvironment({ GOOGLE_PICKER_API_KEY: "k" });
  assert.equal(partial.status, "unconfigured");
  if (partial.status !== "unconfigured") throw new Error("unreachable");
  assert.deepEqual(
    [...partial.missingKeys],
    ["GOOGLE_PICKER_APP_ID"],
    "and names the missing KEY, never a value",
  );

  const configured = resolveGooglePickerEnvironment({
    GOOGLE_PICKER_API_KEY: " k ",
    GOOGLE_PICKER_APP_ID: " 42 ",
  });
  assert.equal(configured.status, "configured");
  if (configured.status !== "configured") throw new Error("unreachable");
  assert.equal(configured.apiKey, "k");
  assert.equal(configured.appId, "42");

  /* Blank is absent, not present-and-empty. */
  assert.equal(
    resolveGooglePickerEnvironment({ GOOGLE_PICKER_API_KEY: "  ", GOOGLE_PICKER_APP_ID: "42" }).status,
    "unconfigured",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. PROVENANCE NAMES THE PERMISSION THAT WAS ACTUALLY USED.
 * ═════════════════════════════════════════════════════════════════════════ */
function provenanceNamesTheRealCapability(): void {
  assert.equal(
    providerDocumentReference("1AbC", GOOGLE_DRIVE_FILE_CAPABILITY).capability,
    GOOGLE_DRIVE_FILE_CAPABILITY,
    "a document admitted under the per-file permission records the per-file capability",
  );
  assert.equal(
    providerDocumentReference("1AbC").capability,
    GOOGLE_DRIVE_CONTENT_CAPABILITY,
    "and the released default is unchanged, so historical references keep their meaning",
  );
  assert.notEqual(
    providerDocumentReference("1AbC", GOOGLE_DRIVE_FILE_CAPABILITY).capability,
    providerDocumentReference("1AbC").capability,
    "the two permission models are distinguishable in the record, forever",
  );

  /* Still four fields and no fifth — the shape KR-EXT1 owns is unchanged. */
  assert.deepEqual(
    Object.keys(providerDocumentReference("1AbC", GOOGLE_DRIVE_FILE_CAPABILITY)).sort(),
    ["capability", "providerKey", "recordId", "recordType"],
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. SUPPORTED TYPES ARE THE RELEASED ONES — THE CHOOSER ADDS NONE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSupportedTypesAreUnchanged(): void {
  assert.deepEqual(
    Object.keys(GOOGLE_DRIVE_READABLE_TYPES).sort(),
    [
      "application/vnd.google-apps.document",
      "text/markdown",
      "text/plain",
      "text/x-markdown",
    ],
    "Google Docs, plain text and Markdown — the adaptation changed the permission, not the formats",
  );
  for (const absent of [
    "application/pdf",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.folder",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]) {
    assert.ok(
      !Object.hasOwn(GOOGLE_DRIVE_READABLE_TYPES, absent),
      `${absent} is still not readable — no format arrived with the new permission`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE HISTORICAL ENTRY POINT IS UNCHANGED.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theHistoricalPathStillMeansWhatItMeant(): Promise<void> {
  const seen: string[] = [];
  await admitProviderDocument(
    tenantContext(),
    { fileId: "1OlD", sourceTitle: "T", domainKey: "d", scope: "company-wide" },
    {
      resolveAuthority: authorized,
      readContent: async (_t, input) => {
        seen.push(input.capability ?? "<default>");
        return { status: "refused", reason: "capability-not-available", detail: "x" };
      },
    },
  );
  assert.deepEqual(
    seen,
    [GOOGLE_DRIVE_CONTENT_CAPABILITY],
    "KID-2's released entry point still reads under KID-1's capability — history is not rewritten",
  );
  assert.deepEqual(
    [...GOOGLE_CAPABILITY_SCOPE_REQUESTS[GOOGLE_DRIVE_CONTENT_CAPABILITY]!],
    [GOOGLE_DRIVE_CONTENT_SCOPE],
  );
}

async function main(): Promise<void> {
  theMappingIsNarrow();
  await theNewFlowNeedsNoRestrictedScope();
  await theTokenBoundaryIsGated();
  thePickerConfigurationFailsClosed();
  provenanceNamesTheRealCapability();
  theSupportedTypesAreUnchanged();
  await theHistoricalPathStillMeansWhatItMeant();
  console.log("glp-picker-per-file/capability-and-token: OK");
}

void main();
