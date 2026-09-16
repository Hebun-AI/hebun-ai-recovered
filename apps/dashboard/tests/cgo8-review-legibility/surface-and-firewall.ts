/*
 * CGO-8 — review-state legibility on Prepared Work, proved from source and from the pure vocabulary.
 *
 * WHAT THIS PROVES:
 *   1. A row can say exactly four things, and "Awaiting review" requires a ledger that WAS read and
 *      holds no decision for that exact revision. Everything else uncertain is "Review state unknown".
 *   2. The review WRITERS are byte-identical to the released TRH-10 code (pinned by digest), and the
 *      new batched reader writes nothing, imports no artifact writer and never names `currentRevision`.
 *   3. The one new server action is a read that reaches only the batched reader.
 *   4. The surface re-reads the ledger after a decision or a new revision instead of trusting old state.
 *   5. The released wording no longer denies that review exists, no longer says no provider is
 *      connected, distinguishes a destination from a connection, and still says review authorizes no
 *      publishing, sending or execution.
 *   6. Nothing here reaches Social Intelligence, /approvals, a provider, a schema or a new subject.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ARTIFACT_REVIEW_ACCEPT_NON_EFFECTS,
  ARTIFACT_REVIEW_PUBLICATION_NOTICE,
  ARTIFACT_REVIEW_SUBJECT_TYPE,
  ARTIFACT_ROW_REVIEW_LABELS,
  artifactRowReviewStatus,
  type ArtifactCurrentReviewStates,
  type ArtifactRevisionReviewState,
} from "../../src/features/work-artifact-review/contracts";
import {
  CONTENT_DESTINATION_NON_CLAIMS,
  WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS,
} from "../../src/features/work-artifacts/contracts";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const REVIEW = "src/features/work-artifact-review/review-revision.server.ts";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const SECTION = "src/components/operations-preparation/prepared-work-section.tsx";
const PREPARATION = "src/components/operations-preparation/operations-preparation.tsx";
const CONTROL = "src/components/operations-preparation/artifact-revision-review.tsx";

/** The digest of the released TRH-10 writer region at `0accb2f7`, recomputed here from source. */
const RELEASED_REVIEW_WRITER_DIGEST = "41c678efa364e7fd1f91553264f3adc4d2f6c3eb47aa969a8a57c3f729368d30";

const stateOf = (over: Partial<ArtifactRevisionReviewState>): ArtifactRevisionReviewState => ({
  revisionId: "r1",
  revisionNo: 1,
  decision: null,
  decidedAt: null,
  decisionId: null,
  decisionCount: 0,
  ...over,
});
const readWith = (states: Record<string, ArtifactRevisionReviewState>): ArtifactCurrentReviewStates => ({
  status: "read",
  states,
});

function fourClosedAnswers(): void {
  assert.deepEqual(ARTIFACT_ROW_REVIEW_LABELS, {
    "awaiting-review": "Awaiting review",
    "changes-requested": "Changes requested",
    accepted: "Accepted for next internal step",
    unknown: "Review state unknown",
  });

  assert.equal(artifactRowReviewStatus(readWith({ a: stateOf({}) }), "a"), "awaiting-review");
  assert.equal(
    artifactRowReviewStatus(readWith({ a: stateOf({ decision: "accepted", decisionCount: 1 }) }), "a"),
    "accepted",
  );
  assert.equal(
    artifactRowReviewStatus(readWith({ a: stateOf({ decision: "changes-requested", decisionCount: 3 }) }), "a"),
    "changes-requested",
  );
  /* UNCERTAINTY IS NEVER "AWAITING" AND NEVER "ACCEPTED". */
  assert.equal(artifactRowReviewStatus({ status: "unavailable" }, "a"), "unknown", "unreadable ledger");
  assert.equal(artifactRowReviewStatus(readWith({}), "a"), "unknown", "revision did not resolve");
  assert.equal(
    artifactRowReviewStatus(readWith({ a: stateOf({ decision: null, decisionCount: 1 }) }), "a"),
    "unknown",
    "a decision this vocabulary does not recognise is not 'awaiting review'",
  );
}

