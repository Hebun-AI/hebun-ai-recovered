/*
 * GOOGLE LEAST-PRIVILEGE ADAPTATION — bite proofs.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, requires it to fail FOR THE
 * INTENDED REASON, and restores the file byte-identically.
 *
 * The properties under proof are the ones this adaptation exists to establish:
 *
 *   THE PER-FILE CAPABILITY MAPS TO THE NON-SENSITIVE SCOPE, NOT A RESTRICTED ONE
 *   THE TOKEN LEAVES THE SERVER FROM EXACTLY ONE PLACE, AND ONLY ON THE NARROW GRANT
 *   THE PRODUCTION PATH DOES NOT SILENTLY FALL BACK TO THE DRIVE-WIDE PERMISSION
 *   PROVENANCE RECORDS THE PERMISSION ACTUALLY USED
 *   SELECTION IS NOT ADMISSION
 *
 * A proof that fails to APPLY, or whose child run times out, is VOID and reported as such — never
 * counted as a pass.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const abs = (f: string) => path.join(ROOT, f);
const read = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const CONTRACTS = "src/features/provider-google/contracts.ts";
const CEREMONY = "src/features/provider-content-admission/authorize-picker-session.server.ts";
const BRIDGE = "src/features/provider-content-admission/admit-provider-document.server.ts";
const SEAM = "src/features/provider-google/read-drive-content.server.ts";

const BEHAVIOUR_SUITE = "tests/glp-picker-per-file/capability-and-token.ts";
const FIREWALL_SUITE = "tests/glp-picker-per-file/boundaries-and-firewall.ts";

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180_000,
  });
  assert.ok(!result.error, `the child run failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

let bitten = 0;

function bites(
  label: string,
  file: string,
  suite: string,
  because: string,
  from: string,
  to: string,
): void {
  const original = read(file);
  const before = sha(original);
  const occurrences = original.split(from).length - 1;
  assert.equal(occurrences, 1, `${label}: the anchor must appear exactly once, found ${occurrences}`);

  try {
    writeFileSync(abs(file), original.replace(from, to), "utf8");
    assert.notEqual(
      sha(read(file)),
      before,
      `${label}: the mutation did not apply — the proof is vacuous`,
    );

    const { ok, output } = runSuite(suite);
    assert.equal(ok, false, `${label}: the suite still passed — the guard does not bite`);
    assert.ok(
      output.includes(because),
      `${label}: failed for the wrong reason — expected ${JSON.stringify(because)}, got:\n${output.slice(-1400)}`,
    );
    bitten += 1;
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: restoration was not byte-identical`);
  }
}

function main(): void {
  /* ── 1 · THE WHOLE POINT: THE NARROW CAPABILITY POINTED AT A WIDE SCOPE ─── */
  bites(
    "the per-file capability is repointed at the restricted Drive-wide scope — the single change " +
      "that would undo the entire adaptation while leaving every name in place",
    CONTRACTS,
    BEHAVIOUR_SUITE,
    /* The exact-value pin fires first, and it is the strongest guard against this mutation. */
    "spelled as Google spells it",
    'export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";',
    'export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";',
  );

  /* ── 2 · THE HISTORICAL CAPABILITY QUIETLY REMAPPED ──────────────────────── */
  bites(
    "KID-1's released capability is silently repointed at the narrow scope, which would rewrite " +
      "what every already-written provenance row means",
    CONTRACTS,
    BEHAVIOUR_SUITE,
    /* The Google-classification pin fires first, and it is the right guard for this mutation. */
    "the two historical capabilities map to exactly Google's two restricted Drive scopes",
    'export const GOOGLE_DRIVE_CONTENT_SCOPE = "https://www.googleapis.com/auth/drive.readonly";',
    'export const GOOGLE_DRIVE_CONTENT_SCOPE = "https://www.googleapis.com/auth/drive.file";',
  );

  /* ── 3 · THE CONTENT SEAM DEFAULTS INSTEAD OF REFUSING ───────────────────── */
  bites(
    "an unrecognized capability falls back to the Drive-wide one instead of being refused, so a " +
      "typo would silently perform the read under the wider permission",
    SEAM,
    BEHAVIOUR_SUITE,
    "is not a content capability",
    "  if (!GOOGLE_DRIVE_CONTENT_CAPABILITIES.includes(capability)) {",
    "  if (false && !GOOGLE_DRIVE_CONTENT_CAPABILITIES.includes(capability)) {",
  );

  /* ── 4 · THE PICKER PATH READS UNDER THE WIDE PERMISSION ─────────────────── */
  bites(
    "the Picker admission path is pointed at the Drive-wide capability, so a document chosen under " +
      "a per-file grant would be read — and recorded — as though it came from a Drive-wide one",
    BRIDGE,
    BEHAVIOUR_SUITE,
    "the read is performed under the per-file capability",
    "  return admitUnderCapability(tenant, input, GOOGLE_DRIVE_FILE_CAPABILITY, deps);",
    "  return admitUnderCapability(tenant, input, GOOGLE_DRIVE_CONTENT_CAPABILITY, deps);",
  );

  /* ── 5 · THE TOKEN GATE OPENS ON THE DRIVE-WIDE GRANT ────────────────────── */
  bites(
    "the browser token is released on the RESTRICTED Drive-wide grant — which would put a key to " +
      "the customer's entire Drive into a web page",
    CEREMONY,
    BEHAVIOUR_SUITE,
    "a Drive-wide grant must never be handed to a browser as a Picker token",
    "  const entry = availability.capabilities.find((c) => c.capability === GOOGLE_DRIVE_FILE_CAPABILITY);",
    "  const entry = availability.capabilities.find((c) => c.capability.startsWith(\"google.drive\"));",
  );

  /* ── 6 · THE KNOWLEDGE BAND STOPS GATING THE TOKEN ───────────────────────── */
  bites(
    "the Knowledge authority check is removed from the token ceremony, so anyone signed in could " +
      "obtain a Google access token for their organization",
    CEREMONY,
    BEHAVIOUR_SUITE,
    "someone who may not author Knowledge never causes a connection read or a credential spend",
    "  if (!authority.authorized) {",
    "  if (false && !authority.authorized) {",
  );

  /* ── 7 · A SECOND MODULE STARTS HANDING OUT TOKENS ───────────────────────── */
  bites(
    "a second module gains the ability to hand a Google access token to its caller — the exact " +
      "spread the census of one exists to stop",
    SEAM,
    FIREWALL_SUITE,
    "only the Picker ceremony may hand a Google access token to its caller",
    "      const result = await readDriveFileContent(accessToken, input.fileId, deps);",
    "      if (input.fileId === \"leak\") return { ok: true as const, value: accessToken };\n" +
      "      const result = await readDriveFileContent(accessToken, input.fileId, deps);",
  );

  /* ── 8 · PROVENANCE STOPS NAMING THE PERMISSION ACTUALLY USED ────────────── */
  bites(
    "the reference is pinned to KID-1's capability regardless of how the document was read, so the " +
      "record would claim a permission the read did not use",
    BRIDGE,
    BEHAVIOUR_SUITE,
    "a document chosen in the Picker is RECORDED as having arrived under the per-file permission",
    "  const reference = providerDocumentReference(content.content.fileId, capability);",
    "  const reference = providerDocumentReference(content.content.fileId);",
  );

  console.log(`glp-picker-per-file/bite-proofs: ${bitten} guards observed to bite`);
  assert.equal(bitten, 8, "every proof must have bitten");
}

main();
