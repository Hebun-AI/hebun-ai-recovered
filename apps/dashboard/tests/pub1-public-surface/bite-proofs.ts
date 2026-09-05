/*
 * PUB-1 — bite proofs.
 *
 * A guard that has never been watched to fail is a guard nobody has evidence for. Each proof below
 * makes ONE targeted change to real source, runs the suite that is supposed to object, requires it
 * to fail FOR THE INTENDED REASON, and restores the file byte-identically.
 *
 * Two families, because PUB-1 has two things worth defending:
 *   the AUTH BOUNDARY  — the product must not become public through the public site
 *   CLAIM TRUTH        — a published sentence must not outlive the contract it rests on
 *
 * A proof that fails to APPLY, or whose child run times out, is VOID and is reported as such —
 * never counted as a pass.
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

const MIDDLEWARE = "src/middleware.ts";
const CATALOG = "src/features/provider-catalog/catalog.ts";
const KNOWLEDGE_MAP = "src/features/knowledge/capability-map.ts";

const BOUNDARY_SUITE = "tests/pub1-public-surface/route-boundary.ts";
const CLAIM_SUITE = "tests/pub1-public-surface/claim-truth.ts";

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  assert.ok(!result.error, `the child run failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

let bitten = 0;

function bites(label: string, file: string, suite: string, because: string, from: string, to: string): void {
  const original = read(file);
  const before = sha(original);
  const occurrences = original.split(from).length - 1;
  assert.equal(occurrences, 1, `${label}: the anchor must appear exactly once, found ${occurrences}`);

  try {
    writeFileSync(abs(file), original.replace(from, to), "utf8");

    /* 1 — the mutation applied. Without this a proof that missed looks like a guard that held. */
    assert.notEqual(sha(read(file)), before, `${label}: the mutation did not apply — the proof is vacuous`);

    /* 2 + 3 — the suite failed, and for the intended reason. */
    const { ok, output } = runSuite(suite);
    assert.equal(ok, false, `${label}: the suite still passed — the guard does not bite`);
    assert.ok(
      output.includes(because),
      `${label}: failed for the wrong reason — expected ${JSON.stringify(because)}, got:\n${output.slice(-1400)}`,
    );
    bitten += 1;
  } finally {
    /* 4 — restored, byte-identical. */
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: restoration was not byte-identical`);
  }
}

function main(): void {
  /* ── AUTH BOUNDARY ─────────────────────────────────────────────────────── */

  bites(
    "the dashboard is made public through the prefix list",
    MIDDLEWARE,
    BOUNDARY_SUITE,
    "/command must not be public",
    'const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms", "/contact"];',
    'const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms", "/contact", "/command"];',
  );

  bites(
    "the dashboard is made public through the exact list",
    MIDDLEWARE,
    BOUNDARY_SUITE,
    "/integrations must not be public",
    'const PUBLIC_EXACT_PATHS = ["/"];',
    'const PUBLIC_EXACT_PATHS = ["/", "/integrations"];',
  );

  bites(
    'the homepage is moved into the PREFIX list, where "/" is one rewrite from exempting everything',
    MIDDLEWARE,
    BOUNDARY_SUITE,
    '"/" is too short to be a safe prefix',
    'const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms", "/contact"];',
    'const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms", "/contact", "/"];',
  );

  bites(
    "a public document is advertised as indexable while the edge gate stops refusing it",
    MIDDLEWARE,
    BOUNDARY_SUITE,
    "/contact must be public at the edge gate",
    'const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms", "/contact"];',
    'const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms"];',
  );

  /* ── CLAIM TRUTH ───────────────────────────────────────────────────────── */

  /*
   * ── TWO PROOFS SINCE KID-1, AND THE ANCHORS ARE NOW CAPABILITY-SPECIFIC ────
   *
   * Google maps two capabilities and each declares its own empty write set, so the old anchor —
   * the bare `write: Object.freeze([]),` line — matched twice and the mutation could no longer be
   * applied unambiguously. Anchoring on the `read:` line above each one restores uniqueness AND
   * makes the proof stronger: the published "No Drive write" claim is now defended against a write
   * scope appearing on EITHER capability, not on whichever one happened to be first.
   */
  bites(
    'Drive write capability is added to the METADATA capability while the site still publishes "No Drive write"',
    CATALOG,
    CLAIM_SUITE,
    "must declare no write scope",
    "        read: Object.freeze([GOOGLE_DRIVE_METADATA_SCOPE]),\n        write: Object.freeze([]),",
    '        read: Object.freeze([GOOGLE_DRIVE_METADATA_SCOPE]),\n        write: Object.freeze(["https://www.googleapis.com/auth/drive.file"]),',
  );

  bites(
    'Drive write capability is added to the CONTENT capability while the site still publishes "No Drive write"',
    CATALOG,
    CLAIM_SUITE,
    "must declare no write scope",
    "        read: Object.freeze([GOOGLE_DRIVE_CONTENT_SCOPE]),\n        write: Object.freeze([]),",
    '        read: Object.freeze([GOOGLE_DRIVE_CONTENT_SCOPE]),\n        write: Object.freeze(["https://www.googleapis.com/auth/drive.file"]),',
  );

  bites(
    "Knowledge search is connected while the site still publishes that no search surface exists",
    KNOWLEDGE_MAP,
    CLAIM_SUITE,
    'the published limit denies "search"',
    '    capability: "search" as const,\n    label: "Knowledge search",\n    state: "not-connected" as const,',
    '    capability: "search" as const,\n    label: "Knowledge search",\n    state: "connected" as const,',
  );

  bites(
    "a second governance subject type is registered while the Decision stage still says there is one",
    "src/features/governance-decision/contracts.ts",
    CLAIM_SUITE,
    "governed decisions cover one subject",
    'export const GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType[] = [\n  "knowledge_node",\n  "work_artifact_revision",\n];',
    'export const GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType[] = ["knowledge_node", "knowledge_node"];',
  );

  /* Eight since KID-1 split the Drive write proof into one per Google capability. */
  assert.equal(bitten, 8, "every bite proof must have bitten");
  console.log(`PUB-1 bite proofs: ${bitten} guards proved to bite`);
}

main();
