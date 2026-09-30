/*
 * INSTAGRAM-PACKAGE-READINESS-1 — structural boundaries, read as source.
 *
 *   the verifier READS the Content Package and nothing else · writes nothing · re-derives no
 *   readiness · cannot select, review, decide, mint or execute · is consumed ONLY by the Instagram
 *   proposal inlet and the executor (never by Heby's agent / command / conversation code) ·
 *   proposal ordering: readiness BEFORE derivation BEFORE prepare → prior-publication → record ·
 *   execution ordering: pre-flight readiness BEFORE the spend, post-commit readiness AFTER the
 *   arming re-read and BEFORE the image grant and Meta · no new persisted enum value.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOnly = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

const VERIFIER = "src/features/instagram-publishing/verify-instagram-package.server.ts";
const PROPOSAL = "src/features/heby-action-inlet/instagram-publish-proposal.server.ts";
const EXECUTOR = "src/features/action-execution/execute-authorized-action.server.ts";

/* 1 · The verifier reads the Content Package authority, and imports nothing that writes. */
{
  const code = codeOnly(read(VERIFIER));
  const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    imports,
    [
      "@/features/auth/tenant/tenant-context",
      "@/features/content-composition/contracts",
      "@/features/content-composition/read-content-package.server",
    ],
    `the verifier's only dependencies are the package read and types: ${imports}`,
  );
  for (const verb of [".insert(", ".update(", ".delete(", ".execute(", "transaction("]) {
    assert.ok(!code.includes(verb), `the verifier must not ${verb}`);
  }
  for (const forbidden of [
    "selectMediaForRevision",
    "deselectMediaForRevision",
    "acceptMediaAsset",
    "declineMediaAsset",
    "acceptArtifactRevision",
    "requestArtifactRevisionChanges",
    "approveActionRequest",
    "consumeActionPermit",
    "recordActionRequest",
    "executeAuthorizedAction",
    "decisionRecords",
    "actionPermits",
    "actionExecutionAttempts",
    "hebyActionRequests",
    "contentSelectedMedia",
    "process.env",
  ]) {
    assert.ok(!code.includes(forbidden), `the verifier must not reference ${forbidden}`);
  }
  /* Readiness is the package's own `ready`; the verifier derives no blocker of its own. */
  assert.ok(!/CONTENT_PACKAGE_BLOCKERS|copyReviewState/.test(code), "the verifier does not re-derive readiness");
  assert.ok(/pkg\.ready/.test(code) && /pkg\.selected/.test(code) && /pkg\.mediaReviewStates/.test(code), "the package's own facts decide");
}

