/*
 * AP-3 — BITE-PROOFS.
 *
 * Each guarantee is mutated in the SHIPPED SOURCE and the defending suite must fail for the
 * INTENDED reason. Every edit's find-string must be present, the mutation must reach disk, and
 * restoration is verified byte-identically in `finally`.
 *
 * The postgres suite needs a PG >= 17 instance (migration 74 uses `pg_c_utf8`); point
 * HEBUN_TEST_ADMIN_DATABASE_URL at it, exactly as for the suite itself.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const POSTGRES = "tests/ap3-dispatch-safety-cap/cap-postgres.ts";
const UNIT = "tests/ap3-dispatch-safety-cap/config-and-prepay.ts";
const FIREWALL = "tests/ap3-dispatch-safety-cap/firewall.ts";
const CAP = "src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts";
const TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
const GENERATOR = "src/features/heby-model/heby-model-generation.server.ts";
const IMAGE = "src/features/media-assets/request-media-generation.server.ts";
const AUDIT = "src/features/governance-audit/ai-dispatch-cap-audit.server.ts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const abs = (f: string) => path.join(ROOT, f);
const readFile = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly edits: readonly { readonly find: string; readonly replace: string }[];
  readonly suite: string;
  readonly expect: string;
}

const CHECK_THEN_PREPAY =
  `      if (admitted >= cap) return { status: "cap-reached" as const, admitted };\n` +
  `      if (input.prepay && !input.prepay()) throw new ProcessBudgetRefusal();\n`;

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 no advisory lock (count-then-insert races)",
    file: CAP,
    edits: [{ find: "sql`select pg_advisory_xact_lock(hashtext('hebun.ai-dispatch-safety-cap'), hashtext(${`${input.tenantId}:${input.dispatchClass}`}))`", replace: "sql`select 1`" }],
    suite: POSTGRES,
    expect: "C1: exactly the cap is admitted under concurrency",
  },
  {
    label: "B2 off by one (the cap admits one more)",
    file: CAP,
    edits: [{ find: "if (admitted >= cap) return", replace: "if (admitted > cap) return" }],
    suite: POSTGRES,
    expect: "M2: at the cap",
  },
  {
    label: "B3 the model count is not tenant-scoped",
    file: AUDIT,
    edits: [{ find: "        eq(auditLog.tenantId, tenantId),\n", replace: "" }],
    suite: POSTGRES,
    expect: "M3: another tenant is admitted while A is capped",
  },
  {
    label: "B4 the process budget is consumed before the cap",
    file: CAP,
    edits: [
      {
        find: CHECK_THEN_PREPAY,
        replace:
          `      if (input.prepay && !input.prepay()) throw new ProcessBudgetRefusal();\n` +
          `      if (admitted >= cap) return { status: "cap-reached" as const, admitted };\n`,
      },
    ],
    suite: POSTGRES,
    expect: "the process budget is not consumed",
  },
  {
    label: "B5 budget-exhausted media rows are counted",
    file: CAP,
    edits: [{ find: `ne(mediaGenerationInvocations.providerFailure, "budget-exhausted")`, replace: `ne(mediaGenerationInvocations.providerFailure, "never-a-failure-code")` }],
    suite: POSTGRES,
    expect: "D1: live registration",
  },
  {
    label: "B6 the refusal row is written as authorized evidence",
    file: AUDIT,
    edits: [{ find: "      action: AI_DISPATCH_CAP_REFUSED,", replace: "      action: EXTERNAL_AI_DISCLOSURE_AUTHORIZED," }],
    suite: POSTGRES,
    expect: "M2: a cap refusal writes no authorized evidence",
  },
  {
    label: "B7 the generator marks a send paid without paying",
    file: GENERATOR,
    edits: [{ find: "      prepay: () => prepayLiveDispatch(deps.transport),", replace: "      prepay: () => true," }],
    suite: POSTGRES,
    expect: "M4: no authorized evidence",
  },
  {
    label: "B8 a prepaid send takes a second unit",
    file: TRANSPORT,
    edits: [{ find: "      if (prepaid) {\n        prepaid = false;\n      } else if (!budget.attempt()) {", replace: "      if (!budget.attempt()) {" }],
    suite: UNIT,
    expect: "the prepaid send does not take a second unit",
  },
  {
    label: "B9 the prepay flag is set without consuming a unit",
    file: TRANSPORT,
    edits: [{ find: "if (prepaid || calls >= maxCalls || !budget.attempt()) return false;", replace: "if (prepaid || calls >= maxCalls) return false;" }],
    suite: UNIT,
    expect: "a prepay takes exactly one unit",
  },
  {
    label: "B10 the prepay key is a registry symbol",
    file: TRANSPORT,
    edits: [{ find: `Symbol("hebun.live-dispatch-prepay")`, replace: `Symbol.for("hebun.live-dispatch-prepay")` }],
    suite: UNIT,
    expect: "a Symbol.for key does not reach the private seam",
  },
  {
    label: "B11 invalid configuration fails open to the default",
    file: CAP,
    edits: [{ find: "  if (!/^\\d+$/.test(text)) return 0;", replace: "  if (!/^\\d+$/.test(text)) return DEFAULT_AI_DISPATCH_CAPS[dispatchClass];" }],
    suite: UNIT,
    expect: "fails closed to 0",
  },
  {
    label: "B12 a live image registration bypasses the cap",
    file: IMAGE,
    edits: [{ find: `  if (transport.transport === "live") {`, replace: `  if (false) {` }],
    suite: POSTGRES,
    expect: "D1: the sixth is refused",
  },
  {
    label: "B13 the cap writes a media row",
    file: CAP,
    edits: [{ find: "  await recordAiDispatchCapRefusal(db, {", replace: "  void db.insert(mediaGenerationInvocations);\n  await recordAiDispatchCapRefusal(db, {" }],
    suite: FIREWALL,
    expect: "the cap itself writes nothing",
  },
];

function runSuite(suite: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    timedOut: result.error?.message.includes("ETIMEDOUT") ?? false,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

function main(): void {
  for (const suite of [POSTGRES, UNIT, FIREWALL]) {
    const clean = runSuite(suite);
    assert.ok(clean.ok, `${suite} must pass unmutated before any bite counts.\n${clean.output.slice(-2500)}`);
  }
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    const original = readFile(mutation.file);
    const before = sha(original);
    let mutated = original;
    for (const edit of mutation.edits) {
      assert.ok(mutated.includes(edit.find), `${mutation.label}: find-string absent in ${mutation.file}`);
      mutated = mutated.replace(edit.find, edit.replace);
    }
    assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
    try {
      writeFileSync(abs(mutation.file), mutated, "utf8");
      assert.equal(sha(readFile(mutation.file)), sha(mutated), `${mutation.label}: did not reach disk`);
      const run = runSuite(mutation.suite);
      assert.equal(run.timedOut, false, `${mutation.label}: the defending suite TIMED OUT — void, not a bite`);
      assert.equal(run.ok, false, `${mutation.label}: SURVIVED — ${mutation.suite} still passed`);
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: failed, but not for the intended reason ("${mutation.expect}").\n${run.output.slice(-2500)}`,
      );
    } finally {
      writeFileSync(abs(mutation.file), original, "utf8");
    }
    assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} not restored byte-identically`);
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }
  assert.equal(bitten, MUTATIONS.length);
  console.log(`ap3-dispatch-safety-cap/bite-proofs: ${bitten} mutations bit`);
}

main();
