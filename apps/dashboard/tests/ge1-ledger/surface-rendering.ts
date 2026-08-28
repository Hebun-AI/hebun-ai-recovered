/*
 * GOVERNED-EXECUTION-1 — WHAT A DIRECTOR ACTUALLY READS.
 *
 * The firewall proves the ledger cannot ACT. This proves what it SAYS, by rendering it and reading
 * the sentences back — because a wording constant pinned in a test is only half the guarantee. The
 * other half is that the surface renders it, in the right state, next to the right row.
 *
 * ── WHY ASSERTIONS ARE OVER STRIPPED TEXT ────────────────────────────────────
 *
 * Tags are removed before asserting, so every claim below is about a sentence a person reads, not
 * about markup that happens to contain a word. A guard that matched class names would pass on a
 * page that said the opposite.
 *
 * Pure. Renders one component. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExecutionLedger } from "../../src/components/decision-workspace/execution-ledger";
import type { ExecutionLedgerEntry } from "../../src/features/action-execution/execution-ledger-projection.server";

/** What a person actually reads. Tags stripped so assertions are about sentences, not markup. */
const visible = (markup: string): string =>
  markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const entry = (over: Partial<ExecutionLedgerEntry> = {}): ExecutionLedgerEntry => ({
  attemptId: "11111111-1111-4111-8111-111111111111",
  permitId: "22222222-2222-4222-8222-222222222222",
  requestId: "33333333-3333-4333-8333-333333333333",
  actionKind: "send-external-communication",
  adapterId: "resend-email-v1",
  status: "accepted",
  providerResponseClass: "accepted",
  providerMessageId: "provider-msg-1",
  failureClass: null,
  startedAt: new Date(1_700_000_000_000).toISOString(),
  completedAt: new Date(1_700_000_001_000).toISOString(),
  requiresAttention: false,
  ...over,
});

const render = (
  entries: readonly ExecutionLedgerEntry[],
  needsAttention: readonly ExecutionLedgerEntry[],
  connected = true,
): string =>
  visible(renderToStaticMarkup(createElement(ExecutionLedger, { entries, needsAttention, connected })));

const rawMarkup = (
  entries: readonly ExecutionLedgerEntry[],
  needsAttention: readonly ExecutionLedgerEntry[],
): string =>
  renderToStaticMarkup(createElement(ExecutionLedger, { entries, needsAttention, connected: true }));

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. UNREADABLE IS NOT EMPTY, AND EMPTY IS NOT UNREADABLE
 * ────────────────────────────────────────────────────────────────────────── */
