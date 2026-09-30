/*
 * tests/content-publication-duplicate-guard-1/policy-contract-firewall.ts — the pure policy, the
 * V1 identity, the acknowledgement contract, and the import boundary of the guard.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  PUBLICATION_GUARD_REFUSALS,
  evaluatePublicationGuard,
  type PublicationHistoryEntry,
  type PublicationIdentity,
} from "../../src/features/action-authorization/content-publication-state";
import { asPublishInstagramMediaPayload } from "../../src/features/instagram-publishing/contracts";
import { asPublishYouTubeVideoPayload } from "../../src/features/youtube-publishing/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const REV = "work-artifact/bd3ab228-61c2-4b42-a2a9-82bd23e8eae1@2";
const CH = "UC5Yf5U_YOKR0K38tWF82kjA";
const YT: PublicationIdentity = { actionKind: "publish-youtube-video", destinationAccountId: CH, artifactRef: REV };
let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function e(stage: PublicationHistoryEntry["stage"], over: Partial<PublicationHistoryEntry> & { at?: string } = {}): PublicationHistoryEntry {
  const attemptStatus = stage.startsWith("execution-") ? (stage.slice("execution-".length) as "accepted") : null;
  return {
    requestId: id(),
    actionKind: "publish-youtube-video",
    destination: "youtube",
    destinationAccountId: CH,
    acknowledgesPriorAttemptId: null,
    payloadDigest: "d".repeat(64),
    requestStatus: stage === "request-pending" ? "pending" : stage === "request-rejected" ? "rejected" : "approved",
    proposedAt: over.at ?? "2026-09-28T10:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    permit: null,
    attempt: attemptStatus
      ? { attemptId: id(), status: attemptStatus, providerResponseClass: null, providerResultId: null, failureClass: null, startedAt: over.at ?? "2026-09-28T10:00:00.000Z", completedAt: null }
      : null,
    stage,
    ...over,
  };
}
const P = { at: "proposal" } as const;

function main(): void {
  /* ══ 1 · policy table ══ */
  assert.deepEqual(evaluatePublicationGuard([], YT, null, P), { status: "clear", latestConsequentialAttemptId: null }, "no history");
  for (const s of ["request-pending", "permit-active", "execution-pending", "permit-consumed-without-attempt"] as const) {
    assert.equal((evaluatePublicationGuard([e(s)], YT, null, P) as { reason?: string }).reason, "publication-in-flight", s);
  }
  for (const s of ["request-rejected", "request-withdrawn", "permit-expired", "permit-revoked", "execution-failed", "execution-refused"] as const) {
    assert.equal(evaluatePublicationGuard([e(s)], YT, null, P).status, "clear", `${s} establishes no publication`);
  }
  const acc = e("execution-accepted", { at: "2026-09-28T10:00:00.000Z" });
  const unk = e("execution-unknown", { at: "2026-09-28T11:00:00.000Z" });
  const fail = e("execution-failed", { at: "2026-09-28T12:00:00.000Z" });
  assert.deepEqual(evaluatePublicationGuard([acc], YT, null, P), { status: "refused", reason: "prior-publication-unacknowledged", latestConsequentialAttemptId: acc.attempt!.attemptId });
  assert.deepEqual(evaluatePublicationGuard([acc], YT, acc.attempt!.attemptId, P), { status: "clear", latestConsequentialAttemptId: acc.attempt!.attemptId });
  /* accepted → unknown → failed: the unknown is the latest consequential; the accepted is stale */
  const h = [acc, unk, fail];
  assert.equal((evaluatePublicationGuard(h, YT, null, P) as { reason: string }).reason, "prior-publication-unacknowledged");
  assert.equal(evaluatePublicationGuard(h, YT, null, P).latestConsequentialAttemptId, unk.attempt!.attemptId, "unknown is never read as failed");
  assert.equal((evaluatePublicationGuard(h, YT, acc.attempt!.attemptId, P) as { reason: string }).reason, "prior-publication-acknowledgement-stale");
  assert.equal((evaluatePublicationGuard(h, YT, fail.attempt!.attemptId, P) as { reason: string }).reason, "prior-publication-acknowledgement-mismatch");
  assert.equal(evaluatePublicationGuard(h, YT, unk.attempt!.attemptId, P).status, "clear");
  /* ordering is by the ATTEMPT's start, not the order rows arrive in */
  assert.equal(evaluatePublicationGuard([unk, acc, fail], YT, null, P).latestConsequentialAttemptId, unk.attempt!.attemptId);
  /* an acknowledgement supplied when none is required is validated, not ignored */
  assert.equal((evaluatePublicationGuard([fail], YT, id(), P) as { reason: string }).reason, "prior-publication-acknowledgement-mismatch");
  /* a harmless LATER request does not hide an earlier accepted attempt */
  assert.equal((evaluatePublicationGuard([acc, e("request-rejected", { at: "2026-09-29T00:00:00.000Z" })], YT, null, P) as { reason: string }).reason, "prior-publication-unacknowledged");

  /* ══ 2 · V1 identity: kind + account + (the reader's) tenant and exact revision ══ */
  const otherChannel = { ...acc, destinationAccountId: "UCqTzRYJBwFsITzxFuqx6YQw" };
  const instagram = { ...acc, actionKind: "publish-instagram-media" as const, destination: "instagram" as const, destinationAccountId: CH };
  const unbound = { ...acc, destinationAccountId: null };
  for (const other of [otherChannel, instagram, unbound]) {
    assert.equal(evaluatePublicationGuard([other], YT, null, P).status, "clear", "another channel, another destination, or no bound account is another identity");
  }
  assert.equal((evaluatePublicationGuard([otherChannel], YT, otherChannel.attempt!.attemptId, P) as { reason: string }).reason, "prior-publication-acknowledgement-mismatch", "an attempt of another identity cannot be acknowledged");
  const IG: PublicationIdentity = { actionKind: "publish-instagram-media", destinationAccountId: "28295264780115792", artifactRef: REV };
  const igAcc = { ...acc, actionKind: "publish-instagram-media" as const, destination: "instagram" as const, destinationAccountId: "28295264780115792" };
  assert.equal((evaluatePublicationGuard([igAcc], IG, null, P) as { reason: string }).reason, "prior-publication-unacknowledged");
  assert.equal(evaluatePublicationGuard([igAcc], { ...IG, destinationAccountId: "99999999999999999" }, null, P).status, "clear", "Instagram account B is not blocked by account A");

  /* ══ 3 · execution phase: the executing request is not in flight against itself; a started attempt is ══ */
  const executing = e("permit-consumed-without-attempt");
  assert.equal(evaluatePublicationGuard([executing], YT, null, { at: "execution", executingRequestId: executing.requestId }).status, "clear");
  assert.equal((evaluatePublicationGuard([executing, e("execution-pending")], YT, null, { at: "execution", executingRequestId: executing.requestId }) as { reason: string }).reason, "publication-in-flight");
  assert.equal(evaluatePublicationGuard([executing, e("permit-active")], YT, null, { at: "execution", executingRequestId: executing.requestId }).status, "clear", "another unused permit is checked when IT executes");
  /* an IDENTICAL pending request keeps the writer's released `already-pending` answer; a different one is in flight */
  const pending = e("request-pending", { payloadDigest: "a".repeat(64) });
  assert.equal(evaluatePublicationGuard([pending], YT, null, { at: "proposal", proposedPayloadDigest: "a".repeat(64) }).status, "clear");
  assert.equal((evaluatePublicationGuard([pending], YT, null, { at: "proposal", proposedPayloadDigest: "b".repeat(64) }) as { reason: string }).reason, "publication-in-flight");
  assert.equal((evaluatePublicationGuard([{ ...pending, stage: "permit-active" }], YT, null, { at: "proposal", proposedPayloadDigest: "a".repeat(64) }) as { reason: string }).reason, "publication-in-flight", "only a PENDING twin is left to the writer");
  assert.deepEqual([...PUBLICATION_GUARD_REFUSALS], ["publication-in-flight", "prior-publication-unacknowledged", "prior-publication-acknowledgement-stale", "prior-publication-acknowledgement-mismatch"]);

  /* ══ 4 · acknowledgement contract: optional, exact key set otherwise, UUID only ══ */
  const ig = {
    integrationId: "11111111-1111-4111-8111-111111111111", externalAccountId: "28295264780115792", draftRef: REV,
    draftRevisionDigest: "a".repeat(64), mediaAssetRef: "22222222-2222-4222-8222-222222222222", mediaAssetDigest: "b".repeat(64),
    publishAssetRef: "33333333-3333-4333-8333-333333333333", publishAssetDigest: "c".repeat(64),
  };
  const ack = "44444444-4444-4444-8444-444444444444";
  assert.equal(asPublishInstagramMediaPayload(ig)?.acknowledgesPriorAttemptId, undefined, "legacy payloads still parse, unchanged");
  assert.equal(asPublishInstagramMediaPayload({ ...ig, acknowledgesPriorAttemptId: ack })?.acknowledgesPriorAttemptId, ack);
  assert.equal(asPublishInstagramMediaPayload({ ...ig, acknowledgesPriorAttemptId: "nope" }), null);
  assert.equal(asPublishInstagramMediaPayload({ ...ig, somethingElse: ack }), null, "any other extra key is still refused");
  const yt = {
    integrationId: ig.integrationId, externalAccountId: "117622225072141590877", expectedChannelId: CH, channelTitle: "TRH", draftRef: REV,
    draftRevisionDigest: "a".repeat(64), videoAssetRef: ig.mediaAssetRef, videoAssetDigest: "b".repeat(64), title: "T", description: "D",
    privacyStatus: "private", categoryId: "22", selfDeclaredMadeForKids: false, containsSyntheticMedia: true,
  };
  assert.ok(asPublishYouTubeVideoPayload(yt));
  assert.equal(asPublishYouTubeVideoPayload({ ...yt, acknowledgesPriorAttemptId: ack })?.acknowledgesPriorAttemptId, ack);
  assert.equal(asPublishYouTubeVideoPayload({ ...yt, acknowledgesPriorAttemptId: 7 }), null);
  assert.equal(asPublishYouTubeVideoPayload({ ...yt, extra: 1 }), null);

  /* ══ 5 · boundary: where the guard runs, and what it can reach ══ */
  const exec = codeOf(read("src/features/action-execution/execute-authorized-action.server.ts"));
  const guardFn = exec.slice(exec.indexOf("async function guardPublicationWithin"), exec.indexOf("async function executeInstagramPublish"));
  assert.match(guardFn, /\.for\("update"\)/, "the revision row is locked");
  assert.match(guardFn, /eq\(workArtifactRevisions\.tenantId, tenantId\)/, "tenant-predicated lock");
  assert.ok(guardFn.indexOf('.for("update")') < guardFn.indexOf("readRevisionPublicationHistory(tx"), "history is read AFTER the lock, on the transaction");
  assert.match(guardFn, /\{ limit: null \}/, "the guard reads the WHOLE history");
  for (const half of ["executeInstagramPublish", "executeYouTubePublish"]) {
    const body = exec.slice(exec.indexOf(`async function ${half}`));
    const cb = body.slice(body.indexOf("onAuthorizedWithin"));
    assert.ok(cb.indexOf("guardPublicationWithin(") < cb.indexOf(".insert(actionExecutionAttempts)"), `${half}: the guard runs before the attempt row`);
    assert.match(cb, /if \(guard\.refusal\) throw new Error\("publication-guard-refused"\);/, `${half}: a refusal rolls the spend back`);
  }
  assert.match(exec, /destinationAccountId: payload\.externalAccountId,\s*artifactRef: payload\.draftRef/, "Instagram identity: bound account + revision");
  assert.match(exec, /destinationAccountId: payload\.expectedChannelId,\s*artifactRef: payload\.draftRef/, "YouTube identity: bound channel + revision");
  assert.doesNotMatch(exec, /pg_advisory/, "no second locking convention");

  const inlet = "src/features/heby-action-inlet/prior-publication.server.ts";
  const ic = codeOf(read(inlet));
  for (const verb of [".insert(", ".update(", ".delete(", ".transaction("]) assert.equal(ic.includes(verb), false, `early check must not ${verb}`);
  assert.deepEqual([...ic.matchAll(/^import\s+(?!type)[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]).sort(), [
    "@/features/action-authorization/canonical-payload",
    "@/features/action-authorization/content-publication-state",
    "@/features/action-authorization/content-publication-state.server",
    "@/features/governance-decision/persistence.server",
  ]);
  /* the pure policy imports only two constants files */
  const pure = codeOf(read("src/features/action-authorization/content-publication-state.ts"));
  assert.deepEqual([...pure.matchAll(/^import\s+(?!type)[^;]*from\s+"([^"]+)"/gm)].map((m) => m[1]).sort(), [
    "@/features/instagram-publishing/contracts",
    "@/features/youtube-publishing/contracts",
  ]);
  /* no cross-revision fingerprint (Director decision 1) */
  assert.doesNotMatch(pure.slice(pure.indexOf("export function evaluatePublicationGuard")), /draftRevisionDigest|mediaAssetDigest|videoAssetDigest/);
  /* Heby gains nothing: no Heby module reaches the guard or the inlet check */
  for (const f of ["src/features/content-composition/heby-content-media-source.server.ts", "src/features/heby-answer/model-answer.server.ts"]) {
    assert.doesNotMatch(read(f), /prior-publication\.server|guardPublicationWithin|evaluatePublicationGuard/, f);
  }
  assert.ok(existsSync(path.join(ROOT, inlet)) && statSync(path.join(ROOT, inlet)).isFile());

  console.log("PASS content-publication-duplicate-guard-1 policy, identity, contract, boundary");
}

main();
