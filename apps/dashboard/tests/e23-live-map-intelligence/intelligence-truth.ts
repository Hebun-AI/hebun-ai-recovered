/*
 * E2-3 — LIVE MAP INTELLIGENCE. WHAT THE ATTACHMENT SAYS, AND WHAT IT REFUSES TO SAY.
 *
 * L4 proved a map can be honest about what it does not know. E2-3 hangs NUMBERS on that map, which
 * is a different and larger risk: a count beside a name is read as a fact about the name, a zero is
 * read as "nothing happened", and a group of counts is read as a summary of how the agent is doing.
 * None of those readings is supplied by a record.
 *
 * So this suite drives every path through the attachment and proves the four separations that make
 * it safe to render:
 *
 *     AUTHORITATIVE AGENT IDENTITY != AUTHORITATIVE OUTCOME
 *     UNAVAILABLE                  != ZERO ACTIVITY
 *     CUMULATIVE                   != CURRENT
 *     COUNT                        != RATE, COMPARISON OR JUDGEMENT
 *
 * Pure: all three authorities are injected, so no database, no network, no provider.
 */
import assert from "node:assert/strict";
import {
  LIVE_MAP_INTELLIGENCE_COMPLETENESS_WORDING,
  LIVE_MAP_PROJECTION_MODEL,
  type LiveMapDomain,
  type LiveMapNode,
  type LiveMapNodeIntelligence,
  type LiveMapProjection,
} from "../../src/features/live-map/contracts";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import {
  LIVE_MAP_AGENT_OUTCOME_AUTHORITY,
  LIVE_MAP_AGENT_OUTCOME_BASIS,
  LIVE_MAP_AGENT_OUTCOME_NOT_OBSERVED,
  LIVE_MAP_AGENT_OUTCOME_UNAVAILABLE,
  type LiveMapAgentOutcome,
  type LiveMapAgentOutcomeRead,
} from "../../src/features/agent-outcome-observation/live-map-agent-outcome.server";
import type { OrganizationAuthorityRead } from "../../src/features/organization-authority/contracts";
import { ORGANIZATION_STRUCTURE_UNAVAILABLE } from "../../src/features/organization-authority/contracts";
import type { DurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "tenant-e23", userId: "user-e23" } as unknown as TenantContext;

const AGENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ORGANIZATION: OrganizationAuthorityRead = {
  status: "available",
  organization: {
    organizationId: "tenant-e23",
    name: "Acme Operating Company",
    slug: "acme",
    lifecycleStatus: "active",
    tenantStatus: "active",
    provenance: "production-operator-ceremony",
    provenanceDetail: "Created by the production operator provisioning ceremony.",
    humanMemberCount: 3,
    structure: ORGANIZATION_STRUCTURE_UNAVAILABLE,
  },
};

/** Two durable identities: one serving, one retired. Both are real; both must survive the join. */
const IDENTITIES: DurableAgentIdentityState = {
  status: "known",
  genesisSpent: true,
  identities: [
    {
      agentId: AGENT_A,
      name: "Sourcing Analyst",
      humanOwnerId: "human-1",
      humanOwnerType: "human",
      createdAt: "2026-06-01T00:00:00.000Z",
      retiredAt: null,
      inService: true,
    },
    {
      agentId: AGENT_B,
      /* THE SAME NAME ON PURPOSE. A name join would be ambiguous here; an id join is not. */
      name: "Sourcing Analyst",
      humanOwnerId: "human-1",
      humanOwnerType: "human",
      createdAt: "2026-07-01T00:00:00.000Z",
      retiredAt: "2026-08-01T00:00:00.000Z",
      inService: false,
    },
  ],
};

/*
 * EVERY NUMBER DISTINCT, ON PURPOSE. A fixture of zeros and ones cannot tell a correct wiring from
 * a plausible one; sixteen distinct values mean any crossed field shows up as the wrong number
 * against the wrong label.
 */
