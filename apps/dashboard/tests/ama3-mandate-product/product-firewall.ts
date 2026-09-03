/*
 * AMA-3 — THE PRODUCT REACHES THE MANDATE AUTHORITY, AND GAINS NOTHING ON THE WAY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human can read and record an agent mandate through the product, and the ONLY thing that
 *    writes one is still the single released writer. The UI holds no second writer, no direct table
 *    write, no tenant parameter and no scope vocabulary of its own. Heby gained a READ and nothing
 *    else. The seeded, in-memory agent definitions are still non-authoritative and still cannot be
 *    mistaken for the durable agent — and AMA-3 did not promote them."
 *
 * The pins:
 *
 *   MANDATE     != PERMISSION
 *   MANDATE     != AUTHORIZATION
 *   MANDATE     != EXECUTION AUTHORITY
 *   MANDATE     != CAPABILITY AVAILABILITY
 *   SEEDED      != DURABLE
 *   NO MANDATE  != UNLIMITED MANDATE
 *   UNAVAILABLE != NO MANDATE
 *
 * Structural assertions run over comment-stripped source, so the phase's own honest prose about
 * what it refuses to do can never satisfy — or trip — a check about what it does.
 * Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { codeOf, performsDurableWrite } from "../helpers/durable-write-detector";
import { MANDATE_SCOPE_VOCABULARY } from "../../src/features/agent-mandate/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import {
  HEBY_PROFILED_WORKSPACES,
  getHebyWorkspaceProfile,
} from "../../src/features/heby-integration/workspace-registry";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const MANDATE_FEATURE = "src/features/agent-mandate";
const WRITER = `${MANDATE_FEATURE}/establish-agent-mandate.server.ts`;
const GROUNDING = `${MANDATE_FEATURE}/heby-mandate-source.server.ts`;
const ACTIONS = "src/app/(dashboard)/agents/actions.ts";
const PAGE = "src/app/(dashboard)/agents/page.tsx";
const CARD = "src/components/agents/agent-mandate-card.tsx";
const JOURNAL = "src/db/migrations/meta/_journal.json";

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. STILL EXACTLY ONE MANDATE WRITER, AND THE PRODUCT IS NOT A SECOND ONE.
 * ═════════════════════════════════════════════════════════════════════════ */
