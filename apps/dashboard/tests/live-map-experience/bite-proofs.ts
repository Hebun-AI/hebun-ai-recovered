/*
 * LMX-1 — BITE-PROOFS.
 *
 * A product milestone's guarantees are the easiest to lose, because every one of them can be
 * removed by an edit that makes the page look better. So each is mutated in the SHIPPED SOURCE and
 * the suite defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — one that
 * cannot be applied looks exactly like one that failed to bite), it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const MAP_SUITE = "tests/live-map-experience/map-surface.ts";
const AWARENESS_SUITE = "tests/live-map-experience/awareness.ts";
const FIREWALL_SUITE = "tests/live-map-experience/firewall.ts";
const INVARIANT_SUITE = "tests/live-map-experience/rendering-invariant.ts";
const CARD_SUITE = "tests/live-map-experience/card-anatomy.ts";
const DARK_SUITE = "tests/live-map-experience/dark-scope.ts";
const OFFICE_SUITE = "tests/live-map-experience/office-scene.ts";
const AGENT_OFFICE_SUITE = "tests/live-map-experience/agent-office.ts";
const AGENT_OFFICE_POSTGRES_SUITE = "tests/live-map-experience/agent-office-postgres.ts";
const PLACEMENT_FIREWALL_SUITE = "tests/ap2-agent-placement/firewall.ts";

const CANVAS = "src/components/live-map/live-map-canvas.tsx";
const BAND = "src/components/awareness/global-awareness.tsx";
const LM_AWARENESS = "src/features/live-map/awareness.ts";
const SEC_AWARENESS = "src/features/security-center/awareness.ts";
const COMMAND_PAGE = "src/app/(dashboard)/command/page.tsx";
const LIVE_MAP_PAGE = "src/app/(dashboard)/live-map/page.tsx";
const RESOLVER = "src/features/auth-runtime/request-session.server.ts";
const STYLESHEET = "src/app/globals.css";
const OFFICE = "src/components/live-map/agent-office-scene.tsx";
const OFFICE_PAGE = "src/components/live-map/agent-office-page.tsx";
const OFFICE_ROUTE = "src/app/(dashboard)/live-map/agents/[agentId]/page.tsx";
const OFFICE_NOT_FOUND = "src/app/(dashboard)/live-map/agents/[agentId]/not-found.tsx";
const OFFICE_THEME = "src/features/live-map/office-theme.ts";
const PROJECTION = "src/features/live-map/read-live-map.server.ts";
const IDENTITY_READER = "src/features/agent-identity/read-durable-agent-identity.server.ts";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

function runSuite(suite: string): SuiteRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  /*
   * PHASE 4B — THE OFFICE ROUTE. Each of these is a way the page could look finished and lie.
   */
  {
    label: "P1 the seam falls back to the first agent",
    file: PROJECTION,
    suite: AGENT_OFFICE_SUITE,
    find: `const node = agents.state.nodes.find((candidate) => candidate.officeRoute === route);`,
    replace: `const node = agents.state.nodes[0];`,
    expect: "an id outside this tenant's list",
  },
  {
    label: "P2 an unanswered authority reads as an absent agent",
    file: PROJECTION,
    suite: AGENT_OFFICE_SUITE,
    find: `return { status: "unavailable", detail: agents.state.detail };`,
    replace: `return { status: "not-found" };`,
    expect: "an unread authority is never not-found",
  },
  {
    label: "P3 the not-found page explains itself",
    file: OFFICE_NOT_FOUND,
    suite: AGENT_OFFICE_SUITE,
    find: `There is no agent office at this address.`,
    replace: `This agent belongs to another organization.`,
    expect: "no reason is offered",
  },
  {
    label: "P4 the panel prints a measured-looking zero",
    file: OFFICE_PAGE,
    suite: AGENT_OFFICE_SUITE,
    find: `<p className="lm-notice">{LIVE_MAP_TEAM_RELATION_ABSENT}</p>`,
    replace: `<p className="lm-notice">0 subagents</p>`,
    expect: "the relationship has no owner",
  },
  {
    label: "P5 a missing placement row reads as unplaced",
    file: PROJECTION,
    suite: AGENT_OFFICE_SUITE,
    find: `if (!view) return { status: "unavailable" };`,
    replace: `if (!view) return { status: "available", state: "unplaced", department: null };`,
    expect: "no row is not unplaced",
  },
  {
    label: "P6 an unread observation headlines as zeros",
    file: OFFICE_PAGE,
    suite: AGENT_OFFICE_SUITE,
    find: `const counts = node.intelligence ? headlineCounts(node.intelligence) : null;`,
    replace: `const counts = (node.intelligence ? headlineCounts(node.intelligence) : null) ?? { filed: 0, approved: 0, neverExecuted: 0 };`,
    expect: "an unread observation prints no zero",
  },
  {
    label: "P7 a historical placement picks a room",
    file: OFFICE_THEME,
    suite: AGENT_OFFICE_SUITE,
    find: `if (placement.status !== "available" || placement.state !== "placed") return "neutral";`,
    replace: `if (placement.status !== "available") return "neutral";`,
    expect: "is not a current placement",
  },
  {
    label: "P8 Details loses the attention block",
    file: OFFICE_PAGE,
    suite: AGENT_OFFICE_SUITE,
    find: `{node.attention ? <AttentionAnnotation attention={node.attention} /> : null}`,
    replace: `{null}`,
    expect: "Oldest proposal awaiting a decision",
  },
  {
    label: "P16 the way back shrinks below a 44px target",
    file: STYLESHEET,
    suite: AGENT_OFFICE_SUITE,
    find: `  min-height: 2.75rem;
  border-radius: 0.375rem;`,
    replace: `  min-height: 1.5rem;
  border-radius: 0.375rem;`,
    expect: "the way back is at least 44px tall",
  },
  {
    label: "P9 the route accepts a query parameter",
    file: OFFICE_ROUTE,
    suite: FIREWALL_SUITE,
    find: `  params: Promise<{ agentId: string }>;`,
    replace: `  params: Promise<{ agentId: string }>;\n  searchParams: Promise<{ tenant?: string }>;`,
    expect: "the office takes no query parameter",
  },
  {
    label: "P10 the route becomes prerenderable",
    file: OFFICE_ROUTE,
    suite: FIREWALL_SUITE,
    find: `export const metadata = { title: "Agent office — Hebun AI" };`,
    replace: `export const metadata = { title: "Agent office — Hebun AI" };\nexport const dynamic = "force-static";`,
    expect: "a tenant page is never prerendered",
  },
  {
    label: "P11 the route turns every non-answer into a 404",
    file: OFFICE_ROUTE,
    suite: FIREWALL_SUITE,
    find: `if (office.status === "not-found") notFound();`,
    replace: `if (office.status !== "found") notFound();`,
    expect: "only a true absence is a 404",
  },
  {
    label: "P12 the theme is given the agent's name",
    file: OFFICE_THEME,
    suite: FIREWALL_SUITE,
    find: `const slug = placement.department?.slug;`,
    replace: `const slug = placement.department?.name;`,
    expect: "only the placement reaches it",
  },
  {
    /* THE NEGATIVE CONTROL for the one consumer PHASE 4B added to the placement census. */
    label: "P14 Live Map reaches the placement writer",
    file: PROJECTION,
    suite: PLACEMENT_FIREWALL_SUITE,
    find: `import { readAgentPlacements } from "@/features/organization-authority/read-agent-placement.server";`,
    replace: `import { readAgentPlacements } from "@/features/organization-authority/read-agent-placement.server";\nimport "@/features/organization-authority/write-agent-placement.server";`,
    expect: "reads placement and can never write it",
  },
  {
    /* THE CENSUS ITSELF STILL BITES: an authority module cannot quietly join the list. */
    label: "P15 a mandate module reaches agent placement",
    file: "src/features/agent-mandate/read-agent-mandate.server.ts",
    suite: PLACEMENT_FIREWALL_SUITE,
    find: `import { workDomains } from "@/db/schema/work-domain";`,
    replace: `import { workDomains } from "@/db/schema/work-domain";\nimport { readAgentPlacements } from "@/features/organization-authority/read-agent-placement.server";`,
    expect: "no mandate, capability",
  },
  {
    /* THE REAL TENANT PROOF: the released predicate is what keeps tenant B out of this list. */
    label: "P13 the identity read loses its tenant predicate",
    file: IDENTITY_READER,
    suite: AGENT_OFFICE_POSTGRES_SUITE,
    find: `      .where(eq(agents.tenantId, tenant.tenantId))\n      .orderBy(desc(agents.createdAt));`,
    replace: `      .orderBy(desc(agents.createdAt));`,
    expect: "tenant B's agent does not exist for tenant A",
  },
  {
    /* M1 — THE ORGANIZATION LOSES THE CENTRE. The map's whole claim is where it puts the reader. */
    label: "M1 the organization is demoted out of the map's centre",
    file: CANVAS,
    suite: MAP_SUITE,
    find: `        <div className="lm-centre">`,
    replace: `        <div className="lm-aside">`,
    expect: "the organization node sits in the map's centre slot",
  },
  {
    /* M2 — A LINE DRAWN TO SOMETHING THE READER CANNOT SEE. */
    label: "M2 the spine is drawn with no organization on the map",
    file: CANVAS,
    suite: MAP_SUITE,
    find: `  const connected = Boolean(organizationNode) && agentNodes.length > 0;`,
    replace: `  const connected = agentNodes.length > 0;`,
    expect: "with no visible organization the spine is not drawn",
  },
  {
    /* M3 — THE PICTURE KEEPS THE LINE AND DROPS THE PROOF. */
    label: "M3 the drawn relationship stops naming the column that proves it",
    file: CANVAS,
    suite: MAP_SUITE,
    /* LM-1 renders one line per relation kind; the guarantee — the basis is printed — is unchanged. */
    find: `          {basis}`,
    replace: `          These are related.`,
    expect: "the durable column that proves it is printed",
  },
  {
    /* M4 — EVERY CARD STARTS SPENDING A FULL AUTHORITY READ ON AN OFFICE NOBODY OPENED. */
    label: "M4 the card link starts prefetching",
    file: CANVAS,
    suite: FIREWALL_SUITE,
    find: `<Link className="lm-node" href={node.officeRoute ?? "/agents"} prefetch={false}>`,
    replace: `<Link className="lm-node" href={node.officeRoute ?? "/agents"}>`,
    expect: "nothing prefetches an office",
  },
  {
    /* M5 — A CONTROL ON A MAP IMPLIES AN AUTHORITY THE MAP DOES NOT HAVE. */
    label: "M5 the map gains an action control",
    file: CANVAS,
    suite: FIREWALL_SUITE,
    find: `      <div className="lm-absences">`,
    replace: `      <button type="button">Reassign</button>\n      <div className="lm-absences">`,
    expect: `the map discloses, it does not act — "<button"`,
  },
  {
    /*
     * M6 — THE DEFECT A PICTURE COMMITS MOST EASILY. An unread observation rendered as three zeros
     * tells a Director that a working agent has proposed nothing.
     */
    label: "M6 an unread observation glances as zeros",
    file: CANVAS,
    suite: MAP_SUITE,
    find: `  if (intelligence.status === "unavailable") {
    return <span className="lm-glance lm-glance-unread">Outcome observation unread</span>;
  }`,
    replace: `  if (intelligence.status === "unavailable") {
    return (
      <span className="lm-glance">
        <Metric value={0} label="filed" />{" "}
        <Metric value={0} label="approved" />{" "}
        <Metric value={0} label="never executed" />
      </span>
    );
  }`,
    expect: "the glance line says it could not be read",
  },
  {
    /* M7 — A MEASURED ZERO AND AN UNREAD AUTHORITY COLLAPSE INTO ONE NUMBER. */
    label: "M7 a known-empty agent domain is summarised as a count of zero",
    file: LM_AWARENESS,
    suite: AWARENESS_SUITE,
    find: `      : agentDomain?.state.status === "known-empty"
        ? { status: "known-empty" }`,
    replace: `      : agentDomain?.state.status === "known-empty"
        ? { status: "counted", count: 0 }`,
    expect: "a measured zero keeps its own state",
  },
  {
    /* M8 — THE ONE SENTENCE A LEDGER CAN NEVER SUPPORT. */
    label: "M8 Security Live announces a security posture",
    file: BAND,
    suite: AWARENESS_SUITE,
    find: `        ? "No governed act has been recorded"`,
    replace: `        ? "All systems secure"`,
    expect: `must not present "all systems"`,
  },
  {
    /* M9 — THE BOUNDED PAGE IS REPORTED AS THE WHOLE RECORD. */
    label: "M9 the recorded-act total becomes the page length",
    file: SEC_AWARENESS,
    suite: AWARENESS_SUITE,
    find: `          totalRecordedActs: observation.totalRecordedActs,`,
    replace: `          totalRecordedActs: observation.acts.length,`,
    expect: "the INDEPENDENT total, not the page length",
  },
  {
    /* M10 — A DERIVED VIEW CLAIMS THE STANDING OF THE RECORD IT WAS COMPUTED FROM. */
    label: "M10 the security observation marks itself authoritative",
    file: SEC_AWARENESS,
    suite: AWARENESS_SUITE,
    find: `    authoritative: observation.authoritative,`,
    replace: `    authoritative: true as unknown as false,`,
    expect: "the observation is derived, and says so",
  },
  {
    /* M11 — THE SUMMARY ACQUIRES A READ, AND WITH IT THE ABILITY TO DISAGREE WITH THE MAP. */
    label: "M11 the awareness summary performs its own read",
    file: LM_AWARENESS,
    suite: FIREWALL_SUITE,
    find: `import type { LiveMapProjection } from "./contracts";`,
    replace:
      `import type { LiveMapProjection } from "./contracts";\n` +
      `import { readLiveMapProjection } from "./read-live-map.server";\n` +
      `void readLiveMapProjection;`,
    expect: "a second read waiting to disagree",
  },
  {
    /* M12 — A PRETTIER ROUTE THAT DOES NOT EXIST. */
    label: "M12 Security Live points at an invented route",
    file: BAND,
    suite: FIREWALL_SUITE,
    find: `      href="/director/governance/security"`,
    replace: `      href="/security"`,
    expect: "no route was invented for prettier IA",
  },
  {
    /*
     * M13 — THE RENDERING INVARIANT ITSELF. If the resolver stops reaching a request-bound API
     * while auth is configured, Next.js may prerender an authenticated route into reusable HTML.
     */
    label: "M13 the resolver stops reaching the request under configured auth",
    file: RESOLVER,
    suite: INVARIANT_SUITE,
    find: `  const env = getAuthEnvironment();
  if (env.status !== "configured") return null;
  const result = await resolveRequestAuthentication(env);`,
    replace: `  const env = getAuthEnvironment();
  if (env.status !== "configured") return null;
  if (env.provider === "local") return null;
  const result = await resolveRequestAuthentication(env);`,
    expect: "MUST reach a request-bound API",
  },
  {
    /* M14 — AND THE OTHER WAY IN: A ROUTE THAT OPTS ITSELF BACK INTO REUSABLE OUTPUT. */
    label: "M14 the map route declares itself force-static",
    file: LIVE_MAP_PAGE,
    suite: INVARIANT_SUITE,
    find: `export const metadata = { title: "Live Map — Hebun AI" };`,
    replace: `export const dynamic = "force-static";\nexport const metadata = { title: "Live Map — Hebun AI" };`,
    expect: "force-static would make this route reusable across tenants",
  },
  {
    /* M15 — THE PRODUCT LABEL BECOMES A RUNTIME CLAIM. */
    label: "M15 Security Live claims continuous monitoring",
    file: BAND,
    suite: AWARENESS_SUITE,
    find: `      footnote={awareness.limits}`,
    replace: `      footnote="Real-time security monitoring, updated continuously."`,
    expect: `no panel may claim "real-time"`,
  },
  {
    /* M16 — TWO RESOLUTIONS CAN DESCRIBE TWO INSTANTS, AND THE PANELS WOULD DISAGREE. */
    label: "M16 the landing route resolves the tenant twice",
    file: COMMAND_PAGE,
    suite: FIREWALL_SUITE,
    find: `  const tenant = await resolveTenantContext();`,
    replace: `  const tenant = await resolveTenantContext();\n  const again = await resolveTenantContext();\n  void again;`,
    expect: "resolves the tenant exactly once",
  },
  {
    /* C1 — A LABEL TAKES THE COUNTS AWAY FROM A SCREEN READER AGAIN. */
    label: "C1 the card link gains an aria-label",
    file: CANVAS,
    suite: CARD_SUITE,
    find: `<Link className="lm-node" href={node.officeRoute ?? "/agents"} prefetch={false}>`,
    replace: `<Link className="lm-node" aria-label={node.label} href={node.officeRoute ?? "/agents"} prefetch={false}>`,
    expect: "no aria-label replaces the card's own text",
  },
  {
    /* C2 — NO WHITESPACE IS DRAWN BETWEEN FLEX ITEMS, SO ITS LOSS IS INVISIBLE TO A SIGHTED READER. */
    label: "C2 two counts run together in the document's text",
    file: CANVAS,
    suite: CARD_SUITE,
    find: `      <Metric value={counts.filed} label="filed" />{" "}`,
    replace: `      <Metric value={counts.filed} label="filed" />`,
    expect: "all three counts read in order",
  },
  {
    /* C3 — BLOCK CONTENT INSIDE THE LINK. */
    label: "C3 the card link gains a block element",
    file: CANVAS,
    suite: CARD_SUITE,
    find: `          <ChevronRight className="lm-node-chevron size-4" aria-hidden="true" />`,
    replace: `          <div><ChevronRight className="lm-node-chevron size-4" aria-hidden="true" /></div>`,
    expect: "nothing block-level",
  },
  {
    /* C4 — THE FIELD STARTS TO VARY BY AGENT, WHICH IS HOW A PICTURE OF WORK ARRIVES. */
    label: "C4 the field is keyed to an agent",
    file: CANVAS,
    suite: CARD_SUITE,
    find: `        <span className="lm-field">`,
    replace: `        <span className="lm-field" data-office={node.label}>`,
    expect: "dressed like every other agent",
  },
  {
    /* C5 — A FIXED HEIGHT CUTS TEXT THE MOMENT A READER ASKS FOR MORE SPACING. */
    label: "C5 the card gets a fixed height",
    file: STYLESHEET,
    suite: CARD_SUITE,
    find: `.lm-agent { min-height: 223px;`,
    replace: `.lm-agent { height: 223px;`,
    expect: "never a fixed height",
  },
  {
    /* C6 — THE FIELD TAKES A FILE. */
    label: "C6 the field is drawn from an image",
    file: STYLESHEET,
    suite: CARD_SUITE,
    find: `    linear-gradient(180deg, var(--lms-field-b), var(--lms-field-c));`,
    replace: `    url("/agent-offices/heby.webp");`,
    expect: "the field is drawn from tokens",
  },
  {
    /* C7 — COLUMNS FOLLOW THE WINDOW, AND THE SIDEBAR'S WIDTH IS NOBODY'S PROBLEM. */
    label: "C7 the columns stop following the content width",
    file: STYLESHEET,
    suite: CARD_SUITE,
    find: `  container: lm-agents / inline-size;\n`,
    replace: ``,
    expect: "columns follow the content width",
  },
  {
    /* C8 — THE LINE FADES BACK BELOW WHAT IT HAS TO SAY. */
    label: "C8 the spine fades out again",
    file: STYLESHEET,
    suite: DARK_SUITE,
    find: `  height: var(--lm-stem);\n  background: var(--lm-line);`,
    replace: `  height: var(--lm-stem);\n  background: linear-gradient(to bottom, transparent, var(--lm-line));`,
    expect: "no gradient fades it",
  },
  {
    /* C9 — THE LINE ITSELF BECOMES TOO FAINT TO SEE. */
    label: "C9 the line drops below 3:1",
    file: STYLESHEET,
    suite: DARK_SUITE,
    find: `var(--color-text-muted) 65%, var(--color-surface)`,
    replace: `var(--color-text-muted) 30%, var(--color-surface)`,
    expect: "the line on the surface",
  },
  {
    /* O1 — A WORD ON THE SCREEN. A monitor that shows text looks like a monitor at work. */
    label: "O1 the standby screen gains a word",
    file: OFFICE,
    suite: OFFICE_SUITE,
    find: `      <Face at={screenFace} fill={paint("screen")} />`,
    replace: `      <Face at={screenFace} fill={paint("screen")} /><text>Ready</text>`,
    expect: "no <text in the drawing",
  },
  {
    /* O2 — IN SERVICE STARTS TO LOOK LIKE ACTIVITY. */
    label: "O2 the scene gains a working state",
    file: OFFICE,
    suite: OFFICE_SUITE,
    find: `  const seated = state !== "retired";`,
    replace: `  const seated = state !== "retired"; const working = state === "active"; void working;`,
    expect: "no such state exists",
  },
  {
    /* O3 — A RETIRED AGENT STAYS AT THE DESK. */
    label: "O3 a retired agent keeps its robot",
    file: OFFICE,
    suite: OFFICE_SUITE,
    find: `  const seated = state !== "retired";`,
    replace: `  const seated = true;`,
    expect: "a retired agent has an empty chair",
  },
  {
    /* O4 — THE HASH DRIFTS, AND EVERY AGENT CHANGES ROOM OVERNIGHT. */
    label: "O4 the variant hash changes",
    file: OFFICE,
    suite: OFFICE_SUITE,
    find: `  return { room: (hash % 4) + 1, head: ((hash >>> 8) % 4) + 1 };`,
    replace: `  return { room: ((hash + 1) % 4) + 1, head: ((hash >>> 8) % 4) + 1 };`,
    expect: "changing it re-dresses every agent",
  },
  {
    /* O5 — A SECOND ELEMENT TAKES AN ID, AND A REFERENCE QUIETLY DRAWS NOTHING. */
    label: "O5 two elements share an id",
    file: OFFICE,
    suite: OFFICE_SUITE,
    find: `<Gradient id="desk-top" `,
    replace: `<Gradient id="desk" `,
    expect: "duplicate id",
  },
  {
    /* O6 — THE ID IS READ RATHER THAN HASHED. */
    label: "O6 the node id is parsed",
    file: OFFICE,
    suite: OFFICE_SUITE,
    find: `  const hash = hashOpaqueId(nodeId);`,
    replace: `  const hash = hashOpaqueId(nodeId);\n  void nodeId.split(":");`,
    expect: "the id stays opaque",
  },
  {
    /* O7 — THE SCENE IS GIVEN A LITERAL COLOUR, AND IT LEAVES THE LIVE MAP SCOPE. */
    label: "O7 the scene spends a literal colour",
    file: OFFICE,
    suite: OFFICE_SUITE,
    find: `      <ellipse cx="0" cy="-13" rx="19" ry="6.4" fill={token("seat")} />`,
    replace: `      <ellipse cx="0" cy="-13" rx="19" ry="6.4" fill="#e0a137" />`,
    expect: "no hex in the scene",
  },
  {
    /* O8 — A NAME IS CUT AGAIN. Identity outranks decoration. */
    label: "O8 a long name is clamped",
    file: STYLESHEET,
    suite: OFFICE_SUITE,
    find: `[data-live-map] .lm-node-name {\n`,
    replace: `[data-live-map] .lm-node-name {\n  -webkit-line-clamp: 2;\n`,
    expect: "no name is ever cut",
  },
  {
    /* O9 — A FIXED SIZE. This is the exact defect the real route found: the room met the words. */
    label: "O9 the room stops following the card",
    file: STYLESHEET,
    suite: OFFICE_SUITE,
    find: `  --lm-scene-width: min(202px, calc(100cqw - 12.25rem));`,
    replace: `  --lm-scene-width: 202px;`,
    expect: "the room is sized from the card",
  },
  {
    /* O10 — HIGH CONTRAST KEEPS THE PICTURE AND LOSES THE MARGIN OF SAFETY. */
    label: "O10 forced colours keep the scene",
    file: STYLESHEET,
    suite: OFFICE_SUITE,
    find: `  [data-live-map] .lm-field { padding-bottom: 0.75rem; }\n  [data-live-map] .lm-scene { display: none; }\n`,
    replace: `  [data-live-map] .lm-field { padding-bottom: 0.75rem; }\n`,
    expect: "the scene steps aside",
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.ok(
    original.includes(mutation.find),
    `${mutation.label}: the find-string is not present in ${mutation.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    assert.equal(sha(readFile(mutation.file)), sha(mutated), `${mutation.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`live-map-experience/bite-proofs: ${bitten} mutations bit`);
}

main();
