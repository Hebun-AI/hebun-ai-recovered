/*
 * R2E — provider-ops projection (pure, no DB, no network).
 *
 * Proves the read model keeps the operational states DISTINCT (never collapsed into one boolean),
 * derives every field from an authoritative source, and never leaks a secret or invents a metric.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readProviderOpsView } from "../../src/features/heby-provider-ops/provider-connectivity-projection.server";
import { evaluateModelAvailability } from "../../src/features/heby-model/model-availability";
import { resolveModelConnectivityConfig } from "../../src/features/heby-model/model-connectivity-environment.server";
import { selectModelTransport } from "../../src/features/heby-model/model-transport-selection.server";

async function main(): Promise<void> {
  // 1. Director OFF, yet configured + credential present → three DISTINCT truths, not collapsed.
  const configuredEnv = {
    HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
    HEBUN_MODEL_PROVIDER: "claude",
    HEBUN_MODEL_ID: "claude-haiku-4-5-20251001",
    HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
    // A key-SHAPED sentinel (not a real Anthropic key): it must NEVER appear in the view.
    ANTHROPIC_API_KEY: "sk-test-DUMMY-must-never-surface-in-a-view",
  };
  const view = await readProviderOpsView({
    env: configuredEnv,
    resolveDirectorEnabled: async () => false,
    selectTransport: () => ({ transportProvenance: "fake" }),
  });
  assert.equal(view.providerKey, "claude");
  assert.equal(view.directorEnabled, false);
  assert.equal(view.directorControl, "disabled");
  assert.equal(view.configuration, "configured", "config presence is independent of the Director toggle");
  assert.equal(view.credential, "present", "credential presence is independent of the Director toggle");
  assert.equal(view.model, "claude-haiku-4-5-20251001");
  assert.equal(view.transport, "fake");
  assert.equal(view.connectivity, "not-recorded");
  assert.equal(view.lastValidation, null);

  // No secret and no fabricated metric anywhere in the serialized view.
  const json = JSON.stringify(view);
  assert.ok(!json.includes("sk-test-DUMMY"), "no api key value in view");
  assert.ok(!/sk-[a-z0-9-]{6,}/i.test(json), "no key-shaped token in view");
  for (const banned of ["health", "score", "latency", "uptime", "cost", "conformance", "balance", "%"]) {
    assert.ok(!json.toLowerCase().includes(banned), `no fabricated "${banned}" in view`);
  }

  // 2. Director ON, but nothing configured and no credential → enabled ≠ ready.
  const view2 = await readProviderOpsView({
    env: { HEBUN_MODEL_CONNECTIVITY_ENABLED: "true", HEBUN_MODEL_PROVIDER: "claude" },
    resolveDirectorEnabled: async () => true,
    selectTransport: () => ({}),
  });
  assert.equal(view2.directorEnabled, true);
  assert.equal(view2.directorControl, "enabled");
  assert.equal(view2.configuration, "needs-configuration", "no model id → needs configuration");
  assert.equal(view2.credential, "missing", "no key → missing");
  assert.equal(view2.model, null);
  assert.equal(view2.transport, "unavailable");

  await availabilityIsStatedNotInferred();

  console.log("r2e projection checks passed");
}

/*
 * ── AVAILABILITY IS STATED, NOT LEFT TO BE INFERRED FROM THE GATES ───────────
 *
 * The gates on this card can all read healthy while a request is still blocked. Two of the five
 * inputs `evaluateModelAvailability` consults were never surfaced — `enabled`
 * (HEBUN_MODEL_CONNECTIVITY_ENABLED) and `credentialPresent` (HEBUN_MODEL_CREDENTIAL) — and the
 * field named `credential` reports a DIFFERENT variable (ANTHROPIC_API_KEY) than the gate of that
 * name. So `configured + present + live` was compatible with AVAILABLE and with two distinct
 * blocked states, and all three rendered identically.
 *
 * That is not hypothetical: a production ceremony read exactly that card, concluded a request had
 * been dispatched to Anthropic, and was wrong — provider-side logs showed no request at all. The
 * decisive state existed in the runtime and reached no surface.
 *
 * WHAT THESE ASSERTIONS PIN, AND WHAT THEY DELIBERATELY DO NOT.
 *
 * They pin ONE property: for every classification the released evaluator can return, the view
 * states that same classification. Each environment below differs from the ready one by a single
 * ABSENT variable, so the cases hold under any parsing rule — they test the projection, never the
 * parser.
 *
 * They do NOT pin how any variable is parsed, and they do NOT pin the current blindness of the
 * legacy fields. Both are defects, and a firewall that froze either one would make a future repair
 * fail this suite — turning a bug into a contract. An earlier draft of this file did exactly that
 * and is corrected here.
 *
 * OBSERVATION, NOT REQUIREMENT (measured 2026-08-25, against this release): `enabled` is compared
 * as `env[...] === "true"` with no `.trim()`, while `provider`, `modelId`, `credential`, the
 * transport mode and `maxOutputTokens` all tolerate surrounding whitespace. A stray newline on
 * that ONE variable therefore yields DISABLED while every sibling gate still reads healthy. Every
 * suite that touches the parser passes with `.trim()` added — measured, not assumed — so nothing
 * asserts the strictness is intended. It is recorded here so the next reader finds it named, with
 * no count that could go stale the way an earlier comment in this repository did. Normalising it stays
 * legitimate and must not fail this suite, because it changes DISPATCH behaviour and belongs to
 * whoever owns that decision, not to an observability fix.
 */
