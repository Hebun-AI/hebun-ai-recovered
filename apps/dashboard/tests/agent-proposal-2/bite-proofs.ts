/*
 * AGENT-PROPOSAL-2 — BITE PROOFS.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, and requires four things: the
 * anchor was UNIQUE, the mutation APPLIED, the suite FAILED FOR THE INTENDED REASON, and the file
 * came back byte-identical by sha256.
 *
 * ── THE ONE THAT MATTERS MOST ────────────────────────────────────────────────
 *
 * M1 adds a recipient picker to the panel. It looks like an obvious usability win — let the
 * Director choose who this is for — and it silently destroys the phase: the moment the browser
 * chooses the action's arguments, the human is the one selecting the act, and every proposal the
 * surface files is misattributed to an agent that merely filled in the rest. Nothing downstream
 * would notice. This surface is the only place that can.
 *
 * M2 is its mirror in the read direction: showing a raw uuid when a name cannot be resolved. It
 * reads as robustness and is a leak.
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

const PANEL = "src/components/decision-workspace/agent-proposal-request.tsx";
const HEBY_ACTIONS = "src/app/(dashboard)/heby/actions.ts";
const READER = "src/features/action-authorization/read-action-authorizations.server.ts";
const DISPLAY = "src/features/action-authorization/agent-proposer-display.server.ts";

const FW_SUITE = "tests/agent-proposal-2/surface-and-firewall.ts";
const PG_SUITE = "tests/agent-proposal-2/display-postgres.ts";

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
  /* A kill leaves `signal` set and `status` null. Neither is an assertion result. */
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
  /* ── THE BROWSER MUST NOT CHOOSE THE ACT ─────────────────────────────────── */
  {
    label: "M1 the panel lets the Director pick the recipient",
    file: PANEL,
    suite: FW_SUITE,
    edits: [
      {
        find: '        <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="heby-goal">',
        replace:
          '        <select name="recipientRef" />\n' +
          '        <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="heby-goal">',
      },
    ],
    because: "that is the agent's job, not the browser's",
  },
  {
    label: "M2 the server action accepts an agent id from the browser",
    file: HEBY_ACTIONS,
    suite: FW_SUITE,
    edits: [
      {
        find: "  input: { readonly goal: string },\n): Promise<OriginateActionResult> {",
        replace:
          "  input: { readonly goal: string; readonly agentId?: string },\n" +
          "): Promise<OriginateActionResult> {",
      },
    ],
    because: 'must not accept "agentId" from the browser',
  },

  /* ── THE RAW ID MUST NOT REACH A HUMAN'S SCREEN ──────────────────────────── */
  {
    /*
     * THE REALISTIC SHAPE OF THIS BUG IS TWO EDITS, and it has to be. Changing only the fallback
     * leaks nothing while the lookup still succeeds — the agent's name resolves and the id is never
     * reached. The leak appears when a lookup FAILS and somebody has made the id the fallback,
     * which is exactly the "show something rather than nothing" instinct this guard exists for.
     */
    label: "M3 an unresolved name falls back to the raw actor id",
    file: READER,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "        const display =\n" +
          '          row.proposedByActorType === "agent" ? displays.get(row.proposedByActorId) : undefined;',
        replace: "        const display: { name: string; inService: boolean } | undefined = undefined;",
      },
      {
        find: "          proposedByAgentName: display?.name ?? null,",
        replace:
          "          proposedByAgentName: display?.name ?? row.proposedByActorId,",
      },
    ],
    because: "THE AGENT'S RAW ACTOR ID IS NOT SERIALIZED TO THE CLIENT",
  },

  /* ── THE NAME MUST BE AUTHORITATIVE, AND TENANT-SCOPED ───────────────────── */
  {
    label: "M5 the display seam stops being tenant-scoped",
    file: DISPLAY,
    suite: PG_SUITE,
    edits: [
      {
        find: "    if (!wanted.has(identity.agentId)) continue;",
        replace: "    if (false) continue;",
      },
      {
        find: "  if (!tenant?.tenantId || agentIds.length === 0) return empty;",
        replace: "  if (agentIds.length === 0) return empty;",
      },
    ],
    because: "an unowned id resolves to nothing, never to a placeholder",
  },
  {
    label: "M6 a retired agent's past proposal loses its name",
    file: DISPLAY,
    suite: PG_SUITE,
    edits: [
      {
        find: "    if (!wanted.has(identity.agentId)) continue;",
        replace: "    if (!wanted.has(identity.agentId) || !identity.inService) continue;",
      },
    ],
    because: "A RETIRED AGENT'S PAST PROPOSAL KEEPS ITS NAME",
  },
];

