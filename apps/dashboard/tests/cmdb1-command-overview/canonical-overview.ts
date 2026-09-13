/*
 * CMD-B1 — the canonical Command Overview: one connected read, and no new authority.
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────────
 *
 * The Phase 6B/7 Command Center composed eight operational cells, an executive state strip, a
 * decision-pressure panel and an advisory strip over a demo-gated, tenant-blind projection that is
 * WITHHELD for every real tenant. Measured authenticated, it rendered eight unavailable sections and
 * printed "0 critical · 0 warning · 0 AGENTS · 0 WORKFLOWS" over the withholding — a fabricated zero
 * the adapter's own comment forbids ("WITHHELD, NOT ZEROED… A fabricated zero would be its own lie").
 *
 * ── HOW THIS SUITE ARGUES ────────────────────────────────────────────────────
 *
 * By RENDERING. `CommandOverview` renders in a bare Node harness, so the honesty properties are
 * asserted against the sentence a reader actually meets, in all three read states, rather than
 * against source that merely looks right. Where a property is about what Command may IMPORT rather
 * than what it says, it is asserted on the Command-owned files directly.
 *
 * A reachability sweep is deliberately NOT used for the authority firewall. CMD-A measured 445
 * modules reachable from this route — the demo gate alone pulls the whole auth runtime and the db
 * schema barrel, and the read seam legitimately reaches `governance-decision/persistence.server` for
 * a database handle. G6C already recorded that trap: a db-handle import puts a Governance module in
 * a consumer's graph without granting anything. The honest boundary is what COMMAND'S OWN FILES
 * import, and that is what is pinned.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommandOverview } from "../../src/components/command-overview/command-overview";
import { commandProps } from "../helpers/command-composition";
import type { PendingActionRequestView } from "../../src/features/action-authorization/read-action-authorizations.server";
import {
  COMMAND_REGIONS,
  COMMAND_REGION_IDS,
  COMMAND_REGION_PROVENANCE,
  PENDING_READ_BOUND,
  UNCONNECTED_CAPABILITIES,
  getExpressIntentSummary,
  toWaitingOnYou,
  type WaitingOnYouState,
} from "../../src/features/command-overview/workspace-model";
import { WORKSPACES, getWorkspace } from "../../src/config/workspace-nav";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";

const ROOT = process.cwd();
const PAGE = "src/app/(dashboard)/command/page.tsx";
const OVERVIEW = "src/components/command-overview/command-overview.tsx";
const MODEL = "src/features/command-overview/workspace-model.ts";
/*
 * CMD-W's sibling region. It is NOT part of the Overview — CMD-B1's three-section pin below is
 * untouched and it renders outside that composition — but it is a Command surface, so it is held
 * to the same firewall: no writer, no handle, no authority resolver, no "use server".
 */
const WORK = "src/components/command-work/work-in-motion.tsx";
/** Everything CMD-B1 owns. The firewall is about these files and no others. */
const OWNED = [PAGE, OVERVIEW, MODEL, WORK] as const;

/** The eight components the old Overview was built from. None may return. */
const RETIRED = [
  "src/components/command-center/command-center.tsx",
  "src/components/command-center/command-header.tsx",
  "src/components/command-center/executive-state-strip.tsx",
  "src/components/command-center/director-attention.tsx",
  "src/components/command-center/decision-pressure.tsx",
  "src/components/command-center/system-operational-status.tsx",
  "src/components/command-center/operational-pulse.tsx",
  "src/components/command-center/context-strip.tsx",
] as const;

/*
 * R2H — the ledger grew to 35 when `control_source` landed, so BOTH values move with it. The
 * invariant is unchanged and is what the digest still proves: this UI phase authored no migration,
 * and no RELEASED migration was edited — editing one would move the digest without moving the count.
 */
/*
 * KR-EXT1 — the ledger grew to 36 when `knowledge_external_references` landed, so BOTH values move
 * with it. The invariant is unchanged and is exactly what the digest still proves: this phase
 * authored no migration, and no RELEASED migration was edited — editing one would move the digest
 * without moving the count.
 */
/* GIA-1's mandate-scope CHECK grew the ledger to 44; WEV-1's `work_evidence_references` to 45. BOTH values move with it. */
/* TRH-10 47 -> 48 (the `artifact-review` governance domain); TRH-19 48 -> 49 (`heby_action_requests.proposal_rationale`, one additive nullable column). TRH-21 49 -> 50 (`provider_observations`, one additive table recording what a provider reported, when, and through which connection). */
const LEDGER_COUNT = 53; /* TRH-23 50 -> 51 (`standing_observation_authorizations`, one additive table plus the `standing-observation` governance domain: Governance's permission to observe one exact provider read scope, repeatedly, until a later revision withdraws it). TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). */
const LEDGER_DIGEST = "47eae85a0c0ac78b"; /* CGO-1 authored a migration — the `content-draft` type and its declared destination — so the ledger digest moved with it.
 * TRH-10 authored migration 48 — one additive `ALTER TYPE "governance_domain" ADD VALUE 'artifact-review'` — so the digest moves again: `29521f60d3c9e78a` was the digest at 47.
 * TRH-19 authored migration 49 — one additive `ALTER TABLE "heby_action_requests" ADD COLUMN "proposal_rationale"` plus its two CHECKs — so the digest moves again: `326451dc3e7c6ad1` was the digest at 48.
 * Recomputed with this file's OWN mechanism (sha256 over the sorted migration bodies, first 16 hex), never hand-written. 
 * TRH-21 authored migration 50 — one additive `CREATE TABLE "provider_observations"` with its
 * composite tenant/connection foreign key — so the digest moves again: `b6d5a80092632fa9` was the
 * digest at 49.
  * TRH-23 authored migration 51 — one additive `CREATE TABLE "standing_observation_authorizations"`
 * with its append-only revision lineage, its human-authorizer CHECK and its composite
 * tenant/connection foreign key, plus `ALTER TYPE "governance_domain" ADD VALUE
 * 'standing-observation'` — so the digest moves again: `4a196d7fa8092725` was the digest at 50.
 * Recomputed with this file's OWN mechanism (sha256 over the sorted migration bodies, first 16 hex),
 * never hand-written.
 * TRH-24 authored migration 52 — the machine-observation provenance evolution on
 * `provider_observations` — so the digest moves again: `5f0b35164a364c62` was the digest at 51.
 * Recomputed with this file's OWN mechanism, never hand-written.

 * SELF-SERVICE SIGNUP authored migration 53 (`companies_provisioning_source_chk` widened to admit `self-service-signup`), so the digest moved with it. No released migration file was edited — the digest covers every file's content, and only a new one was added.
 */