function writersUnchangedAndReaderWritesNothing(): void {
  const source = read(REVIEW);
  const start = source.indexOf("async function review(");
  const end = source.indexOf("/**\n * The DERIVED review state of the revisions of one artifact");
  assert.ok(start > 0 && end > start, "the writer region is present to pin");
  assert.equal(
    createHash("sha256").update(source.slice(start, end)).digest("hex"),
    RELEASED_REVIEW_WRITER_DIGEST,
    "acceptArtifactRevision / requestArtifactRevisionChanges and their transaction are byte-identical to TRH-10",
  );

  const code = codeOf(source);
  const batched = code.slice(code.indexOf("export async function readCurrentRevisionReviewStates"));
  assert.ok(batched.length > 100, "the batched reader is present to examine");
  for (const forbidden of [
    ".insert(", ".update(", ".delete(", ".transaction(", "writeGovernanceDecisionWithin",
    "recordGovernanceEventWithin", "createWorkArtifact", "reviseWorkArtifact", "retireWorkArtifact",
  ]) {
    assert.ok(!batched.includes(forbidden), `the batched reader does not reach ${forbidden}`);
  }
  assert.ok(batched.includes("eq(workArtifactRevisions.tenantId, tenant.tenantId)"), "revisions are tenant-scoped");
  assert.ok(batched.includes("eq(decisionRecords.tenantId, tenant.tenantId)"), "decisions are tenant-scoped");
  assert.ok(
    batched.includes("eq(decisionRecords.subjectType, ARTIFACT_REVIEW_SUBJECT_TYPE)"),
    "and scoped to the released review subject",
  );
  assert.ok(batched.includes("deriveReviewStates("), "it uses the one shared derivation");
  assert.ok(!/currentRevision/.test(source), "the review module still never names currentRevision");
  assert.equal(ARTIFACT_REVIEW_SUBJECT_TYPE, "work_artifact_revision", "no new Governance subject");
  assert.ok(!/from "@\/features\/work-artifacts\/write-work-artifacts/.test(source), "no artifact writer import");
}

function theNewActionIsARead(): void {
  const actions = codeOf(read(ACTIONS));
  const from = actions.slice(actions.indexOf("export async function readCurrentRevisionReviewStatesAction"));
  const opened = from.indexOf("> {\n");
  const body = from.slice(opened, from.indexOf("\n}\n", opened) + 2);
  assert.ok(body.includes("readCurrentRevisionReviewStates(tenant, input.artifacts)"));
  for (const forbidden of ["accept", "request", "Changes", "create", "revise", "retire", "revalidatePath", "prepare"]) {
    assert.ok(!body.includes(forbidden), `the CGO-8 action does not reach "${forbidden}"`);
  }
}

function theSurfaceRereadsAndSaysFourThings(): void {
  const section = codeOf(read(SECTION));
  assert.ok(section.includes("ARTIFACT_ROW_REVIEW_LABELS[rowStatus]"), "the row renders the closed label");
  assert.ok(section.includes("artifactRowReviewStatus(rowReview, artifact.id)"), "derived by the contract, not inline");
  assert.ok(
    section.includes("rowState.revisionNo !== artifact.currentRevision"),
    "a state about an earlier revision is not presented as the current revision's",
  );
  assert.ok(section.includes("onDecided={() => rereadReview(artifact.currentRevision)}"), "re-read after a decision");
  assert.ok(section.includes("await rereadReview(result.revisionNo)"), "re-read after a new revision");
  assert.ok(section.includes("readCurrentRevisionReviewStatesAction"), "the re-read uses the ledger, not the click");

  const control = codeOf(read(CONTROL));
  assert.ok(control.includes("await onDecided?.()"), "the review control hands back after a recorded decision");
  assert.ok(control.includes("ARTIFACT_REVIEW_PUBLICATION_NOTICE"), "the publication notice still renders");

  const preparation = codeOf(read(PREPARATION));
  assert.ok(preparation.includes("readCurrentRevisionReviewStatesAction("), "loaded server-side with the listing");
  assert.ok(preparation.includes("reviewStates={reviewStates}"));

  for (const file of [SECTION, PREPARATION, CONTROL, REVIEW]) {
    const code = codeOf(read(file));
    for (const forbidden of [
      "social-intelligence", "/approvals", "heby-action-inlet", "provider-instagram", "provider-youtube",
      "fetch(", "@/db/schema/work-artifact\"", "publish(", "schedule(",
    ]) {
      if (file === REVIEW && forbidden === "@/db/schema/work-artifact\"") continue;
      assert.ok(!code.includes(forbidden), `${file} does not reach ${forbidden}`);
    }
  }
}

function wordingIsTruthful(): void {
  const authorship = WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS.join(" ");
  assert.ok(!/Hebun holds no review/i.test(authorship), "no longer denies that review exists");
  assert.match(authorship, /Governance review of a revision is a separate recorded decision/);
  assert.match(authorship, /no approval to publish, send or execute/);

  const destination = CONTENT_DESTINATION_NON_CLAIMS.join(" ");
  assert.ok(!/No social provider is connectable/i.test(destination), "no longer claims no provider is connectable");
  assert.match(destination, /not a provider connection/);
  assert.match(destination, /a connection does not make a draft publishable/);
  assert.match(destination, /no provider capability that can publish/);

  assert.ok(!/no provider is connected/i.test(ARTIFACT_REVIEW_PUBLICATION_NOTICE));
  assert.match(ARTIFACT_REVIEW_PUBLICATION_NOTICE, /not publication authorization/i);
  assert.ok(ARTIFACT_REVIEW_ACCEPT_NON_EFFECTS.includes("does not authorize publication, sending, or any external act"));

  const review = read(REVIEW);
  assert.ok(
    !review.includes("Only the human established by the tenant's bootstrap decision may review"),
    "the bootstrap-only reviewer comment is corrected",
  );
  assert.match(review, /ACTIVE delegation/);
  assert.ok(codeOf(review).includes("if (!authority.authorized) throw new ReviewAbort"), "the gate itself is unchanged");

  const section = read(SECTION);
  assert.ok(!section.includes("Hebun holds no review or approval state to set"), "the section header no longer denies review");
}

function main(): void {
  fourClosedAnswers();
  writersUnchangedAndReaderWritesNothing();
  theNewActionIsARead();
  theSurfaceRereadsAndSaysFourThings();
  wordingIsTruthful();
  console.log(
    "cgo8-review-legibility/surface-and-firewall: four closed row answers, uncertainty is unknown, review writers " +
      "byte-identical to TRH-10, batched reader tenant-scoped and write-free, one read-only action, re-read after " +
      "decision and revision, truthful wording, no social/approvals/provider/schema reach",
  );
}

main();