const OUTCOME_A: LiveMapAgentOutcome = {
  agentId: AGENT_A,
  activity: { proposalsFiled: 11, pending: 3, withdrawn: 2 },
  governance: {
    approved: 5,
    rejected: 4,
    permitsIssued: 7,
    permitsActive: 1,
    permitsExpired: 6,
    permitsConsumed: 8,
    permitsRevoked: 9,
    approvedWithoutExecution: 13,
  },
  execution: { attempts: 17, pending: 10, accepted: 14, refused: 15, failed: 16, unknown: 18 },
};

const OUTCOME_READ: LiveMapAgentOutcomeRead = {
  status: "read",
  /* Only AGENT_A is observed — AGENT_B is a real identity this reading holds no entry for. */
  byAgentId: new Map([[AGENT_A, OUTCOME_A]]),
  unresolvedAgentProposals: 0,
};

const read = (outcome: LiveMapAgentOutcomeRead): Promise<LiveMapProjection> =>
  readLiveMapProjection(TENANT, {
    readOrganization: async () => ORGANIZATION,
    readAgentIdentity: async () => IDENTITIES,
    readAgentOutcome: async () => outcome,
  });

const domain = (projection: LiveMapProjection, id: string): LiveMapDomain => {
  const found = projection.domains.find((d) => d.domainId === id);
  assert.ok(found, `${id} is a represented domain`);
  return found!;
};

const agentNodes = (projection: LiveMapProjection): readonly LiveMapNode[] => {
  const state = domain(projection, "agents").state;
  assert.equal(state.status, "available", "the agent domain has nodes to attach to");
  if (state.status !== "available") throw new Error("unreachable");
  return state.nodes;
};

const nodeFor = (projection: LiveMapProjection, agentId: string): LiveMapNode => {
  const found = agentNodes(projection).find((n) => n.nodeId === `agent:${agentId}`);
  assert.ok(found, `agent:${agentId} is on the map`);
  return found!;
};

const observed = (node: LiveMapNode): Extract<LiveMapNodeIntelligence, { status: "observed" }> => {
  assert.ok(node.intelligence, `${node.nodeId} carries an attachment`);
  assert.equal(
    node.intelligence!.status,
    "observed",
    `${node.nodeId}: its evidence was found under its own durable id`,
  );
  if (node.intelligence!.status !== "observed") throw new Error("unreachable");
  return node.intelligence!;
};

const measure = (
  intelligence: Extract<LiveMapNodeIntelligence, { status: "observed" }>,
  groupId: string,
  label: string,
): number => {
  const group = intelligence.groups.find((g) => g.groupId === groupId);
  assert.ok(group, `group ${groupId} exists`);
  const found = group!.measures.find((m) => m.label === label);
  assert.ok(found, `${groupId}.${label} is rendered`);
  return found!.value;
};

/* ── 1 · THE ORGANIZATION FACTS DID NOT MOVE ──────────────────────────────── */
async function organizationTruthIsUnchanged(): Promise<void> {
  const projection = await read(OUTCOME_READ);
  const state = domain(projection, "organization").state;
  assert.equal(state.status, "available");
  if (state.status !== "available") throw new Error("unreachable");
  const node = state.nodes[0]!;

  assert.equal(node.truth, "authoritative", "the organization is still authoritative");
  assert.equal(node.sourceAuthority, "Organization Authority", "and L3 still owns it");
  assert.match(node.detail.join(" "), /Human members: 3/, "its facts are unchanged");
  assert.equal(
    node.intelligence,
    undefined,
    "E2-3 attaches AGENT outcome evidence — an organization node acquires nothing",
  );
}

