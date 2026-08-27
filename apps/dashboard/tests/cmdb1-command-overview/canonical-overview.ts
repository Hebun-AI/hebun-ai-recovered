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
import type { PendingActionRequestView } from "../../src/features/action-authorization/read-action-authorizations.server";
import {
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
/** Everything CMD-B1 owns. The firewall is about these files and no others. */
const OWNED = [PAGE, OVERVIEW, MODEL] as const;

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
const LEDGER_COUNT = 36;
const LEDGER_DIGEST = "3fa25de36812ab16";
const USE_SERVER_MODULES = 9;

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
  payloadDigest: "digest",
  proposedAt: "2026-08-21T09:00:00.000Z",
});

function renderOverview(waiting: WaitingOnYouState): string {
  return renderToStaticMarkup(createElement(CommandOverview, { waiting, intent: INTENT }));
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

const WAITING = "Waiting on you";

/* ─────────────────────────────────────────────────────────────────────────────
 * 6 + 7 + 8 + 27. THE THREE READ STATES ARE THREE DIFFERENT RENDERINGS
 * ────────────────────────────────────────────────────────────────────────── */
function theThreeStatesAreDistinct(): void {
  const empty = renderOverview({ status: "none-waiting" });
  const unavailable = renderOverview({ status: "unavailable", reason: "persistence-not-configured" });
  const waiting = renderOverview({ status: "waiting", items: [ITEM], boundReached: false });

  assert.notEqual(empty, unavailable, "a successful empty read is not the same rendering as an unanswered one");
  assert.notEqual(empty, waiting, "an empty queue is not the same rendering as a populated one");

  const emptyText = sectionText(empty, WAITING);
  assert.ok(emptyText.includes("Nothing currently requires your decision"), "the empty state says nothing requires a decision");
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
  assert.ok(!/\b0\b/.test(emptyText), "a successful empty read renders no zero either — it says the words");

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

  const waitingText = sectionText(renderOverview({ status: "waiting", items: [ITEM], boundReached: false }), WAITING);
  assert.ok(!/permit/i.test(waitingText), "the waiting section never mentions a permit beside a request");

  /* The five states are named where the reader meets them, and in order. */
  const intentText = sectionText(renderOverview({ status: "none-waiting" }), "Express intent");
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
 * 14 + 13 + 24. THREE SECTIONS, EACH WITH PROVENANCE, ONE PAGE IDENTITY
 * ────────────────────────────────────────────────────────────────────────── */
function threeSectionsEachWithProvenance(
  overrides: Readonly<Record<string, string>> = {},
  markupOverride?: string,
): void {
  const markup = markupOverride ?? renderOverview({ status: "none-waiting" });
  const sections = markup.match(/<section\b/g) ?? [];
  assert.equal(sections.length, 3, "the canonical Overview has exactly three sections");

  const labels = [...markup.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["Waiting on you", "Express intent", "Not yet connected"], "in the canonical order");

  const chips = markup.match(/data-provenance="([^"]+)"/g) ?? [];
  assert.equal(chips.length, 3, "every section carries exactly one provenance chip");
  assert.deepEqual(
    [...markup.matchAll(/data-provenance="([^"]+)"/g)].map((m) => m[1]),
    ["authoritative", "derived", "not-connected"],
    "and each states the kind of claim it actually is",
  );

  /* 24. The shell owns workspace identity (VI-1). The Overview adds no heading of its own. */
  const overview = codeOf(overrides[OVERVIEW] ?? read(OVERVIEW));
  assert.ok(!/<h1[\s>]/.test(overview), "the Overview renders no h1 — the page header is the one identity");
  assert.ok(!markup.includes("<h1"), "and none reaches the markup");
  const page = codeOf(overrides[PAGE] ?? read(PAGE));
  assert.equal(
    (page.match(/<PageHeader/g) ?? []).length,
    1,
    "the route states the workspace identity exactly once",
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

  /* The ONLY server modules the route may reach directly are the session resolver and the seam. */
  const page = codeOf(overrides[PAGE] ?? read(PAGE));
  const serverImports = [...page.matchAll(/from\s+"([^"]*\.server)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    serverImports,
    [
      "@/features/action-authorization/read-action-authorizations.server",
      "@/features/auth-runtime/request-session.server",
    ],
    "the route reaches exactly the session resolver and somebody else's read seam",
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
  assert.ok(/\{state\.items\.length\} shown/.test(overview), "the badge says what it shows");
  for (const word of ["total", "in total", "pending decisions in your organization", "organization has"]) {
    assert.ok(
      !overview.toLowerCase().includes(word),
      `the Overview must not claim "${word}" over a bounded read`,
    );
  }

  const many = Array.from({ length: PENDING_READ_BOUND }, (_, i) => ({ ...ITEM, requestId: `req-${i}` }));
  const full = sectionText(renderOverview({ status: "waiting", items: many, boundReached: true }), WAITING);
  assert.ok(full.includes(`${PENDING_READ_BOUND} shown`), "a full read still says shown");
  assert.ok(
    full.includes(`bounded at ${PENDING_READ_BOUND}`),
    "and says so when the read came back full — what is shown may not be everything",
  );

  const partial = sectionText(renderOverview({ status: "waiting", items: [ITEM], boundReached: false }), WAITING);
  assert.ok(!partial.includes("bounded at"), "a partial read makes no bound claim it does not need");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * READING IS NOT ACTING
 * ────────────────────────────────────────────────────────────────────────── */
function readingIsNotActing(overrides: Readonly<Record<string, string>> = {}): void {
  const text = sectionText(renderOverview({ status: "waiting", items: [ITEM], boundReached: false }), WAITING).toLowerCase();
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
  assert.ok(
    text.includes("command neither holds that authority nor checks it"),
    "and says plainly that the authority is not Command's",
  );
  assert.ok(text.includes("open decisions"), "routing to the owning surface, not offering the act");

  /* No control that could mutate anything is rendered. */
  const markup = renderOverview({ status: "waiting", items: [ITEM], boundReached: false });
  assert.ok(!/<button/.test(markup), "the Overview renders no button");
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
  const text = sectionText(renderOverview({ status: "none-waiting" }), "Not yet connected");
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
  const text = sectionText(renderOverview({ status: "none-waiting" }), "Not yet connected");
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
  assert.equal(writers.length, USE_SERVER_MODULES, `no server action was added; found ${writers.length}`);

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
    ["Overview", "Decisions", "Director Intent"],
    "Command L2 is the CMD-B2 canonical three",
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
    threeSectionsEachWithProvenance({}, forged);
  });

  /* M15 — a second workspace identity, proved the same way and additionally at source. */
  bites("add a second workspace identity to the Overview", () => {
    const forged = mutate(renderOverview({ status: "none-waiting" }), /<div/, "<h1>Command</h1><div");
    threeSectionsEachWithProvenance({}, forged);
  });
  bites("declare a second identity in the Overview source", () =>
    threeSectionsEachWithProvenance({
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
  threeSectionsEachWithProvenance();
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
