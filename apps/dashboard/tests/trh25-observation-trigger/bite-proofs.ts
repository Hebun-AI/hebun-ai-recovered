/*
 * TRH-25 — BITE PROOFS.
 *
 * Each property is removed from REAL SOURCE, one at a time, and the focused suites are required to
 * object for the reason declared in advance. A guard that never bites and a guard that never fires
 * look identical from the outside; this is the difference.
 *
 * The three that matter most:
 *
 *   T1 makes the ingress fail OPEN when no secret is configured. One word, and an unconfigured
 *      deployment would expose provider transport to anyone who found the URL.
 *
 *   T3 moves authentication BELOW the scan. The route still returns 401, so every status assertion
 *      still passes — while the scan has already run, contacted a provider and written a row.
 *
 *   T6 lets the scan pass the tenant it just used into the composition. The read would still work,
 *      and the trigger would have gained the one thing it must never have: a say in scope.
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

const SCAN = "src/features/observation-trigger/scan-due-observations.server.ts";
const ROUTE = "src/app/api/observation/scan/route.ts";
const MIDDLEWARE = "src/middleware.ts";
const REGISTER =
  "src/features/standing-observation-authority/read-standing-observations.server.ts";

const FIREWALL = "tests/trh25-observation-trigger/trigger-firewall.ts";
const POSTGRES = "tests/trh25-observation-trigger/trigger-postgres.ts";
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
  readonly edits: readonly Edit[];
  readonly suite: string;
  readonly because: string;
}


interface Edit {
  readonly find: string;
  readonly replace: string;
}
interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly edits: readonly Edit[];
  readonly suite: string;
  readonly because: string;
}
interface AcceptedChange extends Mutation {
  readonly why: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE INGRESS ─────────────────────────────────────────────────────────── */
  {
    label: "T1 an UNSET trigger secret authorizes everyone instead of no one",
    file: ROUTE,
    edits: [{ find: "  if (!expected) return false;", replace: "  if (!expected) return true;" }],
    suite: POSTGRES,
    because: "with no secret configured, every request is refused — including the right one",
  },
  {
    label: "T2 the bearer is compared with ==, so a prefix or a timing probe can pass",
    file: ROUTE,
    edits: [
      {
        find: "  if (given.length !== want.length) return false;\n  return timingSafeEqual(given, want);",
        replace: "  return header.slice(prefix.length).startsWith(expected.slice(0, 4));",
      },
    ],
    suite: POSTGRES,
    because: "unauthenticated (a prefix of the secret) is refused",
  },
  {
    /*
     * THE SUBTLE ONE. The route still returns 401 for a bad caller, so every status assertion
     * passes — but the scan has already run first, contacted the provider and written a row. Only
     * counting provider calls after the refusals catches it.
     */
    label: "T3 authentication is moved BELOW the scan it is supposed to gate",
    file: ROUTE,
    edits: [
      {
        /*
         * ANCHORED ON THE GUARD'S OPENING LINE ALONE, so the comment inside it is not part of the
         * pattern. The scan is HOISTED ABOVE the guard: the 401 still returns for a bad caller, so
         * every status assertion still passes — while a provider has already been contacted.
         */
        find: '  if (!isAuthorized(request.headers.get("authorization"), process.env[TRIGGER_SECRET_ENV])) {',
        replace:
          "  const hoisted = await scanDueObservations();\n" +
          "  void hoisted;\n" +
          '  if (!isAuthorized(request.headers.get("authorization"), process.env[TRIGGER_SECRET_ENV])) {',
      },
    ],
    suite: FIREWALL,
    because: "authentication happens BEFORE the scan is started",
  },
  {
    label: "T4 the route accepts a caller-supplied scope through the query string",
    file: ROUTE,
    edits: [
      {
        find: "  const result = await scanDueObservations();",
        replace:
          "  const tenantId = new URL(request.url).searchParams.get(\"tenantId\");\n" +
          "  void tenantId;\n" +
          "  const result = await scanDueObservations();",
      },
    ],
    suite: FIREWALL,
    because: "the route never reads `searchParams`",
  },
  {
    label: "T5 the middleware exempts all of /api instead of one exact path",
    file: MIDDLEWARE,
    edits: [
      {
        find: 'const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms", "/contact"];',
        replace: 'const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms", "/contact", "/api"];',
      },
    ],
    suite: FIREWALL,
    because: "`/api` is NOT a public PREFIX",
  },

  /* ── THE AUTHORITY BOUNDARY ──────────────────────────────────────────────── */
  {
    label: "T6 the scan passes the tenant it just used into the released composition",
    file: SCAN,
    edits: [
      {
        find: "  const observed = await observeOnceUnderAuthorization(authorization.authorizationId, {",
        replace: "  const observed = await observeOnceUnderAuthorization(authorization.tenantId, {",
      },
    ],
    suite: FIREWALL,
    because: "hands it an authorization id and nothing else",
  },
  {
    label: "T7 the scan decides the operator's stop for itself",
    file: SCAN,
    edits: [
      {
        find: "  if (last.status !== \"read\") return { status: \"due-unknown\" };",
        replace:
          "  const { resolveObservationReadEnabled } = await import(\n" +
          "    \"@/features/standing-observation-authority/observation-read-control.server\"\n" +
          "  );\n" +
          "  void resolveObservationReadEnabled;\n" +
          "  if (last.status !== \"read\") return { status: \"due-unknown\" };",
      },
    ],
    suite: FIREWALL,
    because: "the scan never calls resolveObservationReadEnabled",
  },
  {
    label: "T8 the runtime register gains a tenant parameter a caller could choose",
    file: REGISTER,
    edits: [
      {
        find:
          "export async function listActiveStandingObservationsForRuntime(\n" +
          "  deps: StandingObservationReadDeps = {},",
        replace:
          "export async function listActiveStandingObservationsForRuntime(\n" +
          "  tenantId?: string,\n" +
          "  deps: StandingObservationReadDeps = {},",
      },
    ],
    suite: FIREWALL,
    because: "the runtime register takes NO tenant parameter",
  },
  {
    label: "T9 a withdrawn lineage stays attemptable in the runtime register",
    file: REGISTER,
    edits: [{ find: '      if (row.state !== "active") continue;', replace: "      " }],
    suite: POSTGRES,
    because: "a withdrawn lineage is NOT attemptable",
  },
  {
    label: "T10 an unreadable register is reported as an empty deployment",
    file: SCAN,
    edits: [
      {
        find: '    return { status: "unavailable", reason: "persistence-unavailable" };',
        replace: '    return { status: "scanned", considered: 0, attempted: 0, recorded: 0, outcomes: [] };',
      },
    ],
    suite: POSTGRES,
    because: "an unreadable register FAILS CLOSED and is never reported as an empty scan",
  },

  /* ── THE HONESTY OF THE REPORT ───────────────────────────────────────────── */
  {
    label: "T11 an observation the provider performed but Hebun failed to store is called recorded",
    file: `${"src/features/observation-trigger"}/contracts.ts`,
    edits: [
      /*
       * AIMED AT THE BRANCH THE RACE ACTUALLY TAKES. Both racing scans share one clock, so their
       * observed instants are identical and the loser is refused by the INSTANT index — reported as
       * `already-recorded`. Mutating only the cadence-window branch left this untouched and the
       * proof did not bite, which is how that was discovered.
       */
      {
        find: '        return { status: "duplicate-suppressed", reason: "already-recorded" };',
        replace: '        return { status: "recorded", observationId: "unknown" };',
      },
    ],
    suite: FIREWALL,
    because: "the same instant already on record is a SUPPRESSED duplicate",
  },
];