/* ── 2 · IDENTITY STILL OWNS IDENTITY; THE ATTACHMENT OWNS NOTHING ────────── */
async function identityRemainsTheIdentityOwner(): Promise<void> {
  const projection = await read(OUTCOME_READ);
  for (const node of agentNodes(projection)) {
    assert.equal(node.truth, "authoritative", `${node.nodeId} is authoritative`);
    assert.equal(node.sourceAuthority, "Durable Agent Identity", "identity is owned by its authority");
    assert.match(node.nodeId, /^agent:/, "the node id is the projection identity built from agentId");
  }

  const serving = nodeFor(projection, AGENT_A);
  const retired = nodeFor(projection, AGENT_B);
  assert.equal(serving.label, "Sourcing Analyst");
  assert.equal(retired.label, "Sourcing Analyst");
  assert.match(retired.detail.join(" "), /Retired/, "retirement still comes from the identity read");

  /* The attachment contributes no name, no lifecycle and no identity of its own. */
  const attachment = observed(serving);
  const json = JSON.stringify(attachment);
  assert.ok(!json.includes("Sourcing Analyst"), "the attachment carries no agent name");
  assert.ok(!json.includes(AGENT_A), "and it does not ship the raw identifier to the surface");
  assert.ok(!json.includes("In service"), "nor does it restate the identity authority's lifecycle");

  /*
   * AND NO RAW IDENTIFIER OF ANY KIND. Checked by SHAPE rather than by the fixture's own value, so
   * a different internal id smuggled onto the surface for convenience is caught too.
   */
  for (const node of agentNodes(projection)) {
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
        JSON.stringify(node.intelligence),
      ),
      `${node.nodeId}: no raw identifier is carried on the attachment for UI convenience`,
    );
  }
}

/* ── 3 · THE EVIDENCE COMES FROM THE OWNING SEAM, AND SAYS SO ─────────────── */
async function theAttachmentNamesItsAuthority(): Promise<void> {
  const projection = await read(OUTCOME_READ);
  for (const node of agentNodes(projection)) {
    const intelligence = node.intelligence!;
    assert.equal(intelligence.sourceAuthority, LIVE_MAP_AGENT_OUTCOME_AUTHORITY);
    assert.equal(intelligence.sourceAuthority, "Agent Outcome Observation");
    assert.ok(
      !/Live Map/i.test(intelligence.sourceAuthority),
      "Live Map is never named as the owner of evidence it draws",
    );
    assert.notEqual(
      intelligence.sourceAuthority,
      node.sourceAuthority,
      "the node's authority and the attachment's authority are two different subsystems",
    );
  }
}

/* ── 4 · THE JOIN IS BY DURABLE ID, AND BY NOTHING ELSE ───────────────────── */
async function theJoinIsByIdentity(): Promise<void> {
  const projection = await read(OUTCOME_READ);

  /* The observed agent got ITS numbers, filed under ITS id. */
  const attached = nodeFor(projection, AGENT_A).intelligence!;
  assert.equal(
    attached.status,
    "observed",
    "the agent whose durable id the evidence is filed under receives it",
  );
  const a = observed(nodeFor(projection, AGENT_A));
  assert.equal(measure(a, "proposals", "Filed"), 11);

  /*
   * AND THE OTHER IDENTITY GOT NONE — although it carries the SAME NAME, was established later,
   * and sits at a different position in the list. A name join, a position join or a "nearest
   * match" would all have handed it AGENT_A's eleven proposals.
   */
  const b = nodeFor(projection, AGENT_B).intelligence!;
  assert.equal(b.status, "unavailable", "an identity with no entry is not given somebody else's");
  if (b.status !== "unavailable") throw new Error("unreachable");
  assert.equal(b.detail, LIVE_MAP_AGENT_OUTCOME_NOT_OBSERVED);

  /* Moving the evidence to the OTHER id moves the numbers, and nothing else changes. */
  const moved = await read({
    status: "read",
    byAgentId: new Map([[AGENT_B, { ...OUTCOME_A, agentId: AGENT_B }]]),
    unresolvedAgentProposals: 0,
  });
  assert.equal(measure(observed(nodeFor(moved, AGENT_B)), "proposals", "Filed"), 11);
  assert.equal(
    nodeFor(moved, AGENT_A).intelligence!.status,
    "unavailable",
    "the numbers followed the identifier, not the name and not the order",
  );
}

