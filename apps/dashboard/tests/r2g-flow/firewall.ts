/*
 * R2G — the firewall. What this phase added must not have widened anything.
 *
 * A spend limiter is the kind of change that quietly grows: it is tempting to give it the tenant
 * so it can be fair, the credential so it can identify the caller, or the prompt so it can price
 * the request. It gets none of them, and these proofs are why that stays true.
 *
 * Structural, over the shipped source. No network, no key, no DB.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
/* Executable source only — this repository has been bitten by prose satisfying a text guard. */
const codeOf = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const BUDGET = "src/features/heby-model-live/live-spend-budget.server.ts";
const TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";
const ENV = "src/features/heby-model/model-connectivity-environment.server.ts";
const GENERATION = "src/features/heby-model/heby-model-generation.server.ts";

function main(): void {
  /* ── The limiter is not an authority, and cannot become one ────────────────────────────── */
  {
    const code = codeOf(read(BUDGET));
    for (const forbidden of [
      "tenantId",
      "tenant_id",
      "apiKey",
      "ANTHROPIC",
      "prompt",
      "userPrompt",
      "governance",
      "Governance",
      "authoriz",
      "drizzle",
      "@/db",
      "setInterval",
      "setTimeout",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `the spend limiter must not reference "${forbidden}" — it counts, it does not judge`,
      );
    }
    // It persists nothing and schedules nothing.
    assert.ok(!/insert\(|update\(|\.from\(/.test(code), "the limiter writes and reads no table");
  }

  /* ── No reset backdoor: the process budget cannot be cleared by a caller ───────────────── */
  {
    const code = codeOf(read(BUDGET));
    assert.ok(
      !/reset|clear|__test|forTest/i.test(code),
      "there is no reset hatch — isolation comes from constructing a budget, not clearing one",
    );
    // The exported surface is exactly the minimum.
    const exported = [...code.matchAll(/export (?:function|const) (\w+)/g)].map((m) => m[1]!);
    assert.deepEqual(
      exported.sort(),
      [
        "DEFAULT_LIVE_CALL_BUDGET",
        "LIVE_CALL_BUDGET_ENV_KEY",
        "MAX_CONFIGURABLE_LIVE_CALL_BUDGET",
        "createLiveSpendBudget",
        "getProcessLiveSpendBudget",
        "liveBudgetExhaustedError",
        "resolveLiveCallBudget",
      ],
      "the exported surface is four functions and three constants — no raw mutable counter",
    );
  }

  /* ── The transport still makes no authorization decision ──────────────────────────────── */
  {
    const code = codeOf(read(TRANSPORT));
    for (const forbidden of ["resolveDirectorEnabled", "getControlPlaneDb", "tenantId", "roles"]) {
      assert.ok(
        !code.includes(forbidden),
        `the transport must not reference "${forbidden}" — dispatch authority is R2E's, not its`,
      );
    }
  }

  /* ── The answer path still imports no execution seam and no Knowledge writer ──────────── */
  {
    const code = codeOf(read(ANSWER));
    for (const forbidden of [
      "heby-actions",
      "execution-gate",
      "knowledge-write",
      "insertKnowledge",
      "integration_credentials",
      "integrationCredentials",
    ]) {
      assert.ok(!code.includes(forbidden), `the answer path must not reach "${forbidden}"`);
    }
  }

  /* ── R2G introduced NO new Governance decision and NO new credential store ───────────── */
  {
    for (const file of [BUDGET, TRANSPORT, ENV, GENERATION]) {
      const code = codeOf(read(file));
      assert.ok(
        !code.includes("decision_records") && !code.includes("decisionRecords"),
        `${file} records no Governance decision`,
      );
      assert.ok(
        !code.includes("integrationCredentials") && !code.includes("integration_credentials"),
        `${file} does not touch the tenant credential store`,
      );
    }
  }

  /* ── ONE ceiling, and the transport does not declare a rival ─────────────────────────── */
  {
    const transport = codeOf(read(TRANSPORT));
    assert.ok(
      transport.includes("MODEL_OUTPUT_TOKEN_CEILING"),
      "the transport derives its ceiling rather than declaring one",
    );
    assert.ok(
      !/MAX_LIVE_OUTPUT_TOKENS\s*=\s*\d/.test(transport),
      "THE REGRESSION: the transport must never re-declare the ceiling as a literal",
    );
    const env = codeOf(read(ENV));
    assert.ok(
      !/DEFAULT_MAX_OUTPUT_TOKENS\s*=\s*\d/.test(env),
      "the default must be derived from the ceiling, not re-typed as a number that can drift",
    );
  }

  /* ── The retired env gate is gone from every description, not just from the code ──────── */
  {
    for (const file of [TRANSPORT, "src/features/heby-model/model-transport-selection.server.ts"]) {
      const raw = read(file);
      assert.ok(
        !/double env gate|double-gated selector/.test(raw),
        `${file} no longer describes the retired double-env-gate design as current`,
      );
    }
    // The retired flag itself is still absent from selection logic.
    const selection = codeOf(read("src/features/heby-model/model-transport-selection.server.ts"));
    assert.ok(
      !selection.includes("HEBUN_MODEL_LIVE_CALL_AUTHORIZED"),
      "the retired flag participates in no selection decision",
    );
  }

  console.log("r2g firewall checks passed");
}

main();