/* 2 · Exactly two consumers: the Instagram proposal inlet and the executor. Heby gains nothing. */
{
  const importers = walk("src").filter((f) => f !== VERIFIER && /verify-instagram-package\.server/.test(codeOnly(read(f)))).sort();
  /* INSTAGRAM-APPROVAL-PREVIEW-1 reads it as CURRENT-READINESS CONTEXT beside a governed request; it decides nothing. */
  const PREVIEW = "src/features/instagram-publishing/approval-preview.server.ts";
  assert.deepEqual(importers, [EXECUTOR, PROPOSAL, PREVIEW].sort(), `consumers: ${importers}`);
  let heby = 0;
  for (const f of walk("src")) {
    /* Every Heby / agent feature except the human proposal inlet itself. */
    if (!/^src\/features\/(heby-(?!action-inlet\/)[a-z-]+|agent[a-z-]*)\//.test(f)) continue;
    heby++;
    assert.ok(!/verifyInstagramPackageReadiness|proposeInstagramPublish|executeAuthorizedAction/.test(codeOnly(read(f))), `${f}: Heby does not reach publication authority`);
  }
  assert.ok(heby > 50, `the Heby/agent scan is not vacuous (${heby} files)`);
  /* The proposal inlet does not write selection or review either. */
  const proposal = codeOnly(read(PROPOSAL));
  for (const w of ["selectMediaForRevision", "acceptMediaAsset", "acceptArtifactRevision", "approveActionRequest", "consumeActionPermit"]) {
    assert.ok(!proposal.includes(w), `the proposal inlet must not call ${w}`);
  }
}

/* 3 · Proposal ordering: ownership → readiness → derivative → prepare → prior publication → record. */
{
  const code = codeOnly(read(PROPOSAL));
  const at = (needle: string) => {
    const i = code.indexOf(needle);
    assert.ok(i > 0, `proposal contains ${needle}`);
    return i;
  };
  const order = [
    at('refused("media-not-of-this-draft")'),
    at("await verifyInstagramPackageReadiness("),
    at("await derivePublishJpeg("),
    at("prepareAction({"),
    at("await checkPriorPublicationAtProposal("),
    at("await recordActionRequest("),
  ];
  assert.deepEqual([...order].sort((x, y) => x - y), order, "readiness is verified before derivation, and derivation before prepare/record");
}

/* 4 · Execution ordering in the Instagram half. */
{
  const code = codeOnly(read(EXECUTOR));
  const half = code.slice(code.indexOf("async function executeInstagramPublish"), code.indexOf("const ADAPTER_ID_FOR_EMAIL"));
  const at = (needle: string, from = 0) => {
    const i = half.indexOf(needle, from);
    assert.ok(i > 0, `executor contains ${needle}`);
    return i;
  };
  const resolve = at("await resolvePublishTarget(db,");
  const pre = at("await instagramPackageVerdictFor(db, tenant, payload)");
  const spend = at("await consumeActionPermit(");
  const reach = at("await resolveExternalSendReachability(");
  const post = at("await instagramPackageVerdictFor(db, tenant, payload)", pre + 1);
  const grant = at("readPublishDerivative(");
  const meta = at("await withToken(");
  assert.ok(resolve < pre && pre < spend, "pre-flight readiness precedes the spend");
  assert.ok(spend < reach && reach < post && post < grant && grant < meta, "post-commit readiness after the arming re-read, before the grant and Meta");
  assert.equal((half.match(/instagramPackageVerdictFor\(db, tenant, payload\)/g) ?? []).length, 2, "exactly two readiness reads");
  /* Readiness is NOT read inside the spend transaction and is not a lock authority. */
  const tx = half.slice(spend, half.indexOf("if (guard.refusal) return refused(guard.refusal);"));
  assert.ok(!/instagramPackageVerdictFor|verifyInstagramPackageReadiness|readContentPackage/.test(tx), "no readiness read inside the spend transaction");
  assert.ok(/refused\(instagramPackagePreflightReason\(pkg\.failure\)\)/.test(half), "pre-flight refusal spends nothing");
  assert.ok(/refuseAfterSpend\(instagramPackageFailureClass\(pkgAgain\.failure\)\)/.test(half), "post-commit refusal closes the attempt refused");
  /* The duplicate guard is untouched: still first in the transaction, still under the revision lock. */
  assert.ok(half.indexOf("guardPublicationWithin(") > spend, "guard stays inside the spend transaction");
}

/* 5 · No persisted enum grew: every post-spend readiness class is an EXISTING ledger enum value. */
{
  const enums = codeOnly(read("src/db/schema/_enums.ts"));
  const block = enums.slice(enums.indexOf('pgEnum("action_execution_failure_class"'));
  const ledger = new Set([...block.slice(0, block.indexOf("]")).matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).slice(1));
  const code = codeOnly(read(EXECUTOR));
  const fn = code.slice(code.indexOf("function instagramPackageFailureClass"), code.indexOf("function publishPreflightReasonFor"));
  const returned = [...fn.matchAll(/return "([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(returned.length >= 3, `post-spend classes found: ${returned}`);
  for (const r of returned) assert.ok(ledger.has(r), `${r} is an existing action_execution_failure_class value`);
}

console.log("PASS instagram-package-readiness-1 authority firewall");
