/*
 * R2E — provider-ops projection (pure, no DB, no network).
 *
 * Proves the read model keeps the operational states DISTINCT (never collapsed into one boolean),
 * derives every field from an authoritative source, and never leaks a secret or invents a metric.
 */
import assert from "node:assert/strict";
import { readProviderOpsView } from "../../src/features/heby-provider-ops/provider-connectivity-projection.server";

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

  console.log("r2e projection checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
