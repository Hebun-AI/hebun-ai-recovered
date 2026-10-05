/*
 * APF-3 bite-proofs — each load-bearing boundary of the narrow origination path is mutated in the
 * source, the suite that guards it is run, and it must fail FOR THE STATED REASON. The source is
 * restored byte-identically after each run. Sequential by construction: it rewrites source files.
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

const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";
const PG_SUITE = "tests/apf3-narrow-origination/narrow-origination-postgres.ts";
const ALIGN_SUITE = "tests/apf3-narrow-origination/projection-alignment.ts";

interface Mutation {
  readonly label: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 the declaration is listed by hand instead of derived from the rendering",
    suite: PG_SUITE,
    find: 'disclosure: { tenantId, purpose: "agent-origination", dataClasses: projection.dataClasses },',
    replace: 'disclosure: { tenantId, purpose: "agent-origination", dataClasses: ["conversation", "external-recipient", "work-artifact", "organization"] },',
    because: "the declaration is exactly what was rendered: conversation + organization",
  },
  {
    label: "B2 the production default shows the send arm again",
    suite: PG_SUITE,
    find: 'Object.freeze(["record-work"]);',
    replace: 'Object.freeze(["send", "record-work"]);',
    because: "the declaration is exactly what was rendered: conversation + organization",
  },
  {
    label: "B3 a recipient line is rendered without declaring its class",
    suite: ALIGN_SUITE,
    find: "candidates.recipients.forEach((c) => of(\"external-recipient\")(",
    replace: "candidates.recipients.forEach((c) => hebun(",
    because: "declaration and rendered payload aligned for external-recipient",
  },
  {
    label: "B4 a supplied observation is dropped silently instead of refused",
    suite: PG_SUITE,
    find: '    return refused("observation-not-admitted");\n',
    replace: "",
    because: "observation-not-admitted",
  },
  {
    label: "B5 the department's uuid-backed reference is shown as its selection token",
    suite: PG_SUITE,
    find: "org(`- departmentSlug=${d.slug} name=${d.label}`)",
    replace: "org(`- departmentSlug=${d.departmentRef} name=${d.label}`)",
    because: "no uuid in the rendered evidence",
  },
  {
    label: "B6 the parser is handed candidates the model was not shown",
    suite: PG_SUITE,
    find: "    recipients: send ? all.recipients : [],\n    drafts: send ? all.drafts : [],\n",
    replace: "    recipients: all.recipients,\n    drafts: all.drafts,\n",
    because: "a send the model was not offered is refused by the parser",
  },
];

function proveOne(m: Mutation): { label: string; bit: boolean; detail: string } {
  const before = read(ORIGINATION);
  const digest = sha(before);
  const occurrences = before.split(m.find).length - 1;
  if (occurrences !== 1) return { label: m.label, bit: false, detail: `anchor found ${occurrences} times` };
  let output = "";
  let ok = false;
  try {
    writeFileSync(abs(ORIGINATION), before.replace(m.find, m.replace), "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", m.suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
    output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    ok = r.status === 0;
  } finally {
    writeFileSync(abs(ORIGINATION), before, "utf8");
  }
  assert.equal(sha(read(ORIGINATION)), digest, `${m.label}: source restored byte-identically`);
  if (ok) return { label: m.label, bit: false, detail: "the suite PASSED against mutated source" };
  if (!output.includes(m.because)) return { label: m.label, bit: false, detail: `failed, but not for: ${m.because}` };
  return { label: m.label, bit: true, detail: `bit on: ${m.because}` };
}

const verdicts = MUTATIONS.map(proveOne);
for (const v of verdicts) console.log(`${v.bit ? "BIT " : "MISS"}  ${v.label} — ${v.detail}`);
const missed = verdicts.filter((v) => !v.bit);
assert.equal(missed.length, 0, `every guard must bite; missed: ${missed.map((v) => v.label).join(", ")}`);
console.log(`PASS apf3-narrow-origination bite proofs (${verdicts.length}/${verdicts.length} bit)`);
