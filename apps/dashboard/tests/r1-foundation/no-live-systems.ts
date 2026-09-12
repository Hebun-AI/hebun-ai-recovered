import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Guard: R1 must establish durable foundations WITHOUT activating any live
 * provider, execution, network, device, or background runtime, and without
 * leaking the session secret / reference to a client-rendered surface.
 */

const R1_SOURCE_FILES = [
  "src/db/client.server.ts",
  "src/features/auth/environment/auth-environment.server.ts",
  "src/features/auth-runtime/session-digest.server.ts",
  "src/features/auth-runtime/session-cookie.ts",
  "src/features/auth-runtime/session-service.server.ts",
  "src/features/auth-runtime/request-session.server.ts",
  "src/features/auth-runtime/identity-repository.server.ts",
  "src/features/tenant-registry/durable-registry-repository.server.ts",
  "src/features/tenant-registry/tenant-registry-service.server.ts",
  /* PROVIDER ACCOUNT LIFECYCLE added exactly one server-action boundary: the Instagram
   * disconnect. It is a THIN caller — the credential/connection composition lives in
   * `provider-connection-lifecycle`, because a released INT-2 firewall keeps the credential
   * authority unreachable from `src/app`. A second one appearing is a decision to record. */
  "src/app/(dashboard)/integrations/instagram/actions.ts",
  "src/app/login/actions.ts",
  "src/app/login/page.tsx",
  "src/app/(dashboard)/foundation/actions.ts",
  "src/app/(dashboard)/foundation/page.tsx",
  "src/middleware.ts",
];

// Tokens that would indicate a live provider / execution / network / background
// runtime being introduced by R1. (node:crypto and pg/drizzle are legitimate.)
const FORBIDDEN_TOKENS = [
  "fetch(",
  "@anthropic-ai",
  "@ai-sdk",
  "openai",
  "child_process",
  "execSync",
  "spawn(",
  "setInterval(",
  "computer-use",
];

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function main(): void {
  for (const file of R1_SOURCE_FILES) {
    const source = read(file);
    for (const token of FORBIDDEN_TOKENS) {
      assert.equal(
        source.includes(token),
        false,
        `${file} must not contain "${token}" (no live provider/execution in R1)`,
      );
    }
  }

  // Client-visible surfaces must not render the session secret or raw reference.
  for (const clientFile of [
    "src/app/login/page.tsx",
    "src/app/(dashboard)/foundation/page.tsx",
  /* SELF-SERVICE SIGNUP added exactly one server-action boundary: the signup action. It is the
   * only way a browser can cause tenant creation, which is why it is named here rather than matched
   * by a pattern — a second one appearing is a decision somebody has to record. */
  "src/app/register/actions.ts",
  ]) {
    const source = read(clientFile);
    for (const secretToken of [
      "sessionDigestCurrentKey",
      "DIGEST_SECRET",
      "providerSessionReferenceHash",
      ".secret",
    ]) {
      assert.equal(
        source.includes(secretToken),
        false,
        `${clientFile} must not reference "${secretToken}"`,
      );
    }
  }

  // Local sign-in must be gated to the `local` provider (never runs under a
  // Supabase/production configuration).
  const loginActions = read("src/app/login/actions.ts");
  assert.equal(
    loginActions.includes('env.provider !== "local"'),
    true,
    "loginAction must fail closed unless the provider is local",
  );

  console.log("r1 no-live-systems + secret-exposure guard checks passed");
}

main();
