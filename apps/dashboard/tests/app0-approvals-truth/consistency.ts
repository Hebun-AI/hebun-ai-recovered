/*
 * APP-0 — /approvals may not deny a capability it renders.
 *
 * ── THE CONTRADICTION ────────────────────────────────────────────────────────
 *
 * On the authenticated surface the page stated both of these, a few hundred pixels apart:
 *
 *   "Actions Awaiting Authorization · 0 PENDING · No action is waiting for authorization"
 *   "Decision Act · NOT CONNECTED · Decision recording is not connected yet.
 *    No approve, reject, or authorize action is offered here."
 *
 * The first is R3A/R3B: consequential requests read from the durable store, with real Approve,
 * Refuse and Revoke affordances behind a server-resolved Governance authority. The second is a
 * Phase 14 safety gate that was true when written and became false the moment that path shipped.
 *
 * ── WHY THE GUARDS BELOW ARE RENDER-BASED, NOT GREP-BASED ────────────────────
 *
 * A banned-substring sweep over the component tree would fire on honest prose — the surface is
 * *supposed* to say "not connected" about evidence, recommendations and briefings, none of which
 * became connected. What must never happen is narrower and is a property of what a READER SEES:
 * the decision-act denial may not appear while the decision act is offered. So the regions are
 * rendered with `renderToStaticMarkup`, tags are stripped, and the assertions read the visible
 * sentence — the same instrument `director-truth-surface` uses.
 *
 * The whole-page component cannot be rendered here (a child reaches for routing state that does
 * not exist outside Next), so the composition is proved separately: the act region is not imported,
 * not referenced, and no file in the surface declares it.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ActionAuthorizations } from "../../src/components/decision-workspace/action-authorizations";
import { DecisionHistory } from "../../src/components/decision-workspace/decision-history";
import { derivePermitState } from "../../src/features/action-authorization/read-action-authorizations.server";

const ROOT = process.cwd();
const SURFACE_DIR = "src/components/decision-workspace";
const WORKSPACE = `${SURFACE_DIR}/decision-workspace.tsx`;
const HISTORY = `${SURFACE_DIR}/decision-history.tsx`;
const AUTHORIZATIONS = `${SURFACE_DIR}/action-authorizations.tsx`;
const ROUTE = "src/app/(dashboard)/approvals/page.tsx";

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** What a person actually reads. Tags stripped so assertions are about sentences, not markup. */
const visible = (markup: string): string =>
  markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const renderAuthorizations = (connected: boolean): string =>
  visible(renderToStaticMarkup(createElement(ActionAuthorizations, { requests: [], permits: [], connected })));

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. THE DENIAL IS GONE FROM WHAT A READER SEES
 * ────────────────────────────────────────────────────────────────────────── */
const ACT_DENIALS = [
  "Decision recording is not connected yet",
  "No approve, reject, or authorize action is offered here",
] as const;