function exactlyOneWriterSurvivedTheProductConnection(): void {
  const writersOf = (symbol: string): string[] =>
    collect("src")
      .filter((f) =>
        new RegExp(`\\.\\s*(?:insert|update|delete)\\s*\\(\\s*${symbol}\\s*\\)`).test(
          codeOf(read(f)),
        ),
      )
      .sort();

  assert.deepEqual(
    writersOf("agentMandates"),
    [WRITER],
    "AMA-1's census is unchanged: exactly ONE module writes a mandate, and it is not the product",
  );

  /* The UI holds no durable write of any kind — it is transport to an authority, not an authority. */
  for (const file of [CARD, PAGE]) {
    assert.ok(
      !performsDurableWrite(read(file)),
      `${file} performs no durable write — the surface asks an authority, it is not one`,
    );
  }

  /*
   * THE ACTION IS TRANSPORT. It calls the released writer and holds no INSERT, no table import and
   * no database handle of its own, so it cannot drift from the rules it fronts.
   */
  const actions = codeOf(read(ACTIONS));
  assert.ok(
    actions.includes("establishAgentMandate("),
    "the action calls the ONE released mandate writer",
  );
  for (const forbidden of [
    "agentMandates",
    "db/schema/agent-mandate",
    "getControlPlaneDb",
    "resolveGovernanceDbOrNull",
    "drizzle-orm",
    ".insert(",
    ".update(",
    ".delete(",
    "transaction(",
  ]) {
    assert.ok(
      !actions.includes(forbidden),
      `the server action does not reach ${forbidden} — it is transport, never authority`,
    );
  }

  /* And exactly one product path reaches the writer, so there is no second workflow to maintain. */
  const callers = collect("src")
    .filter((f) => f !== WRITER && !f.startsWith(MANDATE_FEATURE))
    .filter((f) => /\bestablishAgentMandate\s*\(/.test(codeOf(read(f))))
    .sort();
  assert.deepEqual(
    callers,
    [ACTIONS],
    "exactly ONE product caller of the mandate writer",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE CLIENT CANNOT SUPPLY AUTHORITY, AND NO FIELD EXISTS FOR IT.
 * ═════════════════════════════════════════════════════════════════════════ */
function theClientSuppliesNoAuthority(): void {
  const actions = codeOf(read(ACTIONS));
  const start = actions.indexOf("establishAgentMandateAction(");
  assert.notEqual(start, -1, "the action exists under its released name");
  const body = actions.slice(start);

  /* Exactly the five legitimate inputs the released writer already admits. */
  for (const admitted of [
    "agentId",
    "purpose",
    "proposalScope",
    "justification",
    "observedMandateRevision",
  ]) {
    assert.ok(body.includes(admitted), `the action forwards ${admitted}`);
  }

  /*
   * AND NOTHING THE SERVER MUST DERIVE. Each of these is a field that, if the client could send it,
   * would let a browser name the organization, the actor, the authorizing decision or the position
   * in the supersession chain.
   */
  for (const forbidden of [
    "tenantId",
    "userId",
    "governanceDecisionId",
    "governanceSessionId",
    "establishedByActorId",
    "establishedByActorType",
    "mandateRevision:",
    "supersedesMandateId",
    "effectiveFrom",
    "authorityCeiling",
    "authority_ceiling",
  ]) {
    assert.ok(
      !body.includes(forbidden),
      `the client cannot supply ${forbidden} — the writer derives it`,
    );
  }

  /* The tenant comes from the resolved session, and there is no parameter for one. */
  assert.ok(
    body.includes("resolveTenantContext()"),
    "the tenant is resolved server-side from the authenticated session",
  );

  /*
   * THE CARD'S SUBMIT PAYLOAD, SCOPED TO THE CALL ITSELF.
   *
   * Not a file-wide identifier ban: the card RENDERS `governanceDecisionId` on purpose — Phase 2
   * requires the Governance binding to be inspectable, and it sits in progressive disclosure. So
   * the guard runs over what is SENT, which is the claim being made. A file-wide ban would have
   * punished the surface for showing a human the decision their mandate rests on.
   *
   *     DISPLAYING A BINDING != SUPPLYING ONE
   */
  const card = codeOf(read(CARD));
  const callAt = card.indexOf("establishAgentMandateAction({");
  assert.notEqual(callAt, -1, "the surface calls the action");
  const payload = card.slice(callAt, card.indexOf("});", callAt));
  for (const forbidden of [
    "tenantId",
    "userId",
    "governanceDecisionId",
    "governanceSessionId",
    "mandateRevision:",
    "supersedesMandateId",
    "effectiveFrom",
    "establishedByActorId",
  ]) {
    assert.ok(!payload.includes(forbidden), `the surface never SENDS ${forbidden}`);
  }
  /* And it sends the concurrency token it was SHOWN, never one a reader typed. */
  assert.ok(
    payload.includes("observedMandateRevision: observedRevision"),
    "the observed revision is the one the surface rendered — a token, never an input",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE UI OFFERS THE RELEASED VOCABULARY AND NOTHING ELSE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceCannotOfferAnInadmissibleScope(): void {
  const card = codeOf(read(CARD));
  assert.ok(
    card.includes("MANDATE_SCOPE_VOCABULARY"),
    "the scope selector is driven by the released vocabulary itself",
  );

  /*
   * NOT A COPY, AND NOT A LITERAL. A hard-coded list here would be a second vocabulary that could
   * drift from the one the writer and the database CHECK enforce.
   */
  for (const kind of MANDATE_SCOPE_VOCABULARY) {
    assert.ok(
      !new RegExp(`["'\`]${kind}["'\`]`).test(card),
      `the surface names no action kind literally (${kind}) — it renders the vocabulary`,
    );
  }
  assert.deepEqual(
    [...MANDATE_SCOPE_VOCABULARY],
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    "and the vocabulary is still the released originable one — AMA-3 widened nothing",
  );

  /*
   * WITHDRAWAL IS AN EMPTY SCOPE. No boolean, no lifecycle, no separate action — the released
   * semantic, or none.
   */
  for (const invented of [
    "withdrawMandate",
    "withdrawAgentMandate",
    "isWithdrawn",
    "mandateStatus",
    "revokeMandate",
    "deleteMandate",
  ]) {
    assert.ok(!card.includes(invented), `withdrawal is an empty scope, never ${invented}`);
    assert.ok(!codeOf(read(ACTIONS)).includes(invented), `and the action offers no ${invented}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE SURFACE CLAIMS A CEILING, NEVER A PERMISSION.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceClaimsNoAuthority(): void {
  const card = read(CARD);

  /*
   * Run over the RENDERED WORDS. The card must SAY "not permission" and "not authorization" —
   * denying them is half its job — so a vocabulary ban would fail on its own honest denial, the
   * collision AMA-1, AMA-2 and E2-4 onward each recorded. So the ban is on phrases that would make
   * a CLAIM, and the denials are pinned by presence instead.
   */
  for (const claim of [
    /is authorized to/i,
    /has permission to/i,
    /can execute/i,
    /will execute/i,
    /permissions granted/i,
    /capabilities granted/i,
    /without approval\b(?!.*still)/i,
  ]) {
    assert.ok(
      !claim.test(card),
      `the surface never claims ${claim.source} — MANDATE != PERMISSION`,
    );
  }

  /* And it states the ceiling in the words that make it one. */
  for (const required of [
    "may propose",
    "ceiling",
    "grants nothing",
    "still requires a human decision",
  ]) {
    assert.ok(card.includes(required), `the surface states "${required}"`);
  }

  /* The two states that must never merge are two distinct rendered sentences. */
  assert.ok(card.includes("NO MANDATE"), "absence is named");
  assert.ok(card.includes("UNAVAILABLE is not NO MANDATE"), "UNAVAILABLE != NO MANDATE, in words");
  assert.ok(
    card.includes("measured absence"),
    "an absent mandate is a measured absence, never a permission",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. HEBY GAINED A READ, AND ONLY A READ.
 * ═════════════════════════════════════════════════════════════════════════ */
function hebyGainedOnlyARead(): void {
  const grounding = codeOf(read(GROUNDING));

  /* No mutation of any kind exists in the projection — not uncalled, ABSENT. */
  for (const verb of ["insert", "update", "delete", "transaction"]) {
    assert.ok(
      !new RegExp(`\\.\\s*${verb}\\s*\\(`).test(grounding),
      `the grounding projection contains no \`.${verb}(\``,
    );
  }

  /*
   * AND IT IMPORTS THE READ SEAM MODULE, NEVER THE BARREL. The barrel re-exports
   * `establishAgentMandate`; importing it would put a Governance-bound mandate writer into Heby's
   * import graph for the sake of a read — G6C's defect, and the one AMA-2 refused in the proposal
   * writer's graph. Banned by EXACT specifier, since the legitimate relative import contains it.
   */
  const imports = [...grounding.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(
    !imports.includes("@/features/agent-mandate"),
    "the projection does not import the feature barrel",
  );
  assert.ok(
    !imports.some((i) => i.includes("establish-agent-mandate")),
    "and cannot reach the writer at all",
  );
  assert.ok(
    imports.includes("./read-agent-mandate.server"),
    "it reads through the released read seam",
  );

  /* Heby's answer path holds the projection, and no mandate writer anywhere. */
  const hebyFiles = [
    ...collect("src/features/heby-answer"),
    ...collect("src/features/heby-runtime"),
    ...collect("src/features/heby-integration"),
  ];
  for (const file of hebyFiles) {
    const source = codeOf(read(file));
    for (const forbidden of [
      /\bestablishAgentMandate\b/,
      /\bagentMandates\b/,
      /db\/schema\/agent-mandate/,
    ]) {
      assert.ok(
        !forbidden.test(source),
        `${file} cannot write a mandate (${forbidden.source}) — Heby grounds, it does not bound`,
      );
    }
  }

  /* The class is declared on exactly one workspace profile. */
  const declaring = [...HEBY_PROFILED_WORKSPACES]
    .filter((id) =>
      (getHebyWorkspaceProfile(id).sourceClasses as readonly string[]).includes("agent-mandate"),
    )
    .sort();
  assert.deepEqual(
    declaring,
    ["command"],
    "`agent-mandate` is declared on Command only — where /heby resolves and a Director asks",
  );
  /* `workforce` in particular did not gain it: that class is chartered for humans. */
  assert.ok(
    !(getHebyWorkspaceProfile("workforce").sourceClasses as readonly string[]).includes(
      "agent-mandate",
    ),
    "RUNTIME AGENT != WORKFORCE IDENTITY",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE SEEDED FICTION WAS MEASURED, AND IT WAS NOT PROMOTED.
 *
 * AMA-3 touched `/agents`. The risk this section exists to close is that the large seeded,
 * in-memory definition catalog quietly becomes organizational truth merely because something real
 * landed on the same page.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSeededFictionWasNotPromoted(): void {
  const page = read(PAGE);

  /*
   * ORDER IS THE TRUTH CLAIM. The durable identity ceremony, then the authoritative mandate, and
   * the seeded surface LAST. A reader meets what is real before what is simulated.
   */
  const identityAt = page.indexOf("<DurableAgentIdentityCard");
  const mandateAt = page.indexOf("<AgentMandateCard");
  const seededAt = page.indexOf("<AgentsTruthSurface");
  assert.ok(identityAt !== -1 && mandateAt !== -1 && seededAt !== -1, "all three regions render");
  assert.ok(identityAt < mandateAt, "identity precedes the mandate — an agent exists, then is bounded");
  assert.ok(
    mandateAt < seededAt,
    "AUTHORITATIVE MANDATE PRECEDES THE SEEDED CATALOG — SEEDED != DURABLE",
  );

  /* The page still names the catalog as seeded and in-memory, in its own header context. */
  assert.ok(
    /seeded agent definitions/.test(page) && /in-memory registry/.test(page),
    "the catalog is still labelled seeded and in-memory",
  );

  /*
   * AND NO MANDATE REACHES IT. The mandate card renders durable identities only; the seeded model
   * has no mandate field, no mandate read, and no path to the writer.
   */
  for (const file of [
    "src/components/agents/agents-truth-surface.tsx",
    "src/components/agents/agent-registry-workspace.tsx",
    "src/features/workforce/agents-truth-model.ts",
  ]) {
    const source = codeOf(read(file));
    for (const forbidden of [
      /agent-mandate/,
      /agentMandates/,
      /establishAgentMandate/,
      /readEffectiveAgentMandate/,
    ]) {
      assert.ok(
        !forbidden.test(source),
        `${file} holds no mandate (${forbidden.source}) — a seeded definition is not a durable agent`,
      );
    }
  }

  /*
   * THE MANDATE CARD RENDERS DURABLE IDENTITIES ONLY. Its entry type is keyed on
   * `DurableAgentIdentityRecord`, so a seeded definition is not merely filtered out — it is
   * unrepresentable as a mandate subject.
   */
  const card = codeOf(read(CARD));
  assert.ok(
    card.includes("DurableAgentIdentityRecord"),
    "the mandate surface is typed on the durable identity record",
  );
  for (const seededType of ["AgentDefinitionView", "AgentsTruthModel", "agent-crud"]) {
    assert.ok(!card.includes(seededType), `and never on the seeded model (${seededType})`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. AMA-3 CREATED NO SCHEMA, NO AGENT AND NO NEW AUTHORITY.
 * ═════════════════════════════════════════════════════════════════════════ */
function amA3AddedNoAuthority(): void {
  const journal = JSON.parse(read(JOURNAL)) as { entries: readonly unknown[] };
  assert.equal(
    journal.entries.length,
    46, /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46 (`heby_action_requests` purpose columns). */
    "the migration ledger is unchanged by AMA-3 — it is a surface and a read", /* WORK-1 grew it 41 -> 42. */
  );

  const writersOf = (symbol: string): string[] =>
    collect("src")
      .filter((f) =>
        new RegExp(`\\.\\s*(?:insert|update|delete)\\s*\\(\\s*${symbol}\\s*\\)`).test(
          codeOf(read(f)),
        ),
      )
      .sort();

  /* `agents` still has exactly the two identity writers. Bounding an agent never changes one. */
  assert.deepEqual(
    writersOf("agents"),
    [
      path.join("src", "features", "agent-identity", "create-durable-agent-identity.server.ts"),
      path.join("src", "features", "agent-identity", "retire-durable-agent-identity.server.ts"),
    ],
    "still exactly two writers of `agents` — AGENT IDENTITY != AGENT MANDATE",
  );
  for (const inert of ["permissions", "rolePermissions"]) {
    assert.deepEqual(writersOf(inert), [], `\`${inert}\` still has zero writers`);
  }

  /*
   * AND THE PRODUCT PATH REACHES NO CONSEQUENTIAL CAPABILITY. Asserted as unreachable imports on
   * the two files that carry the workflow.
   */
  for (const file of [ACTIONS, CARD]) {
    const imports = [...codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    for (const forbidden of [
      "action-permit",
      "action-execution",
      "consume-action-permit",
      "revoke-action-permit",
      "decide-action-request",
      "provider-google",
      "provider-github",
      "integration-credential",
      "secret-encryption",
      "claude-transport",
      "heby-model",
      "role-permission",
      "schema/permission",
    ]) {
      assert.ok(
        !imports.some((i) => i.includes(forbidden)),
        `${file} does not import ${forbidden} — a mandate mints nothing`,
      );
    }
  }

  /* NO SECOND AGENT. AMA-3 creates none, and the surface offers no way to. */
  const card = codeOf(read(CARD));
  assert.ok(
    !card.includes("createDurableAgentIdentity"),
    "the mandate surface cannot create an agent — that is the ceremony above it",
  );
}

exactlyOneWriterSurvivedTheProductConnection();
theClientSuppliesNoAuthority();
theSurfaceCannotOfferAnInadmissibleScope();
theSurfaceClaimsNoAuthority();
hebyGainedOnlyARead();
theSeededFictionWasNotPromoted();
amA3AddedNoAuthority();

console.log("ama3-mandate-product/product-firewall: OK");
