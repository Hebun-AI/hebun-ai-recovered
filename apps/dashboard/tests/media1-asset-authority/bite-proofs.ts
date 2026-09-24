/*
 * MEDIA-1 — BITE PROOFS.
 *
 * Each proof makes ONE targeted change to real source, runs the suite that is supposed to object, and
 * requires that the anchor was unique, the mutation applied, the suite failed FOR THE INTENDED
 * REASON, and the file came back byte-identical by sha256. A killed child is VOID, never a bite.
 *
 * ── THE ONES THAT MATTER MOST ────────────────────────────────────────────────
 *
 * P1 removes the storage preflight. Nothing else changes, and a connected test store still admits
 * images normally — only the released, unconnected resolver reveals that generation would now be
 * attempted for an image that could never be kept.
 *
 * P6 disables the dimension bound in code and shows the DATABASE still refuses: the request ends
 * `persistence-failed`, not admitted. The layers are independent, and the test notices either one.
 *
 * Source-mutating, so this file runs its children SEQUENTIALLY and never in parallel with them.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string): string => path.join(ROOT, f);
const read = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const REQUEST = "src/features/media-assets/request-media-generation.server.ts";
const VERIFY = "src/features/media-assets/admission-verification.ts";
const READ = "src/features/media-assets/read-media-assets.server.ts";
const RETIRE = "src/features/media-assets/retire-media-asset.server.ts";
const DOWNLOAD = "src/features/media-assets/provider-output-download.server.ts";
const STORAGE = "src/features/media-assets/media-storage.server.ts";
const REVIEW = "src/features/media-asset-review/review-media-asset.server.ts";
const G2 = "src/features/governance-decision/decision-authority.server.ts";

const PG_SUITE = "tests/media1-asset-authority/authority-postgres.ts";
const CONTRACT_SUITE = "tests/media1-asset-authority/admission-contract.ts";
const FIREWALL_SUITE = "tests/media1-asset-authority/authority-firewall.ts";

const CHILD_TIMEOUT_MS = 300_000;

interface Run {
  readonly ok: boolean;
  readonly void: boolean;
  readonly output: string;
}

function runSuite(suite: string): Run {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const killed = result.signal !== null || result.status === null;
  return { ok: result.status === 0, void: killed, output };
}

interface Edit {
  readonly find: string;
  readonly replace: string;
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly edits: readonly Edit[];
  /** A PRODUCT REASON CODE or an EXPLICIT assertion message — never a bare English word. */
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "P1 generation no longer checks that storage is connected",
    file: REQUEST,
    suite: PG_SUITE,
    edits: [{ find: '  if (storage.status !== "available") return refused("storage-unavailable");\n', replace: "" }],
    because: "released resolvers: storage not connected",
  },
  {
    label: "P2 the durable-agent refusal is removed from preflight",
    file: REQUEST,
    suite: PG_SUITE,
    edits: [{ find: '  if (authorship.status !== "resolved") return refused("no-durable-agent");\n', replace: "" }],
    because: "no durable agent",
  },
  {
    label: "P3 a request key that registered nothing still dispatches",
    file: REQUEST,
    suite: PG_SUITE,
    edits: [{ find: '  if (!invocationId) return refused("duplicate-request");\n', replace: "" }],
    because: "same request key again",
  },
  {
    label: "P4 the source revision is no longer tenant-predicated",
    file: REQUEST,
    suite: PG_SUITE,
    edits: [{ find: "          eq(workArtifactRevisions.tenantId, tenant.tenantId),\n", replace: "" }],
    because: "another tenant's draft revision",
  },
  {
    label: "P5 a declared type that disagrees with the bytes is accepted",
    file: VERIFY,
    suite: PG_SUITE,
    edits: [
      {
        find: "  if (declared !== null && declared !== signature.mimeType) {",
        replace: "  if (declared === \"never\" && declared !== signature.mimeType) {",
      },
    ],
    because: "declared PNG, bytes JPEG",
  },
  {
    label: "P6 the dimension bound is disabled in code (the database still refuses)",
    file: VERIFY,
    suite: PG_SUITE,
    edits: [
      {
        find: "    signature.width > MEDIA_ASSET_LIMITS.maxDimension ||\n    signature.height > MEDIA_ASSET_LIMITS.maxDimension",
        replace: "    signature.width < 0 ||\n    signature.height < 0",
      },
    ],
    because: "dimensions over 8192",
  },
  {
    label: "P7 a read no longer requires storage before looking up the row",
    file: READ,
    suite: PG_SUITE,
    edits: [
      {
        find: '  if (storage.status !== "available") return { status: "unavailable", reason: "storage-unavailable" };\n',
        replace: "",
      },
    ],
    because: "no storage: unavailable, never not-found or empty",
  },
  {
    label: "P8 a read is no longer tenant-predicated",
    file: READ,
    suite: PG_SUITE,
    edits: [
      {
        find: "    .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, assetId)))",
        replace: "    .where(eq(mediaAssets.id, assetId))",
      },
    ],
    because: "another tenant's asset is not found",
  },
  {
    label: "P9 a read is granted without comparing stored bytes to the row",
    file: READ,
    suite: PG_SUITE,
    edits: [
      {
        find: "  if (stored.byteSize !== record.byteSize || stored.sha256Hex !== record.byteDigest) {",
        replace: "  if (stored.byteSize < 0) {",
      },
    ],
    because: "a read is never granted on bytes that are not the admitted ones",
  },
  {
    label: "P10 review no longer requires the digest the reviewer was shown",
    file: REVIEW,
    suite: PG_SUITE,
    edits: [
      {
        find: '      if (asset.byteDigest !== input!.byteDigest) throw new ReviewAbort("asset-digest-mismatch");\n',
        replace: "",
      },
    ],
    because: "asset-digest-mismatch",
  },
  {
    label: "P11 review resolves the asset without the tenant",
    file: REVIEW,
    suite: PG_SUITE,
    edits: [
      {
        find: "            eq(mediaAssets.tenantId, tenant.tenantId),\n            eq(mediaAssets.id, input!.assetId),",
        replace: "            eq(mediaAssets.id, input!.assetId),",
      },
    ],
    because: "asset-unresolvable",
  },
  {
    label: "P12 the G2 writer records an asset acceptance under the artifact-review outcome",
    file: G2,
    suite: PG_SUITE,
    edits: [
      {
        find: "        ? MEDIA_ASSET_REVIEW_ACCEPTED_OUTCOME\n",
        replace: "        ? ARTIFACT_REVIEW_ACCEPTED_OUTCOME\n",
      },
    ],
    because: "media-asset-accepted",
  },
  {
    label: "P13 retirement is no longer tenant-predicated",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [{ find: "          eq(mediaAssets.tenantId, tenant.tenantId),\n", replace: "" }],
    because: "asset-not-found",
  },
  {
    label: "P14 retirement also rewrites a byte-identity column",
    file: RETIRE,
    suite: FIREWALL_SUITE,
    edits: [
      {
        find: '.set({ assetLifecycleStatus: "retired", retiredAt: now, retiredByActorId: tenant.userId })',
        replace: '.set({ assetLifecycleStatus: "retired", retiredAt: now, retiredByActorId: tenant.userId, byteSize: 1 })',
      },
    ],
    because: "retirement sets only the retirement columns",
  },
  {
    label: "P15 the download host allowlist is not enforced",
    file: DOWNLOAD,
    suite: CONTRACT_SUITE,
    edits: [
      {
        find: "  if (!allowedHosts.has(url.hostname.toLowerCase())) {",
        replace: "  if (allowedHosts.size < 0) {",
      },
    ],
    because: "download-host-not-allowed",
  },
  {
    label: "P16 the storage resolver claims a connection that does not exist",
    file: STORAGE,
    suite: CONTRACT_SUITE,
    edits: [
      {
        find: '    return { status: "unavailable", reason: "storage-not-connected" };',
        replace:
          '  return { status: "available", store: { backend: "s3", put: async () => {}, verify: async () => ({ status: "absent" }), createReadAccess: async () => ({ url: "", expiresAt: "" }) } } as never;',
      },
    ],
    because: "storage-not-connected",
  },
];