/* ── 5 · DERIVED IS A SECOND TRUTH CLASS, NOT A SECOND AUTHORITY ──────────── */
async function theAttachmentIsDerived(): Promise<void> {
  const projection = await read(OUTCOME_READ);
  for (const node of agentNodes(projection)) {
    assert.equal(node.truth, "authoritative", "the NODE is authoritative");
    assert.equal(node.intelligence!.truthClass, "derived", "the ATTACHMENT is derived");
    assert.notEqual(
      node.truth as string,
      node.intelligence!.truthClass as string,
      "the two truth classes are never the same value",
    );
    assert.ok(
      !JSON.stringify(node.intelligence).includes("authoritative"),
      "a derived attachment can never describe itself as authoritative",
    );
  }
  assert.equal(LIVE_MAP_PROJECTION_MODEL.attachesDerivedObservation, true);
  assert.equal(LIVE_MAP_PROJECTION_MODEL.ownsDomainTruth, false, "attaching evidence owns nothing");
}

/* ── 6 · UNAVAILABLE IS NOT ZERO, AND "NO ENTRY" IS NEITHER ───────────────── */
async function unavailableIsNeverZeroActivity(): Promise<void> {
  const projection = await read({ status: "unavailable", reason: "read-failed" });

  for (const node of agentNodes(projection)) {
    const intelligence = node.intelligence!;
    assert.equal(intelligence.status, "unavailable", "an unread observation stays unread");
    if (intelligence.status !== "unavailable") throw new Error("unreachable");
    assert.equal(intelligence.detail, LIVE_MAP_AGENT_OUTCOME_UNAVAILABLE);
    assert.match(
      intelligence.detail,
      /says nothing about what this agent has proposed/,
      "and it says so, rather than leaving a blank a reader fills in",
    );
    assert.ok(
      !Object.prototype.hasOwnProperty.call(intelligence, "groups"),
      "an unread observation carries NO counts — not even zeroed ones",
    );
  }

  /* The projection-level completeness figure is absent too: a total over nothing is not a total. */
  assert.equal(
    projection.intelligenceCompleteness,
    undefined,
    "no completeness figure is invented for an observation that was never read",
  );

  /* THREE OUTCOMES, THREE SENTENCES. Unread, no-entry and measured-zero never share a rendering. */
  const zeroed: LiveMapAgentOutcome = {
    agentId: AGENT_A,
    activity: { proposalsFiled: 0, pending: 0, withdrawn: 0 },
    governance: {
      approved: 0,
      rejected: 0,
      permitsIssued: 0,
      permitsActive: 0,
      permitsExpired: 0,
      permitsConsumed: 0,
      permitsRevoked: 0,
      approvedWithoutExecution: 0,
    },
    execution: { attempts: 0, pending: 0, accepted: 0, refused: 0, failed: 0, unknown: 0 },
  };
  const measuredZero = await read({
    status: "read",
    byAgentId: new Map([[AGENT_A, zeroed]]),
    unresolvedAgentProposals: 0,
  });
  const zeroNode = observed(nodeFor(measuredZero, AGENT_A));
  assert.equal(measure(zeroNode, "proposals", "Filed"), 0, "a measured zero IS shown as a zero");
  assert.notEqual(
    LIVE_MAP_AGENT_OUTCOME_UNAVAILABLE,
    LIVE_MAP_AGENT_OUTCOME_NOT_OBSERVED,
    "unread and no-entry are two different sentences",
  );
}

