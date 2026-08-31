/*
 * THE FIRST-AGENT CONFIRMATION MUST BE COMPLETE BEFORE THE ONE-WAY DOOR, NOT AFTER IT.
 *
 * AGENT-ID-0.1 shipped a confirmation that was TRUE in every sentence it printed and SILENT on
 * several it did not. Silence is not a lie, but on an irreversible transition it is the same
 * outcome: the human confirms without the facts, and there is no second chance to learn them.
 *
 * ── THE THREE CLAIMS THIS FILE DEFENDS ──────────────────────────────────────
 *
 * 1. NINE FACTS ARE ON SCREEN BEFORE THE FINAL CLICK — the count it moves (0 now, 1 after), what
 *    becomes readable, the four ways the door does not reopen, and the five capabilities the
 *    ceremony does not grant.
 * 2. THE COUNT IS MEASURED, NOT ASSERTED. `genesisCountDisclosure` is a pure function fed by the
 *    read seam. A hard-coded "0" would keep claiming zero after it stopped being true.
 * 3. NOTHING ELSE MOVED. Both authorities are byte-identical to their released commits, the ledger
 *    is unchanged, Governance is unwidened, and there is still exactly ONE disclosure source.
 *
 * ── WHY THE ASSERTIONS ARE SCOPED TO THE CONFIRMATION BRANCH ────────────────
 *
 * "Visible before confirmation" is a claim about WHERE, and a module-wide `includes()` cannot make
 * it. This repository has been bitten by exactly that shape before — an ordering assertion that
 * matched an import line and could never fail. So the source is SLICED to the `confirming` branch,
 * and the slice is asserted non-trivial before anything is asserted inside it.
 *
 * The card is a client component that calls `useRouter`, so it cannot be rendered outside Next.
 * The rendering is therefore proved structurally, while the SENTENCES are proved by importing the
 * real constants and the real function and reading what they actually say.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  AGENT_CAPABILITY_LADDER,
  GENESIS_DISCLOSURE,
  genesisCountDisclosure,
} from "../../src/features/agent-identity/ceremony-disclosure";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DISCLOSURE = "src/features/agent-identity/ceremony-disclosure.ts";
const DURABLE_CARD = "src/components/agents/durable-agent-identity-card.tsx";
const CREATE_AUTHORITY = "src/features/agent-identity/create-durable-agent-identity.server.ts";
const RETIRE_AUTHORITY = "src/features/agent-identity/retire-durable-agent-identity.server.ts";
const GOVERNANCE_CONTRACTS = "src/features/governance-decision/contracts.ts";
const MIGRATIONS = "src/db/migrations";

/** The commits each authority must still match, byte for byte. This phase writes no authority. */
const AGENT_ID_0_RELEASE = "253fc03";
const AGENT_ID_0_1_RELEASE = "bcade6a";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

