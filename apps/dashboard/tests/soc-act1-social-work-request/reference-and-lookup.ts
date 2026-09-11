/*
 * SOC-ACT1 — the observation reference, and the exact lookup it depends on.
 *
 * The reference is PURE STRING WORK and must never feel like an existence check; the lookup is the
 * only thing that can answer ownership, and it must narrow rather than widen.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PROVIDER_OBSERVATION_REF_PREFIX,
  formatProviderObservationRef,
  isProviderObservationRef,
  parseProviderObservationRef,
} from "../../src/features/provider-observation-history/observation-ref";

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SEAM = "src/features/provider-observation-history/read-provider-observations.server.ts";
const REF_MODULE = "src/features/provider-observation-history/observation-ref.ts";

const UUID = "6c7f2a10-4b3d-4e5f-8a9b-0c1d2e3f4a5b";

/* ── 1 · the reference round-trips, and only in its canonical shape ─────────── */

function itRoundTripsOnlyCanonicalReferences(): void {
  const ref = formatProviderObservationRef(UUID);
  assert.equal(ref, `${PROVIDER_OBSERVATION_REF_PREFIX}/${UUID}`);
  assert.deepEqual(parseProviderObservationRef(ref), { observationId: UUID });
  assert.ok(isProviderObservationRef(ref));

  /* UPPERCASE IN, LOWERCASE OUT — several spellings of one id would hash as several approvals. */
  assert.equal(formatProviderObservationRef(UUID.toUpperCase()), ref);
}

function itRefusesEverythingThatIsNotOne(): void {
  for (const bad of [
    null,
    undefined,
    42,
    "",
    UUID,
    `${PROVIDER_OBSERVATION_REF_PREFIX}/not-a-uuid`,
    `${PROVIDER_OBSERVATION_REF_PREFIX}/${UUID} `,
    ` ${PROVIDER_OBSERVATION_REF_PREFIX}/${UUID}`,
    `Provider-Observation/${UUID}`,
    `organization/${UUID}`,
    `${PROVIDER_OBSERVATION_REF_PREFIX}/${UUID}/extra`,
  ]) {
    assert.equal(parseProviderObservationRef(bad), null, `parsed a non-reference: ${String(bad)}`);
    assert.equal(isProviderObservationRef(bad), false);
  }

  /* A malformed id must fail LOUDLY on the way in — it would otherwise be hashed into an approval. */
  assert.throws(() => formatProviderObservationRef("not-a-uuid"), TypeError);
}

/* ── 2 · formatting asserts nothing about existence ────────────────────────── */

function itIsPureStringWork(): void {
  const CODE = codeOf(read(REF_MODULE));
  for (const forbidden of ["drizzle-orm", "@/db/", "getDb", "fetch(", "Date.now", "process.env"]) {
    assert.ok(
      !CODE.includes(forbidden),
      `the reference module must not reach ${forbidden} — a syntactic check is not an existence check`,
    );
  }
}

/* ── 3 · the lookup NARROWS; it cannot widen ───────────────────────────────── */

function theLookupIsAndedWithTheTenantPredicate(): void {
  const CODE = codeOf(read(SEAM));

  assert.ok(
    /readonly observationId\?: string;/.test(CODE),
    "the query contract must expose an exact observation predicate",
  );

  /*
   * THE TENANT PREDICATE IS THE FIRST ELEMENT AND IS UNCONDITIONAL. Every optional predicate —
   * including this phase's — is PUSHED onto that same list, so each can only ever narrow the answer.
   * If the observation predicate were ever built into its own `where`, a cross-tenant read would
   * become representable, and that is the line this assertion guards.
   */
  assert.ok(
    /const predicates = \[eq\(providerObservations\.tenantId, tenant\.tenantId\)\]/.test(CODE),
    "the tenant predicate must remain the unconditional base of the predicate list",
  );
  assert.ok(
    /if \(query\.observationId\) predicates\.push\(eq\(providerObservations\.id, query\.observationId\)\)/.test(
      CODE,
    ),
    "the observation predicate must be pushed onto the tenant-anchored predicate list",
  );

  /* No caller-supplied tenant may be expressible at this seam. */
  assert.ok(
    !/readonly tenantId\?/.test(CODE),
    "the query contract must never accept a caller-supplied tenant",
  );
}

function existingConsumersKeepTheirContract(): void {
  const CODE = codeOf(read(SEAM));
  for (const kept of [
    "readonly providerKey?: string;",
    "readonly capabilityKey?: string;",
    "readonly subjectRef?: string;",
    "readonly limit?: number;",
  ]) {
    assert.ok(CODE.includes(kept), `SOC-ACT1 must not remove the released predicate: ${kept}`);
  }
}

function main(): void {
  itRoundTripsOnlyCanonicalReferences();
  itRefusesEverythingThatIsNotOne();
  itIsPureStringWork();
  theLookupIsAndedWithTheTenantPredicate();
  existingConsumersKeepTheirContract();
  console.log("SOC-ACT1 reference and lookup checks passed");
}

main();