/* ── 7 · CUMULATIVE, AND NEVER LABELLED AS A PERIOD ───────────────────────── */
async function evidenceIsCumulativeAndSaysSo(): Promise<void> {
  const projection = await read(OUTCOME_READ);
  const intelligence = observed(nodeFor(projection, AGENT_A));

  assert.equal(intelligence.basis, LIVE_MAP_AGENT_OUTCOME_BASIS);
  assert.match(
    intelligence.basis,
    /covering everything since this agent identity was established/,
    "the span is stated, not left to be assumed",
  );
  assert.match(intelligence.basis, /not limited to a period/, "and it refuses the window reading");

  /*
   * NO TIME-WINDOW CLAIM ANYWHERE IN THE PROJECTION. The released statements carry no date
   * predicate at all, so every one of these words would be a claim the records cannot support.
   */
  const json = JSON.stringify(projection).toLowerCase();
  for (const banned of [
    "real-time",
    "realtime",
    "real time",
    "live activity",
    "live update",
    "auto-refresh",
    "streaming",
    "last 24",
    "past 24",
    "today",
    "this week",
    "this month",
    "recent activity",
    "right now",
    "currently",
    "up to the minute",
    "as of now",
    "latest activity",
  ]) {
    assert.ok(!json.includes(banned), `the attachment must not claim "${banned}"`);
  }
  assert.equal(LIVE_MAP_PROJECTION_MODEL.realTime, false);
  assert.match(projection.freshness, /not a stream/, "and the surrounding read still says what it is");
}

/* ── 8 · A COUNT IS A COUNT. NO RATE, NO SCORE, NO RANKING ────────────────── */
async function countsAreNeverJudgements(): Promise<void> {
  const projection = await read(OUTCOME_READ);

  /* Every measure is an integer count. A proportion would not be. */
  for (const node of agentNodes(projection)) {
    const intelligence = node.intelligence!;
    if (intelligence.status !== "observed") continue;
    for (const group of intelligence.groups) {
      for (const m of group.measures) {
        assert.ok(Number.isInteger(m.value), `${group.groupId}.${m.label} is a whole count`);
        assert.ok(m.value >= 0, `${group.groupId}.${m.label} is never negative`);
      }
    }
  }

  /*
   * And no field or sentence is named after a verdict.
   *
   * SCOPED TO WHAT E2-3 PRODUCES — the attachments and the completeness signal — rather than to
   * the whole projection. A whole-projection substring ban reads the ORGANIZATION'S OWN NAME:
   * "Acme Operating Company" contains "rating", and a guard that fails on a customer's legal name
   * is a guard somebody deletes.
   */
  const json = JSON.stringify({
    attachments: agentNodes(projection).map((n) => n.intelligence),
    completeness: projection.intelligenceCompleteness,
  }).toLowerCase();
  for (const banned of [
    "score",
    "rating",
    "grade",
    "rank",
    "success rate",
    "successrate",
    "approval rate",
    "execution rate",
    "percent",
    "%",
    "ratio",
    "performance",
    "efficiency",
    "trend",
    "verdict",
    "healthy",
  ]) {
    assert.ok(!json.includes(banned), `the attachment must not produce "${banned}"`);
  }

  assert.equal(LIVE_MAP_PROJECTION_MODEL.producesProportion, false);
  assert.equal(LIVE_MAP_PROJECTION_MODEL.comparesAgents, false);
  assert.equal(LIVE_MAP_PROJECTION_MODEL.producesJudgement, false);
}

