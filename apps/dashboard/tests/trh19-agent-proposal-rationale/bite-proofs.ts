/*
 * TRH-19 — BITE PROOFS.
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
 * M1 and M2 are the two edits a reviewer would wave through. M1 folds the rationale into the
 * canonical payload — it reads like "show the approver more" and it silently rewrites the act's
 * identity, so the same act with a different reason becomes a different act and dedup stops
 * meaning anything. M2 drops the proposer gate on the insert, which reads like removing a
 * redundant condition and instead lets a human path put words in the agent's mouth.
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

const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";
const SURFACE = "src/components/decision-workspace/action-authorizations.tsx";
const READ_SEAM = "src/features/action-authorization/read-action-authorizations.server.ts";

const PG_SUITE = "tests/trh19-agent-proposal-rationale/rationale-postgres.ts";
const FIREWALL_SUITE = "tests/trh19-agent-proposal-rationale/firewall.ts";

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
  /* ── THE RATIONALE IS NOT PART OF THE ACT ────────────────────────────────── */
  {
    label: "M1 the rationale is folded into the canonical payload",
    file: WRITER,
    suite: PG_SUITE,
    edits: [
      {
        find: "        canonicalPayload: payload,",
        replace:
          "        canonicalPayload:\n" +
          "          proposalRationale === undefined\n" +
          "            ? payload\n" +
          "            : { ...payload, proposalRationale },",
      },
    ],
    because: "THE RATIONALE IS ABSENT FROM THE CANONICAL PAYLOAD",
  },
  /* ── NOBODY MAY PUT WORDS IN THE AGENT'S MOUTH ───────────────────────────── */
  {
    label: "M2 the insert stops checking that the proposer is an agent",
    file: WRITER,
    suite: FIREWALL_SUITE,
    edits: [
      {
        find:
          "        proposalRationale:\n" +
          '          proposer.actorType === "agent" ? (proposalRationale ?? null) : null,',
        replace: "        proposalRationale: proposalRationale ?? null,",
      },
    ],
    because: "the insert writes a rationale only for an agent-resolved proposer",
  },
  {
    label: "M3 the human writer entry point gains a rationale parameter",
    file: WRITER,
    suite: FIREWALL_SUITE,
    edits: [
      {
        find:
          "  purposeWorkItemId?: string,\n" +
          "): Promise<ActionRequestResult> {\n" +
          "  if (typeof window !== \"undefined\") {\n" +
          "    throw new Error(\"Action requests are server-only.\");\n" +
          "  }\n" +
          "  if (!tenant?.tenantId || !tenant.userId) return Promise.resolve(refused(\"unauthenticated\"));",
        replace:
          "  purposeWorkItemId?: string,\n" +
          "  proposalRationale?: string,\n" +
          "): Promise<ActionRequestResult> {\n" +
          "  if (typeof window !== \"undefined\") {\n" +
          "    throw new Error(\"Action requests are server-only.\");\n" +
          "  }\n" +
          "  if (!tenant?.tenantId || !tenant.userId) return Promise.resolve(refused(\"unauthenticated\"));",
      },
    ],
    because: "THE HUMAN WRITER ENTRY POINT HAS NO RATIONALE PARAMETER",
  },
  /* ── THE STORED RATIONALE IS THE ONE THE AGENT GAVE ──────────────────────── */
  {
    label: "M4 the origination files a manufactured rationale instead of the selection's",
    file: ORIGINATION,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "          /* TRH-19. The same value, on the same terms, for the second admitted kind. */\n" +
          "          chosen.reason,",
        replace: '          `Heby proposed ${chosen.kind}.`,',
      },
    ],
    because: "THE EXACT NORMALIZED REASON IS STORED",
  },
  {
    label: "M5 the rationale is dropped on the way to the inlet",
    file: ORIGINATION,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "          /* TRH-19. The same value, on the same terms, for the second admitted kind. */\n" +
          "          chosen.reason,",
        replace: "          undefined,",
      },
    ],
    because: "THE EXACT NORMALIZED REASON IS STORED",
  },
  /* ── UNAVAILABLE IS NOT ABSENT ───────────────────────────────────────────── */
  {
    label: "M6 a missing rationale is rendered as the agent having given none",
    file: SURFACE,
    suite: FIREWALL_SUITE,
    edits: [
      {
        find: '{item.proposalRationale ?? "Proposal rationale unavailable"}',
        replace: '{item.proposalRationale ?? "Heby did not explain this proposal"}',
      },
    ],
    because: "a null rationale renders as UNAVAILABLE",
  },
  {
    label: "M7 the read seam substitutes a string for an unrecorded rationale",
    file: READ_SEAM,
    suite: PG_SUITE,
    edits: [
      {
        find: "          proposalRationale: row.proposalRationale,",
        replace: '          proposalRationale: row.proposalRationale ?? "No rationale was recorded.",',
      },
    ],
    /*
     * The FIRST assertion this mutation trips is the human-proposal one, not the historical-row
     * one further down — a substituted string reaches every null row, and the human row is read
     * first. The proof names the message that actually fires rather than the one it expected to.
     */
    because: "and a human proposal reads null, which the surface must render as nothing at all",
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
  {
    label: "C1 the agent gate is written as an if instead of a conditional",
    file: WRITER,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "        proposalRationale:\n" +
          '          proposer.actorType === "agent" ? (proposalRationale ?? null) : null,',
        replace:
          '        proposalRationale: proposer.actorType !== "agent" ? null : (proposalRationale ?? null),',
      },
    ],
    why: "the same condition, spelled the other way round, stores exactly the same value",
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
    `trh19-agent-proposal-rationale/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} ` +
      `tolerated changes accepted, 0 void`,
  );
}

main();
