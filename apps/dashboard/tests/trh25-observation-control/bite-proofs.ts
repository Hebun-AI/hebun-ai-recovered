/*
 * TRH-25 PREREQUISITES — BITE PROOFS.
 *
 * Each property is removed from REAL SOURCE, one at a time, and the focused suites are required to
 * object for the reason declared in advance. A guard that never bites and a guard that never fires
 * look identical from the outside; this is the difference.
 *
 * The three that matter most:
 *
 *   P1 makes the switch fail OPEN. One word, and an unreadable control plane would silently permit
 *      every machine read — the exact failure a kill switch exists to prevent, and the one that
 *      leaves no trace because everything appears to work.
 *
 *   P4 removes the row lock. The window predicate still reads correct, and under concurrency two
 *      observations commit: `insert ... where not exists` cannot see an uncommitted sibling.
 *
 *   P5 makes the cadence window one-sided again — the natural, obvious, WRONG formulation. Of two
 *      racing writers the one holding the earlier instant never sees the later row, so whichever
 *      commits second still inserts. This proof exists because that bug was written first.
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

const HISTORY = "src/features/provider-observation-history";
const COMPOSITION = `${HISTORY}/observe-once-under-authorization.server.ts`;
const WRITER = `${HISTORY}/write-provider-observation.server.ts`;
const REVALIDATOR =
  "src/features/standing-observation-authority/revalidate-standing-observation.server.ts";
const CONTROL = "src/features/standing-observation-authority/observation-read-control.server.ts";
const CEREMONY_LIB = "scripts/lib/provider-connectivity.ts";

const FIREWALL = "tests/trh25-observation-control/control-firewall.ts";
const POSTGRES = "tests/trh25-observation-control/control-postgres.ts";
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

const SWITCH_BLOCK = "  if (!(await resolveObservationReadEnabled(\n    deps.controlRepo !== undefined\n      ? { repo: deps.controlRepo }\n      : deps.getDb\n        ? { getDb: deps.getDb }\n        : {},\n  ))) {\n    return { status: \"refused\", reason: \"observation-read-disabled\" };\n  }\n";

const MUTATIONS: readonly Mutation[] = [
  /* ── THE STOP ────────────────────────────────────────────────────────────── */
  {
    label: "P1 the switch fails OPEN when the control plane cannot be reached",
    file: CONTROL,
    edits: [{ find: "    if (!db) return false;", replace: "    if (!db) return true;" }],
    suite: POSTGRES,
    because: "K2 — a named control plane that yields no handle fails closed rather than falling back",
  },
  {
    label: "P2 the revalidator stops consulting the switch at all",
    file: REVALIDATOR,
    edits: [
      {
        find: "  if (!(await resolveObservationReadEnabled(",
        replace: "  if (false && !(await resolveObservationReadEnabled(",
      },
    ],
    suite: POSTGRES,
    because: "K2 — with NO control row at all, a fully authorized read is refused",
  },
  {
    /*
     * PLACED AFTER THE CONNECTION READ, NOT DELETED. This is the subtle failure: the switch is
     * still consulted and still refuses, so every behavioural assertion about stopping passes — but
     * a stopped deployment now reads tenant data before refusing, and the refusal reason for an
     * unhealthy connection changes underneath the released TRH-23 suite. Only the positional rule
     * catches it.
     */
    label: "P3 the stop is demoted below the tenant-data reads",
    file: REVALIDATOR,
    edits: [
      /*
       * A GENUINE DEMOTION, past the connection AND capability reads. An earlier version of this
       * proof moved the block only past `tenantScopeOf`, which is still above the anchor the rule
       * measures — it did not bite, and a mutation that does not bite is not evidence that the rule
       * is weak, only that the mutation was.
       */
      { find: SWITCH_BLOCK, replace: "" },
      {
        find: "  /*\n   * 15 · A USABLE CREDENTIAL",
        replace: SWITCH_BLOCK + "\n  /*\n   * 15 · A USABLE CREDENTIAL",
      },
    ],
    suite: FIREWALL,
    because: "the switch is decided BEFORE any tenant data is read",
  },

  /* ── THE CONCURRENCY GUARANTEE ───────────────────────────────────────────── */
  {
    label: "P4 the authorization row lock is removed, leaving `where not exists` alone",
    file: WRITER,
    edits: [{ find: "           for update", replace: "           " }],
    suite: POSTGRES,
    /*
     * THE REASON IS THE ONE THAT ACTUALLY FIRES, verified rather than assumed. Without the explicit
     * lock the waiter is still delayed — the insert's own foreign key takes a KEY SHARE lock on the
     * authorization row, which the holder's FOR UPDATE conflicts with — so it is not the "blocks"
     * assertion that catches this. It is the outcome: the waiter wakes and RECORDS a duplicate,
     * because without the lock its window was evaluated before the competitor existed.
     */
    because: "once the lock is released the waiter re-reads and refuses",
  },
  {
    label: "P5 the cadence window becomes one-sided — the obvious, wrong formulation",
    file: WRITER,
    edits: [
      {
        find:
          "             and p.observed_at > ${observedAt}::timestamptz - make_interval(mins => ${windowMinutes})\n" +
          "             and p.observed_at < ${observedAt}::timestamptz + make_interval(mins => ${windowMinutes})",
        replace:
          "             and p.observed_at > ${observedAt}::timestamptz - make_interval(mins => ${windowMinutes})\n" +
          "             and p.observed_at < ${observedAt}::timestamptz",
      },
    ],
    suite: POSTGRES,
    because: "once the lock is released the waiter re-reads and refuses",
  },
  {
    label: "P6 the window check is dropped, so any second sample is stored",
    file: WRITER,
    edits: [{ find: "        where not exists (", replace: "        where not (true) and not exists (" }],
    suite: POSTGRES,
    /*
     * THIS ONE SURFACES EARLIER THAN ITS SIBLINGS, and the reason is worth recording: with the
     * window gone entirely, the very FIRST armed read stores a second row beside the one the
     * fixture already holds, so the suite objects at K13 long before it reaches the race. Declaring
     * the assertion that actually fires is the difference between a proof and a guess.
     */
    because: "K13 — and exactly one observation is stored",
  },

  /* ── THE WRITE AUTHORITY ─────────────────────────────────────────────────── */
  {
    label: "P7 the application gains a writer for the control row",
    file: CONTROL,
    edits: [
      {
        find: "export async function resolveObservationReadEnabled(",
        replace:
          "declare const db: {\n" +
          "  insert: (t: unknown) => { values: (v: unknown) => Promise<void> };\n" +
          "};\n" +
          "declare const providerConnectivityControls: unknown;\n" +
          "export const armFromTheApp = () =>\n" +
          "  db.insert(providerConnectivityControls).values({ directorEnabled: true });\n\n" +
          "export async function resolveObservationReadEnabled(",
      },
    ],
    suite: FIREWALL,
    because: "does not .insert( the control table",
  },
  {
    label: "P8 the control key is retyped in the ceremony instead of imported",
    file: CEREMONY_LIB,
    edits: [
      { find: "  OBSERVATION_READ_CONTROL_KEY,\n]);", replace: '  "provider-observation-read",\n]);' },
    ],
    suite: FIREWALL,
    because: "and never spells the literal itself",
  },
];

const ACCEPTED: readonly AcceptedChange[] = [
  /*
   * C1 — PROSE IS NOT CODE. Every rule reads source with comments stripped, so a comment inside the
   * composition naming the switch it deliberately does not consult must be tolerated.
   */
  {
    label: "C1 the composition NAMES the switch in a comment explaining why it does not consult it",
    file: COMPOSITION,
    edits: [
      {
        find: "export async function observeOnceUnderAuthorization(",
        replace:
          "/* resolveObservationReadEnabled is deliberately not called here: the revalidator owns it. */\n" +
          "export async function observeOnceUnderAuthorization(",
      },
    ],
    suite: FIREWALL,
    why: "the rules read code with comments stripped, so prose naming the switch changes nothing",
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
    `trh25-observation-control/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated ` +
      `changes accepted, 0 void`,
  );
}

main();