/* ── 9 · THE LIFECYCLE STAGES SURVIVE AS SEPARATE NUMBERS ─────────────────── */
async function lifecycleDistinctionsSurvive(): Promise<void> {
  const projection = await read(OUTCOME_READ);
  const intelligence = observed(nodeFor(projection, AGENT_A));

  /* Sixteen distinct fixture values against sixteen labels: any crossed wire is a wrong number. */
  const expected: ReadonlyArray<readonly [string, string, number]> = [
    ["proposals", "Filed", 11],
    ["proposals", "Awaiting a decision", 3],
    ["proposals", "Withdrawn", 2],
    ["governance", "Approved", 5],
    ["governance", "Rejected", 4],
    ["governance", "Permits issued", 7],
    ["governance", "Permits still active", 1],
    ["governance", "Permits expired", 6],
    ["governance", "Permits consumed", 8],
    ["governance", "Permits revoked", 9],
    ["governance", "Approved, never executed", 13],
    ["execution", "Attempts", 17],
    ["execution", "Awaiting an answer", 10],
    ["execution", "Accepted by the provider", 14],
    ["execution", "Refused", 15],
    ["execution", "Failed", 16],
    ["execution", "Unknown", 18],
  ];
  for (const [groupId, label, value] of expected) {
    assert.equal(measure(intelligence, groupId, label), value, `${groupId}.${label}`);
  }

  /* APPROVED IS NOT EXECUTED, and the gap is carried rather than recomputed into agreement. */
  assert.notEqual(
    measure(intelligence, "governance", "Approved, never executed"),
    measure(intelligence, "governance", "Approved"),
    "the approval gap is its own number",
  );

  /* FAILED != REFUSED and UNKNOWN != FAILED, as three separate values. */
  assert.notEqual(measure(intelligence, "execution", "Failed"), measure(intelligence, "execution", "Refused"));
  assert.notEqual(measure(intelligence, "execution", "Unknown"), measure(intelligence, "execution", "Failed"));

  /* No number claims delivery, and the refusals are rendered rather than implied. */
  const claims = intelligence.nonClaims.join(" ").toLowerCase();
  assert.ok(claims.includes("approved is not executed"), "approved != executed");
  assert.ok(claims.includes("a permit is not an execution"), "permit != execution");
  assert.ok(claims.includes("accepted is not delivered"), "accepted != delivered");
  assert.ok(claims.includes("unknown outcome is not a failure"), "unknown != failed");

  const notes = intelligence.groups
    .flatMap((g) => g.measures.map((m) => m.note ?? ""))
    .join(" ")
    .toLowerCase();
  assert.ok(notes.includes("does not perform one"), "an approval is not an act");
  assert.ok(notes.includes("not delivered"), "acceptance is not delivery");
  assert.ok(notes.includes("this is not a failure"), "an unknown outcome is not a failure");
}

/* ── 10 · UNRESOLVED PROPOSALS ARE REPORTED, NEVER DISCARDED ──────────────── */
async function unresolvedProposalsAreReported(): Promise<void> {
  const clean = await read(OUTCOME_READ);
  assert.ok(clean.intelligenceCompleteness, "the completeness signal is always present when read");
  assert.equal(clean.intelligenceCompleteness!.unresolvedAgentProposals, 0);
  assert.equal(
    clean.intelligenceCompleteness!.detail,
    LIVE_MAP_INTELLIGENCE_COMPLETENESS_WORDING.placed,
    "a complete join says so, rather than saying nothing",
  );

  const short = await read({
    status: "read",
    byAgentId: new Map([[AGENT_A, OUTCOME_A]]),
    unresolvedAgentProposals: 4,
  });
  assert.equal(short.intelligenceCompleteness!.unresolvedAgentProposals, 4);
  assert.equal(
    short.intelligenceCompleteness!.detail,
    LIVE_MAP_INTELLIGENCE_COMPLETENESS_WORDING.unresolved,
  );
  assert.match(
    short.intelligenceCompleteness!.detail,
    /no agent was invented to hold them/,
    "an unplaceable proposal never manufactures an agent",
  );

  /* AND IT MANUFACTURES NOTHING. Four unplaced proposals, and still exactly two agent nodes. */
  assert.equal(agentNodes(short).length, 2, "the node count is the identity authority's, unchanged");
}