function main(): void {
  /* ── 1. THE COUNT IS A MEASUREMENT, AND IT READS 0 → 1 ─────────────────────
   *
   * Run for real, not matched as a string. The ceremony is only offered while the tenant holds
   * none, so 0 is the case that will actually be printed to the first human.
   */
  const atZero = genesisCountDisclosure(0);
  assert.ok(
    /currently holds 0 durable agent identities/.test(atZero),
    `the confirmation states the CURRENT count as 0. Got: ${atZero}`,
  );
  assert.ok(
    /will hold 1\b/.test(atZero),
    `the confirmation states the EXPECTED count after success as 1. Got: ${atZero}`,
  );
  /*
   * AND IT IS NOT A SLOGAN WITH A NUMBER GLUED ON. Feeding it a different count must change both
   * halves — a function that always says "0 … 1" is a hard-coded sentence wearing a parameter.
   */
  const atOne = genesisCountDisclosure(1);
  assert.ok(
    /currently holds 1 durable agent identity\b/.test(atOne) && /will hold 2\b/.test(atOne),
    `the sentence is derived from its argument, singular included. Got: ${atOne}`,
  );
  assert.notEqual(atZero, atOne, "the count sentence is not a constant with a parameter ignored");

  /* ── 2. THE FOUR IRREVERSIBILITY FACTS SAY WHAT THEY MUST ──────────────────
   *
   * The MEANING is asserted, not the wording, because prose is allowed to improve. Each pattern
   * below is the fact the Director required, expressed as the least it could possibly say.
   */
  const REQUIRED_MEANINGS: readonly (readonly [keyof typeof GENESIS_DISCLOSURE, RegExp, string])[] = [
    ["genesisIsOneShot", /ONCE|one-shot|only once/i, "the ceremony may happen once"],
    [
      "canonicalReadBack",
      /readable through Hebun's canonical agent identity and actor read path/i,
      "the new identity becomes readable through the canonical read path",
    ],
    ["retirementIsNotDeletion", /withdraws it from service|survive/i, "retirement is not deletion"],
    [
      "retirementDoesNotReopen",
      /still counts|stays closed/i,
      "retirement does not reopen the genesis ceremony",
    ],
    ["retirementIsTerminal", /no reinstatement|returns a retired identity to service/i,
      "retirement is terminal under the released lifecycle"],
    ["noSuccession", /No successor is created/i, "no successor is created"],
    [
      "noRenameOrReplacement",
      /No rename authority and no replacement authority exists/i,
      "no rename or replacement authority exists today",
    ],
  ];
  for (const [key, pattern, why] of REQUIRED_MEANINGS) {
    const sentence: string = GENESIS_DISCLOSURE[key];
    assert.ok(
      typeof sentence === "string" && sentence.length > 0,
      `GENESIS_DISCLOSURE.${key} exists — the surface has a sentence for: ${why}`,
    );
    assert.ok(pattern.test(sentence), `GENESIS_DISCLOSURE.${key} states that ${why}. Got: ${sentence}`);
  }

  /* ── 3. ALL NINE FACTS ARE INSIDE THE CONFIRMATION BRANCH ──────────────────
   *
   * SLICED, not searched module-wide. The slice runs from the `confirming ? (` branch to the button
   * that performs the transition, so anything asserted here is provably on screen BEFORE the click.
   */
  const cardCode = codeOf(read(DURABLE_CARD));
  const start = cardCode.indexOf("{confirming ? (");
  const end = cardCode.indexOf("Establish durable identity");
  assert.ok(start > 0, "the confirmation branch was located in the durable card");
  assert.ok(end > start, "the final creation button follows the confirmation branch");
  const confirmation = cardCode.slice(start, end);
  assert.ok(
    confirmation.length > 500,
    "the confirmation slice is substantial — an empty slice would make every assertion below vacuous",
  );

  const MUST_RENDER_BEFORE_CLICK: readonly (readonly [string, string])[] = [
    ["genesisCountDisclosure(identities.length)", "the count before and after, measured from the read seam"],
    ["GENESIS_DISCLOSURE.genesisIsOneShot", "the ceremony is a one-shot"],
    ["GENESIS_DISCLOSURE.canonicalReadBack", "the canonical read-back expectation"],
    ["GENESIS_DISCLOSURE.retirementIsNotDeletion", "retirement is not deletion"],
    ["GENESIS_DISCLOSURE.retirementDoesNotReopen", "retirement does not reopen genesis"],
    ["GENESIS_DISCLOSURE.retirementIsTerminal", "retirement is terminal"],
    ["GENESIS_DISCLOSURE.noSuccession", "no successor is created"],
    ["GENESIS_DISCLOSURE.noRenameOrReplacement", "no rename or replacement authority exists"],
    ["<Ladder />", "the five capabilities this ceremony does not grant"],
    ["PERSISTED_IDENTITY_FIELDS.map", "the columns that will be written"],
    ["WITHHELD_IDENTITY_FIELDS.map", "the columns deliberately left empty"],
  ];
  for (const [expression, fact] of MUST_RENDER_BEFORE_CLICK) {
    assert.ok(
      confirmation.includes(expression),
      `the confirmation renders \`${expression}\` BEFORE the final button — ${fact}`,
    );
  }

  /* ── 4. NO HIDDEN CAPABILITY CLAIM ────────────────────────────────────────
   *
   * The ladder is the surface's promise about what the ceremony does NOT reach. Exactly one rung is
   * reached, and it is the first. A second `reached: true` would be a capability claim no phase in
   * this repository has earned.
   */
  assert.equal(AGENT_CAPABILITY_LADDER.length, 5, "the capability ladder still has five rungs");
  assert.equal(AGENT_CAPABILITY_LADDER[0]!.rung, "IDENTITY CREATED", "the first rung is identity");
  assert.deepEqual(
    AGENT_CAPABILITY_LADDER.map((step) => step.reached),
    [true, false, false, false, false],
    "identity is reached and authentication, authorization, runtime and execution are NOT",
  );
  /*
   * AND THE NEW SENTENCES CLAIM NOTHING POSITIVE. `canonicalReadBack` is the one that could drift:
   * "resolves as an actor" is a READ, and a sentence that turned it into a capability would be the
   * first lie on this surface. It must therefore also say what being readable is not.
   */
  assert.ok(
    /Being readable is not being able to act/i.test(GENESIS_DISCLOSURE.canonicalReadBack),
    "the read-back sentence separates being readable from being able to act",
  );
  const NEW_SENTENCES = [GENESIS_DISCLOSURE.canonicalReadBack, GENESIS_DISCLOSURE.noRenameOrReplacement];
  const FORBIDDEN_CLAIMS = [
    /\bis authenticated\b/i,
    /\bis authorized\b/i,
    /\bcan authenticate\b/i,
    /\bcan execute\b/i,
    /\bwill execute\b/i,
    /\bruntime (?:is|will be) (?:started|available)\b/i,
    /\btools are connected\b/i,
    /\bcan act\b(?!\.)/i,
  ];
  for (const sentence of NEW_SENTENCES) {
    for (const claim of FORBIDDEN_CLAIMS) {
      assert.ok(
        !claim.test(sentence),
        `no disclosure sentence claims a capability the ceremony does not grant (${claim}). Got: ${sentence}`,
      );
    }
  }

  /* ── 5. EXACTLY ONE DISCLOSURE SOURCE ─────────────────────────────────────
   *
   * A second module exporting the same vocabulary is how two surfaces start disagreeing about a
   * one-way door. The census is by NAME, not by count: it fails on an addition AND on a move.
   */
  const exporters = walk("src").filter((f) => /export const GENESIS_DISCLOSURE/.test(read(f)));
  assert.deepEqual(exporters, [DISCLOSURE], "exactly one module owns the genesis disclosure");
  const importers = walk("src").filter((f) => codeOf(read(f)).includes("ceremony-disclosure"));
  assert.deepEqual(
    importers,
    [DURABLE_CARD],
    "exactly one component reads the disclosure — there is no second ceremony surface",
  );

  /* ── 6. NEITHER AUTHORITY MOVED ───────────────────────────────────────────
   *
   * A disclosure repair that changed a writer would be a different phase wearing this one's name.
   */
  for (const [authority, release] of [
    [CREATE_AUTHORITY, AGENT_ID_0_RELEASE],
    [RETIRE_AUTHORITY, AGENT_ID_0_1_RELEASE],
  ] as const) {
    const released = execFileSync("git", ["show", `${release}:apps/dashboard/${authority}`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(
      read(authority),
      released,
      `${authority} is byte-identical to ${release} — this phase changed no creation or retirement behaviour`,
    );
  }

  /* ── 7. NO SCHEMA, NO MIGRATION, NO WIDENED GOVERNANCE ────────────────────── */
  const sqlCount = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).length;
  assert.equal(sqlCount, 40, "this phase authored no migration — a sentence needs none");
  const journal = JSON.parse(read(path.join(MIGRATIONS, "meta/_journal.json")));
  assert.equal(journal.entries.length, sqlCount, "and the journal agrees with the files on disk");
  const touched = `${codeOf(read(DISCLOSURE))}\n${codeOf(read(DURABLE_CARD))}`;
  for (const forbidden of ["pgTable", "pgEnum", "alter table", "drizzle-orm", "getControlPlaneDb"]) {
    assert.ok(
      !touched.includes(forbidden),
      `neither repaired file reaches \`${forbidden}\` — a disclosure owns no schema and no database handle`,
    );
  }
  assert.ok(
    /GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType\[\] = \["knowledge_node"\];/.test(
      codeOf(read(GOVERNANCE_CONTRACTS)),
    ),
    'governance subject types are still exactly ["knowledge_node"] — disclosing a ceremony is not a decision',
  );

  console.log(
    "agent-id-ceremony-disclosure/confirmation-completeness: nine facts before the click, " +
      "count measured, one disclosure source, both authorities byte-identical",
  );
}

main();