function threeStatesStayThree(): void {
  const unavailable = render([], [], false);
  assert.ok(
    unavailable.includes("The execution ledger could not be read"),
    "an unreadable ledger says so",
  );
  assert.ok(
    unavailable.includes("An unreadable ledger is not an empty one"),
    "and refuses to be read as an empty history",
  );
  assert.ok(unavailable.includes("Not connected"), "and is labelled not connected");
  assert.ok(
    !unavailable.includes("needing attention"),
    "an unreadable ledger renders no count — a count would be a claim it cannot make",
  );

  const empty = render([], []);
  assert.ok(
    empty.includes("No execution attempt has been recorded"),
    "a readable empty ledger states a fact about the organization",
  );
  assert.ok(empty.includes("0 needing attention"), "and states the count it actually read");
  assert.ok(
    !empty.includes("could not be read"),
    "a successful read is never rendered as a failed one",
  );
  assert.ok(
    empty.includes("No recorded attempt is missing a confirmed outcome"),
    "and the attention list says it is empty rather than disappearing",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. AN AMBIGUOUS OUTCOME IS THE LOUDEST THING ON THE SURFACE
 *
 * `unknown` is the one state a human can make worse by acting on the obvious reading.
 * ────────────────────────────────────────────────────────────────────────── */
function unknownIsNotFailedAndNotSafe(): void {
  const unknown = entry({
    status: "unknown",
    providerResponseClass: "ambiguous",
    providerMessageId: null,
    completedAt: new Date(1_700_000_002_000).toISOString(),
    requiresAttention: true,
  });
  const markup = render([unknown], [unknown]);

  assert.ok(markup.includes("1 needing attention"), "it is counted for the Director");
  assert.ok(
    markup.includes("The external effect may already have happened"),
    "the surface states the effect may already have occurred",
  );
  assert.ok(
    markup.includes("the answer was lost"),
    "and that the answer, not the request, is what went missing",
  );
  assert.ok(markup.includes("Do not retry blindly"), "and tells the human not to retry");

  /* UNKNOWN != FAILED. */
  assert.ok(
    !markup.includes("Failed — nothing was sent"),
    "an ambiguous outcome is never rendered as a clean failure",
  );

  /* UNKNOWN != SAFE-TO-RETRY, and no machine is doing anything about it either. */
  assert.ok(
    markup.includes("no automatic retry, no replay and no reconciliation"),
    "the three absent capabilities are named",
  );
  assert.ok(
    markup.includes("this surface offers no control"),
    "and the surface says it offers none",
  );
  assert.ok(
    markup.includes("requires a new proposal, a new Governance decision and a new permit"),
    "a second send is stated as a second authorization",
  );
  for (const forbidden of ["safe to retry", "try again", "Retry", "Replay", "Reconcile"]) {
    assert.ok(!markup.includes(forbidden), `the surface must never say "${forbidden}"`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. ACCEPTED IS NOT SENT AND NOT DELIVERED
 * ────────────────────────────────────────────────────────────────────────── */
function acceptedNeverBecomesDelivered(): void {
  const markup = render([entry()], []);

  assert.ok(markup.includes("Accepted by the provider"), "the claim is the provider's, not Hebun's");
  assert.ok(
    markup.includes("Provider message id: provider-msg-1"),
    "and it appears beside the only evidence for it",
  );

  /* The non-claims travel with the acceptance, every time. */
  for (const nonClaim of [
    "Accepted does not mean the message was delivered",
    "Accepted does not mean the recipient received it",
    "Accepted does not mean the recipient read it",
    "Accepted does not mean the address is valid or owned by anyone",
  ]) {
    assert.ok(markup.includes(nonClaim), `the surface must render "${nonClaim}"`);
  }

  for (const forbidden of ["Delivered", "was sent successfully", "Message sent", "Successfully sent"]) {
    assert.ok(!markup.includes(forbidden), `the surface must never render "${forbidden}"`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. PENDING IS NOT SUCCESS — AND SURVIVING A RELOAD IS THE WHOLE POINT
 * ────────────────────────────────────────────────────────────────────────── */
function pendingIsAnAbsentAnswer(): void {
  const pending = entry({
    status: "pending",
    providerResponseClass: null,
    providerMessageId: null,
    completedAt: null,
    requiresAttention: true,
  });
  const markup = render([pending], [pending]);

  assert.ok(
    markup.includes("No outcome was ever recorded for this attempt"),
    "a pending row explains why it looks the way it does",
  );
  assert.ok(
    markup.includes("not a provider success") && markup.includes("not a provider failure"),
    "and is claimed as neither",
  );
  assert.ok(!markup.includes("Accepted by the provider"), "and carries no acceptance");
  assert.ok(!markup.includes("concluded"), "an unconcluded attempt shows no conclusion time");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. A REFUSAL SAYS NOTHING LEFT THE PROCESS
 * ────────────────────────────────────────────────────────────────────────── */
function refusedIsHonestAboutItsReason(): void {
  const markup = render(
    [
      entry({
        status: "refused",
        providerResponseClass: null,
        providerMessageId: null,
        failureClass: "credential-unavailable",
        requiresAttention: false,
      }),
    ],
    [],
  );
  assert.ok(markup.includes("Refused before anything was sent"), "a refusal says nothing was sent");
  assert.ok(
    markup.includes("Recorded reason: credential-unavailable"),
    "and names the durable reason rather than a generic failure",
  );
  assert.ok(markup.includes("0 needing attention"), "a refusal needs no reconciliation");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. THE RENDERED SURFACE CONTAINS NO CONTROL AT ALL
 *
 * Asserted over RAW markup, not stripped text: a control is an element, and stripping tags is
 * exactly what would hide one.
 * ────────────────────────────────────────────────────────────────────────── */
function theRenderedSurfaceOffersNothing(): void {
  const unknown = entry({ status: "unknown", providerMessageId: null, requiresAttention: true });
  const markup = rawMarkup([unknown, entry()], [unknown]);

  for (const control of ["<button", "<form", "<input", "<select", "<textarea", "onclick", "href="]) {
    assert.ok(
      !markup.toLowerCase().includes(control),
      `the ledger rendered "${control}" — it is a report and must offer no control`,
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 7. AN AMBIGUOUS ATTEMPT IS SHOWN TWICE, AND A SETTLED ONE ONCE
 *
 * The two lists come from two reads (see the projection header), so an attempt needing attention
 * appears both in the attention list and in the history. That repetition is deliberate: the
 * history is the record, and the attention list is what a human must not scroll past.
 * ────────────────────────────────────────────────────────────────────────── */
function bothListsRenderTheSameAttempt(): void {
  const unknown = entry({
    attemptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "unknown",
    providerMessageId: null,
    requiresAttention: true,
  });
  const accepted = entry({ attemptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
  const markup = render([unknown, accepted], [unknown]);

  assert.ok(markup.includes("1 needing attention"), "the count is the attention subset");
  /* Both rows appear in the history; the ambiguous one appears twice, deliberately. */
  assert.equal(
    markup.split("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa").length - 1,
    2,
    "the ambiguous attempt appears in both the attention lens and the full history",
  );
  assert.equal(
    markup.split("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb").length - 1,
    1,
    "and a settled attempt appears only in the history",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8. A BOUNDED LIST SAYS SO — AND AN UNBOUNDED ONE DOES NOT PRETEND
 *
 * The dangerous direction is silence: a truncated ledger that reads as the whole record would be
 * an irreversible act nobody was shown.
 * ────────────────────────────────────────────────────────────────────────── */
function truncationIsDisclosed(): void {
  const unknown = entry({ status: "unknown", providerMessageId: null, requiresAttention: true });

  const quiet = visible(
    renderToStaticMarkup(
      createElement(ExecutionLedger, {
        entries: [entry()],
        needsAttention: [],
        connected: true,
      }),
    ),
  );
  assert.ok(
    !quiet.includes("Older attempts exist"),
    "a complete list makes no truncation claim",
  );

  const truncated = visible(
    renderToStaticMarkup(
      createElement(ExecutionLedger, {
        entries: [entry()],
        needsAttention: [unknown],
        connected: true,
        historyTruncated: true,
        attentionTruncated: true,
      }),
    ),
  );
  assert.ok(
    truncated.includes("Older attempts exist and are not shown"),
    "a bounded history says it is bounded",
  );
  assert.ok(
    truncated.includes("a bounded list is not the whole record"),
    "and says what that means",
  );
  assert.ok(
    truncated.includes("More attempts are missing a confirmed outcome than are shown here"),
    "a bounded attention list says the same, in the words that matter most",
  );
  assert.ok(
    truncated.includes("Every one of them still needs a human"),
    "and does not let the unshown ones read as handled",
  );
}

function main(): void {
  threeStatesStayThree();
  unknownIsNotFailedAndNotSafe();
  acceptedNeverBecomesDelivered();
  pendingIsAnAbsentAnswer();
  refusedIsHonestAboutItsReason();
  theRenderedSurfaceOffersNothing();
  bothListsRenderTheSameAttempt();
  truncationIsDisclosed();

  console.log("ge1-ledger/surface-rendering: OK");
}

main();