/* ── 11 · NO NEW NODE KIND, NO NEW EDGE, NO NEW DOMAIN ────────────────────── */
async function theGraphDidNotGrow(): Promise<void> {
  const withEvidence = await read(OUTCOME_READ);
  const withoutEvidence = await read({ status: "unavailable", reason: "read-failed" });

  for (const projection of [withEvidence, withoutEvidence]) {
    assert.deepEqual(
      projection.domains.map((d) => d.domainId),
      ["organization", "agents", "structure", "people"],
      "the same four domains — evidence added no fifth",
    );
    const nodes = projection.domains.flatMap((d) =>
      d.state.status === "available" ? d.state.nodes : [],
    );
    assert.deepEqual(
      [...new Set(nodes.map((n) => n.kind))].sort(),
      ["agent", "organization"],
      "two node kinds, exactly as Core admitted",
    );
    for (const edge of projection.edges) {
      assert.equal(edge.relation, "belongs-to", "the one proven relation is still the only one");
    }
  }

  /* The node and edge COUNTS are identical with and without evidence: attaching creates nothing. */
  const count = (p: LiveMapProjection): number =>
    p.domains.flatMap((d) => (d.state.status === "available" ? d.state.nodes : [])).length;
  assert.equal(count(withEvidence), count(withoutEvidence), "evidence added no node");
  assert.equal(withEvidence.edges.length, withoutEvidence.edges.length, "evidence added no edge");
  assert.equal(withEvidence.edges.length, 2, "one edge per agent, and nothing more");

  /* And no proposal, Governance, permit or execution ENTITY appeared on the map. */
  const kinds = new Set(
    withEvidence.domains
      .flatMap((d) => (d.state.status === "available" ? d.state.nodes : []))
      .map((n) => n.kind as string),
  );
  for (const absent of ["proposal", "governance", "permit", "execution", "activity", "human", "department"]) {
    assert.ok(!kinds.has(absent), `E2-3 introduced no "${absent}" node`);
  }
}

/* ── 12 · ORGANIZATION STRUCTURE IS STILL ABSENT, AND STILL SAID ──────────── */
async function structureRemainsUnowned(): Promise<void> {
  const projection = await read(OUTCOME_READ);
  assert.equal(domain(projection, "structure").state.status, "no-authority");
  /* LM-1 — the People Register exists, so an unreachable one is `unavailable`, not `no-authority`. */
  assert.equal(domain(projection, "people").state.status, "unavailable");

  /*
   * THE BAN IS ON WHAT E2-3 ADDED, NOT ON THE MAP'S OWN DENIAL.
   *
   * `LIVE_MAP_STRUCTURE_ABSENT` says departments, teams and REPORTING LINES cannot be shown — the
   * released sentence whose whole job is to name the thing that does not exist. A whole-projection
   * word ban fails on that honest denial, which is the R6D lesson restated: scope a vocabulary ban
   * to the code that could commit the offence.
   */
  const added = JSON.stringify({
    attachments: agentNodes(projection).map((n) => n.intelligence),
    completeness: projection.intelligenceCompleteness,
  }).toLowerCase();
  for (const banned of ["department", "team", "reporting line", "manager", "org chart", "headcount"]) {
    assert.ok(!added.includes(banned), `E2-3 invented no structural fact: "${banned}"`);
  }

  /* And the map still states the absence in its own words, unweakened. */
  const structure = domain(projection, "structure").state;
  if (structure.status !== "no-authority") throw new Error("unreachable");
    /*
     * OSA-1 repaired this sentence, and the assertion follows the repair rather than being
     * dropped. "Hebun has no authority for internal organizational structure" became FALSE
     * when the Organization Structure Authority shipped; the claim that survives — and the
     * one this test has always really been about — is that an UNREAD structure is never
     * rendered as a known zero.
     */
  assert.match(
    structure.detail,
    /unknown — not absent/,
    "no-authority is still not a measured zero",
  );
}

async function main(): Promise<void> {
  await organizationTruthIsUnchanged();
  await identityRemainsTheIdentityOwner();
  await theAttachmentNamesItsAuthority();
  await theJoinIsByIdentity();
  await theAttachmentIsDerived();
  await unavailableIsNeverZeroActivity();
  await evidenceIsCumulativeAndSaysSo();
  await countsAreNeverJudgements();
  await lifecycleDistinctionsSurvive();
  await unresolvedProposalsAreReported();
  await theGraphDidNotGrow();
  await structureRemainsUnowned();
  console.log("e23 live map intelligence — truth checks passed");
}

void main();
