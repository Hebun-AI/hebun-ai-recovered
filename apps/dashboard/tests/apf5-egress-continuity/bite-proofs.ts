/*
 * APF-5 bite-proofs — each load-bearing guard is mutated in source, the suite that owns it is run,
 * and it must fail FOR THE STATED REASON. Sources are restored byte-identically. Sequential.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string) => path.join(ROOT, f);
const read = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const COMPOSE = "src/features/external-ai-data-use/compose-external-ai-disclosure.ts";
const GENERATOR = "src/features/heby-model/heby-model-generation.server.ts";
const WRITER = "src/features/governance-audit/external-ai-disclosure-audit.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";
const RUNNER = "scripts/relevance-experiment/run.ts";
const PG = "tests/apf5-egress-continuity/egress-continuity-postgres.ts";
const APF3 = "tests/apf3-narrow-origination/narrow-origination-postgres.ts";
const FIREWALL = "tests/external-ai-data-use-1a/firewall-and-inertness.ts";
const RELEVANCE = "tests/relevance1/boundaries.ts";

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 the model check is removed from the gate",
    file: COMPOSE,
    suite: PG,
    find: '  if (!attestation.modelIds.includes(request.modelId)) return refuse("model-not-attested");\n',
    replace: "",
    because: "a non-attested model is refused before the network",
  },
  {
    label: "B2 the gate checks a model other than the one sent",
    file: GENERATOR,
    suite: PG,
    find: "          modelId,\n        );",
    replace: '          "claude-haiku-4-5-20251001",\n        );',
    because: "a non-attested model is refused before the network",
  },
  {
    label: "B3 an authorized decision is sent without its record",
    file: GENERATOR,
    suite: PG,
    /* AP-3 — the authorized record is now written inside the dispatch-cap admission's commit. */
    find: "        if (!(await record(evidence, { getDb: () => db }).catch(() => false))) {",
    replace: "        if (false && !(await record(evidence, { getDb: () => db }).catch(() => false))) {",
    because: "exactly one decision record",
  },
  {
    label: "B4 a failed refusal record escapes the refusal",
    file: GENERATOR,
    suite: PG,
    find: "      if (evidence) await record(evidence).catch(() => false);",
    replace: "      if (evidence) await record(evidence);",
    because: "audit down",
  },
  {
    label: "B5 the audit writer reaches the deciding authority",
    file: WRITER,
    suite: FIREWALL,
    find: 'import type { ExternalAiDisclosureEvidence } from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";',
    replace:
      'import type { ExternalAiDisclosureEvidence } from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";\nimport { composeExternalAiDisclosure } from "@/features/external-ai-data-use/compose-external-ai-disclosure";\nvoid composeExternalAiDisclosure;',
    because: "the audit writer imports nothing from the authority but the evidence type",
  },
  {
    label: "B6 origination falls back to a constant correlation",
    file: ORIGINATION,
    suite: APF3,
    find: "correlationId: deps.newCorrelationId?.() ?? invocationId,",
    replace: 'correlationId: deps.newCorrelationId?.() ?? "agent-origination",',
    because: "the request's correlation is the invocation id",
  },
  {
    label: "B7 the relevance runner regains a live transport",
    file: RUNNER,
    suite: RELEVANCE,
    find: 'import { writeFileSync } from "node:fs";',
    replace:
      'import { writeFileSync } from "node:fs";\nimport { selectModelTransport } from "../../src/features/heby-model/model-transport-selection.server";\nvoid selectModelTransport;',
    because: "selects no transport",
  },
];

function proveOne(m: Mutation): { label: string; bit: boolean; detail: string } {
  const before = read(m.file);
  const digest = sha(before);
  const n = before.split(m.find).length - 1;
  if (n !== 1) return { label: m.label, bit: false, detail: `anchor found ${n} times in ${m.file}` };
  let output = "";
  let ok = false;
  try {
    writeFileSync(abs(m.file), before.replace(m.find, m.replace), "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", m.suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
    output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    ok = r.status === 0;
  } finally {
    writeFileSync(abs(m.file), before, "utf8");
  }
  assert.equal(sha(read(m.file)), digest, `${m.label}: source restored byte-identically`);
  if (ok) return { label: m.label, bit: false, detail: "the suite PASSED against mutated source" };
  if (!output.includes(m.because)) return { label: m.label, bit: false, detail: `failed, but not for: ${m.because}` };
  return { label: m.label, bit: true, detail: `bit on: ${m.because}` };
}

const verdicts = MUTATIONS.map(proveOne);
for (const v of verdicts) console.log(`${v.bit ? "BIT " : "MISS"}  ${v.label} — ${v.detail}`);
const missed = verdicts.filter((v) => !v.bit);
assert.equal(missed.length, 0, `every guard must bite; missed: ${missed.map((v) => v.label).join(", ")}`);
console.log(`PASS apf5-egress-continuity bite proofs (${verdicts.length}/${verdicts.length} bit)`);
