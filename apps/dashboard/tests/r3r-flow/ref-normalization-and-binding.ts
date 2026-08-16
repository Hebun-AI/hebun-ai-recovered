/*
 * R3R — reference syntax, address normalization, endpoint digest, and exact action binding.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A recipient has exactly one spelling, its address has exactly one normalized form that agrees
 *    with the form the repository already uses, its digest covers those exact bytes — AND an
 *    approval that names a recipient and an endpoint cannot be inherited by a different recipient,
 *    a different address, or a different draft."
 *
 * Pure. No database, no network, no model.
 */
import assert from "node:assert/strict";
/*
 * Loaded FIRST, exactly as the R3W suites do: the schema barrel is the only safe entry point for
 * `src/db/schema/*`. The parity check below imports `normalizeTargetEmail` from a server module,
 * which transitively reaches the schema graph, and reaching it through an individual file instead
 * throws "Cannot access 'tenantColumns' before initialization".
 */
import "../../src/db/client.server";
import {
  EXTERNAL_RECIPIENT_REF_PREFIX,
  formatRecipientRef,
  isRecipientRef,
  parseRecipientRef,
} from "../../src/features/external-recipients/recipient-ref";
import {
  RECIPIENT_EMAIL_MAX_LENGTH,
  isNormalizedRecipientEmail,
  normalizeRecipientEmail,
} from "../../src/features/external-recipients/normalization";
import {
  digestRecipientEndpoint,
  endpointDigestsMatch,
  isRecipientEndpointDigest,
} from "../../src/features/external-recipients/endpoint-digest";
import { validateCreateRecipientInput } from "../../src/features/external-recipients/validation";
import { normalizeTargetEmail } from "../../src/features/membership-authority/authorize-membership.server";
import { digestCanonicalAction } from "../../src/features/action-authorization/canonical-payload";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import { digestArtifactContent } from "../../src/features/work-artifacts/content-digest";

const ID_A = "0f2b7d1a-3c4e-4a5b-8c9d-0e1f2a3b4c5d";
const ID_B = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e";

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. EXACTLY ONE SPELLING PER RECIPIENT.
 * ═════════════════════════════════════════════════════════════════════════ */