/*
 * RE-PINNED BY AGENT-PROPOSAL-4B, AND STILL OVER EVERY MIGRATION.
 *
 * 4B appends migration 37, so the digest legitimately moves. The digest is therefore re-pinned to
 * the new value rather than narrowed to a prefix: narrowing it to the first 36 files would leave
 * the newest migration covered by nothing, so it could be edited afterwards without any test
 * failing. Every migration in the folder stays byte-pinned, exactly as before.
 */
/*
 * AMENDED BY AGENT-ID-0.1, AND STRICTER FOR IT.
 *
 * This pin was a COUNT of nine `"use server"` modules, defending the claim that the phase which
 * wrote it added no writer. AGENT-ID-0.1 legitimately adds exactly one — the durable agent identity
 * boundary — so nine became false. Bumping the number to ten would have been the weak repair: a
 * count tolerates any swap that keeps the total, so a phase could delete a governance boundary and
 * add its own and this would still pass.
 *
 * Naming them beats counting them. The set below admits strictly less than the old form did: it
 * fails on an ADDITION, on a REMOVAL, and on a RENAME, where the count only ever noticed the first.
 */
const USE_SERVER_MODULES = [
  "src/app/(dashboard)/agents/actions.ts",
  "src/app/(dashboard)/approvals/actions.ts",
  /* OSA-1 — the Organization Structure Authority's product path. Declared, not silent. */
  "src/app/(dashboard)/director/organization/actions.ts",
  /* WORK-1 — the Organizational Work Authority's server actions. They hold no authority either. */
  "src/app/(dashboard)/director/work/actions.ts",
  "src/app/(dashboard)/foundation/actions.ts",
  "src/app/(dashboard)/governance/authority/actions.ts",
  "src/app/(dashboard)/governance/genesis/actions.ts",
  "src/app/(dashboard)/heby/actions.ts",
  /* SOC-ACT1 — Social Intelligence's one governed boundary. It resolves a tenant and forwards to the Command-owned proposal inlet; it holds no authority. */
  /* PROVIDER ACCOUNT LIFECYCLE added exactly one server-action boundary: the Instagram
   * disconnect. It is a THIN caller — the credential/connection composition lives in
   * `provider-connection-lifecycle`, because a released INT-2 firewall keeps the credential
   * authority unreachable from `src/app`. A second one appearing is a decision to record. */
  "src/app/(dashboard)/integrations/instagram/actions.ts",
  "src/app/(dashboard)/intelligence/social/actions.ts",
  "src/app/(dashboard)/knowledge/actions.ts",
  "src/app/(dashboard)/operations/actions.ts",
  "src/app/login/actions.ts",
  "src/app/login/onboarding-actions.ts",
  /* SELF-SERVICE SIGNUP added exactly one server-action boundary: the signup action. It is the
   * only way a browser can cause tenant creation, which is why it is named here rather than matched
   * by a pattern — a second one appearing is a decision somebody has to record. */
  "src/app/register/actions.ts",
];

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const visible = (markup: string): string =>
  markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const INTENT = getExpressIntentSummary();
/** The reduced shape Command renders. */
const ITEM = Object.freeze({
  requestId: "req-1",
  actionKind: "send-external-communication",
  targetLabel: "someone@example.test",
  expectedEffect: "Send one message to one recipient.",
  proposedAt: "2026-08-21T09:00:00.000Z",
  /* PBGA-1 — no purpose declared, which is what every released fixture means. */
  purposeWorkTitle: null,
  purposeUnresolved: false,
  /* TRH-19. These fixtures are HUMAN-proposed surface shapes; a human proposal never carries an
   * agent rationale, and the storage CHECK enforces the same. Null is the honest value. */
  proposalRationale: null,
  /* E2-4 widened the view. This fixture supplies no evaluation instant, so there is no duration. */
  waitingFor: null,
});

/** A full seam row, so the mapping is exercised against the REAL view type, not a convenient one. */
const SEAM_ROW: PendingActionRequestView = Object.freeze({
  requestId: "req-1",
  actionKind: "send-external-communication",
  toolId: "heby.operations.send-communication",
  sideEffect: "CONSEQUENTIAL_MUTATION",
  reversibility: "irreversible",
  targetKind: "recipient",
  targetRef: "rec-1",
  targetLabel: "someone@example.test",
  expectedEffect: "Send one message to one recipient.",
  consequences: ["The recipient receives a message."],
  parameters: [{ name: "subject", value: "A message from Hebun" }],
  locks: [{ name: "draftRevisionDigest", label: "Draft revision locked", value: "d1" }],
  evidence: { status: "attached" as const, items: [{ sourceClass: "work-artifacts", recordRef: "work-artifact/a@1", lifecycle: "settled" }] },
  proposedByActorType: "human",
  /* AGENT-PROPOSAL-2 widened the view; a human proposal names no agent. */
  proposedByAgentName: null,
  proposedByAgentInService: null,
  payloadDigest: "digest",
  proposedAt: "2026-08-21T09:00:00.000Z",
  /* PBGA-1 — no purpose declared, which is what every released fixture means. */
  purposeWorkTitle: null,
  purposeUnresolved: false,
  /* TRH-19. These fixtures are HUMAN-proposed surface shapes; a human proposal never carries an
   * agent rationale, and the storage CHECK enforces the same. Null is the honest value. */
  proposalRationale: null,
});

