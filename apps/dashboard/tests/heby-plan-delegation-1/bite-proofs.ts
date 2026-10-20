/*
 * HEBY-PLAN-DELEGATION-1 — bite-proofs. Each mutant breaks one claim of `follow-up.ts`; the suite must
 * exit non-zero for every one, and every file is restored byte-for-byte (checked by md5).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const SUITE = "tests/heby-plan-delegation-1/follow-up.ts";
const md5 = (s: string) => createHash("md5").update(s).digest("hex");

const MUTANTS: readonly { readonly name: string; readonly file: string; readonly from: string; readonly to: string }[] = [
  {
    name: "M1 a follow-up goal carries the work titles",
    file: "src/features/heby-commands/ai-operational-plan.server.ts",
    /* PLAN-FOLLOW-UP-REFERENCE-V1: the follow-up object now also carries `binding` and `sourceCount`; the mutation is unchanged. */
    from: "goal: PLAN_FOLLOW_UP_GOALS[s.move], binding",
    to: "goal: `${PLAN_FOLLOW_UP_GOALS[s.move]} ${s.items.map((a) => titleOf(a)).join(\", \")}`, binding",
  },
  {
    name: "M2 a fixed goal names an alias",
    file: "src/features/heby-commands/plan-follow-up.ts",
    from: "for the work items that have no accountable person recorded.",
    to: "for W1, which has no accountable person recorded.",
  },
  {
    name: "M3 follow-ups are offered under any result, not only an accepted one",
    file: "src/components/layout/heby/heby-composer.tsx",
    from: 'props.commandOutput.tone === "info" && props.commandOutput.followUps?.length',
    to: "props.commandOutput.followUps?.length",
  },
  {
    name: "M4 the Knowledge mode is offered for a follow-up",
    file: "src/components/layout/heby/heby-origination-affordance.tsx",
    from: "          {followUp ? null : (\n            <button",
    to: "          {false ? null : (\n            <button",
  },
  {
    name: "M5 the control implies an update",
    file: "src/features/heby-commands/plan-follow-up.ts",
    from: 'export const PLAN_FOLLOW_UP_LABEL = "Takip görevi oluştur";',
    to: 'export const PLAN_FOLLOW_UP_LABEL = "İşi güncelle";',
  },
];

const env = { ...process.env };
delete env.ANTHROPIC_BASE_URL;
delete env.ANTHROPIC_API_KEY;

const baseline = spawnSync(process.execPath, ["--import", "tsx", SUITE], { cwd: ROOT, encoding: "utf8", env });
assert.equal(baseline.status, 0, `the suite passes unmutated:\n${baseline.stderr}`);

for (const mutant of MUTANTS) {
  const file = path.join(ROOT, mutant.file);
  const original = readFileSync(file, "utf8");
  assert.equal(original.split(mutant.from).length - 1, 1, `${mutant.name}: the anchor occurs exactly once`);
  try {
    writeFileSync(file, original.replace(mutant.from, mutant.to));
    const run = spawnSync(process.execPath, ["--import", "tsx", SUITE], { cwd: ROOT, encoding: "utf8", env });
    assert.notEqual(run.status, 0, `${mutant.name}: the suite must fail`);
    assert.match(run.stderr, /AssertionError/, `${mutant.name}: it fails on an assertion, not a crash`);
  } finally {
    writeFileSync(file, original);
  }
  assert.equal(md5(readFileSync(file, "utf8")), md5(original), `${mutant.name}: restored byte-for-byte`);
}

console.log(`PASS heby-plan-delegation-1 bite-proofs ${MUTANTS.length}/${MUTANTS.length}`);