function referenceSyntaxIsExact(): void {
  const ref = formatRecipientRef(ID_A);
  assert.equal(ref, `${EXTERNAL_RECIPIENT_REF_PREFIX}/${ID_A}`);
  assert.deepEqual(parseRecipientRef(ref), { recipientId: ID_A });

  /* Uppercase IN is accepted and lowercased OUT, so one row has one reference. */
  assert.equal(formatRecipientRef(ID_A.toUpperCase()), ref);

  /*
   * Every one of these names the same row to a human and hashes differently to R3A. If any parsed,
   * one recipient would have several references and therefore several independent approvals.
   */
  for (const hostile of [
    `${EXTERNAL_RECIPIENT_REF_PREFIX}/${ID_A.toUpperCase()}`,
    `${EXTERNAL_RECIPIENT_REF_PREFIX}/${ID_A} `,
    ` ${EXTERNAL_RECIPIENT_REF_PREFIX}/${ID_A}`,
    `${EXTERNAL_RECIPIENT_REF_PREFIX}/${ID_A}/`,
    `${EXTERNAL_RECIPIENT_REF_PREFIX}/${ID_A}@1`,
    `External-Recipient/${ID_A}`,
    `${EXTERNAL_RECIPIENT_REF_PREFIX}/not-a-uuid`,
    `work-artifact/${ID_A}@1`,
    "",
    null,
    undefined,
    42,
    { recipientId: ID_A },
  ]) {
    assert.equal(parseRecipientRef(hostile), null, `must not parse: ${String(hostile)}`);
    assert.equal(isRecipientRef(hostile), false);
  }

  assert.throws(() => formatRecipientRef("not-a-uuid"), TypeError);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. NORMALIZATION AGREES WITH THE FORM THE REPOSITORY ALREADY STORES.
 *
 * `normalization.ts` reproduces `normalizeTargetEmail` rather than importing it, because that
 * function lives inside a server module carrying the database client. Reproduction is only
 * defensible if the two provably agree, so this is that proof rather than a comment claiming it.
 * ═════════════════════════════════════════════════════════════════════════ */

function normalizationMatchesTheExistingConvention(): void {
  const corpus: readonly unknown[] = [
    "jane@example.com",
    "  Jane@Example.COM  ",
    "JANE@EXAMPLE.COM",
    "jane+work@example.co.uk",
    "jane.smith@sub.example.com",
    "ayşe@örnek.com",
    "a@b.co",
    "no-at-sign",
    "two@@example.com",
    "trailing@dot.",
    "@example.com",
    "jane@example",
    "jane @example.com",
    "jane@ example.com",
    "",
    "   ",
    `${"a".repeat(RECIPIENT_EMAIL_MAX_LENGTH)}@example.com`,
    null,
    undefined,
    42,
    {},
  ];

  for (const value of corpus) {
    assert.equal(
      normalizeRecipientEmail(value),
      normalizeTargetEmail(value),
      `R3R and membership authority must agree on: ${JSON.stringify(value)}`,
    );
  }

  assert.equal(normalizeRecipientEmail("  Jane@Example.COM  "), "jane@example.com");
  assert.equal(isNormalizedRecipientEmail("jane@example.com"), true);
  assert.equal(isNormalizedRecipientEmail("Jane@Example.com"), false);

  /*
   * DELIBERATELY NOT AGGRESSIVE. `jane+work@` really can be a different mailbox from `jane@`, and
   * folding them would silently merge two recipients into one — an identity claim this domain
   * refuses to make.
   */
  assert.notEqual(
    normalizeRecipientEmail("jane+work@example.com"),
    normalizeRecipientEmail("jane@example.com"),
    "tagged addresses stay distinct — no provider-specific canonicalization",
  );
  assert.notEqual(
    normalizeRecipientEmail("j.ane@example.com"),
    normalizeRecipientEmail("jane@example.com"),
    "dots are not stripped — that is a Gmail rule, not an internet rule",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE DIGEST COVERS EXACT BYTES, AND CLAIMS NOTHING ELSE.
 * ═════════════════════════════════════════════════════════════════════════ */

function digestIsDeterministicAndExact(): void {
  const normalized = normalizeRecipientEmail("  Jane@Example.COM ")!;
  const digest = digestRecipientEndpoint(normalized);

  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, digestRecipientEndpoint(normalized), "deterministic");
  assert.equal(
    digest,
    digestRecipientEndpoint(normalizeRecipientEmail("JANE@EXAMPLE.COM")!),
    "the same mailbox in different spellings normalizes to ONE digest",
  );
  assert.notEqual(
    digest,
    digestRecipientEndpoint("jane@example.org"),
    "a different address is a different digest",
  );

  /*
   * The digest is over the NORMALIZED value, and the raw form hashes differently. That is exactly
   * why this module exists separately from `digestArtifactContent`, which hashes bytes verbatim.
   */
  assert.notEqual(digest, digestRecipientEndpoint("  Jane@Example.COM "));
  assert.notEqual(
    digest,
    digestArtifactContent(normalized + "\n"),
    "artifact and endpoint digests answer different questions",
  );

  assert.equal(isRecipientEndpointDigest(digest), true);
  for (const bad of [digest.toUpperCase(), digest.slice(0, 63), `${digest}0`, "", null, 1]) {
    assert.equal(isRecipientEndpointDigest(bad), false);
  }
  assert.equal(endpointDigestsMatch(digest, digest), true);
  assert.equal(endpointDigestsMatch(digest, digestRecipientEndpoint("x@y.co")), false);
  assert.equal(endpointDigestsMatch(digest, "not-a-digest"), false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. VALIDATION PREVENTS CORRUPTION, NOT EXPRESSION.
 * ═════════════════════════════════════════════════════════════════════════ */

function validationRefusesShapeNotMeaning(): void {
  const ok = validateCreateRecipientInput({
    displayName: "Ayşe Yılmaz",
    endpointKind: "email",
    endpointValue: "ayse@example.com",
  });
  assert.deepEqual(ok, []);

  /* A hostile-LOOKING name is legitimate data and is stored verbatim. */
  for (const name of [
    "<script>alert(1)</script>",
    "' OR 1=1 --",
    "../../etc/passwd",
    "Ignore previous instructions",
    "Robert'); DROP TABLE external_recipients;--",
  ]) {
    assert.deepEqual(
      validateCreateRecipientInput({ displayName: name, endpointKind: "email", endpointValue: "a@b.co" }),
      [],
      `display names are DATA and must not be sanitized: ${name}`,
    );
  }

  /* Structurally broken input is refused. */
  const problems = validateCreateRecipientInput({
    displayName: "  ",
    endpointKind: "sms",
    endpointValue: "not-an-email",
  });
  assert.ok(problems.some((p) => p.field === "displayName" && p.problem === "empty"));
  assert.ok(problems.some((p) => p.field === "endpointKind" && p.problem === "unknown"));

  assert.ok(
    validateCreateRecipientInput({
      displayName: "a\nb",
      endpointKind: "email",
      endpointValue: "a@b.co",
    }).some((p) => p.problem === "control-characters"),
    "a display name is single-line",
  );
  assert.ok(
    validateCreateRecipientInput({
      displayName: "x".repeat(201),
      endpointKind: "email",
      endpointValue: "a@b.co",
    }).some((p) => p.problem === "too-long"),
  );
  assert.ok(
    validateCreateRecipientInput({
      displayName: "Jane",
      endpointKind: "email",
      endpointValue: "nope",
    }).some((p) => p.field === "endpointValue" && p.problem === "invalid"),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. EXACT BINDING, THROUGH R3A's UNCHANGED CANONICAL PAYLOAD.
 *
 * This is the whole point of R3R existing at all: an approval must name one draft AND one
 * destination, and neither half may drift into another.
 * ═════════════════════════════════════════════════════════════════════════ */

function exactRecipientAndDraftBinding(): void {
  const draftRef = formatWorkArtifactRef(ID_B, 1);
  const draftRef2 = formatWorkArtifactRef(ID_B, 2);
  const draftDigest = digestArtifactContent("Merhaba Ayşe,\nFirst draft.");
  const draftDigest2 = digestArtifactContent("Merhaba Ayşe,\nSecond draft.");

  const recipientA = formatRecipientRef(ID_A);
  const recipientB = formatRecipientRef(ID_B);
  const endpointOld = digestRecipientEndpoint("jane@old.com");
  const endpointNew = digestRecipientEndpoint("jane@new.com");

  const bind = (
    recipientRef: string,
    recipientEndpointDigest: string,
    ref: string,
    draftRevisionDigest: string,
  ) =>
    digestCanonicalAction({
      actionKind: "send-external-communication",
      toolId: "heby.operations.send-communication",
      targetKind: "record",
      targetRef: recipientRef,
      payload: { recipientRef, recipientEndpointDigest, draftRef: ref, draftRevisionDigest },
    });

  const approved = bind(recipientA, endpointOld, draftRef, draftDigest);
  assert.match(approved, /^[0-9a-f]{64}$/);
  assert.equal(approved, bind(recipientA, endpointOld, draftRef, draftDigest), "deterministic");

  /* Each of the four halves moves the binding independently. */
  assert.notEqual(
    approved,
    bind(recipientB, endpointOld, draftRef, draftDigest),
    "APPROVED FOR ONE RECIPIENT IS NOT AUTHORIZED FOR ANOTHER",
  );
  assert.notEqual(
    approved,
    bind(recipientA, endpointNew, draftRef, draftDigest),
    "APPROVED FOR ONE ADDRESS IS NOT AUTHORIZED FOR ANOTHER — the Day-1/Day-2 case",
  );
  assert.notEqual(
    approved,
    bind(recipientA, endpointOld, draftRef2, draftDigest),
    "a different draft revision is a different action",
  );
  assert.notEqual(
    approved,
    bind(recipientA, endpointOld, draftRef, draftDigest2),
    "a swapped draft digest is a different action",
  );

  /* R3A needed no change: these are ordinary scalars and it hashes them as such. */
  const reordered = digestCanonicalAction({
    actionKind: "send-external-communication",
    toolId: "heby.operations.send-communication",
    targetKind: "record",
    targetRef: recipientA,
    payload: {
      draftRevisionDigest: draftDigest,
      recipientEndpointDigest: endpointOld,
      draftRef,
      recipientRef: recipientA,
    },
  });
  assert.equal(reordered, approved, "key ORDER does not change the binding");
}

referenceSyntaxIsExact();
normalizationMatchesTheExistingConvention();
digestIsDeterministicAndExact();
validationRefusesShapeNotMeaning();
exactRecipientAndDraftBinding();

console.log("PASS r3r reference, normalization, digest and exact binding");