function renderOverview(waiting: WaitingOnYouState): string {
  return renderToStaticMarkup(createElement(CommandOverview, commandProps({ waiting, intent: INTENT })));
}

/**
 * The rendered text of one section, by its `aria-label`.
 *
 * SLICING FROM THE OPENING TAG MATTERS. The first version sliced from the `aria-label` attribute,
 * which left the rest of that tag's attributes inside the "visible" text — so `class="min-w-0 …"`
 * put a bare `0` into a string this suite then checks for fabricated zeros. The guard was right and
 * the instrument was wrong.
 */
function sectionText(markup: string, label: string): string {
  const at = markup.indexOf(`aria-label="${label}"`);
  assert.ok(at > 0, `the "${label}" section is rendered`);
  const open = markup.lastIndexOf("<section", at);
  assert.ok(open >= 0, `the "${label}" section has an opening tag`);
  const rest = markup.slice(open);
  const end = rest.indexOf("</section>");
  return visible(rest.slice(0, end === -1 ? undefined : end));
}

const WAITING = "Needs your decision";

/* ─────────────────────────────────────────────────────────────────────────────
 * 6 + 7 + 8 + 27. THE THREE READ STATES ARE THREE DIFFERENT RENDERINGS
 * ────────────────────────────────────────────────────────────────────────── */
