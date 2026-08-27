/*
 * THE DISCLOSURE REPAIR — BITE PROOFS.
 *
 * A disclosure guard is the easiest kind to write and the easiest kind to write USELESSLY: a
 * sentence can be asserted present by a rule that would also pass if it were deleted, because the
 * words survive in a neighbouring panel or in a comment. So each repaired claim is removed from the
 * confirmation, one at a time, and the suite is required to object.
 *
 * ── THE ANCHORS ARE INDENTATION-SENSITIVE ON PURPOSE ────────────────────────
 *
 * Four of these constants are rendered TWICE — once in the creation confirmation and once in the
 * retirement confirmation. A bare `<li>{GENESIS_DISCLOSURE.noSuccession}</li>` therefore matches two
 * places, and `String.replace` would silently mutate the retirement panel while the proof claimed to
 * be testing the creation one. The leading whitespace is what separates them (18 columns against
 * 26), and the uniqueness assertion below is what proves the separation held.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite. A
 * timeout is the absence of a verdict, not a verdict.
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

const CARD = "src/components/agents/durable-agent-identity-card.tsx";
const DISCLOSURE = "src/features/agent-identity/ceremony-disclosure.ts";
const PAGE = "src/app/(dashboard)/agents/page.tsx";

const SUITE = "tests/agent-id-ceremony-disclosure/confirmation-completeness.ts";

const CHILD_TIMEOUT_MS = 240_000;

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
  readonly because: string;
}

/*
 * The creation confirmation's bullets, at their own indentation.
 *
 * THE LEADING NEWLINE IS LOAD-BEARING. Without it the 18-column anchor is a SUBSTRING of the
 * 26-column retirement line — eighteen spaces followed by `<li>` occurs inside twenty-six spaces
 * followed by `<li>` — so four of these anchors matched twice and the uniqueness assertion caught
 * it. Anchoring on the newline forces the indentation to be exactly eighteen columns.
 */
const bullet = (expression: string): string => `\n                  <li>{${expression}}</li>`;

const MUTATIONS: readonly Mutation[] = [
  /* ── THE COUNT ───────────────────────────────────────────────────────────── */
  {
    label: "B1 the human is not told what the count is now, or what it becomes",
    file: CARD,
    edits: [{ find: bullet("genesisCountDisclosure(identities.length)"), replace: "" }],
    because: "the count before and after, measured from the read seam",
  },
  {
    label: "B2 the count sentence stops being a measurement and hard-codes 0 → 1",
    file: DISCLOSURE,
    edits: [
      {
        find:
          "  return (\n" +
          "    `Your organization currently holds ${currentCount} durable agent ${identities(currentCount)}. ` +\n" +
          "    `After this ceremony succeeds, it will hold ${currentCount + 1}.`\n" +
          "  );",
        replace:
          "  void currentCount;\n" +
          "  void identities;\n" +
          "  return (\n" +
          '    "Your organization currently holds 0 durable agent identities. " +\n' +
          '    "After this ceremony succeeds, it will hold 1."\n' +
          "  );",
      },
    ],
    /*
     * THE EARLIER ASSERTION FIRES FIRST, AND IT IS THE STRONGER ONE. Hard-coding the sentence
     * breaks the SINGULAR check (`holds 1 durable agent identity`) before it ever reaches the
     * "not a constant" comparison. The expected reason names the assertion that actually runs —
     * naming the later one would have made this proof pass for a reason it never observed.
     */
    because: "the sentence is derived from its argument, singular included",
  },

  /* ── WHAT BECOMES READABLE ───────────────────────────────────────────────── */
  {
    label: "B3 the canonical read-back expectation is withheld",
    file: CARD,
    edits: [{ find: bullet("GENESIS_DISCLOSURE.canonicalReadBack"), replace: "" }],
    because: "the canonical read-back expectation",
  },
  {
    label: "B4 the read-back sentence is softened into a capability claim",
    file: DISCLOSURE,
    edits: [
      {
        find: " Being readable is not being able to act.\",",
        replace: " The agent can act on your behalf from that moment.\",",
      },
    ],
    because: "the read-back sentence separates being readable from being able to act",
  },

  /* ── THE FOUR WAYS THE DOOR DOES NOT REOPEN ──────────────────────────────── */
  {
    label: "B5 terminal retirement is disclosed only AFTER the door has closed",
    file: CARD,
    edits: [{ find: bullet("GENESIS_DISCLOSURE.retirementIsTerminal"), replace: "" }],
    because: "retirement is terminal",
  },
  {
    label: "B6 the human is not told that retirement creates no successor",
    file: CARD,
    edits: [{ find: bullet("GENESIS_DISCLOSURE.noSuccession"), replace: "" }],
    because: "no successor is created",
  },
  {
    label: "B7 the name is presented as though it could be corrected later",
    file: CARD,
    edits: [{ find: bullet("GENESIS_DISCLOSURE.noRenameOrReplacement"), replace: "" }],
    because: "no rename or replacement authority exists",
  },
  {
    label: "B8 retirement stops claiming that genesis stays closed",
    file: CARD,
    edits: [{ find: bullet("GENESIS_DISCLOSURE.retirementDoesNotReopen"), replace: "" }],
    because: "retirement does not reopen genesis",
  },

  /* ── THE CAPABILITY LADDER ───────────────────────────────────────────────── */
  {
    label: "B9 the ceremony claims to have reached authentication",
    file: DISCLOSURE,
    edits: [
      {
        find:
          '    rung: "AUTHENTICATED",\n    reached: false,',
        replace: '    rung: "AUTHENTICATED",\n    reached: true,',
      },
    ],
    because: "identity is reached and authentication, authorization, runtime and execution are NOT",
  },

  /* ── ONE DISCLOSURE SOURCE ───────────────────────────────────────────────── */
  {
    label: "B10 a second surface starts reading the ceremony vocabulary",
    file: PAGE,
    edits: [
      {
        find: 'import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";',
        replace:
          'import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";\n' +
          'import { GENESIS_DISCLOSURE } from "@/features/agent-identity/ceremony-disclosure";',
      },
    ],
    because: "exactly one component reads the disclosure",
  },
];

