/*
 * TRH-21 — BITE PROOFS.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, and requires four things: the
 * anchor was UNIQUE, the mutation APPLIED, the suite FAILED FOR THE INTENDED REASON, and the file
 * came back byte-identical by sha256.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite.
 *
 * ── THE ONES THAT MATTER MOST ────────────────────────────────────────────────
 *
 * M1 takes the tenant from the record instead of the authorized context. It reads like removing a
 * redundant parameter — the caller already knows the tenant — and it is the whole cross-tenant
 * firewall, because after it a caller decides which organization an observation belongs to.
 *
 * M2 adds the facts digest to the conflict target. It reads like "dedupe more precisely" and
 * silently converts the idempotency rule from ABOUT THE INSTANT to ABOUT THE VALUES: an unchanged
 * count would stop being recorded, and "nobody looked" would become indistinguishable from
 * "somebody looked and nothing had moved".
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

const WRITER = "src/features/provider-observation-history/write-provider-observation.server.ts";
const COMPOSITION = "src/features/provider-observation-history/record-youtube-channel-observation.server.ts";
const READER = "src/features/provider-observation-history/read-provider-observations.server.ts";
const MIGRATION = "src/db/migrations/20260907124912_trh21_provider_observation_history.sql";

const PG_SUITE = "tests/trh21-provider-observation-history/history-postgres.ts";
const TRUTH_SUITE = "tests/trh21-provider-observation-history/history-truth-and-firewall.ts";

const CHILD_TIMEOUT_MS = 600_000;

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

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  /** A PRODUCT REASON CODE or an EXPLICIT assertion message — never a bare English word. */
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE TENANT COMES FROM THE AUTHORIZED CONTEXT, NEVER FROM THE RECORD ── */
  {
    label: "M1 the tenant is taken from the caller's record instead of the authorized context",
    file: WRITER,
    /*
     * PROVED AGAINST A REAL DATABASE, not against source text. A cast can smuggle a field past the
     * type, so the only honest proof is what the ROW says afterwards.
     *
     * WHAT ACTUALLY OBJECTS IS DEFENCE IN DEPTH, and the exact failure is worth naming: the probe
     * supplies a foreign tenant beside THIS tenant's connection, so once the writer honours the
     * supplied tenant the composite foreign key refuses the pair outright and the write stops being
     * ordinary. Two independent guards would have to be removed together for this to pass.
     */
    suite: PG_SUITE,
    find: "        tenantId: tenant.tenantId,",
    replace:
      "        tenantId: (record as unknown as { tenantId?: string }).tenantId ?? tenant.tenantId,",
    because: "the write itself is ordinary",
  },
  /* ── IDEMPOTENCY IS ABOUT THE INSTANT, NEVER ABOUT THE VALUES ───────────── */
  {
    label: "M2 the facts digest joins the conflict target",
    file: WRITER,
    suite: TRUTH_SUITE,
    find: "          providerObservations.observedAt,\n        ],",
    replace: "          providerObservations.observedAt,\n          providerObservations.factsDigest,\n        ],",
    because: "the idempotency key is tenant + provider + subject + instant, and nothing else",
  },
  /* ── APPEND-ONLY MEANS A REPLAY CANNOT REWRITE A ROW ────────────────────── */
  {
    label: "M3 the insert upgrades itself into an upsert",
    file: WRITER,
    suite: TRUTH_SUITE,
    find: "      .onConflictDoNothing({",
    replace: "      .onConflictDoUpdate({\n        set: { factsDigest: facts },",
    because: 'the writer must not contain "onConflictDoUpdate"',
  },
  /* ── THE SUBJECT IS THE PROVIDER'S, NOT THE HUMAN'S ─────────────────────── */
  {
    label: "M4 the subject is built from the handle a human typed",
    file: COMPOSITION,
    suite: TRUTH_SUITE,
    find: "      subjectRef: youtubeChannelSubjectRef(outcome.value.channel.channelId),",
    replace: "      subjectRef: youtubeChannelSubjectRef(rawHandle),",
    because: "the subject is the PROVIDER's channel id",
  },
  /* ── THE READ SEAM DERIVES NOTHING ──────────────────────────────────────── */
  {
    label: "M5 the read seam starts computing a delta",
    file: READER,
    suite: TRUTH_SUITE,
    find: "/** One page. A history read is a bounded page, never \"everything ever observed\". */",
    replace: "/** A helpful delta between the two newest observations. */\nexport const DELTA_ENABLED = true;\n",
    because: 'the read seam must not compute "delta"',
  },
  /* ── A CROSS-TENANT FILING IS REFUSED BY THE DATABASE, NOT BY A COMMENT ─── */
  {
    label: "M6 the composite tenant/connection foreign key never reaches the database",
    /*
     * THE MIGRATION IS THE MUTATION TARGET, NOT THE SCHEMA FILE. The disposable harness builds its
     * database from the SQL on disk, so editing the TypeScript declaration would prove nothing
     * about what the database actually enforces — the constraint would still be there. This is the
     * distinction between what a schema says and what a database does.
     */
    file: MIGRATION,
    suite: PG_SUITE,
    find: 'ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_tenant_integration_fk"',
    replace: 'SELECT 1; -- ADD CONSTRAINT "provider_observations_tenant_integration_fk"',
    because: "the composite foreign key refuses another tenant's connection",
  },
];

interface Verdict {
  readonly label: string;
  readonly bit: boolean;
  readonly void: boolean;
  readonly detail: string;
}

function proveOne(mutation: Mutation): Verdict {
  const before = read(mutation.file);
  const digest = sha(before);

  const occurrences = before.split(mutation.find).length - 1;
  if (occurrences !== 1) {
    return {
      label: mutation.label,
      bit: false,
      void: true,
      detail: `anchor is not unique in ${mutation.file} (found ${occurrences})`,
    };
  }

  const mutated = before.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, before, `${mutation.label}: the mutation must change the file`);

  let run: Run;
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    run = runSuite(mutation.suite);
  } finally {
    writeFileSync(abs(mutation.file), before, "utf8");
  }

  const restored = sha(read(mutation.file));
  assert.equal(restored, digest, `${mutation.label}: ${mutation.file} must be restored byte-identically`);

  if (run.void) {
    return { label: mutation.label, bit: false, void: true, detail: "child run was killed — VOID" };
  }
  if (run.ok) {
    return { label: mutation.label, bit: false, void: false, detail: "the suite PASSED against mutated source" };
  }
  if (!run.output.includes(mutation.because)) {
    return {
      label: mutation.label,
      bit: false,
      void: false,
      detail: `the suite failed, but not for the intended reason (${mutation.because})`,
    };
  }
  return { label: mutation.label, bit: true, void: false, detail: `bit on: ${mutation.because}` };
}

function main(): void {
  const verdicts = MUTATIONS.map(proveOne);
  for (const verdict of verdicts) {
    console.log(`${verdict.bit ? "BIT " : verdict.void ? "VOID" : "MISS"}  ${verdict.label} — ${verdict.detail}`);
  }
  const missed = verdicts.filter((v) => !v.bit);
  assert.equal(
    missed.length,
    0,
    `every guard must bite; ${missed.length} did not: ${missed.map((v) => v.label).join(", ")}`,
  );
  console.log(`PASS trh21-provider-observation-history bite proofs (${verdicts.length}/${verdicts.length} bit)`);
}

main();