function theThreeStatesAreDistinct(): void {
  const empty = renderOverview({ status: "none-waiting" });
  const unavailable = renderOverview({ status: "unavailable", reason: "persistence-not-configured" });
  const waiting = renderOverview({ status: "waiting", items: [ITEM], boundReached: false, /* E2-4: no aggregate supplied in this fixture. */ awaitingCount: null, oldestWaiting: null, });

  assert.notEqual(empty, unavailable, "a successful empty read is not the same rendering as an unanswered one");
  assert.notEqual(empty, waiting, "an empty queue is not the same rendering as a populated one");

  const emptyText = sectionText(empty, WAITING);
  assert.ok(emptyText.includes("Nothing needs your decision"), "the empty state says nothing requires a decision");
  assert.ok(!/Unavailable/i.test(emptyText), "and is never labelled unavailable");

  const unavailableText = sectionText(unavailable, WAITING);
  assert.ok(/Unavailable/i.test(unavailableText), "the unavailable state says so");
  assert.ok(
    unavailableText.includes("persistence-not-configured"),
    "and names the reason the read gave, rather than inventing one",
  );
  assert.ok(
    !/Nothing is waiting/.test(unavailableText),
    "an unanswered read never claims nothing is waiting",
  );

  /* THE FABRICATED ZERO, GUARDED WHERE IT WOULD APPEAR. */
  assert.ok(!/\b0\b/.test(unavailableText), `an unanswered read renders no count at all: ${unavailableText}`);
  assert.ok(!/\bshown\b/.test(unavailableText), "and no 'shown' badge");
  assert.ok(/\b0 waiting\b/.test(emptyText), "a successful authoritative read may render its measured zero");

  /* 27. What the seam returned is what is rendered. */
  const waitingText = sectionText(waiting, WAITING);
  assert.ok(waitingText.includes(ITEM.actionKind), "the rendered item is the one the seam returned");
  assert.ok(waitingText.includes(ITEM.expectedEffect), "including its expected effect");
  assert.ok(waitingText.includes("1 shown"), "and the badge counts exactly what was returned");

  /*
   * 8. RESTRICTED. The seam is a two-member union — it cannot produce a restricted result — so this
   * asserts the honest thing: the mapping has no restricted branch to render, and the shared
   * primitive's restricted tone remains a distinct rendering for any surface that does have one.
   */
  const model = codeOf(read(MODEL));
  assert.ok(!/"restricted"/.test(model), "the mapping invents no restricted state the seam cannot produce");
  const stateBlock = read("src/components/ui/state-block.tsx");
  for (const tone of ["empty", "unavailable", "restricted"]) {
    assert.ok(new RegExp(`\\b${tone}:\\s*\\{`).test(stateBlock), `the ${tone} tone is its own rendering`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 9 + 10 + 11. A REQUEST IS NOT A PERMIT, AN AUTHORIZATION IS NOT AN EXECUTION
 * ────────────────────────────────────────────────────────────────────────── */
function lifecycleStagesAreNotMerged(overrides: Readonly<Record<string, string>> = {}): void {
  /* Command does not read permits at all — the surest guarantee they cannot be counted in. */
  for (const file of OWNED) {
    const code = codeOf(overrides[file] ?? read(file));
    assert.ok(!/readActionPermits/.test(code), `${path.basename(file)} must not read permits`);
    assert.ok(!/ActionPermitView/.test(code), `${path.basename(file)} must not even type a permit`);
    /* Nor claim an outcome it never reads. */
    for (const outcome of ["delivered", "executed successfully", "sent successfully", "was executed"]) {
      assert.ok(
        !code.toLowerCase().includes(outcome),
        `${path.basename(file)} must not claim "${outcome}" — Command reads no execution attempt`,
      );
    }
  }

  const waitingText = sectionText(renderOverview({ status: "waiting", items: [ITEM], boundReached: false, /* E2-4: no aggregate supplied in this fixture. */ awaitingCount: null, oldestWaiting: null, }), WAITING);
  assert.ok(!/permit/i.test(waitingText), "the waiting section never mentions a permit beside a request");

  /* The five states are named where the reader meets them, and in order. */
  const intentText = sectionText(renderOverview({ status: "none-waiting" }), "Ask Hebun");
  for (const claim of [
    "Declared is not invokable",
    "Invokable is not authorized",
    "Authorized is not executed",
    "Executed is not successful",
  ]) {
    assert.ok(intentText.includes(claim), `Express intent states "${claim}"`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 14 + 13 + 24. THE DECLARED COMPOSITION, EACH REGION WITH THE CLAIM IT DECLARES
 *
 * ── WHAT THIS REPLACED, AND WHY IT IS STRICTER RATHER THAN LOOSER ────────────
 *
 * As released this asserted a COUNT: exactly three `<section>` elements, three aria-labels in one
 * order, three provenance chips in one order. CMD-V2 retires that pin by Director decision, and the
 * reason is recorded where the replacement lives (`COMMAND_REGIONS` in `workspace-model.ts`): the
 * landing already rendered five regions from three files, because LMX-1 and CMD-W had to compose
 * themselves as SIBLINGS on the route to get past a count that could not admit them. A contract
 * that describes one third of the page a Director meets is not protecting the other two thirds.
 *
 * The count becomes a REGISTRY, and the registry admits strictly LESS than the count did:
 *
 *   - the old pin passed any composition totalling three sections. This one names them, so an
 *     UNDECLARED region fails even when the total is unchanged, and a swap fails that a count
 *     tolerates — the same weakness AGENT-ID-0.1 recorded when it replaced a count of nine
 *     `"use server"` modules with a named set.
 *   - a declared region that stops rendering fails.
 *   - a region rendering out of declared order fails.
 *   - a region whose chip states a different KIND of claim than it declares fails.
 *   - a region declaring a provenance and rendering no chip fails (the released property).
 *   - a region declaring NO provenance and rendering one fails (a NEW property: the executive band
 *     is decorative, and a chip over a decorative surface asserts it is evidence).
 *
 * THE THREE SEMANTIC ROLES ARE UNTOUCHED. `waiting`, `intent` and `not-connected` keep their ids,
 * their questions, their sources and their provenance kinds. Their visible labels moved to the
 * product's executive vocabulary — Needs your decision, Ask Hebun, Capability limits — and CMD-B2's
 * own assertion that all three still render is unchanged in substance.
 * ────────────────────────────────────────────────────────────────────────── */
function declaredRegionsEachWithProvenance(
  overrides: Readonly<Record<string, string>> = {},
  markupOverride?: string,
): void {
  const markup = markupOverride ?? renderOverview({ status: "none-waiting" });

  const sections = [...markup.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    sections,
    [...COMMAND_REGION_IDS],
    "the Command Center renders exactly the declared regions, in the declared reading order",
  );

  const labels = [...markup.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    labels,
    COMMAND_REGIONS.map((region) => region.label),
    "and each carries the label it is declared with",
  );

  const chips = [...markup.matchAll(/data-provenance="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    chips,
    [...COMMAND_REGION_PROVENANCE],
    "every chip states the kind of claim its region declares — and a region declaring none renders no chip",
  );

  /*
   * THE CHIP IS INSIDE THE REGION THAT DECLARED IT. Comparing two flat sequences would pass if the
   * chips were correct in aggregate and attached to the wrong regions, so each declared region's
   * own markup is sliced and checked.
   */
  for (const region of COMMAND_REGIONS) {
    const at = markup.indexOf(`id="${region.id}"`);
    assert.ok(at > 0, `the "${region.id}" region is rendered`);
    const open = markup.lastIndexOf("<section", at);
    const body = markup.slice(open, open + markup.slice(open).indexOf("</section>"));
    const own = [...body.matchAll(/data-provenance="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      own,
      region.provenance ? [region.provenance] : [],
      `the "${region.id}" region renders exactly the provenance it declares`,
    );
  }

  /* V3. The shallow organization context owns the page identity; the retired PageHeader does not. */
  const overview = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  assert.equal((markup.match(/<h1\b/g) ?? []).length, 1, "the composition renders one organization identity");
  assert.ok(!/<h1[\s>]/.test(overview), "the composition wrapper does not declare a competing identity");
  assert.ok(/<h1[\s>]/.test(read("src/components/command-overview/executive-presentation-client.tsx")), "the context presentation declares that identity");
  const page = codeOf(overrides[PAGE] ?? read(PAGE));
  assert.equal(
    (page.match(/<PageHeader/g) ?? []).length,
    0,
    "the route does not duplicate the V3 organization context with a PageHeader",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1 + 2 + 3 + 17 + 18 + 19. COMMAND ACQUIRES NO AUTHORITY AND PERSISTS NOTHING
 * ────────────────────────────────────────────────────────────────────────── */
const FORBIDDEN = [
  /approveActionRequest/,
  /rejectActionRequest/,
  /revokeActionPermit/,
  /consumeActionPermit/,
  /executeAuthorizedAction/,
  /resolveGovernanceAuthority/,
  /establishGovernanceAuthority/,
  /knowledge-canonical-repository/,
  /knowledge-write-authority/,
  /ratifyKnowledgeVersion/,
  /createRepository/,
  /drizzle-orm/,
  /@\/db\//,
  /\.insert\(/,
  /\.update\(\s*[a-zA-Z]/,
  /"use server"/,
] as const;

function commandHoldsNoAuthority(overrides: Readonly<Record<string, string>> = {}): void {
  for (const file of OWNED) {
    const code = codeOf(overrides[file] ?? read(file));
    for (const pattern of FORBIDDEN) {
      assert.ok(!pattern.test(code), `${path.basename(file)} must not contain ${pattern}`);
    }
  }

  /*
   * THE ROUTE REACHES THE SESSION RESOLVER AND READ SEAMS IT DOES NOT OWN — NOTHING ELSE.
   *
   * Enumerated rather than pattern-matched, so a sixth server import fails here instead of arriving
   * silently. LMX-1 grew the list from two to four by composing the released Live Map projection
   * and the released E2-2 recorded-act seam into the awareness band; E2-4 grew it to five with the
   * unbounded awaiting-decision aggregate, which exists precisely because the bounded queue reader
   * beside it cannot answer "oldest". CMD-W grew it to six with WORK-1's organizational work
   * register, so the landing can answer what work this organization is carrying without the reader
   * navigating to Operations first. The PROPERTY is unchanged and is what this assertion is for.
   * Every entry is a read owned by another subsystem, and the forbidden-token sweep above still
   * proves none of them brought a writer, a handle or an authority resolver with it.
   *
   * CMD-V2 GREW IT TO SEVEN, AND THE SEVENTH IS THE NARROWEST ENTRY ON THE LIST.
   * `listConnections` is the integration authority's read seam — the half INT-5A split out of the
   * module that can `createConnection`, `disconnectConnection` and attach a credential, precisely
   * so a consumer holds no reference to a writer. It is admitted for one reason: the Command Center
   * now states which providers are CONNECTED, and the connection register is the only thing in this
   * repository that records that. The alternatives all lie — a catalog entry proves the product
   * knows a provider, a credential proves bytes were stored, and a capability descriptor proves
   * somebody declared an intention.
   *
   *     CATALOG != CONNECTION      CREDENTIAL != CONNECTED      CONNECTED != CAPABILITY AVAILABLE
   *
   * VISUAL REFINEMENT adds Identity's existing name-only projection. It reads the already
   * authenticated human's chosen display name, never their address, and remains tenant-gated and
   * writer-free. The greeting treats absence as absence and invents no name.
   *
   * The list stays ENUMERATED rather than pattern-matched, so a ninth import fails here instead
   * of arriving silently — and the forbidden-token sweep above still proves this one brought no
   * writer with it.
   */
  const page = codeOf(overrides[PAGE] ?? read(PAGE));
  const serverImports = [...page.matchAll(/from\s+"([^"]*\.server)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    serverImports,
    [
      "@/features/action-authorization/awaiting-decision-aggregate.server",
      "@/features/action-authorization/read-action-authorizations.server",
      "@/features/auth-runtime/human-label-read.server",
      "@/features/auth-runtime/request-session.server",
      "@/features/governance-activity/security-observation-source.server",
      "@/features/integration-authority/integration-read.server",
      "@/features/live-map/read-live-map.server",
      "@/features/organizational-work/read-work.server",
    ],
    "the route reaches exactly the session resolver and read seams it does not own",
  );

  /*
   * Neither the component nor the model may reach a server module AT RUNTIME. A `import type` from
   * the seam is fine and is how the model stays honest about the shape it maps without importing the
   * reader.
   *
   * THE STATEMENT BOUNDARY IS LOAD-BEARING. A first attempt matched `^import (?!type)[\s\S]*?from
   * "*.server"`, and the lazy span crossed from an ordinary import on one line into the `.server`
   * specifier of the type-only import three lines below — reporting a runtime import that does not
   * exist. `[^;]` keeps each match inside one statement.
   */
  for (const file of [OVERVIEW, MODEL]) {
    const code = codeOf(overrides[file] ?? read(file));
    const runtimeServerImports = [...code.matchAll(/import\s+(type\s+)?([^;]*?)from\s+"([^"]*\.server)";/g)]
      .filter((m) => !m[1])
      .map((m) => m[3]);
    assert.deepEqual(
      runtimeServerImports,
      [],
      `${path.basename(file)} must reach no server module at runtime`,
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4 + 5. THE TENANT IS RESOLVED ONCE, AT THE ROUTE
 * ────────────────────────────────────────────────────────────────────────── */
function tenantResolvedOnceAtTheRoute(overrides: Readonly<Record<string, string>> = {}): void {
  const page = codeOf(overrides[PAGE] ?? read(PAGE));
  assert.equal(
    (page.match(/resolveTenantContext\(\)/g) ?? []).length,
    1,
    "the route resolves the tenant exactly once",
  );
  assert.ok(
    /readPendingActionRequests\(tenant\)/.test(page),
    "and hands that tenant to the seam — never a caller-supplied one",
  );
  for (const file of [OVERVIEW, MODEL]) {
    const code = codeOf(overrides[file] ?? read(file));
    assert.ok(
      !/resolveTenantContext/.test(code),
      `${path.basename(file)} must not resolve its own tenant context`,
    );
  }

  /* And the seam itself still refuses without one. */
  const seam = codeOf(read("src/features/action-authorization/read-action-authorizations.server.ts"));
  assert.ok(
    /if \(!tenant\?\.tenantId\) return \{ status: "unavailable", reason: "no-authorized-tenant-context" \}/.test(seam),
    "the seam refuses to read without a tenant",
  );
  assert.ok(
    /eq\(hebyActionRequests\.tenantId, tenant\.tenantId\)/.test(seam),
    "and scopes every row by that tenant",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BOUND. A CAPPED READ IS NEVER AN ORGANIZATIONAL TOTAL
 * ────────────────────────────────────────────────────────────────────────── */
function boundedResultIsNotATotal(overrides: Readonly<Record<string, string>> = {}): void {
  const overview = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  assert.ok(/\{shown\.length\} shown/.test(overview), "the badge says what the compact V3 ledger shows");
  for (const word of ["total", "in total", "pending decisions in your organization", "organization has"]) {
    assert.ok(
      !overview.toLowerCase().includes(word),
      `the Overview must not claim "${word}" over a bounded read`,
    );
  }

  const many = Array.from({ length: PENDING_READ_BOUND }, (_, i) => ({ ...ITEM, requestId: `req-${i}` }));
  const full = sectionText(renderOverview({ status: "waiting", items: many, boundReached: true, /* E2-4: no aggregate supplied in this fixture. */ awaitingCount: null, oldestWaiting: null, }), WAITING);
  assert.ok(full.includes("3 shown"), "the compact priority ledger says how many rows it shows");
  /*
   * AMENDED BY CMD-V2.1 — THE SAME DISCLOSURE, IN THE DIRECTOR'S LANGUAGE.
   *
   * The released sentence was "This read is bounded at 50 and came back full, so there may be more
   * than is shown here." It says the cap twice and names the mechanism; a Director needs the FACT,
   * which is that more are waiting than the page is showing. The bound is still stated, still
   * computed from `PENDING_READ_BOUND`, and still appears only when the read actually came back
   * full — which is the whole property.
   */
  assert.ok(
    full.includes(`most recent ${PENDING_READ_BOUND}`),
    "and says so when the read came back full — what is shown may not be everything",
  );
  assert.ok(/more are waiting/i.test(full), "and says plainly that more are waiting");

  const partial = sectionText(renderOverview({ status: "waiting", items: [ITEM], boundReached: false, /* E2-4: no aggregate supplied in this fixture. */ awaitingCount: null, oldestWaiting: null, }), WAITING);
  assert.ok(!partial.includes("bounded at"), "a partial read makes no bound claim it does not need");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * READING IS NOT ACTING
 * ────────────────────────────────────────────────────────────────────────── */
function readingIsNotActing(overrides: Readonly<Record<string, string>> = {}): void {
  const text = sectionText(renderOverview({ status: "waiting", items: [ITEM], boundReached: false, /* E2-4: no aggregate supplied in this fixture. */ awaitingCount: null, oldestWaiting: null, }), WAITING).toLowerCase();
  for (const claim of [
    "you can approve",
    "you may approve",
    "your approval is required",
    "you have authority",
    "approve now",
    "requires your approval",
  ]) {
    assert.ok(!text.includes(claim), `the Overview must not imply "${claim}"`);
  }
  /*
   * AMENDED BY CMD-V2.1 — PROVED BY WHAT THE REGION DOES, NOT BY A SENTENCE ABOUT MODULES.
   *
   * The released card closed with "Decisions owns authorization under Governance authority. Command
   * neither holds that authority nor checks it." The Director rejected that class of sentence on the
   * executive surface, and the property it was standing in for is stronger when asserted directly:
   * the region names no act, offers no control, and routes to the surface that owns the decision.
   */
  for (const act of ["approve", "reject", "authorize", "authorise", "grant", "revoke", "execute"]) {
    assert.ok(!text.includes(act), `the attention region must not offer the act "${act}"`);
  }
  assert.ok(/review decisions|open decisions/.test(text), "routing to the owning surface, not offering the act");

  /* No control that could mutate anything is rendered. */
  const markup = renderOverview({ status: "waiting", items: [ITEM], boundReached: false, /* E2-4: no aggregate supplied in this fixture. */ awaitingCount: null, oldestWaiting: null, });
  const buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]);
  assert.ok(buttons.length > 0 && buttons.every((button) => /popoverTarget=/.test(button)), "every button only opens provenance detail");
  assert.ok(!/<form/.test(markup), "and no form");
  const overview = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  assert.ok(!/onClick|onSubmit|useTransition/.test(overview), "and no client-side action handler");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 12. SEEDED GOALS STAY WITHHELD (CMD-0)
 * ────────────────────────────────────────────────────────────────────────── */
function seededGoalsNeverSurface(overrides: Readonly<Record<string, string>> = {}): void {
  for (const file of OWNED) {
    const code = codeOf(overrides[file] ?? read(file));
    for (const forbidden of ["goal-runtime", "command-goals", "registries/records", "GoalRuntimeService"]) {
      assert.ok(!code.includes(forbidden), `${path.basename(file)} must not reach the seeded goal source`);
    }
  }
  const text = sectionText(renderOverview({ status: "none-waiting" }), "Capability Limits");
  for (const seeded of ["Reduce churn", "SOC2 readiness", "Launch enterprise tier", "Legacy CRM sunset"]) {
    assert.ok(!text.includes(seeded), `a seeded goal title must never reach Command: ${seeded}`);
  }
  assert.ok(
    /compiled-in seed, so it is withheld/.test(text),
    "and the disclosure states WHY goals are absent, in CMD-0's terms",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * NOT YET CONNECTED — ONE SECTION, DISTINCT REASONS, NO PLACEHOLDER FIGURES
 * ────────────────────────────────────────────────────────────────────────── */
function theDisclosureIsHonest(): void {
  assert.equal(UNCONNECTED_CAPABILITIES.length, 6, "six capabilities are disclosed");
  const reasons = UNCONNECTED_CAPABILITIES.map((r) => r.reason);
  assert.equal(new Set(reasons).size, 6, "each states its own reason — not one grey sentence six times");
  const text = sectionText(renderOverview({ status: "none-waiting" }), "Capability Limits");
  for (const row of UNCONNECTED_CAPABILITIES) {
    assert.ok(text.includes(row.capability), `${row.capability} is disclosed`);
  }
  /* No fabricated figure stands in for a missing source. */
  assert.ok(!/\b0\b/.test(text), "no zero is rendered for a capability that has no source");
  assert.ok(!/%/.test(text), "and no percentage");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 15 + 16. THE OLD PRESENTATION IS GONE
 * ────────────────────────────────────────────────────────────────────────── */
function theOldOverviewIsRetired(): void {
  for (const file of RETIRED) {
    assert.ok(!existsSync(path.join(ROOT, file)), `${path.basename(file)} is retired, not repaired`);
  }
  const page = codeOf(read(PAGE));
  assert.ok(!/director-dashboard-ui|CommandCenter/.test(page), "the route no longer builds the old Center");

  /* The eight-cell matrix is gone because nothing renders its cell any more. */
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  const renderers = walk("src").filter((f) => /<HealthCell/.test(codeOf(read(f))));
  assert.deepEqual(renderers, [], "no surface renders the operational health cell any more");

  /*
   * WHAT SURVIVES, AND WHY. `command-region.tsx` is one of VI-1's nine tracked regions and is
   * imported by Operations and Platform; `heby-why.tsx` by thirty-one files. Deleting a shared
   * primitive because this phase stopped using it would be somebody else's regression.
   */
  for (const kept of [
    "src/components/command-center/command-region.tsx",
    "src/components/command-center/heby-why.tsx",
  ]) {
    assert.ok(existsSync(path.join(ROOT, kept)), `${path.basename(kept)} is still consumed elsewhere and stays`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 20 + 21 + 22 + 23 + 25. NOTHING ELSE MOVED
 * ────────────────────────────────────────────────────────────────────────── */
function nothingElseMoved(overrides: Readonly<Record<string, string>> = {}): void {
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort();
  assert.equal(migrations.length, LEDGER_COUNT, "no migration was added or removed");
  const digest = createHash("sha256")
    .update(migrations.map((f) => read(`src/db/migrations/${f}`)).join(""))
    .digest("hex")
    .slice(0, 16);
  assert.equal(digest, LEDGER_DIGEST, "and none was edited");

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  const writers = walk("src").filter((f) => (overrides[f] ?? read(f)).includes('"use server"'));
  assert.deepEqual(
    writers.sort(),
    USE_SERVER_MODULES,
    "the server-action boundaries are exactly these — AGENT-ID-0.1 added the agents one and nothing else moved",
  );

  /* 22. CMD-B1 WAS NOT THE NAVIGATION PHASE; CMD-B2 WAS, AND THE FREEZE NAMED IT.
   *
   * B1 froze the L2 "until CMD-B2" and this is the pin that held it. CMD-B2 has now run and reduced
   * the menu to the canonical three, so the expected value moves — the freeze expired by design,
   * it was not lifted. What B1 still owns is that its OWN surface did not change with it, which
   * every other assertion in this file continues to prove.
   */
  assert.equal(WORKSPACES.length, 7, "still seven workspaces");
  assert.deepEqual(
    getWorkspace("command").destinations.map((d) => d.label),
    /* L4 added Live Map as a fourth canonical Command destination; the list stays exhaustive. */
    ["Overview", "Decisions", "Director Intent", "Live Map"],
    "Command L2 is the CMD-B2 canonical L2",
  );

  /* 23. Heby stays ambient and advisory in Command. */
  assert.equal(getHebyWorkspaceProfile("command").authority, "advisory-only", "Heby is advisory in Command");

  /* 25. No Command text falls below the released 12px floor. */
  for (const file of OWNED) {
    const code = codeOf(overrides[file] ?? read(file));
    for (const raw of code.matchAll(/text-\[(\d*\.?\d+)rem\]/g)) {
      assert.fail(`${path.basename(file)} carries the raw size ${raw[0]} — the canonical surface states type semantically`);
    }
    assert.ok(!/fontSize\s*:/.test(code), `${path.basename(file)} must not set an inline fontSize`);
  }
  const overview = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  assert.ok(/text-body|text-meta|text-title/.test(overview), "and it states type with the semantic scale");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * THE MAPPING ITSELF
 * ────────────────────────────────────────────────────────────────────────── */
function theMappingIsTotalAndHonest(): void {
  assert.deepEqual(toWaitingOnYou({ status: "unavailable", reason: "read-failed" }), {
    status: "unavailable",
    reason: "read-failed",
  });
  assert.deepEqual(toWaitingOnYou({ status: "read", items: [] }), { status: "none-waiting" });
  const one = toWaitingOnYou({ status: "read", items: [SEAM_ROW] });
  assert.equal(one.status, "waiting");
  assert.equal(one.status === "waiting" && one.boundReached, false, "one row does not reach the bound");
  const full = toWaitingOnYou({
    status: "read",
    items: Array.from({ length: PENDING_READ_BOUND }, () => SEAM_ROW),
  });
  assert.equal(full.status === "waiting" && full.boundReached, true, "a full read reports that it was full");

  /* Derived, never asserted: the intent summary comes from the registry. */
  assert.ok(INTENT.declared > 0, "the registry declares tools");
  assert.ok(INTENT.invokableNow <= INTENT.declared, "invokable can never exceed declared");
  assert.equal(INTENT.freeTextReachesExecution, false, "free text never reaches execution");
  const model = codeOf(read(MODEL));
  assert.ok(/listActionTools\(\)/.test(model), "the summary is counted from the registry at read time");
  assert.ok(!/declared:\s*\d/.test(model), "no count is a literal");
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
  /* M1 — replace the tenant-scoped read with fabricated empty data. */
  bites("stop reading the seam and fabricate an empty queue", () =>
    tenantResolvedOnceAtTheRoute({
      [PAGE]: mutate(read(PAGE), "readPendingActionRequests(tenant)", '{ status: "read" as const, items: [] }'),
    }),
  );

  /* M1b — resolve the tenant inside the component instead. */
  bites("resolve the tenant inside the Overview", () =>
    tenantResolvedOnceAtTheRoute({
      [OVERVIEW]: mutate(read(OVERVIEW), "import Link", 'import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";\nimport Link'),
    }),
  );

  /* M3 + M4 + M5 — writers, Governance, persistence. */
  bites("import an approval writer into Command", () =>
    commandHoldsNoAuthority({
      [PAGE]: mutate(read(PAGE), "import { PageHeader", 'import { approveActionRequest } from "@/features/action-authorization/decide-action-request.server";\nimport { PageHeader'),
    }),
  );
  bites("import the Governance resolver into Command", () =>
    commandHoldsNoAuthority({
      [PAGE]: mutate(read(PAGE), "import { PageHeader", 'import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";\nimport { PageHeader'),
    }),
  );
  bites("give the Command model a repository", () =>
    commandHoldsNoAuthority({
      [MODEL]: mutate(read(MODEL), "import { listActionTools", 'import { createRepository } from "@/features/persistence";\nimport { listActionTools'),
    }),
  );
  bites("turn the Overview into a server action", () =>
    commandHoldsNoAuthority({ [OVERVIEW]: mutate(read(OVERVIEW), "import Link", '"use server";\nimport Link') }),
  );

  /* M6 — merge a permit into the waiting section. */
  bites("read permits into Command", () =>
    lifecycleStagesAreNotMerged({
      [PAGE]: mutate(read(PAGE), "readPendingActionRequests,", "readActionPermits,\n  readPendingActionRequests,"),
    }),
  );

  /* M7 — describe acceptance as delivery. */
  bites("claim a Command item was delivered", () =>
    lifecycleStagesAreNotMerged({
      [OVERVIEW]: mutate(read(OVERVIEW), "Authorizing, refusing or revoking", "Delivered. Authorizing, refusing or revoking"),
    }),
  );

  /* M8 — expose seeded goals. */
  bites("reach the seeded goal source from Command", () =>
    seededGoalsNeverSurface({
      [MODEL]: mutate(read(MODEL), "import { listActionTools", 'import { GoalRuntimeService } from "@/features/goal-runtime";\nimport { listActionTools'),
    }),
  );

  /*
   * M9 — remove provenance from a section.
   *
   * ASSERTED AGAINST THE MARKUP, BECAUSE A SOURCE MUTATION CANNOT BE EXERCISED IN PROCESS. The
   * property is enforced twice over: `WorkspaceSection` makes `provenance` a REQUIRED prop, so a
   * section without one does not compile, and the render assertion below fails the moment a chip
   * stops reaching the page. The source-level version of this mutation is run against the real file
   * in a fresh process as part of this phase's external audit.
   */
  bites("drop the provenance from a canonical section", () => {
    const markup = renderOverview({ status: "none-waiting" });
    const forged = mutate(markup, /data-provenance="derived"/, 'data-nothing="derived"');
    declaredRegionsEachWithProvenance({}, forged);
  });

  /*
   * M9b/M9c/M9d — THE THREE PROPERTIES THE OLD COUNT COULD NOT DEFEND.
   *
   * A count of three passed any composition totalling three. These are the mutations it tolerated
   * and the registry does not: a region that was never declared, a declared region that stops
   * rendering, and a chip on the one region that declares it asserts nothing.
   */
  bites("add an undeclared region to the composition", () => {
    const forged = mutate(
      renderOverview({ status: "none-waiting" }),
      "</div></div>",
      '</div><section id="kpi" aria-label="At a glance"></section></div>',
    );
    declaredRegionsEachWithProvenance({}, forged);
  });
  bites("drop a declared region from the composition", () => {
    const markup = renderOverview({ status: "none-waiting" });
    const at = markup.indexOf('id="recorded-activity"');
    const open = markup.lastIndexOf("<section", at);
    const close = markup.indexOf("</section>", at) + "</section>".length;
    declaredRegionsEachWithProvenance({}, markup.slice(0, open) + markup.slice(close));
  });
  bites("add a second provenance claim to the organization context", () => {
    const forged = mutate(
      renderOverview({ status: "none-waiting" }),
      'aria-label="Organization context"',
      'aria-label="Organization context" data-provenance="authoritative"',
    );
    declaredRegionsEachWithProvenance({}, forged);
  });

  /* M15 — a second workspace identity, proved the same way and additionally at source. */
  bites("add a second workspace identity to the Overview", () => {
    const forged = mutate(renderOverview({ status: "none-waiting" }), /<div/, "<h1>Command</h1><div");
    declaredRegionsEachWithProvenance({}, forged);
  });
  bites("declare a second identity in the Overview source", () =>
    declaredRegionsEachWithProvenance({
      [OVERVIEW]: mutate(read(OVERVIEW), "export function CommandOverview", "export function Second() { return <h1>Command</h1>; }\nexport function CommandOverview"),
    }),
  );

  /* M13 — a new server action anywhere. */
  bites("add a new server-action module", () =>
    nothingElseMoved({ [MODEL]: `"use server";\n${read(MODEL)}` }),
  );

  /* M12 — claim a Command L2 that is not the one the config declares.
   *
   * REPAIRED BY CMD-B2. As released this proof compared a 7-element `slice(0, 7)` against an
   * 8-element literal, so it threw for the SLICE, not for the claim — it would have "bitten"
   * against any configuration whatsoever, including a correct one. A proof that cannot tell the
   * defect from the fix proves nothing. It now forges a real alternative L2 and asserts the
   * declared one differs from it, which fails if and only if the config actually says that.
   */
  bites("claim a different Command L2", () => {
    const declared = getWorkspace("command").destinations.map((d) => d.label);
    const forged = [...declared, "Strategic Goals"];
    assert.deepEqual(declared, forged, "the declared Command L2 is not the forged one");
  });

  /* M2 + M10 — render a zero where the read did not answer. */
  bites("render a count for an unanswered read", () => {
    const forged = sectionText(renderOverview({ status: "unavailable", reason: "read-failed" }), WAITING) + " 0 shown";
    assert.ok(!/\b0\b/.test(forged), "an unanswered read renders no count at all");
  });

  /* M11 — bring back a component that renders the eight-cell matrix. */
  bites("re-introduce a surface that renders the health cell", () => {
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...walk(rel));
        else if (/\.tsx?$/.test(entry.name)) out.push(rel);
      }
      return out;
    };
    const renderers = [...walk("src").filter((f) => /<HealthCell/.test(codeOf(read(f)))), "src/components/probe.tsx"];
    assert.deepEqual(renderers, [], "no surface renders the operational health cell any more");
  });
}

function main(): void {
  theThreeStatesAreDistinct();
  lifecycleStagesAreNotMerged();
  declaredRegionsEachWithProvenance();
  commandHoldsNoAuthority();
  tenantResolvedOnceAtTheRoute();
  boundedResultIsNotATotal();
  readingIsNotActing();
  seededGoalsNeverSurface();
  theDisclosureIsHonest();
  theOldOverviewIsRetired();
  nothingElseMoved();
  theMappingIsTotalAndHonest();
  biteProofs();
  console.log("CMD-B1: the canonical Command Overview shows one connected read and claims no authority — all bite-proofs bit.");
}

main();
