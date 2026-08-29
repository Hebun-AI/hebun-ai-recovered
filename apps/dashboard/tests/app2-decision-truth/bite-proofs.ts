/*
 * APP-2 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite defending it
 * must fail — for the INTENDED reason, not merely for some reason.
 *
 * The mutations come in two kinds, and both matter. Most REVERT a repair: they put a false denial
 * back, or hide a projected field, and prove the firewall notices. The rest ADD something the phase
 * forbids — a fabricated recommendation, a second evidence store, a weakened human constraint — and
 * prove the boundary is defended rather than merely described.
 *
 * Restoration runs in `finally` and is verified byte-identically. Each child is bounded: a hanging
 * bite-proof is not a verdict, so a timeout is reported VOID rather than counted as a bite.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const FIREWALL = "tests/app2-decision-truth/decision-surface-firewall.ts";

const SURFACE = "src/components/decision-workspace";
const CARD = `${SURFACE}/action-authorizations.tsx`;
const WORKSPACE = `${SURFACE}/decision-workspace.tsx`;
const EVIDENCE_REGION = `${SURFACE}/decision-evidence-advisory.tsx`;
const CONSEQUENCES_REGION = `${SURFACE}/decision-consequences-governance.tsx`;
const HANDOFF_REGION = `${SURFACE}/decision-handoff-boundary.tsx`;
const READER = "src/features/action-authorization/read-action-authorizations.server.ts";
const PROJECTION = "src/features/action-authorization/decision-projection.ts";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;
const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(): { ok: boolean; output: string; timedOut: boolean } {
  const r = spawnSync(process.execPath, ["--import", "tsx", FIREWALL], {
    cwd: ROOT, encoding: "utf8", env: process.env,
    maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: r.status === 0,
    output: `${r.stdout ?? ""}${r.stderr ?? ""}`,
    timedOut: r.signal === "SIGTERM" && r.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /* The exact sentence that was false on the live page. */
    label: "M1 the stale \"no evidence connected\" denial returns",
    file: EVIDENCE_REGION,
    find: `detail="Evidence is grounded information — with its source and provenance — that supports a decision. A connected request carries`,
    replace: `detail="Evidence is grounded information. No decision item is connected, so no evidence is shown, and none is invented. A connected request carries`,
    expect: "must not deny evidence that a connected request stores",
  },
  {
    label: "M2 the evidence projection is dropped",
    file: READER,
    find: `          evidence: toEvidence(row.evidence),`,
    replace: `          evidence: { status: "none" } as const,`,
    expect: "evidence comes from the row",
  },
  {
    label: "M3 proposer attribution is hidden",
    file: CARD,
    find: `          proposed by {item.proposedByAgentName ?? item.proposedByActorType}`,
    replace: `          proposed`,
    expect: "the card renders the proposer",
  },
  {
    /*
     * AGENT-PROPOSAL-2. The tempting "improvement" when a name will not resolve is to show the id
     * instead of the class. That is a leak wearing a helpful face, and the card's fallback is the
     * one place it would be written.
     */
    label: "M3b the unresolved agent name falls back to the raw actor id",
    file: CARD,
    find: `          proposed by {item.proposedByAgentName ?? item.proposedByActorType}`,
    replace: `          proposed by {item.proposedByAgentName ?? item.proposedByActorId}`,
    expect: "the card never renders a raw actor id",
  },
  {
    label: "M4 the structural region denies connected consequences",
    file: CONSEQUENCES_REGION,
    find: `            title="Consequences appear on the action being authorized"`,
    replace: `            title="No consequences to display"`,
    expect: "the consequences region points at where live consequences appear",
  },
  {
    label: "M5 \"this surface starts nothing\" returns",
    file: HANDOFF_REGION,
    find: `          detail="Authorizing issues a bounded, revocable, single-spend permit. It does not execute.`,
    replace: `          detail="No handoff is connected and this surface starts nothing. It does not execute.`,
    expect: "must not deny the execute control this surface holds",
  },
  {
    label: "M6 raw digests become primary decision fields again",
    file: PROJECTION,
    find: `    if (DIGEST_KEY.test(name)) locks.push({ name, label: lockLabel(name), value });
    else parameters.push({ name, value });`,
    replace: `    parameters.push({ name, value });`,
    /* The parameters assertion fires first: with no split, all four keys stay parameters. */
    expect: "the decision facts stay as parameters",
  },
  {
    label: "M7 the lock/binding explanation is removed",
    file: CARD,
    find: `                Authorization binds <span className="font-mono">payloadDigest</span>, computed over`,
    replace: `                Computed over`,
    expect: "the card explains what actually binds",
  },
  {
    /* The whole risk of the layering half: a summary that declares nothing. */
    label: "M8 the collapsed summary stops declaring what is unavailable",
    file: WORKSPACE,
    find: `            Structural contract vocabulary — none of it describes the request above. Not connected:`,
    replace: `            Structural contract vocabulary. Additional detail:`,
    expect: "the CLOSED summary still declares",
  },
  {
    label: "M9 a generated recommendation appears",
    file: EVIDENCE_REGION,
    find: `            detail="A recommendation is advisory analysis`,
    replace: `            detail="Hebun suggests you approve this. A recommendation is advisory analysis`,
    expect: "must not advise the human",
  },
  {
    label: "M10 a second evidence reader appears on the surface",
    file: CONSEQUENCES_REGION,
    find: `export function DecisionConsequencesAndGovernance() {`,
    replace: `import { readPendingActionRequests } from "@/features/action-authorization/read-action-authorizations.server";\n\nexport function DecisionConsequencesAndGovernance() {`,
    expect: "must not reach \"readPendingActionRequests\"",
  },
  {
    /*
     * The human-supremacy CHECK, attacked at the DDL. A phase that only reads these constraints
     * would never notice them being dropped, so the mutation removes one from the applied migration.
     */
    label: "M11 the human-authorizer constraint is weakened",
    file: "src/db/migrations/20260816063156_r3a_action_authorization.sql",
    find: `"action_permits_human_authorizer_chk"`,
    replace: `"action_permits_any_authorizer_chk"`,
    expect: "a permit's authorizer is constrained to human at the storage layer",
  },
  {
    label: "M12 a migration is added",
    file: JOURNAL,
    find: `      "tag": "20260828190630_sia3_agent_improvement_hypothesis",\n      "breakpoints": true\n    }\n  ]`,
    replace:
      `      "tag": "20260828190630_sia3_agent_improvement_hypothesis",\n      "breakpoints": true\n    },\n` +
      `    {\n      "idx": 36,\n      "version": "7",\n      "when": 1787900000000,\n` +
      `      "tag": "20260827000000_app_2_should_not_exist",\n      "breakpoints": true\n    }\n  ]`,
    expect: "APP-2 adds no migration",
  },
];

function withMutation(m: Mutation, body: () => void): void {
  const original = readFile(m.file);
  const before = sha(original);
  assert.ok(
    original.includes(m.find),
    `${m.label}: the find-string is not present in ${m.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(m.find, m.replace);
  assert.notEqual(mutated, original, `${m.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(m.file), mutated, "utf8");
    assert.equal(sha(readFile(m.file)), sha(mutated), `${m.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(m.file), original, "utf8");
  }
  assert.equal(sha(readFile(m.file)), before, `${m.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const m of MUTATIONS) {
    withMutation(m, () => {
      const run = runSuite();
      assert.equal(run.timedOut, false, `${m.label}: the defending suite TIMED OUT. VOID, not a bite.`);
      assert.equal(
        run.ok, false,
        `${m.label}: the mutation SURVIVED — the firewall still passed.\n--- actual ---\n${run.output.slice(-1500)}`,
      );
      assert.ok(
        run.output.includes(m.expect),
        `${m.label}: the suite failed, but not for the intended reason. Expected "${m.expect}".\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${m.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`app2-decision-truth/bite-proofs: ${bitten} mutations bit`);
}

main();
