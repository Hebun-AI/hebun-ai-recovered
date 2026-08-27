/*
 * AGENT-RUNTIME-0 — BITE PROOFS.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, and requires four things: the
 * anchor was UNIQUE, the mutation APPLIED, the suite FAILED FOR THE INTENDED REASON, and the file
 * came back byte-identical by sha256.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite. A
 * timeout is the absence of a verdict, not a verdict.
 *
 * ── THE ONE THAT MATTERS MOST ────────────────────────────────────────────────
 *
 * M1 restores the exact defect this phase exists to remove: `authoredByActorId: tenant.userId`
 * beside `authoredByActorType: "agent"`. It is one token, it typechecks, it passes lint, and every
 * artifact it writes looks perfectly normal. If the suite does not object to that line, this whole
 * phase is decoration.
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

const WRITER = "src/features/work-artifacts/write-work-artifacts.server.ts";
const AUTHORSHIP = "src/features/work-artifacts/agent-authorship.server.ts";
const SEAM = "src/features/work-artifacts/prepare-work-artifact.server.ts";

const PG_SUITE = "tests/agent-runtime-0/attribution-postgres.ts";
const FW_SUITE = "tests/agent-runtime-0/boundaries-and-firewall.ts";

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
  /* ── THE DEFECT ITSELF ───────────────────────────────────────────────────── */
  {
    label: "M1 an agent-authored revision names the human who asked for it",
    file: WRITER,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "        authoredByActorType: author.actorType,\n" +
          "        authoredByActorId: author.actorId,\n" +
          "        sourceMessageId: sourceMessageId ?? null,\n" +
          "        createdAt: now,\n" +
          "      });\n\n" +
          "      return { artifactId };",
        replace:
          "        authoredByActorType: author.actorType,\n" +
          "        authoredByActorId: tenant.userId,\n" +
          "        sourceMessageId: sourceMessageId ?? null,\n" +
          "        createdAt: now,\n" +
          "      });\n\n" +
          "      return { artifactId };",
      },
    ],
    because: "AND THE ID HALF NAMES THE DURABLE AGENT",
  },
  {
    label: "M1b the REVISE path names the human who asked for it",
    file: WRITER,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "        contentDigest,\n" +
          "        authoredByActorType: author.actorType,\n" +
          "        authoredByActorId: author.actorId,",
        replace:
          "        contentDigest,\n" +
          "        authoredByActorType: author.actorType,\n" +
          "        authoredByActorId: tenant.userId,",
      },
    ],
    because: "A HEBY REVISION NAMES THE SAME DURABLE AGENT",
  },

  /* ── FAIL-CLOSED, NOT FAIL-AVAILABLE ─────────────────────────────────────── */
  {
    label: "M2 a RETIRED durable agent may author new work",
    file: AUTHORSHIP,
    suite: PG_SUITE,
    edits: [
      {
        find: "  const serving = state.identities.filter((identity) => identity.inService);",
        replace: "  const serving = state.identities;",
      },
    ],
    because: "A RETIRED AGENT AUTHORS NOTHING",
  },
  {
    label: "M3 an unreachable identity authority is reported as an absent agent",
    file: AUTHORSHIP,
    suite: PG_SUITE,
    edits: [
      {
        find: '    return { status: "refused", reason: "agent-identity-authority-unavailable" };',
        replace: '    return { status: "refused", reason: "no-durable-agent-identity" };',
      },
    ],
    because: "unreachable is its own answer, distinct from nonexistent",
  },
  {
    label: "M4 two serving identities silently resolve to whichever sorted first",
    file: AUTHORSHIP,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "  if (serving.length > 1) {\n" +
          '    return { status: "refused", reason: "ambiguous-durable-agent-identity" };\n' +
          "  }",
        replace: "  /* mutated: ambiguity is resolved by picking one */",
      },
    ],
    because: "two serving identities are refused, never resolved to whichever sorted first",
  },

  /* ── A CLIENT-SUPPLIED AGENT ID MAY NOT AUTHOR ───────────────────────────── */
  {
    label: "M5 the brand check accepts anything shaped like an authorship",
    file: AUTHORSHIP,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "    (value as Record<PropertyKey, unknown>)[AGENT_AUTHORSHIP_BRAND] === true &&\n",
        replace: "",
      },
    ],
    because: "an unbranded value is not an authorship",
  },

  /* ── THE SEAM MAY NOT PROCEED PAST A REFUSAL ─────────────────────────────── */
  {
    label: "M6 the preparation seam ignores an authorship refusal",
    file: SEAM,
    suite: FW_SUITE,
    edits: [
      {
        find: '  const authorship = await resolveAgentAuthorship(tenant, deps.agentIdentity ?? {});',
        replace:
          "  const authorship = await (async () => ({\n" +
          '    status: "resolved" as const,\n' +
          "    authorship: { agentId: tenant.userId } as never,\n" +
          "  }))();",
      },
    ],
    because: "the preparation seam is the only caller of the resolver",
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
    label: "C1 the two refusal branches are ordered the other way round",
    file: AUTHORSHIP,
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
  {
    label: "C2 the brand check tests its clauses in a different order",
    file: AUTHORSHIP,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "    typeof (value as AgentAuthorship).agentId === \"string\" &&\n" +
          "    (value as AgentAuthorship).agentId.length > 0",
        replace:
          "    (value as AgentAuthorship).agentId?.length > 0 &&\n" +
          "    typeof (value as AgentAuthorship).agentId === \"string\"",
      },
    ],
    why: "both orders reject every non-authorship this suite presents",
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
    `agent-runtime-0/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated changes ` +
      `accepted, 0 void`,
  );
}

main();
