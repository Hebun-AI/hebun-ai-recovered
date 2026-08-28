/*
 * AGENT-PROPOSAL-1 — BITE PROOFS.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, and requires four things: the
 * anchor was UNIQUE, the mutation APPLIED, the suite FAILED FOR THE INTENDED REASON, and the file
 * came back byte-identical by sha256.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite.
 *
 * ── THE ONE THAT MATTERS MOST ────────────────────────────────────────────────
 *
 * M1 is a two-line change that any reviewer would read as a robustness improvement: instead of
 * requiring the whole response to be an object, find the object inside it. That single edit turns
 * "the agent produced a structured selection" into "the agent said something that contained
 * something that looked like one", and every other defence in this phase is downstream of it. If
 * the suite does not object to that, the closed contract is decoration.
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

const PARSER = "src/features/agent-origination/structured-output.ts";
const PROPOSER = "src/features/action-authorization/agent-proposer.server.ts";
const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const INLET = "src/features/heby-action-inlet/send-proposal.server.ts";

const PURE_SUITE = "tests/agent-proposal-1/structured-output.ts";
const PG_SUITE = "tests/agent-proposal-1/origination-postgres.ts";

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
  /* ── FREE-FORM TEXT MUST NEVER BECOME AN ACTION ──────────────────────────── */
  {
    label: "M1 the parser hunts for a JSON object inside prose",
    file: PARSER,
    suite: PURE_SUITE,
    edits: [
      {
        find: "  const body = (fenced ? fenced[1]! : trimmed).trim();",
        replace:
          "  const raw = (fenced ? fenced[1]! : trimmed).trim();\n" +
          "  const body = raw.slice(raw.indexOf(\"{\"), raw.lastIndexOf(\"}\") + 1);",
      },
    ],
    because: "prose must never become an action",
  },
  {
    label: "M2 a reference that was never offered is accepted",
    file: PARSER,
    suite: PURE_SUITE,
    edits: [
      {
        find:
          "  const offeredRecipient = candidates.recipients.some((c) => c.ref === recipientRef);\n" +
          "  const offeredDraft = candidates.drafts.some((c) => c.ref === draftRef);\n" +
          '  if (!offeredRecipient || !offeredDraft) return refused("reference-not-offered");',
        replace: "  /* mutated: the candidate set no longer bounds the selection */",
      },
    ],
    because: "A WELL-FORMED REFERENCE THAT WAS NEVER OFFERED IS REFUSED",
  },
  {
    label: "M3 the closed action set stops being closed",
    file: PARSER,
    suite: PURE_SUITE,
    edits: [
      {
        find:
          "  const kind = envelope.kind;\n" +
          "  if (kind !== SEND_ORIGINATION_ALIAS && kind !== NO_ACTION_KIND) {",
        replace:
          "  const kind = envelope.kind === NO_ACTION_KIND ? NO_ACTION_KIND : SEND_ORIGINATION_ALIAS;\n" +
          "  if (false) {",
      },
    ],
    because: 'kind "grant-permission" must be refused',
  },

  /* ── THE PROPOSER MUST BE REAL, IN SERVICE, AND UNFORGEABLE ──────────────── */
  {
    label: "M4 a RETIRED durable agent may originate a proposal",
    file: PROPOSER,
    suite: PG_SUITE,
    edits: [
      {
        find: "  const serving = state.identities.filter((identity) => identity.inService);",
        replace: "  const serving = state.identities;",
      },
    ],
    because: "A RETIRED AGENT ORIGINATES NOTHING",
  },
  {
    label: "M5 the proposer brand check accepts anything shaped like a proposer",
    file: PROPOSER,
    suite: PG_SUITE,
    edits: [
      {
        find: "    (value as Record<PropertyKey, unknown>)[AGENT_PROPOSER_BRAND] === true &&\n",
        replace: "",
      },
    ],
    because: "an unbranded value is not a proposer",
  },

  /* ── THE ROW MUST NAME WHO ACTUALLY CHOSE ────────────────────────────────── */
  {
    label: "M6 the proposal names the human who asked instead of the agent that chose",
    file: WRITER,
    suite: PG_SUITE,
    edits: [
      {
        find: "        proposedByActorId: proposer.actorId,",
        replace: "        proposedByActorId: tenant.userId,",
      },
    ],
    because: "AND IT IS THE REAL DURABLE AGENT IDENTITY",
  },
  {
    label: "M7 the inlet files every proposal through the human writer",
    file: INLET,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "  const recorded = proposer\n" +
          "    ? await recordAgentOriginatedActionRequest(tenant, prepared, proposer, deps, originationInvocationId)\n" +
          "    : await recordActionRequest(tenant, prepared, deps);",
        replace: "  const recorded = await recordActionRequest(tenant, prepared, deps);",
      },
    ],
    because: "THE PROPOSER IS AN AGENT",
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
    label: "C1 the two membership checks are evaluated in the other order",
    file: PARSER,
    suite: PURE_SUITE,
    edits: [
      {
        find:
          "  const offeredRecipient = candidates.recipients.some((c) => c.ref === recipientRef);\n" +
          "  const offeredDraft = candidates.drafts.some((c) => c.ref === draftRef);\n" +
          '  if (!offeredRecipient || !offeredDraft) return refused("reference-not-offered");',
        replace:
          "  const offeredDraft = candidates.drafts.some((c) => c.ref === draftRef);\n" +
          "  const offeredRecipient = candidates.recipients.some((c) => c.ref === recipientRef);\n" +
          '  if (!offeredDraft || !offeredRecipient) return refused("reference-not-offered");',
      },
    ],
    why: "both halves must be offered, so the order the two are checked in changes no outcome",
  },
  {
    label: "C2 the proposer's two identity guards are ordered the other way round",
    file: PROPOSER,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "  if (state.identities.length === 0) {\n" +
          '    return { status: "refused", reason: "no-durable-agent-identity" };\n' +
          "  }\n\n" +
          "  /* `inService` is DERIVED by the read seam from the absence of retirement, never stored. */\n" +
          "  const serving = state.identities.filter((identity) => identity.inService);\n" +
          "  if (serving.length === 0) {\n" +
          '    return { status: "refused", reason: "durable-agent-identity-retired" };\n' +
          "  }",
        replace:
          "  const serving = state.identities.filter((identity) => identity.inService);\n" +
          "  if (state.identities.length === 0) {\n" +
          '    return { status: "refused", reason: "no-durable-agent-identity" };\n' +
          "  }\n" +
          "  if (serving.length === 0) {\n" +
          '    return { status: "refused", reason: "durable-agent-identity-retired" };\n' +
          "  }",
      },
    ],
    why: "hoisting a pure filter above a guard that does not depend on it changes no outcome",
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
    /* EVERY edit landed, by exact content — a partial application is a different proof. */
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
    `agent-proposal-1/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated changes ` +
      `accepted, 0 void`,
  );
}

main();
