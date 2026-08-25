import assert from "node:assert/strict";
import {
  resolveModelConnectivityConfig,
  evaluateModelAvailability,
} from "../../src/features/heby-model";
import { unavailableStatusFor } from "../../src/features/heby-runtime/model-adapter";

const BASE = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test-model",
  HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
  /*
   * R2G — bounded by the one ceiling. This fixture read `512`, an arbitrary number chosen when
   * the configured default was 1024 and nothing connected it to what the live transport would
   * accept. It is now above `MODEL_OUTPUT_TOKEN_CEILING`, so it resolves to MISCONFIGURED and
   * every state below it would report a bound problem instead of the thing it is testing.
   *
   * The assertions are unchanged; only the fixture moved inside the range the product actually
   * permits. The refusal of an out-of-range value is proved directly in `tests/r2g-flow`.
   */
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "256",
};

function state(env: Record<string, string | undefined>, transportPresent: boolean) {
  return evaluateModelAvailability(resolveModelConnectivityConfig(env), {
    transportPresent,
  });
}

function main(): void {
  // 1. default connectivity disabled
  assert.equal(state({}, true), "DISABLED");
  assert.equal(state({ ...BASE, HEBUN_MODEL_CONNECTIVITY_ENABLED: "false" }, true), "DISABLED");

  // 2. missing provider / 3. missing model → MISCONFIGURED
  assert.equal(state({ ...BASE, HEBUN_MODEL_PROVIDER: undefined }, true), "MISCONFIGURED");
  assert.equal(state({ ...BASE, HEBUN_MODEL_ID: undefined }, true), "MISCONFIGURED");

  // 4. missing credential → CREDENTIAL_UNAVAILABLE
  assert.equal(state({ ...BASE, HEBUN_MODEL_CREDENTIAL: undefined }, true), "CREDENTIAL_UNAVAILABLE");

  // 5. transport unavailable
  assert.equal(state(BASE, false), "TRANSPORT_UNAVAILABLE");

  // 6. availability state classification (fully configured + transport)
  assert.equal(state(BASE, true), "AVAILABLE");

  // configured ≠ connected: env alone (no transport) never AVAILABLE
  assert.notEqual(state(BASE, false), "AVAILABLE");

  // credential presence never exposes the value
  const config = resolveModelConnectivityConfig({ ...BASE, HEBUN_MODEL_CREDENTIAL: "topsecretvalue" });
  assert.equal(config.credentialPresent, true);
  assert.equal(JSON.stringify(config).includes("topsecretvalue"), false);
  assert.equal("credential" in config, false);

  // unavailableStatusFor mapping is honest and closed
  assert.deepEqual(
    { a: unavailableStatusFor("DISABLED")?.available, r: unavailableStatusFor("DISABLED")?.reason },
    { a: false, r: "no-provider-configured" },
  );
  assert.equal(unavailableStatusFor("CREDENTIAL_UNAVAILABLE")?.reason, "no-credentials");
  assert.equal(unavailableStatusFor("TRANSPORT_UNAVAILABLE")?.reason, "provider-unavailable");
  assert.equal(unavailableStatusFor("MISCONFIGURED")?.available, false);
  // AVAILABLE is not an unavailability to report and is never a success claim
  assert.equal(unavailableStatusFor("AVAILABLE"), null);

  console.log("r2b connectivity availability checks passed");
}

main();