async function availabilityIsStatedNotInferred(): Promise<void> {
  const KEY = "sk-test-DUMMY-must-never-surface-in-a-view";
  const READY = {
    HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
    HEBUN_MODEL_PROVIDER: "claude",
    HEBUN_MODEL_ID: "claude-haiku-4-5-20251001",
    HEBUN_MODEL_TRANSPORT: "live",
    HEBUN_MODEL_CREDENTIAL: "present",
    ANTHROPIC_API_KEY: KEY,
  } as const;

  /* One variable removed per case — nothing else differs. */
  const CASES = [
    ["AVAILABLE", READY],
    ["DISABLED", { ...READY, HEBUN_MODEL_CONNECTIVITY_ENABLED: undefined }],
    ["CREDENTIAL_UNAVAILABLE", { ...READY, HEBUN_MODEL_CREDENTIAL: undefined }],
    ["TRANSPORT_UNAVAILABLE", { ...READY, ANTHROPIC_API_KEY: undefined }],
    ["MISCONFIGURED", { ...READY, HEBUN_MODEL_ID: undefined }],
  ] as const;

  for (const [expected, env] of CASES) {
    const view = await readProviderOpsView({ env, resolveDirectorEnabled: async () => true });
    assert.equal(view.availability, expected, `${expected} is stated by the view`);

    /* THE SAME AUTHORITY, NOT A RESTATEMENT. A second opinion here could drift from the runtime. */
    assert.equal(
      view.availability,
      evaluateModelAvailability(resolveModelConnectivityConfig(env), {
        transportPresent: Boolean(selectModelTransport(env).transport),
      }),
      `${expected} matches the released evaluator exactly`,
    );

    /* No secret, in any state. */
    const json = JSON.stringify(view);
    assert.ok(!json.includes(KEY), "the key value never enters the view");
    assert.ok(!/sk-[a-z0-9-]{6,}/i.test(json), "no key-shaped token in the view");
  }

  /* The projection reports; it never dispatches. No execution authority was added here. */
  const source = readFileSync(
    "src/features/heby-provider-ops/provider-connectivity-projection.server.ts",
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, " ");
  for (const banned of ["transport.send", ".send(", "fetch(", "generateHebyModelAnswer", "api.anthropic.com"]) {
    assert.ok(!source.includes(banned), `the projection must not reach ${banned}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