const voided: string[] = [];
let bitten = 0;

function withMutation(label: string, file: string, edits: readonly Edit[], body: () => void): void {
  const original = read(file);
  const before = sha(original);

  let mutated = original;
  for (const edit of edits) {
    const occurrences = mutated.split(edit.find).length - 1;
    assert.equal(
      occurrences,
      1,
      `${label}: the mutation anchor must appear exactly once in ${file}, found ${occurrences}`,
    );
    mutated = mutated.replace(edit.find, edit.replace);
  }

  try {
    writeFileSync(abs(file), mutated, "utf8");
    assert.notEqual(sha(read(file)), before, `${label}: the mutation did not reach ${file}`);
    assert.equal(read(file), mutated, `${label}: ${file} on disk is not the text this proof composed`);
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: ${file} was not restored byte-identically`);
  }
}

function main(): void {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.label, mutation.file, mutation.edits, () => {
      const run = runSuite(mutation.suite);
      if (run.void) {
        voided.push(mutation.label);
        return;
      }
      assert.equal(run.ok, false, `${mutation.label}: the suite still PASSED — the guard it targets does not bite`);
      assert.ok(
        run.output.includes(mutation.because),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.because}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    if (!voided.includes(mutation.label)) {
      bitten += 1;
      console.log(`BITE ${mutation.label}`);
    }
  }

  assert.deepEqual(voided, [], `these proofs were VOID (child killed), not passes: ${voided.join(", ")}`);
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`media1-asset-authority/bite-proofs: ${bitten} mutations bit, 0 void`);
}

main();
