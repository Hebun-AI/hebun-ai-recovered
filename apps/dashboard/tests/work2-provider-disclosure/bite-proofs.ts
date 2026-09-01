/*
 * WORK-2 POST-ACCEPTANCE PRIVACY HARDENING — BITE-PROOFS.
 *
 * Every guarantee this hardening introduces is mutated in the SHIPPED SOURCE, and the suite
 * defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * ── WHICH SUITE DEFENDS WHICH MUTATION, AND WHY ──────────────────────────────
 *
 * THE COLUMN CHOICE IS DEFENDED BY THE POSTGRES SUITE ON PURPOSE. A structural assertion can see
 * that `users.email` is absent from an expression; only a real database can show that an email-only
 * human comes back with NOTHING rather than with their address. That is the whole finding, so it is
 * measured where it is real.
 *
 * THE DISCLOSURE PATH IS DEFENDED BY THE PURE SUITE, because what must be proved there is that
 * whatever Identity declines to name arrives at the provider as `name unavailable` — a property of
 * the composed request, not of any row.
 *
 * Every mutation is chosen to COMPILE. A mutation that cannot resolve a name is testing the module
 * loader, and its `ReferenceError` would kill the suite for a reason unrelated to the guard.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const DISCLOSURE_SUITE = "tests/work2-provider-disclosure/provider-bound-name.ts";
const POSTGRES_SUITE = "tests/hlr-human-legibility/legibility-postgres.ts";

const IDENTITY = "src/features/auth-runtime/human-label-read.server.ts";
const GROUNDING = "src/features/organizational-work/heby-work-source.server.ts";
const WORK_PAGE = "src/app/(dashboard)/director/work/page.tsx";

/** Generous, but finite. The Postgres suite mints and migrates a database, so it is the slow one. */
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

function runSuite(suite: string): SuiteRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /*
     * THE DEFECT ITSELF, REINTRODUCED. Restoring the address floor to the disclosable expression is
     * exactly the state WORK-2's production acceptance found, and a real database is the only place
     * it shows: the map comes back holding an address for a human who has no name.
     */
    label: "D1 the disclosable expression floors at the email address again",
    file: IDENTITY,
    suite: POSTGRES_SUITE,
    find:
      "const HUMAN_NAME_EXPRESSION = sql<string | null>`coalesce(${users.displayName}, ${users.name})`;",
    replace:
      "const HUMAN_NAME_EXPRESSION = sql<string | null>`coalesce(${users.displayName}, ${users.name}, ${users.email})`;",
    expect: "a human with no name is ABSENT — the address is not a fallback",
  },
  {
    /*
     * THE NULL IS THE ANSWER. Without the skip, a human with no name enters the map with a null
     * value — present, unnamed, and indistinguishable to a caller from somebody Hebun can name.
     * `ABSENT` and `present but empty` are different facts and the caller renders them differently.
     */
    label: "D2 a nameless row is admitted into the map instead of being left out",
    file: IDENTITY,
    suite: POSTGRES_SUITE,
    find: `      if (typeof row.label !== "string" || row.label.length === 0) continue;`,
    replace: `      void row;`,
    expect: "a human with no name is ABSENT — the address is not a fallback",
  },
  {
    /*
     * THE CONSUMER SWAP. The projection reaching for the product label is the disclosure this
     * hardening closed. Aliased at the import so the mutation COMPILES and the module still loads.
     */
    label: "D3 the work projection reaches for the address-floored product label",
    file: GROUNDING,
    suite: DISCLOSURE_SUITE,
    find: `import { resolveHumanNames } from "@/features/auth-runtime/human-label-read.server";`,
    replace: `import { resolveHumanLabels as resolveHumanNames } from "@/features/auth-runtime/human-label-read.server";`,
    expect: "must NEVER reach the address-floored product label",
  },
  {
    /*
     * UNKNOWN MUST REMAIN UNKNOWN. Substituting any invented word for the declared constant is
     * exactly the guess this hardening forbids — and the most tempting one, because it reads better.
     */
    label: "D4 an unnamed human is given an invented name",
    file: GROUNDING,
    suite: DISCLOSURE_SUITE,
    find: `  const named = name ?? WORK_LABEL_UNAVAILABLE;`,
    replace: `  const named = name ?? "Unknown Person";`,
    expect: "an unnamed human reads as `name unavailable` with their identifier, and nothing else",
  },
  {
    /*
     * THE IDENTIFIER IS NOT REPLACED BY THE NAME. WORK-2 uses it for reference integrity, so a
     * surface-shaped "tidy up" that drops it is a regression in the record, not in the rendering.
     */
    label: "D5 the accountable identifier is dropped once a name exists",
    file: GROUNDING,
    suite: DISCLOSURE_SUITE,
    find: "`accountable human: ${named} (${item.accountableActorId})${standing}. `",
    replace: "`accountable human: ${named}${standing}. `",
    /* §1 fires before §5 — the expectation names the assertion that ACTUALLY fires. */
    expect: "and the identifier travels beside it",
  },
  {
    /*
     * THE RELEASED PRODUCT SURFACE IS NOT COLLATERAL. Switching a page to the provider-safe read
     * would blank the picker for the one organization that exists — a privacy change nobody asked
     * for, taken by accident, on a surface whose label was production-accepted.
     */
    label: "D6 a released page adopts the provider-safe read",
    file: WORK_PAGE,
    suite: DISCLOSURE_SUITE,
    find: `  readSelectableMembers,
  resolveHumanLabels,`,
    replace: `  readSelectableMembers,
  resolveHumanNames as resolveHumanLabels,`,
    /*
     * The alias keeps the LOCAL name `resolveHumanLabels`, so the "still uses the product label"
     * assertion passes and the NAME-adoption assertion is the one that fires. The expectation names
     * the assertion that actually catches the swap, not the one that reads best.
     */
    expect: "was deliberately NOT switched — UI LEGIBILITY != PROVIDER DISCLOSURE",
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.ok(
    original.includes(mutation.find),
    `${mutation.label}: the find-string is not present in ${mutation.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    assert.equal(
      sha(readFile(mutation.file)),
      sha(mutated),
      `${mutation.label}: the mutation did not reach disk`,
    );
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(
    sha(readFile(mutation.file)),
    before,
    `${mutation.file} was not restored byte-identically`,
  );
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`work2-provider-disclosure/bite-proofs: ${bitten} mutations bit`);
}

main();
