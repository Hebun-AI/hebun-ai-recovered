/*
 * SOC-ACT1 — the authorities this phase must NOT have acquired.
 *
 * Proved from the real source of the modules this phase touched, with comments stripped: a rule
 * about CODE must not be satisfied by prose that merely denies the thing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const INLET = "src/features/heby-action-inlet/record-work-proposal.server.ts";
const ACTION = "src/app/(dashboard)/intelligence/social/actions.ts";
const FORM = "src/components/social-intelligence/work-request-form.tsx";
const RESOLVER = "src/features/heby-runtime/source-resolver.ts";
const CAPABILITY_GATE = "src/features/heby-actions/capability-gate.ts";
const PREPARER = "src/features/heby-actions/action-preparer.ts";

/* ── 1 · the source class exists and is NOT connected to Heby ──────────────── */

function theClassExistsAndCarriesNoReader(): void {
  assert.ok(
    HEBY_SOURCE_CLASSES.includes("provider-observations"),
    "SOC-ACT1's evidence vocabulary value must exist",
  );

  /*
   * SOURCE-CLASS MEMBERSHIP != HEBY CONNECTIVITY. The pure resolver must say so, and must say it
   * with its OWN sentence rather than a shared generic one.
   */
  const resolution = resolveSource("provider-observations");
  assert.equal(resolution.state, "unavailable", "no Heby reader over provider observations exists");
  assert.equal(resolution.items.length, 0, "an unavailable class must fabricate no items");
  assert.equal(resolution.authoritative, false);
  assert.ok((resolution.unavailableReason ?? "").trim().length > 0, "it must say why");

  /* No other class may share the sentence — a generic reason explains nothing. */
  const reasons = HEBY_SOURCE_CLASSES.filter((c) => c !== "provider-observations")
    .map((c) => resolveSource(c).unavailableReason ?? "")
    .filter((r) => r.length > 0);
  assert.ok(
    !reasons.includes(resolution.unavailableReason ?? ""),
    "the new class must state its own reason, not borrow another's",
  );
}

function noHebyReaderWasAdded(): void {
  const RESOLVER_CODE = codeOf(read(RESOLVER));
  /*
   * The branch must RETURN UNAVAILABLE and nothing else. A reader would appear here as a call, a
   * tenant, or a database handle — the pure resolver holds none of those and must keep holding none.
   */
  for (const forbidden of ["providerObservations", "readProviderObservations", "getDb", "drizzle-orm"]) {
    assert.ok(
      !RESOLVER_CODE.includes(forbidden),
      `the pure resolver must not reach ${forbidden}; SOC-ACT1 adds no Heby reader`,
    );
  }

  /* And no substitution dep may have appeared for it in the answer flow. */
  const ANSWER = codeOf(read("src/features/heby-answer/model-answer.server.ts"));
  assert.ok(
    !/resolveProviderObservations/.test(ANSWER),
    "SOC-ACT1 must not add a connected reader substitution for provider observations",
  );
}

/* ── 2 · the originator reaches no provider and owns no lifecycle ──────────── */

function theOriginatorReachesNoProvider(): void {
  const CODE = codeOf(read(INLET));
  for (const forbidden of [
    "fetch(",
    "adapter",
    "transport",
    "graph.facebook.com",
    "googleapis",
    "credential",
    "accessToken",
  ]) {
    assert.ok(
      !CODE.includes(forbidden),
      `the proposal inlet must not reach ${forbidden}: filing a request contacts no provider`,
    );
  }
}

function theOriginatorWritesNoWorkPermitOrDecision(): void {
  const CODE = codeOf(read(INLET));
  for (const forbidden of [
    "recordWorkWithin",
    "recordWork(",
    "retireWork",
    "consumeActionPermit",
    "decideActionRequest",
    "executeRecordWork",
  ]) {
    assert.ok(
      !CODE.includes(forbidden),
      `filing a proposal must not reach ${forbidden} — PROPOSED is not AUTHORIZED, EXECUTED or SUCCESSFUL`,
    );
  }
}

/* ── 3 · the browser supplies an identity and a sentence, never a fact ─────── */

function theBoundaryAcceptsNoAuthoritativeInput(): void {
  const CODE = codeOf(read(ACTION));
  for (const forbidden of ["tenantId", "userId", "authoritative", "permit", "approve", "followersCount"]) {
    assert.ok(
      !CODE.includes(forbidden),
      `the server boundary must not accept ${forbidden} from a browser`,
    );
  }
  assert.ok(CODE.includes("resolveTenantContext"), "the tenant must be resolved server-side");
}

function theFormSendsNoMeasurement(): void {
  const CODE = codeOf(read(FORM));
  for (const forbidden of [
    "followersCount",
    "followsCount",
    "mediaCount",
    "subscriberCount",
    "previous",
    "latest",
    "change",
  ]) {
    assert.ok(!CODE.includes(forbidden), `the affordance must not send or restate ${forbidden}`);
  }
}

/* ── 4 · the UI may not overstate what happened ────────────────────────────── */

function theAffordanceClaimsNoExecution(): void {
  const SOURCE = read(FORM);
  const VISIBLE = codeOf(SOURCE);
  for (const banned of [
    "Work created",
    "Action completed",
    "Executed",
    "Published",
    "Authorized",
    "Approved",
  ]) {
    assert.ok(
      !VISIBLE.includes(banned),
      `the affordance must never render "${banned}" — filing a request does none of it`,
    );
  }
  assert.ok(
    VISIBLE.includes("File work request"),
    "the control must name the act it performs: filing a request",
  );
}

/* ── 5 · the controls this phase promised not to touch ─────────────────────── */

function workspaceOwnershipAndConfusedDeputyAreUnchanged(): void {
  const GATE = codeOf(read(CAPABILITY_GATE));
  assert.ok(
    GATE.includes("const workspacePermitted = requestingWorkspace === tool.ownerWorkspace"),
    "workspace ownership must remain strict equality",
  );
  const PREP = read(PREPARER);
  assert.ok(
    PREP.includes('if (!cap.workspacePermitted) return "RESTRICTED"'),
    "the confused-deputy protection must remain",
  );

  /* And the request must be filed under the OWNING workspace, never the Intelligence one. */
  const INLET_CODE = codeOf(read(INLET));
  assert.ok(
    INLET_CODE.includes("requestingWorkspace: RECORD_WORK_OWNER_WORKSPACE"),
    "SOC-ACT1 must file under the capability's owning workspace",
  );
  assert.ok(
    !/requestingWorkspace: "intelligence"/.test(INLET_CODE),
    "Social Intelligence must not wield a Command-owned tool",
  );
}

function noProviderWriteCapabilityWasIntroduced(): void {
  const CODE = codeOf(read(INLET)) + codeOf(read(ACTION)) + codeOf(read(FORM));
  for (const forbidden of [
    "content_publish",
    "manage_insights",
    "publish",
    "instagram.media.write",
    "youtube.upload",
  ]) {
    assert.ok(!CODE.includes(forbidden), `SOC-ACT1 must introduce no provider write capability (${forbidden})`);
  }
}

function main(): void {
  theClassExistsAndCarriesNoReader();
  noHebyReaderWasAdded();
  theOriginatorReachesNoProvider();
  theOriginatorWritesNoWorkPermitOrDecision();
  theBoundaryAcceptsNoAuthoritativeInput();
  theFormSendsNoMeasurement();
  theAffordanceClaimsNoExecution();
  workspaceOwnershipAndConfusedDeputyAreUnchanged();
  noProviderWriteCapabilityWasIntroduced();
  console.log("SOC-ACT1 authority firewall checks passed");
}

main();
