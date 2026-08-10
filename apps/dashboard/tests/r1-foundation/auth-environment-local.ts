import assert from "node:assert/strict";
import { resolveAuthenticationEnvironment } from "../../src/features/auth/server";

function main(): void {
  // Local provider: configured WITHOUT any Supabase project keys.
  const local = resolveAuthenticationEnvironment({
    HEBUN_AUTH_ENABLED: "true",
    HEBUN_AUTH_PROVIDER: "local",
    DATABASE_URL: "postgresql://localhost/hebun",
    HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION: "1",
    HEBUN_AUTH_SESSION_DIGEST_SECRET: "test-only-secret",
  });
  assert.equal(local.status, "configured");
  if (local.status === "configured") {
    assert.equal(local.provider, "local");
    assert.equal(local.supabaseUrl, undefined);
    assert.equal(local.supabasePublishableKey, undefined);
    assert.deepEqual(local.sessionDigestCurrentKey, {
      version: 1,
      secret: "test-only-secret",
    });
    assert.equal(Object.isFrozen(local), true);
  }

  // Local mode missing the control-plane URL: invalid, and it must NOT demand the
  // Supabase keys.
  const localMissing = resolveAuthenticationEnvironment({
    HEBUN_AUTH_ENABLED: "true",
    HEBUN_AUTH_PROVIDER: "local",
    HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION: "1",
    HEBUN_AUTH_SESSION_DIGEST_SECRET: "test-only-secret",
  });
  assert.equal(localMissing.status, "invalid");
  if (localMissing.status === "invalid") {
    assert.deepEqual(localMissing.missingKeys, ["DATABASE_URL"]);
    assert.equal(localMissing.invalidKeys.includes("SUPABASE_URL"), false);
  }

  // Unknown provider is a configuration error.
  const unknown = resolveAuthenticationEnvironment({
    HEBUN_AUTH_ENABLED: "true",
    HEBUN_AUTH_PROVIDER: "azure",
    DATABASE_URL: "postgresql://localhost/hebun",
    HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION: "1",
    HEBUN_AUTH_SESSION_DIGEST_SECRET: "test-only-secret",
  });
  assert.equal(unknown.status, "invalid");
  if (unknown.status === "invalid") {
    assert.equal(unknown.invalidKeys.includes("HEBUN_AUTH_PROVIDER"), true);
  }

  // Regression guard: default provider (unset) still requires Supabase keys.
  const defaultProvider = resolveAuthenticationEnvironment({
    HEBUN_AUTH_ENABLED: "true",
  });
  assert.equal(defaultProvider.status, "invalid");
  if (defaultProvider.status === "invalid") {
    assert.deepEqual(defaultProvider.missingKeys, [
      "DATABASE_URL",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION",
      "HEBUN_AUTH_SESSION_DIGEST_SECRET",
    ]);
  }

  console.log("r1 auth environment (local mode) checks passed");
}

main();
