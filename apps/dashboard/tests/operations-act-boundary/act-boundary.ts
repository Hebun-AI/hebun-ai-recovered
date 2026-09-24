import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACT_STAGES,
  buildActBoundaryModel,
  type ActBoundaryInput,
} from "../../src/features/operations-act-boundary/model";

/*
 * Operations Band 2 — the act boundary.
 *
 * The band's whole claim is that it ORIGINATES NOTHING: every value is a count of rows a released
 * authority produced, or a state it resolved. These checks hold it to that, and to keeping the
 * five words apart rather than collapsing them into "ready".
 */

type Arming = ActBoundaryInput["arming"];

/* A reachable deployment+organization. Only the fields the model reads are meaningful. */
function armed(overrides: Partial<Arming> = {}): Arming {
  return {
    providerLabel: "Resend",
    providerKey: "resend",
    providerEndpoint: "https://api.resend.com/emails",
    adapterId: "resend-email",
    directorEnabled: true,
    directorControl: "enabled",
    credential: "present",
    sender: "configured",
    subject: "configured",
    configuration: "configured",
    armingState: "armed",
    tenantArming: "armed",
    effectiveSend: "reachable",
    senderDomainVerification: "not-established-by-hebun",
    connectivity: "not-recorded",
    lastSend: null,
    ...overrides,
  } as Arming;
}

function attempt(status: string) {
  return {
    attemptId: `a-${status}-${Math.random()}`,
    permitId: "p",
    handoffId: "h",
    requestId: "r",
    actionKind: "send",
    adapterId: "resend-email",
    status,
    providerResponseClass: null,
    providerMessageId: null,
    failureClass: null,
    recipientId: "rec",
    startedAt: new Date(0).toISOString(),
    completedAt: null,
  };
}

function stagesAreOrderedAndComplete(): void {
  const model = buildActBoundaryModel({
    arming: armed(),
    attempts: { status: "read", items: [] } as ActBoundaryInput["attempts"],
  });
  assert.deepEqual(
    model.stages.map((s) => s.stage),
    [...ACT_STAGES],
    "the five words are kept apart, in order",
  );
  for (const stage of model.stages) {
    assert.ok(stage.question.length > 0, `${stage.stage} explains what it means`);
    assert.ok(stage.provenance.length > 0, `${stage.stage} names where its answer came from`);
  }
}

/*
 * The two stages this band deliberately declines to answer. If either ever becomes `observed`,
 * a second count of something another authority already owns has been introduced.
 */
function preparedAndAuthorizedAreNotCountedHere(): void {
  const model = buildActBoundaryModel({
    arming: armed(),
    attempts: { status: "read", items: [] } as ActBoundaryInput["attempts"],
  });
  const byStage = (s: string) => model.stages.find((x) => x.stage === s);
  assert.equal(byStage("prepared")?.evidence, "not-surfaced-here");
  assert.equal(byStage("authorized")?.evidence, "not-surfaced-here");
}

function talliesAreCountsOfRealRows(): void {
  const items = [
    attempt("accepted"),
    attempt("accepted"),
    attempt("refused"),
    attempt("failed"),
    attempt("pending"),
    attempt("unknown"),
  ];
  const model = buildActBoundaryModel({
    arming: armed(),
    attempts: { status: "read", items } as unknown as ActBoundaryInput["attempts"],
  });
  assert.ok(model.attempts, "a readable ledger yields a tally");
  assert.equal(model.attempts?.total, 6);
  assert.equal(model.attempts?.accepted, 2);
  assert.equal(model.attempts?.refused, 1);
  assert.equal(model.attempts?.failed, 1);
  assert.equal(model.attempts?.unreconciled, 2, "pending + unknown need a human");
  const byStage = (s: string) => model.stages.find((x) => x.stage === s);
  assert.equal(byStage("executed")?.value, "6", "executed is the attempt count, not an outcome");
  assert.equal(byStage("successful")?.value, "2", "successful is the accepted count");
  assert.match(
    byStage("successful")?.caveat ?? "",
    /not delivery/i,
    "acceptance is never upgraded into delivery",
  );
}

/* An unreadable ledger is not an empty one. It must never render as zero. */
function unreadableLedgerIsNotZero(): void {
  const model = buildActBoundaryModel({
    arming: armed(),
    attempts: { status: "unavailable", reason: "persistence-not-configured" },
  });
  assert.equal(model.attempts, null, "no tally is invented");
  assert.equal(model.attemptsUnavailableReason, "persistence-not-configured");
  const byStage = (s: string) => model.stages.find((x) => x.stage === s);
  assert.equal(byStage("executed")?.evidence, "unavailable");
  assert.notEqual(byStage("executed")?.value, "0", "unavailable is never shown as zero");
}

