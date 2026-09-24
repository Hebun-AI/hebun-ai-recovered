/*
 * PUBLISH-0 — static boundary of the JPEG publish derivative.
 *
 *   sharp is imported by exactly one module: the derivative writer, inside the Media authority ·
 *   the execution path and the lineage reader never load the codec · derivation reaches no permit,
 *   action request, provider transport or execution ledger.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const walk = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = join(d, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const importers = walk("src").filter((f) => /from\s+["']sharp["']|require\(["']sharp["']\)/.test(code(f)));
assert.deepEqual(importers, ["src/features/media-assets/derive-publish-jpeg.server.ts"], "one module loads sharp");

for (const f of [
  "src/features/media-assets/read-publish-derivative.server.ts",
  "src/features/action-execution/execute-authorized-action.server.ts",
]) {
  assert.equal(code(f).includes("derive-publish-jpeg"), false, `${f} never loads the codec`);
}

const derive = code("src/features/media-assets/derive-publish-jpeg.server.ts");
for (const forbidden of [
  "action-authorization",
  "action-execution",
  "actionPermits",
  "hebyActionRequests",
  "actionExecutionAttempts",
  "provider-instagram",
  "createReadAccess",
  "fetch(",
]) {
  assert.equal(derive.includes(forbidden), false, `derivation must not reach ${forbidden}`);
}
assert.equal(/withMetadata|keepMetadata|keepExif|keepIccProfile|withExif/.test(derive), false, "no metadata is kept");

const read = code("src/features/media-assets/read-publish-derivative.server.ts");
assert.equal((read.match(/createReadAccess\(/g) ?? []).length, 1, "one grant site");
assert.ok(/key:\s*lineage\.derivative\.storageKey/.test(read), "the grant names the derivative's key");

/* The ONLY runtime inlet: the existing propose seam, tenant from the session, nothing else. */
const hebyActions = code("src/app/(dashboard)/heby/actions.ts");
assert.ok(
  /runHebyProposeCommand\(\s*\{\s*commandId:\s*input\.commandId,\s*args:\s*input\.args\s*\},\s*\{\s*resolveTenant:\s*resolveTenantContext\s*\},?\s*\)/.test(hebyActions),
  "the propose action passes only commandId + args, tenant from resolveTenantContext",
);
const inletImporters = walk("src").filter((f) => code(f).includes("instagram-publish-proposal.server"));
assert.deepEqual(
  inletImporters,
  ["src/features/heby-action-inlet/propose-commands.server.ts"],
  "the publish inlet is reached only through the authoritative propose dispatcher",
);
const inlet = code("src/features/heby-action-inlet/instagram-publish-proposal.server.ts");
for (const forbidden of ["mintActionPermit", "approveActionRequest", "executeAuthorizedAction", "publishInstagramImage", "withAuthorizedInstagramToken", "fetch("]) {
  assert.equal(inlet.includes(forbidden), false, `the publish inlet must not reach ${forbidden}`);
}

console.log("PASS publish-0 derivation boundary");
