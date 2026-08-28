/*
 * AGENT-ID-0.1 — BITE PROOFS.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, and requires four things: the
 * anchor was UNIQUE, the mutation APPLIED, the suite FAILED FOR THE INTENDED REASON, and the file
 * came back byte-identical by sha256.
 *
 * Anchor uniqueness is not decoration. `String.replace` takes the FIRST match, so an anchor that
 * occurs twice mutates a line nobody meant to mutate and proves something nobody meant to prove.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite. A
 * timeout is the absence of a verdict, not a verdict.
 *
 * Expected reasons are PRODUCT REASON CODES or EXPLICIT assertion messages. Never a bare English
 * word, and never a string that a message-less assertion would echo from its own source.
 *
 * ── THE ONE THAT MATTERS MOST ────────────────────────────────────────────────
 *
 * M8 mutates the CREATION authority, not the retirement one. It narrows the genesis count so that a
 * retired identity stops counting — which is precisely the failure mode the Director forbade: a
 * retirement that silently reopens the first-agent ceremony. Nothing in the retirement authority
 * would look wrong; the lie would live one module away. That guard has to bite from here.
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

const RETIRE = "src/features/agent-identity/retire-durable-agent-identity.server.ts";
const CREATE = "src/features/agent-identity/create-durable-agent-identity.server.ts";
const ACTIONS = "src/app/(dashboard)/agents/actions.ts";
const MOCK = "src/components/agents/agent-registry-workspace.tsx";
const PAGE = "src/app/(dashboard)/agents/page.tsx";

const PG_SUITE = "tests/agent-id-0-1/retirement-postgres.ts";
const FW_SUITE = "tests/agent-id-0-1/boundaries-and-firewall.ts";

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
  /** One or more edits to the SAME file, applied together. See the defence-in-depth note on M2. */
  readonly edits: readonly Edit[];
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE GENESIS INVARIANT ───────────────────────────────────────────────── */
  {
    label: "M8 retirement silently reopens the first-agent ceremony",
    file: CREATE,
    suite: PG_SUITE,
    edits: [{ find: "      .where(eq(agents.tenantId, tenant.tenantId));",
    replace:
      "      .where(and(eq(agents.tenantId, tenant.tenantId), isNull(agents.retiredAt)));" }],
    because: "a tenant whose ONLY identity is retired has still crossed genesis",
  },

  /* ── WHO MAY RETIRE ──────────────────────────────────────────────────────── */
  {
    label: "M1 anybody in the organization may retire an identity they do not own",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [{ find:
      '    if (row.humanOwnerType !== "human" || row.humanOwnerId !== tenant.userId) {\n' +
      '      return { status: "refused" as const, reason: "not-the-human-owner" as const };\n' +
      "    }",
    replace: "    /* mutated: ownership no longer gates the withdrawal */" }],
    because: "not-the-human-owner",
  },
  {
    label: "M3 retirement stops being tenant-scoped",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [{ find: "      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenant.tenantId)))",
    replace: "      .where(eq(agents.id, agentId))" }],
    because: "another organization's identity is refused indistinguishably",
  },

  /* ── TERMINALITY AND CONCURRENCY ─────────────────────────────────────────── */
  /*
   * M2 REMOVES BOTH WITNESSES, AND IT HAS TO.
   *
   * Removing the early guard ALONE leaves the suite green, and removing the `isNull(retiredAt)`
   * predicate alone does too. That is not a dead guard — it is DEFENCE IN DEPTH, and the pair is
   * proved to be exactly that by the two ACCEPTED controls below, which watch each single removal
   * be tolerated. Terminality is genuinely held only when both are gone, so that is what this
   * mutation takes away.
   *
   * The first run of this proof asserted the single removal and reported "does not bite". Treating
   * that as a defect would have been wrong; the honest reading is that one guard was covering for
   * the other, and the proof had to be widened to see it.
   */
  {
    label: "M2 a retired identity may be retired again (BOTH witnesses removed)",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "    if (row.retiredAt !== null || row.lifecycle === RETIRED_AGENT_LIFECYCLE_STATUS) {\n" +
          '      return { status: "refused" as const, reason: "agent-identity-already-retired" as const };\n' +
          "    }",
        replace: "    /* mutated: the early terminal-state guard is gone */",
      },
      {
        find: "          isNull(agents.retiredAt),\n",
        replace: "          /* mutated: the update no longer refuses a second stamp */\n",
      },
    ],
    because: "a retired identity cannot be retired again",
  },
  /*
   * M4 REMOVES THE LOCK **AND** THE UPDATE PREDICATE, FOR THE REASON M2 DOES.
   *
   * Removing `for update` alone leaves the suite green (measured as C4). That is not a useless lock;
   * it is the same defence-in-depth shape again, and it corrects a belief worth stating plainly:
   *
   *     THE CONDITIONAL UPDATE IS THE SERIALIZER. THE ROW LOCK IS THE EARLY, CLEAN REFUSAL.
   *
   * Postgres locks the row at UPDATE time regardless, and re-evaluates `retired_at is null` after
   * waiting, so a second writer matches zero rows and is refused. Take that predicate away as well
   * and six unlocked readers all see an in-service identity, all pass the early guard, and all
   * stamp a retirement — which is exactly the race the concurrency assertion exists to catch.
   */
  {
    label: "M4 the row is judged without being locked (AND the update stops re-checking)",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [
      {
        find: '      .for("update")\n',
        replace: "      /* mutated: the row is read while another writer may still change it */\n",
      },
      {
        find: "          isNull(agents.retiredAt),\n",
        replace: "          /* mutated: the update no longer re-checks after waiting */\n",
      },
    ],
    because: "three simultaneous retirements produce exactly one retirement",
  },

  /* ── RETIREMENT IS NOT DELETION, AND FABRICATES NOTHING ──────────────────── */
  {
    label: "M5 retirement soft-deletes the identity as well",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [{ find: "        retiredAt: now,\n        updatedAt: now,",
    replace: "        retiredAt: now,\n        deletedAt: now,\n        updatedAt: now," }],
    because: "`deleted_at` is NULL after retirement",
  },
  {
    label: "M6 retirement fabricates a successor",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [{ find: "        updatedBy: tenant.userId,\n        updatedByType: \"human\",",
    replace:
      "        replacedByAgentId: agentId,\n        updatedBy: tenant.userId,\n        updatedByType: \"human\"," }],
    because: "`replaced_by_agent_id` is NULL after retirement",
  },
  {
    label: "M7 the retiring actor is half-attributed",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [{ find: "        updatedBy: tenant.userId,\n        updatedByType: \"human\",\n",
    replace: "        updatedByType: \"human\",\n" }],
    because: "the actor pair is written BOTH-OR-NEITHER",
  },

  /* ── THE CLIENT MAY NOT NAME A TENANT ────────────────────────────────────── */
  {
    label: "M9 the creation action accepts a client-supplied tenant",
    file: ACTIONS,
    suite: FW_SUITE,
    edits: [{ find: "export async function createDurableAgentIdentityAction(input: {\n  name: string;\n}",
    replace:
      "export async function createDurableAgentIdentityAction(input: {\n  name: string;\n  tenantId: string;\n}" }],
    because: "no action accepts `tenantId`",
  },

  /* ── ONE DURABLE CREATION AUTHORITY IN THE PRODUCT ───────────────────────── */
  {
    label: "M10 the simulation's control claims to create a real agent again",
    file: MOCK,
    suite: FW_SUITE,
    edits: [{ find: "            Create simulated definition\n          </Button>",
    replace: "            Create Agent\n          </Button>" }],
    because: "no control in the simulation reads `Create Agent`",
  },
  {
    label: "M11 the simulation is presented above the durable authority",
    file: PAGE,
    suite: FW_SUITE,
    /*
     * TWO EDITS, BECAUSE ADJACENCY IS NOT THE PROPERTY.
     *
     * This was ONE edit that found the identity card immediately followed by the simulation and
     * swapped the pair. That anchor silently encoded an assumption the property never made — that
     * nothing else is rendered between them — and SELF-IMPROVING-AGENTS-1 falsified it by adding a
     * third surface to this page. The anchor then matched nothing, so the proof failed as
     * UNFINDABLE rather than proving anything, which is the worst failure mode a bite-proof has: a
     * guard reported as unproven while it is in fact intact.
     *
     * Lifting the card OUT and re-inserting it AFTER the simulation proves the same property — the
     * durable authority is presented BEFORE the simulation — whatever else the page renders in
     * between. Repaired stricter, not weakened: it now also bites on a page where the two were
     * never adjacent to begin with.
     */
    edits: [
      { find:
      "        <DurableAgentIdentityCard\n" +
      "          block={block}\n" +
      "          actingHumanId={tenant?.userId}\n" +
      "          tenantId={tenant?.tenantId}\n" +
      "          genesisSpent={identityState.status === \"known\" ? identityState.genesisSpent : false}\n" +
      "          identities={identityState.status === \"known\" ? identityState.identities : []}\n" +
      "        />\n",
      replace: "" },
      { find: "        <AgentsTruthSurface model={model} />",
      replace:
        "        <AgentsTruthSurface model={model} />\n" +
        "        <DurableAgentIdentityCard\n" +
        "          block={block}\n" +
        "          actingHumanId={tenant?.userId}\n" +
        "          tenantId={tenant?.tenantId}\n" +
        "          genesisSpent={identityState.status === \"known\" ? identityState.genesisSpent : false}\n" +
        "          identities={identityState.status === \"known\" ? identityState.identities : []}\n" +
        "        />" },
    ],
    because: "the durable authority is presented BEFORE the simulation",
  },

  /* ── THE READ MAY NOT INFER GENESIS FROM HEALTH ──────────────────────────── */
  {
    label: "M12 the read reports genesis as unspent once the identity is retired",
    file: "src/features/agent-identity/read-durable-agent-identity.server.ts",
    suite: PG_SUITE,
    edits: [{ find: "      genesisSpent: rows.length > 0,",
    replace: "      genesisSpent: rows.some((row) => row.retiredAt === null)," }],
    because: "genesis reads as SPENT for a tenant whose only identity is retired",
  },
];