const ACCEPTED: readonly AcceptedChange[] = [
  /*
   * C1 — PROSE IS NOT CODE. Every rule reads source with comments stripped, so a comment in the
   * scan naming the decisions it deliberately does not make must be tolerated.
   */
  {
    label: "C1 the scan NAMES the authorities it does not call, in a comment",
    file: SCAN,
    edits: [
      {
        find: "export async function scanDueObservations(",
        replace:
          "/* resolveObservationReadEnabled and mintObservationPrincipal belong to the revalidator. */\n" +
          "export async function scanDueObservations(",
      },
    ],
    suite: FIREWALL,
    why: "the rules read code with comments stripped, so prose naming an authority changes nothing",
    because: "",
  },
];

let bitten = 0;
const voided: string[] = [];

function withMutation(label: string, file: string, edits: readonly Edit[], body: () => void): void {
  const original = read(file);
  const before = sha(original);

  let mutated = original;
  for (const edit of edits) {
    const occurrences = mutated.split(edit.find).length - 1;
    assert.equal(
      occurrences,
      1,
      `${label}: the mutation anchor must appear exactly once in ${file}, found ${occurrences} — ` +
        `a non-unique anchor mutates a line the proof did not choose`,
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
      assert.equal(run.ok, false, `${mutation.label}: the suite still PASSED — the guard does not bite`);
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

  for (const control of ACCEPTED) {
    withMutation(control.label, control.file, control.edits, () => {
      const run = runSuite(control.suite);
      assert.equal(run.void, false, `${control.label}: the control run was killed — VOID, not a pass`);
      assert.ok(
        run.ok,
        `${control.label}: this change was REJECTED, but it should have been tolerated because ` +
          `${control.why}.\n--- actual ---\n${run.output.slice(-2000)}`,
      );
    });
    console.log(`ACCEPT ${control.label}`);
  }

  assert.deepEqual(voided, [], `these proofs were VOID (child killed), not passes: ${voided.join(", ")}`);
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(
    `trh25-observation-trigger/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated ` +
      `changes accepted, 0 void`,
  );
}

main();