/** A change the suite must TOLERATE, and the reason it must. */
interface AcceptedChange {
  readonly label: string;
  readonly file: string;
  readonly edits: readonly Edit[];
  readonly why: string;
}

const ACCEPTED: readonly AcceptedChange[] = [
  /*
   * C1 — THE ORDER OF THE BULLETS IS NOT THE RULE.
   *
   * Every fact stays on screen; only two swap places. A suite that rejects this is pinning the
   * LAYOUT of the disclosure rather than its completeness, and every bite above would be worth less
   * than it looks.
   */
  {
    label: "C1 two consequence bullets are rendered in the other order",
    file: CARD,
    edits: [
      {
        find:
          bullet("GENESIS_DISCLOSURE.retirementIsTerminal") +
          bullet("GENESIS_DISCLOSURE.noSuccession"),
        replace:
          bullet("GENESIS_DISCLOSURE.noSuccession") +
          bullet("GENESIS_DISCLOSURE.retirementIsTerminal"),
      },
    ],
    why: "the completeness rule is about which facts are present, not the order they appear in",
  },
  /*
   * C2 — THE PROSE MAY IMPROVE.
   *
   * The meaning assertions match the least the sentence could say, so a genuine rewording that
   * keeps the fact must pass. If this is rejected, the suite has frozen an editor's wording and the
   * next person to improve it will delete the guard instead.
   */
  {
    label: "C2 the one-shot sentence is reworded while keeping the fact",
    file: DISCLOSURE,
    edits: [
      {
        find:
          '    "Your organization may establish a durable agent identity ONCE. After this, the creation ceremony refuses.",',
        replace:
          '    "This ceremony may be performed ONCE by your organization, and every later attempt is refused.",',
      },
    ],
    why: "the assertion matches the FACT (once) rather than a frozen sentence",
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
    /* Every edit landed, checked by EXACT CONTENT: an insertion deliberately keeps its anchor. */
    assert.equal(
      read(file),
      mutated,
      `${label}: ${file} on disk is not the text this proof composed — the mutation is partial`,
    );
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(
      sha(read(file)),
      before,
      `${label}: ${file} was not restored byte-identically`,
    );
  }
}

function main(): void {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.label, mutation.file, mutation.edits, () => {
      const run = runSuite(SUITE);
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
      const run = runSuite(SUITE);
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
    `agent-id-ceremony-disclosure/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} ` +
      `tolerated changes accepted, 0 void`,
  );
}

main();