/*
 * THE CONTROLS. Behaviour-PRESERVING changes that must be ACCEPTED.
 *
 * Without these, a suite that failed on every edit would look identical to a suite that failed on
 * the right ones — and every bite above would be worth less than it looks.
 */
interface AcceptedChange {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly edits: readonly Edit[];
  readonly why: string;
}

const ACCEPTED: readonly AcceptedChange[] = [
  /*
   * C0 — A DEFENCE-IN-DEPTH MEASUREMENT, AND AN HONEST CORRECTION.
   *
   * This was written as a MUTATION: drop the `proposedByActorType === "agent"` filter so every row
   * tries to resolve a name, and watch "a human proposal names no agent" fail. It did not fail, and
   * treating that as a defect would have been wrong.
   *
   * The reason is worth recording. The filter is not what keeps a human row nameless — the DISPLAY
   * MAP is. It is built from `readDurableAgentIdentityState`, which returns rows from the `agents`
   * table only, so a human's user id can never be a key in it and `get()` returns undefined however
   * the caller asks. The type filter avoids a pointless lookup and states the intent; the authority
   * boundary is what makes the result true.
   *
   * Recording it as a tolerated change is the difference between "this filter does nothing" (false,
   * and an invitation to delete it carelessly) and "the guarantee lives one layer down" (true).
   */
  {
    label: "C0 the actor-type filter is removed — the identity authority still names nobody human",
    file: READER,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "        const display =\n" +
          '          row.proposedByActorType === "agent" ? displays.get(row.proposedByActorId) : undefined;',
        replace: "        const display = displays.get(row.proposedByActorId);",
      },
      {
        find:
          "    const agentIds = rows\n" +
          '      .filter((row) => row.proposedByActorType === "agent")\n' +
          "      .map((row) => row.proposedByActorId);",
        replace: "    const agentIds = rows.map((row) => row.proposedByActorId);",
      },
    ],
    why:
      "the display map contains only durable AGENT identities, so a human's user id is not a key in " +
      "it and resolves to nothing regardless of which rows are asked about",
  },

  {
    label: "C1 the display map is built with a different but equivalent loop guard",
    file: DISPLAY,
    suite: PG_SUITE,
    edits: [
      {
        find: "    if (!wanted.has(identity.agentId)) continue;",
        replace: "    if (wanted.has(identity.agentId) === false) continue;",
      },
    ],
    why: "`!x` and `x === false` are the same test for a boolean Set membership result",
  },
  {
    label: "C2 the panel's two outcome blocks are declared in the other order",
    file: PANEL,
    suite: FW_SUITE,
    edits: [
      {
        find: "const MIN_GOAL = 12;\nconst MAX_GOAL = 2000;",
        replace: "const MAX_GOAL = 2000;\nconst MIN_GOAL = 12;",
      },
    ],
    why: "two independent constants have no ordering relationship",
  },
];

const voided: string[] = [];
let bitten = 0;

function withMutation(
  label: string,
  file: string,
  edits: readonly Edit[],
  body: () => void,
): void {
  const original = read(file);
  const before = sha(original);

  /* EVERY ANCHOR MUST BE UNIQUE. `replace` takes the first match; two matches is a different proof. */
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
    assert.notEqual(
      sha(read(file)),
      before,
      `${label}: the mutation did not reach ${file} — the proof would be vacuous`,
    );
    assert.equal(
      read(file),
      mutated,
      `${label}: ${file} on disk is not the text this proof composed — the mutation is partial`,
    );
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
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
      );
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
    `agent-proposal-2/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated changes ` +
      `accepted (2 behaviour-preserving, 1 defence-in-depth measurement), 0 void`,
  );
}

main();