/*
 * THE CONTROL. A behaviour-PRESERVING change that must be ACCEPTED.
 *
 * The two witnesses of retirement are checked with `||`, so their order is meaningless. Swapping
 * them changes no outcome for any input. If the suite rejects this, it is testing the SPELLING of
 * the guard rather than the rule, and every bite above would be worth less than it looks.
 */
/** A change the suite must TOLERATE, and the reason it must. */
interface AcceptedChange {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly edits: readonly Edit[];
  readonly why: string;
}

const ACCEPTED: readonly AcceptedChange[] = [
  /*
   * C1 — THE ORDER OF TWO `||` OPERANDS IS NOT THE RULE.
   *
   * The two witnesses of retirement are checked with `||`, so their order is meaningless. Swapping
   * them changes no outcome for any input. If the suite rejects this, it is testing the SPELLING of
   * the guard rather than the rule, and every bite above would be worth less than it looks.
   */
  {
    label: "C1 the two witnesses of retirement are tested in the other order",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [
      {
        find: "    if (row.retiredAt !== null || row.lifecycle === RETIRED_AGENT_LIFECYCLE_STATUS) {",
        replace: "    if (row.lifecycle === RETIRED_AGENT_LIFECYCLE_STATUS || row.retiredAt !== null) {",
      },
    ],
    why: "swapping two `||` operands is behaviour-preserving",
  },

  /*
   * C2 / C3 — THE DEFENCE-IN-DEPTH MEASUREMENT.
   *
   * These are NOT claims that the removed code is useless. They are the measurement that makes M2
   * honest: each single removal is TOLERATED because the other guard still refuses, with the same
   * product reason. Recording that is the difference between "this guard does not bite" (false, and
   * an invitation to delete it) and "these two guards cover for each other" (true, and the reason
   * M2 has to remove both).
   */
  {
    label: "C2 the early terminal-state guard alone is removed — the update predicate still refuses",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [
      {
        find:
          "    if (row.retiredAt !== null || row.lifecycle === RETIRED_AGENT_LIFECYCLE_STATUS) {\n" +
          '      return { status: "refused" as const, reason: "agent-identity-already-retired" as const };\n' +
          "    }",
        replace: "    /* measured: only the early guard is gone */",
      },
    ],
    why: "the `isNull(retiredAt)` update predicate still produces `agent-identity-already-retired`",
  },
  {
    label: "C3 the update predicate alone is removed — the early guard still refuses",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [
      {
        find: "          isNull(agents.retiredAt),\n",
        replace: "          /* measured: only the update predicate is gone */\n",
      },
    ],
    why: "the early terminal-state guard still produces `agent-identity-already-retired`",
  },
  /*
   * C4 — THE SAME MEASUREMENT FOR THE LOCK.
   *
   * Removing `for update` alone is tolerated because the conditional UPDATE re-evaluates its
   * predicate after waiting on the row lock Postgres takes anyway. This is the evidence behind M4's
   * widening, and behind the correction to the authority's own comment: the lock buys an early,
   * clean refusal, not the serialization itself.
   */
  {
    label: "C4 the explicit row lock alone is removed — the conditional update still serializes",
    file: RETIRE,
    suite: PG_SUITE,
    edits: [
      {
        find: '      .for("update")\n',
        replace: "      /* measured: only the explicit lock is gone */\n",
      },
    ],
    why: "the `isNull(retiredAt)` predicate is re-evaluated after Postgres' own row lock, so a second writer still matches zero rows",
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
    /*
     * EVERY edit landed, not merely the first: a partial application is a different proof.
     *
     * Checked by EXACT CONTENT, not by "the anchor is gone". An insertion-style edit deliberately
     * keeps its anchor — M6 adds a line ABOVE the actor pair and re-emits the pair — so an
     * anchor-absence check calls a perfectly applied mutation partial. Each edit's uniqueness was
     * already asserted before it was applied, so equality with the text we computed is the whole
     * guarantee: every anchor was found, every replacement was made, and the file on disk is it.
     */
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
    `agent-id-0-1/bite-proofs: ${bitten} mutations bit, ${ACCEPTED.length} tolerated changes ` +
      `accepted (1 behaviour-preserving, 3 defence-in-depth measurements), 0 void`,
  );
}

main();
