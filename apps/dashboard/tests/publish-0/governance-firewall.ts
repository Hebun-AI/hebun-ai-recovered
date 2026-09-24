/*
 * PUBLISH-0 — structural firewall. Reads source only.
 *
 *   prepared ≠ authorized: the kind is not registered with the action registry, the proposal inlet,
 *   the agent origination list, or the execution authority. Nothing can be authorized or executed
 *   under it until the attempt-ledger decision is made.
 *
 *   the write path is ONE module; no other file can reach `/media_publish`; that module sees no
 *   tenant, no database and no authority.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND, asPublishInstagramMediaPayload } from "../../src/features/instagram-publishing/contracts";
import { EXECUTABLE_ACTION_KIND } from "../../src/features/action-execution/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import { EXECUTABLE_ACTION_KINDS } from "../../src/features/heby-actions/action-registry";

const PUBLISH_MODULE = "src/features/provider-instagram/instagram-publish-transport.server.ts";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── Executable ONLY through the one authority; never agent-originable. ── */
assert.notEqual(EXECUTABLE_ACTION_KIND, PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND, "the send constant is unchanged");
assert.equal((AGENT_ORIGINABLE_ACTION_KINDS as readonly string[]).includes(PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND), false, "no agent can originate a publish");
assert.equal((EXECUTABLE_ACTION_KINDS as readonly string[]).includes(PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND), true, "registered as executable");

const files = walk("src");

/* ── The write path is one module, and exactly one executor calls it. ── */
/* contracts.ts DECLARES the ban list and the exemption, so it names the fragment by necessity. */
const publishers = files.filter(
  (f) => f !== "src/features/provider-instagram/contracts.ts" && codeOnly(readFileSync(f, "utf8")).includes("media_publish"),
);
assert.deepEqual(publishers, [PUBLISH_MODULE], "only the publish transport can express /media_publish");
const callers = files.filter((f) => f !== PUBLISH_MODULE && /\bpublishInstagramImage\b/.test(codeOnly(readFileSync(f, "utf8"))));
assert.deepEqual(
  callers,
  ["src/features/action-execution/execute-authorized-action.server.ts"],
  "the ONE execution authority is the only caller — no route, no UI, no cron, no capability resolver",
);
const attemptWriters = files.filter((f) => /\.insert\(actionExecutionAttempts\)/.test(codeOnly(readFileSync(f, "utf8"))));
assert.deepEqual(attemptWriters, ["src/features/action-execution/execute-authorized-action.server.ts"], "the attempt ledger still has exactly one writer");
const executor = codeOnly(readFileSync("src/features/action-execution/execute-authorized-action.server.ts", "utf8"));
assert.ok(
  executor.indexOf("resolveExternalSendReachability(tenant.tenantId") < executor.indexOf("executeInstagramPublish("),
  "the arming conjunction is read before the publish half is dispatched",
);

const publishSrc = codeOnly(readFileSync(PUBLISH_MODULE, "utf8"));
for (const forbidden of ["@/db", "drizzle", "TenantContext", "tenantId", "permit", "process.env", "console."]) {
  assert.equal(publishSrc.includes(forbidden), false, `publish transport must not reference ${forbidden}`);
}
assert.equal(/fetchImpl\(\s*url\.toString\(\)/.test(publishSrc), true, "one fetch site, built URL only");
assert.equal((publishSrc.match(/fetchImpl\(/g) ?? []).length, 1, "exactly one fetch site");

/* ── The payload is closed. ── */
const good = {
  integrationId: "31fcbd7c-8dd7-48eb-adf6-6548981a10ba",
  externalAccountId: "28295264780115792",
  draftRef: "artifact/x@1",
  draftRevisionDigest: "a".repeat(64),
  mediaAssetRef: "5d1e2c3b-4a59-4f6e-8d7c-9b0a1f2e3d4c",
  mediaAssetDigest: "b".repeat(64),
  publishAssetRef: "6e2f3d4c-5b6a-4f7e-9d8c-0a1b2c3d4e5f",
  publishAssetDigest: "c".repeat(64),
};
assert.ok(asPublishInstagramMediaPayload(good));
{
  const { publishAssetRef: _r, publishAssetDigest: _d, ...originalOnly } = good;
  void _r;
  void _d;
  assert.equal(asPublishInstagramMediaPayload(originalOnly), null, "the derivative identity is required");
}
assert.equal(
  asPublishInstagramMediaPayload({ ...good, publishAssetRef: good.mediaAssetRef }),
  null,
  "the derivative cannot be the original",
);
assert.equal(asPublishInstagramMediaPayload({ ...good, publishAssetDigest: "short" }), null);
assert.equal(asPublishInstagramMediaPayload({ ...good, publishingAccountId: "17841408635351823" }), null, "a decision cannot name the publishing id");
assert.equal(asPublishInstagramMediaPayload({ ...good, imageUrl: "https://x" }), null, "a decision cannot carry a URL");
assert.equal(asPublishInstagramMediaPayload({ ...good, draftRevisionDigest: "short" }), null);

console.log("PASS publish-0 governance firewall");