/* Every missing half is named at once, so a Director does not fix them one reload at a time. */
function blockersNameEveryMissingHalf(): void {
  const reachable = buildActBoundaryModel({
    arming: armed(),
    attempts: { status: "read", items: [] } as ActBoundaryInput["attempts"],
  });
  assert.equal(reachable.blockers.length, 0, "a reachable organization has no blockers");

  const blocked = buildActBoundaryModel({
    arming: armed({
      effectiveSend: "blocked",
      tenantArming: "never-armed",
      directorEnabled: false,
      directorControl: "disabled",
      configuration: "needs-configuration",
      credential: "missing",
    }),
    attempts: { status: "read", items: [] } as ActBoundaryInput["attempts"],
  });
  const joined = blocked.blockers.join(" ").toLowerCase();
  assert.ok(joined.includes("organization"), "the organization half is named");
  assert.ok(joined.includes("deployment half"), "the deployment switch is named");
  assert.ok(joined.includes("credential"), "the missing configuration value is named");
  assert.equal(blocked.blockers.length, 3, "all three missing halves, not just the first");
}

/*
 * `not-established` is an absence of context, never a decision. It must not be worded as though
 * somebody chose not to arm.
 */
function absentContextIsNotADecision(): void {
  const model = buildActBoundaryModel({
    arming: armed({ effectiveSend: "blocked", tenantArming: "not-established" }),
    attempts: { status: "unavailable", reason: "no-authorized-tenant-context" },
  });
  const wording = model.blockers.join(" ");
  assert.match(wording, /could not be established/i);
  assert.ok(!/never armed/i.test(wording), "an unknown state is not reported as a refusal");
}

/* The model is pure: no database, no clock, no request, no authority. */
function modelIsPure(): void {
  const source = readFileSync(
    join(process.cwd(), "src", "features", "operations-act-boundary", "model.ts"),
    "utf8",
  );
  for (const banned of ["drizzle", "resolveGovernanceDb", "process.env", "Date.now(", "new Date("]) {
    assert.ok(!source.includes(banned), `the act-boundary model touches no ${banned}`);
  }
  /* The only VALUE import is the pure status predicate; the reader types are type-only. */
  assert.ok(
    source.includes('import type {') && source.includes("execution-arming-projection.server"),
    "reader shapes are imported as types, never as runtime modules",
  );
}

/* Read-only: the surface reports, it offers nothing to press. */
function surfaceOffersNoControl(): void {
  const component = readFileSync(
    join(process.cwd(), "src", "components", "operations-act-boundary", "act-boundary-surface.tsx"),
    "utf8",
  );
  for (const banned of ["<button", "onClick", "<form", "useState", "Retry", "Disarm", "Send now"]) {
    assert.ok(!component.includes(banned), `the act boundary exposes no control (${banned})`);
  }
  assert.ok(
    component.includes("resolveTenantContext"),
    "the tenant is resolved server-side, never taken from a prop",
  );
  const lowered = component.toLowerCase();
  for (const banned of ["health%", "uptime", "successrate", "queue", "incident", "campaign"]) {
    assert.ok(!lowered.includes(banned), `the act boundary invents no ${banned}`);
  }
}

/* The three bands render in the approved order, and no fifth L2 destination appears. */
function pageRendersThreeBandsInOrder(): void {
  const page = readFileSync(
    join(process.cwd(), "src", "app", "(dashboard)", "operations", "page.tsx"),
    "utf8",
  );
  const band1 = page.indexOf("<OperationsPreparation />");
  const band2 = page.indexOf("<ActBoundarySurface />");
  const band3 = page.indexOf("<OperationsOverview />");
  assert.ok(band1 > 0 && band2 > 0 && band3 > 0, "all three bands render");
  assert.ok(band1 < band2, "Work in flight leads the page");
  assert.ok(band2 < band3, "the act boundary sits above the capability diagnostic");
  /*
   * MEASURED REGRESSION GUARD. Without this export the route prerenders statically, and the build
   * bakes one session-less render — "arming could not be established", ledger unreadable — into an
   * HTML file served to every viewer forever. A surface that exists to avoid stating untruths must
   * not be cached into stating one.
   */
  assert.match(
    page,
    /export const dynamic = "force-dynamic"/,
    "the route refuses static prerendering — every band reads per-request tenant truth",
  );
}

function main(): void {
  stagesAreOrderedAndComplete();
  preparedAndAuthorizedAreNotCountedHere();
  talliesAreCountsOfRealRows();
  unreadableLedgerIsNotZero();
  blockersNameEveryMissingHalf();
  absentContextIsNotADecision();
  modelIsPure();
  surfaceOffersNoControl();
  pageRendersThreeBandsInOrder();
  console.log("operations act-boundary checks passed");
}

main();
