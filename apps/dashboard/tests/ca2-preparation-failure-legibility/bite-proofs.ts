/*
 * CA-2 PREPARATION FAILURE LEGIBILITY — bite proofs. Each guard is removed in turn; the suite that
 * owns it must fail for the intended reason. A survivor is a guard that protects nothing.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FW = "tests/ca2-preparation-failure-legibility/surface-and-firewall.ts";
const PG = "tests/ca2-preparation-failure-legibility/fallback-postgres.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";
const SEAM = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const SURFACE = "src/components/operations-preparation/prepare-with-hebun.tsx";
const GROUNDING = "src/features/heby-answer/model-facing-projection.ts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const once = (find: string, replace: string) => (text: string) => {
  assert.equal(text.split(find).length - 1, 1, `find-string must occur exactly once: ${find.slice(0, 90)}`);
  return text.replace(find, replace);
};

const MUTATIONS: readonly { label: string; file: string; suite: string; apply: (t: string) => string; expect: RegExp }[] = [
  {
    label: "B1 a gate refusal loses its named reason",
    file: ANSWER,
    suite: FW,
    apply: once(`        modelFallback: { kind: "unavailable", state: outcome.state },\n`, ""),
    expect: /A2 every deterministic fallback names its closed reason/,
  },
  {
    label: "B2 a provider failure is reported as a data-use refusal",
    file: ANSWER,
    suite: PG,
    apply: once(`modelFallback: { kind: "provider-failed", code },`, `modelFallback: { kind: "unavailable", state: "DATA_USE_NOT_AUTHORIZED" },`),
    expect: /F1 named as a provider failure/,
  },
  {
    label: "B3 the action sends the raw seam result, answer included",
    file: ACTIONS,
    suite: FW,
    apply: once(`return { ...toPreparationClientResult(result), grounding: disposition };`, `return { ...result, grounding: disposition } as never;`),
    expect: /B1 the action returns only the client-safe result/,
  },
  {
    label: "B4 a prepared result keeps its answer",
    file: SEAM,
    suite: FW,
    apply: once(`  if (rest.status === "prepared") return rest;`, `  if (rest.status === "prepared") return result as never;`),
    expect: /B4 a prepared result carries no answer/,
  },
  {
    label: "B5 the seam files a fallback as prepared work",
    file: SEAM,
    suite: PG,
    apply: once(`  if (answer.outcome.response.origin !== "model") {\n    return { status: "refused", reason: "no-model-answer", answer };\n  }\n`, ""),
    expect: /F1 a provider failure serves no model answer/,
  },
  {
    label: "B6 a provider failure is worded as an authorization refusal",
    file: SURFACE,
    suite: FW,
    apply: once("return `The request to the model provider did not succeed", "return `Not authorized by data use: the request to the model provider did not succeed"),
    expect: /C5 a provider failure is never worded as an authorization refusal/,
  },
  {
    label: "B7 grounding is defaulted on again",
    file: SURFACE,
    suite: FW,
    apply: once(`useState(OWN_CONTENT_GROUNDING_DISCLOSABLE)`, `useState(true)`),
    expect: /E3 grounding is not defaulted on/,
  },
  {
    label: "B8 a refused grounding option is selectable",
    file: SURFACE,
    suite: FW,
    apply: once(`          disabled={!OWN_CONTENT_GROUNDING_DISCLOSABLE}\n`, ""),
    expect: /E5 it cannot be selected while refused/,
  },
  {
    label: "B9 a thrown revision request shows nothing",
    file: SURFACE,
    suite: FW,
    apply: (text) => {
      const at = text.lastIndexOf("          } catch {\n            setMessage(ACTION_DID_NOT_COMPLETE);\n            return;\n          }");
      assert.ok(at > 0, "the revision form's catch exists");
      return `${text.slice(0, at)}          } catch {\n            return;\n          }${text.slice(at + "          } catch {\n            setMessage(ACTION_DID_NOT_COMPLETE);\n            return;\n          }".length)}`;
    },
    expect: /D2 both forms say when the action did not complete/,
  },
  {
    label: "B10 the grounding option stops following the policy",
    file: GROUNDING,
    suite: FW,
    apply: once(`    .decision === "allowed";`, `    .decision !== "denied";`),
    expect: /E1 the option is derived from the released policy/,
  },
];

function run(suite: string) {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`, timedOut: r.signal === "SIGTERM" && r.status === null };
}

function main(): void {
  for (const s of [FW, PG]) {
    const base = run(s);
    assert.equal(base.ok, true, `baseline ${s} must pass before any mutation:\n${base.output.slice(-2000)}`);
  }
  for (const m of MUTATIONS) {
    const file = path.join(ROOT, m.file);
    const original = readFileSync(file);
    const text = original.toString("utf8");
    try {
      writeFileSync(file, m.apply(text));
      assert.notEqual(readFileSync(file, "utf8"), text, `${m.label}: mutation reached disk`);
      const r = run(m.suite);
      assert.equal(r.timedOut, false, `${m.label}: TIMED OUT — a VOID result, not a bite`);
      assert.equal(r.ok, false, `${m.label}: the mutation SURVIVED`);
      assert.match(r.output, m.expect, `${m.label}: failed, but not for the intended reason:\n${r.output.slice(-1500)}`);
      console.log(`BITE ${m.label}`);
    } finally {
      writeFileSync(file, original);
      assert.ok(readFileSync(file).equals(original), `${m.label}: restoration is byte-identical`);
    }
  }
  console.log(`ca2-preparation-failure-legibility/bite-proofs: ${MUTATIONS.length} mutations bit`);
}

main();