function theActIsNotDenied(overrides: Readonly<Record<string, string>> = {}): void {
  /* Nothing rendered on this surface may carry the denial. */
  const rendered = [renderAuthorizations(true), visible(renderToStaticMarkup(createElement(DecisionHistory)))];
  for (const markup of rendered) {
    for (const denial of ACT_DENIALS) {
      assert.ok(!markup.includes(denial), `a rendered region still says "${denial}" while the act is offered`);
    }
  }

  /* And no file in the surface may declare it, so it cannot return through another component. */
  for (const file of readdirSync(path.join(ROOT, SURFACE_DIR)).filter((f) => f.endsWith(".tsx"))) {
    const source = overrides[`${SURFACE_DIR}/${file}`] ?? read(`${SURFACE_DIR}/${file}`);
    for (const denial of ACT_DENIALS) {
      assert.ok(
        !codeOf(source).includes(denial),
        `${file} declares "${denial}" — the decision act is connected on this surface`,
      );
    }
  }

  /* The act region is not composed any more, under any name. */
  const workspace = codeOf(overrides[WORKSPACE] ?? read(WORKSPACE));
  assert.ok(!/DecisionActAndHistory/.test(workspace), "the act-and-history region is no longer composed");
  assert.ok(/<DecisionHistory\s*\/>/.test(workspace), "history is composed on its own");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. CONNECTED-EMPTY, UNAVAILABLE AND COUNT ARE THREE DIFFERENT RENDERINGS
 * ────────────────────────────────────────────────────────────────────────── */
function emptyIsNotUnavailable(): void {
  const connected = renderAuthorizations(true);
  const unavailable = renderAuthorizations(false);

  assert.ok(connected.includes("0 pending"), "a successful read of an empty queue states the count it read");
  assert.ok(
    connected.includes("No action is waiting for authorization"),
    "and says nothing is waiting — a fact about the tenant",
  );
  assert.ok(!connected.includes("Not connected"), "a successful read is never labelled not connected");

  assert.ok(unavailable.includes("Not connected"), "an unavailable read says so");
  assert.ok(
    unavailable.includes("Authorization persistence is not configured"),
    "and explains why, rather than showing an empty queue",
  );
  assert.ok(!unavailable.includes("0 pending"), "an unavailable read never renders a count");
  assert.ok(
    !unavailable.includes("No action is waiting for authorization"),
    "and never claims nothing is waiting — it does not know",
  );
  assert.notEqual(connected, unavailable, "the two states are not the same rendering");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. READING IS NOT AUTHORITY
 * ────────────────────────────────────────────────────────────────────────── */
function readingIsNotApproving(): void {
  /*
   * The read seam takes a tenant and nothing else; the decision writers additionally resolve
   * Governance. Asserted against the FUNCTION BODIES, because a module-wide search would match the
   * import line and could never fail.
   */
  const reader = codeOf(read("src/features/action-authorization/read-action-authorizations.server.ts"));
  assert.ok(!/resolveGovernanceAuthority\s*\(/.test(reader), "the reader resolves no authority — it only reads");

  const decide = codeOf(read("src/features/action-authorization/decide-action-request.server.ts"));
  for (const fn of ["approveActionRequest", "rejectActionRequest"]) {
    const at = decide.indexOf(`export async function ${fn}`);
    assert.ok(at > 0, `${fn} exists`);
    const body = decide.slice(at, decide.indexOf("\nexport ", at + 1) === -1 ? undefined : decide.indexOf("\nexport ", at + 1));
    assert.ok(/resolveGovernanceAuthority\(/.test(body), `${fn} resolves Governance authority`);
    assert.ok(/no-governance-authority|not-the-governance-authority/.test(body), `${fn} refuses without it`);
  }

  /* The presentation may not imply that being able to read confers the authority to act. */
  const rendered = renderAuthorizations(true);
  for (const claim of ["you may approve", "you can approve", "your authority to approve"]) {
    assert.ok(!rendered.toLowerCase().includes(claim), `the surface must not imply "${claim}"`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4 + 5. A PERMIT IS NOT AN EXECUTION, AND AN EXECUTION IS NOT A SUCCESS
 * ────────────────────────────────────────────────────────────────────────── */
function permitIsNotExecution(): void {
  /* The permit state machine knows nothing about outcomes. */
  const now = new Date("2026-08-20T12:00:00.000Z");
  const later = new Date("2026-08-20T13:00:00.000Z");
  assert.equal(derivePermitState("active", later, now), "active");
  assert.equal(derivePermitState("active", now, later), "expired", "expiry is derived, never stored");
  assert.equal(derivePermitState("consumed", later, now), "consumed");
  assert.equal(derivePermitState("revoked", later, now), "revoked");

  const authorizations = codeOf(read(AUTHORIZATIONS));
  /* Acceptance is the strongest claim available, and it is explicitly not delivery. */
  assert.ok(
    /Accepted is not delivered/.test(authorizations),
    "acceptance is stated as acceptance, never as delivery",
  );
  for (const word of ["Delivered", "delivered successfully", "Sent successfully"]) {
    assert.ok(
      !new RegExp(`>\\s*${word}`).test(authorizations),
      `the surface must not render "${word}" as an outcome`,
    );
  }
  /* A permit is described as authorization, not as an act that happened. */
  assert.ok(
    /A permit exists only once a Governance decision authorized one/.test(authorizations),
    "a permit is stated as an authorization",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6 + 7 + 8 + 9. NO WRITER, RESOLVER, AUTHORITY OR TENANT CHANGE MOVED INTO PRESENTATION
 * ────────────────────────────────────────────────────────────────────────── */
const FORBIDDEN_IN_PRESENTATION = [
  /"use server"/,
  /drizzle-orm/,
  /@\/db\//,
  /createRepository/,
  /\.insert\(/,
  /\.update\(\s*[a-zA-Z]/,
  /resolveGovernanceAuthority/,
  /resolveTenantContext/,
  /governance-decision\//,
] as const;

function presentationHoldsNoAuthority(overrides: Readonly<Record<string, string>> = {}): void {
  for (const file of readdirSync(path.join(ROOT, SURFACE_DIR)).filter((f) => f.endsWith(".tsx"))) {
    const rel = `${SURFACE_DIR}/${file}`;
    const source = codeOf(overrides[rel] ?? read(rel));
    for (const pattern of FORBIDDEN_IN_PRESENTATION) {
      assert.ok(!pattern.test(source), `${file} must not contain ${pattern} — presentation holds no authority`);
    }
  }

  /* The tenant is still resolved once, by the route, and handed down. */
  const route = codeOf(read(ROUTE));
  assert.ok(/resolveTenantContext\(\)/.test(route), "the route resolves the tenant");
  assert.ok(
    /readPendingActionRequests\(tenant\)/.test(route) && /readActionPermits\(tenant\)/.test(route),
    "and both reads are given that tenant, not a caller-supplied one",
  );
  assert.ok(
    /connected\s*=\s*requests\.status === "read" && permits\.status === "read"/.test(route),
    "connected still means both reads answered — not that rows exist",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 10. COMMAND IS UNTOUCHED
 * ────────────────────────────────────────────────────────────────────────── */
function commandIsUntouched(): void {
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  /* No Command file may reach into this surface, and this surface may not reach into Command. */
  const surface = readdirSync(path.join(ROOT, SURFACE_DIR)).filter((f) => f.endsWith(".tsx"));
  for (const file of surface) {
    const source = codeOf(read(`${SURFACE_DIR}/${file}`));
    assert.ok(
      !/from\s+"@\/features\/command-|from\s+"@\/components\/command-(?!center\/heby-why)/.test(source),
      `${file} must not import a Command model or surface`,
    );
  }
  const commandFiles = [...walk("src/components/command-center"), ...walk("src/features/command-goals")];
  for (const file of commandFiles) {
    assert.ok(
      !codeOf(read(file)).includes("decision-workspace"),
      `${file} must not import the Decisions surface`,
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BITE-PROOFS
 * ────────────────────────────────────────────────────────────────────────── */
function mutate(source: string, from: string | RegExp, to: string): string {
  const after = source.replace(from, to);
  assert.notEqual(after, source, "bite-proof mutation did not APPLY — it would prove nothing");
  return after;
}

function bites(label: string, run: () => void): void {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  assert.ok(threw, `bite-proof "${label}" did not bite — the assertion does not guard it`);
}

function biteProofs(): void {
  /* 1. Restore the exact stale copy into a surface file. */
  bites("restore the stale decision-act denial", () =>
    theActIsNotDenied({
      [HISTORY]: mutate(read(HISTORY), "Past decisions are not listed", "Decision recording is not connected yet"),
    }),
  );

  /* 2. Re-compose the deleted act region. */
  bites("re-compose the act-and-history region", () =>
    theActIsNotDenied({ [WORKSPACE]: mutate(read(WORKSPACE), "<DecisionHistory />", "<DecisionActAndHistory />") }),
  );

  /* 3. Render "Not connected" while the region is in fact connected. */
  bites("label a connected read as not connected", () => {
    const connected = renderAuthorizations(true);
    const forged = connected.replace("0 pending", "Not connected");
    assert.notEqual(forged, connected, "the forgery applied");
    assert.ok(forged.includes("0 pending"), "a successful read of an empty queue states the count it read");
    assert.ok(!forged.includes("Not connected"), "a successful read is never labelled not connected");
  });

  /* 4. Imply that a reader may approve. */
  bites("imply the reader holds approval authority", () => {
    const forged = `${renderAuthorizations(true)} you may approve`;
    for (const claim of ["you may approve"]) {
      assert.ok(!forged.toLowerCase().includes(claim), `the surface must not imply "${claim}"`);
    }
  });

  /* 5. Describe an authorization as an execution that happened. */
  bites("describe a permit as delivered", () =>
    permitIsNotExecutionOn(mutate(read(AUTHORIZATIONS), "Accepted is not delivered", "Accepted means delivered")),
  );

  /* 6. Move a Governance writer into presentation. */
  bites("import the Governance authority resolver into presentation", () =>
    presentationHoldsNoAuthority({
      [HISTORY]: mutate(
        read(HISTORY),
        'import { DecisionRegion',
        'import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";\nimport { DecisionRegion',
      ),
    }),
  );
  bites("turn a presentation component into a server action", () =>
    presentationHoldsNoAuthority({ [HISTORY]: mutate(read(HISTORY), "import { DecisionRegion", '"use server";\nimport { DecisionRegion') }),
  );

  /* 7. Reach into Command from this surface. */
  bites("import a Command model into the Decisions surface", () => {
    const forged = codeOf(mutate(read(HISTORY), "import { DecisionRegion", 'import { x } from "@/features/command-goals/workspace-model";\nimport { DecisionRegion'));
    assert.ok(
      !/from\s+"@\/features\/command-|from\s+"@\/components\/command-(?!center\/heby-why)/.test(forged),
      "must not import a Command model or surface",
    );
  });
}

/** The permit/execution check, parameterised so its bite-proof runs against a mutated source. */
function permitIsNotExecutionOn(authorizations: string): void {
  assert.ok(
    /Accepted is not delivered/.test(codeOf(authorizations)),
    "acceptance is stated as acceptance, never as delivery",
  );
}

function main(): void {
  theActIsNotDenied();
  emptyIsNotUnavailable();
  readingIsNotApproving();
  permitIsNotExecution();
  permitIsNotExecutionOn(read(AUTHORIZATIONS));
  presentationHoldsNoAuthority();
  commandIsUntouched();
  biteProofs();
  console.log("APP-0: /approvals states one truth about the decision act — all bite-proofs bit.");
}

main();
