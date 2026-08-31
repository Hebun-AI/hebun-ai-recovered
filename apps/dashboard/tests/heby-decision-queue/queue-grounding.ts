/*
 * HEBY DECISION QUEUE GROUNDING — HEBY CAN SAY WHAT IS WAITING, AND CAN DECIDE NONE OF IT.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Heby can state which consequential actions this organization has recorded as awaiting a human
 *    decision, from the Action Authorization Authority's own authoritative record. It distinguishes
 *    a queue with rows, a queue measured EMPTY, and an authority that could not be READ — and never
 *    merges the last two. Every item carries the denial that a pending proposal is a decision or a
 *    recommendation, and nothing in the class asserts priority, urgency, risk or approval-worthiness,
 *    because no authority in this repository owns any of them."
 *
 * The pins:
 *
 *   PENDING      != APPROVED
 *   PENDING      != PERMITTED
 *   PENDING      != EXECUTED
 *   UNAVAILABLE  != EMPTY QUEUE
 *   SUMMARIZED   != RECOMMENDED
 *   HEBY READS THE QUEUE != HEBY CAN DECIDE ANYTHING IN IT
 *
 * Pure: no database, no network, no model. The one read seam is injected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
/*
 * THE SCHEMA BARREL, FIRST AND ON PURPOSE — a harness ordering fix, not a product one.
 *
 * `src/db/schema/*` has a module-initialisation cycle that only resolves when the barrel orders the
 * imports; pulling a single schema file in first throws "Cannot access 'tenantColumns' before
 * initialization". The application never hits it because `db/client.server` loads the barrel, and
 * `/approvals` has read this same seam in production since R3A. This import reproduces the app's
 * order so the test measures the feature rather than the loader.
 */
import "../../src/db/schema";
import {
  DECISION_QUEUE_EMPTY_STATEMENT,
  DECISION_QUEUE_GROUNDING_PROVENANCE,
  DECISION_QUEUE_NON_CLAIM,
  DECISION_QUEUE_ROUTE,
  readDecisionQueueGroundingSource,
} from "../../src/features/action-authorization/heby-decision-queue-source.server";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import {
  getHebyWorkspaceProfile,
  resolveHebyWorkspaceContext,
} from "../../src/features/heby-integration/workspace-registry";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import { resolveHebyWorkspace } from "../../src/features/heby-integration/panel-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = path.join(process.cwd(), "src");
const SOURCE = path.join(ROOT, "features/action-authorization/heby-decision-queue-source.server.ts");

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

const PENDING = {
  requestId: "req-1",
  actionKind: "send-external-communication",
  toolId: "heby.operations.send-communication",
  sideEffect: "external-communication",
  reversibility: "irreversible",
  targetKind: "record",
  targetRef: "external-recipient/r-1",
  targetLabel: "Ayşe Yılmaz",
  expectedEffect: "Send the approved draft to the recorded recipient.",
  consequences: ["A message leaves the organization", "It cannot be recalled"],
  parameters: [{ name: "recipientRef", value: "external-recipient/r-1" }],
  locks: [],
  evidence: {
    status: "attached" as const,
    items: [{ sourceClass: "work-artifacts", recordRef: "work-artifact/a-1@1", lifecycle: "settled" }],
  },
  proposedByActorType: "agent",
  proposedByAgentName: "Heby",
  proposedByAgentInService: true,
  payloadDigest: "d".repeat(64),
  proposedAt: "2026-08-27T21:47:19.238Z",
} as never;

const readReturning = (result: unknown) => (async () => result) as never;

/* ═══ 1. SEMANTIC OWNERSHIP — the class exists, and this connects the one it was about. ═══ */
function semanticOwnership(): void {
  assert.ok(
    (HEBY_SOURCE_CLASSES as readonly string[]).includes("decision-records"),
    "the class is a released one; this phase invented none",
  );

  /*
   * The two workspaces that declare it also declare `decision-preparation`. That pairing is the
   * repository's own statement of what the class means, and it is why the queue belongs here
   * rather than in `governance` — which reads the constitutional record a decision is taken UNDER.
   */
  for (const [route, expected] of [
    ["/heby", true],
    ["/approvals", true],
    ["/agents", false],
  ] as const) {
    const workspace = resolveHebyWorkspace(route);
    const profile = resolveHebyWorkspaceContext({ workspace, route });
    const classes = profile.sources.map((s: { sourceClass: string }) => s.sourceClass);
    assert.equal(
      classes.includes("decision-records"),
      expected,
      `${route} availability of decision-records`,
    );
  }
}

/* ═══ 2. TENANT ISOLATION — no tenant, no read, and no parameter that could name another. ═══ */
async function tenantIsolation(): Promise<void> {
  const anonymous = await readDecisionQueueGroundingSource(null);
  assert.equal(anonymous.state, "unavailable");
  assert.equal(anonymous.unavailableReason, "no-authorized-tenant-context");
  assert.equal(anonymous.items.length, 0, "an unauthenticated reader is shown nothing");

  /* The seam receives the server-resolved context and nothing else; there is no tenant argument. */
  let seen: unknown = null;
  await readDecisionQueueGroundingSource(TENANT, {
    readPending: (async (tenant: unknown) => {
      seen = tenant;
      return { status: "read", items: [] };
    }) as never,
  });
  assert.equal(seen, TENANT, "the resolved context is passed straight through, never rebuilt");
}

/* ═══ 3. A PENDING QUEUE GROUNDS, WITH THE FACTS THAT HELP A HUMAN DECIDE. ═══ */
async function pendingQueueGrounds(): Promise<void> {
  const resolution = await readDecisionQueueGroundingSource(TENANT, {
    readPending: readReturning({ status: "read", items: [PENDING] }),
  });

  assert.equal(resolution.sourceClass, "decision-records");
  assert.equal(resolution.state, "resolved");
  assert.equal(resolution.authoritative, true, "stored columns, not recomputed counts");
  assert.equal(resolution.provenance, DECISION_QUEUE_GROUNDING_PROVENANCE);
  assert.equal(resolution.items.length, 1);

  const [item] = resolution.items;
  assert.equal(item!.recordRef, "heby-action-request/req-1");
  assert.match(item!.label, /awaiting a human decision/i);
  assert.equal(item!.lifecycle, "settled");

  for (const fragment of [
    "Send the approved draft to the recorded recipient.",
    "Ayşe Yılmaz",
    "external-communication",
    "irreversible",
    "A message leaves the organization",
    "1 evidence reference is attached",
    "durable agent Heby",
    "2026-08-27T21:47:19.238Z",
  ]) {
    assert.ok(
      item!.detail.includes(fragment),
      `the item carries "${fragment}": ${item!.detail}`,
    );
  }

  /* WHAT IT MUST NOT CARRY. A digest and raw parameters help a Director decide nothing. */
  assert.equal(item!.detail.includes("d".repeat(64)), false, "no payload digest");
  assert.equal(item!.detail.includes("recipientRef"), false, "no raw parameters");
}

/* ═══ 4. A MEASURED EMPTY QUEUE IS AN ANSWER, AND SAYS SO. ═══ */
async function emptyQueueIsMeasured(): Promise<void> {
  const resolution = await readDecisionQueueGroundingSource(TENANT, {
    readPending: readReturning({ status: "read", items: [] }),
  });
  assert.equal(resolution.state, "resolved", "a successful read that returned nothing is RESOLVED");
  assert.equal(resolution.items.length, 1, "the measured absence travels as a fact");
  assert.ok(resolution.items[0]!.detail.includes(DECISION_QUEUE_EMPTY_STATEMENT));
  assert.match(resolution.items[0]!.detail, /read the pending queue successfully/i);
}

/* ═══ 5. UNAVAILABLE != EMPTY QUEUE — the sentence a Director would act on by doing nothing. ═══ */
async function unavailableIsNotEmpty(): Promise<void> {
  const resolution = await readDecisionQueueGroundingSource(TENANT, {
    readPending: readReturning({ status: "unavailable", reason: "persistence-not-configured" }),
  });
  assert.equal(resolution.state, "unavailable");
  assert.equal(resolution.unavailableReason, "persistence-not-configured", "verbatim, never softened");
  assert.equal(resolution.items.length, 0);

  /*
   * THE DEFECT THIS FORBIDS, STATED AS A TEST. An unreachable authority must never produce the
   * empty-queue sentence, because a Director reading "nothing needs your decision" during an
   * outage acts on it by doing nothing.
   */
  const spoken = JSON.stringify(resolution);
  assert.equal(
    spoken.includes(DECISION_QUEUE_EMPTY_STATEMENT),
    false,
    "an unreachable queue may never claim to be an empty one",
  );
  assert.equal(/nothing is awaiting/i.test(spoken), false, "and may not say it in other words");
}

/* ═══ 6. NO RECOMMENDATION, NO PRIORITY, NO URGENCY, NO RISK — nobody owns those. ═══ */
async function noInferenceBeyondTheRecord(): Promise<void> {
  const resolution = await readDecisionQueueGroundingSource(TENANT, {
    readPending: readReturning({ status: "read", items: [PENDING] }),
  });
  const claimed = resolution.items.map((i) => i.detail).join(" ") + " " + resolution.provenance;

  /*
   * Scoped to what the source CLAIMS, and the non-claim is pinned BY EQUALITY separately — the
   * settled remedy for a ban that would otherwise fail on the sentence that DENIES the word.
   */
  const withoutDenial = claimed.split(DECISION_QUEUE_NON_CLAIM).join(" ");
  for (const banned of [
    /\bshould (be )?approve/i,
    /\bsafe to approve\b/i,
    /\bhigh priority\b/i,
    /\brecommend/i,
    /\burgent\b/i,
    /\brisk score\b/i,
    /\bapproval-worthy\b/i,
    /\blikely to succeed\b/i,
  ]) {
    assert.equal(banned.test(withoutDenial), false, `the class must not assert ${banned}`);
  }

  assert.ok(
    resolution.items.every((i) => i.detail.includes(DECISION_QUEUE_NON_CLAIM)),
    "every item carries the denial",
  );
  for (const denied of ["priority", "urgency", "risk score", "judgement"]) {
    assert.ok(DECISION_QUEUE_NON_CLAIM.includes(denied), `the denial names ${denied}`);
  }
}

/* ═══ 7. PENDING IS NOT THE OTHER FIVE STATES, AND THE CLASS SAYS WHICH IT CARRIES. ═══ */
async function statesStayApart(): Promise<void> {
  const resolution = await readDecisionQueueGroundingSource(TENANT, {
    readPending: readReturning({ status: "read", items: [PENDING] }),
  });
  assert.match(resolution.provenance, /AWAITING A HUMAN DECISION/);
  assert.match(
    resolution.provenance,
    /Nothing here is approved, authorized, permitted or executed/i,
    "the provenance keeps pending apart from every downstream state",
  );
  assert.match(
    resolution.provenance,
    /recorded-acts class/i,
    "and it names the class that owns what was already decided, so this creates no second truth",
  );
  assert.ok(resolution.items[0]!.detail.includes("still pending"));
}

/* ═══ 8. NO AUTHORITY MUTATION — proved on the module's own text and its import graph. ═══ */
function noAuthorityMutation(): void {
  const source = readFileSync(SOURCE, "utf8");
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");

  for (const forbidden of [
    "insert(",
    "update(",
    "delete(",
    "transaction(",
    "decideActionRequest",
    "recordActionRequest",
    "recordAgentOriginatedActionRequest",
    "consumeActionPermit",
    "revokeActionPermit",
    "executeAuthorizedAction",
    "writeGovernanceDecision",
    "establishAgentMandate",
    "getControlPlaneDb",
  ]) {
    assert.equal(
      code.includes(forbidden),
      false,
      `the grounding module must not reach ${forbidden}`,
    );
  }

  /*
   * THE IMPORT MUST BE THE READ SEAM MODULE, BY EXACT PATH. The decision writer, the proposal
   * writer, the permit consumer and the permit revoker are files in THIS SAME DIRECTORY, so a
   * convenience import of a barrel or a sibling is the whole risk this assertion exists for.
   */
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  assert.deepEqual(
    imports.filter((i) => i.startsWith(".")),
    ["./read-action-authorizations.server"],
    `exactly one relative import, and it is the read seam: ${imports.join(", ")}`,
  );
  assert.equal(
    imports.some((i) => i.includes("@/features/action-authorization")),
    false,
    "and no absolute re-entry into its own feature that could resolve to a writer",
  );
}

/* ═══ 9. THE PURE DEFAULT IS HONEST, AND STILL SATISFIES G6D. ═══ */
function thePureDefaultIsHonest(): void {
  const pure = resolveSource("decision-records");
  assert.equal(pure.state, "unavailable", "the pure resolver holds no tenant and reads nothing");
  const reason = pure.unavailableReason ?? "";

  /* G6D's repair, unchanged: it may not claim the Governance decision record is unconnected. */
  assert.equal(/no persisted decision records are connected/i.test(reason), false);
  assert.match(reason, /decision-preparation/i);
  assert.match(reason, /governance source class/i);

  /* And the G6D-corrected framing: a SERVER read, never an absent connection or an empty queue. */
  assert.match(reason, /read tenant-scoped on the server/i);
  assert.equal(
    /nothing is awaiting|no pending|empty/i.test(reason),
    false,
    "the fallback must never read as a measured empty queue",
  );
}

/* ═══ 10. THE ROUTE IS THE RELEASED ONE, so an answer routes rather than invents. ═══ */
function routeIsTheReleasedSurface(): void {
  assert.equal(DECISION_QUEUE_ROUTE, "/approvals");
  const profile = getHebyWorkspaceProfile(resolveHebyWorkspace("/approvals"));
  assert.equal(
    profile.defaultRoute,
    DECISION_QUEUE_ROUTE,
    "the class points at the surface the workspace already owns",
  );
}

async function main(): Promise<void> {
  semanticOwnership();
  await tenantIsolation();
  await pendingQueueGrounds();
  await emptyQueueIsMeasured();
  await unavailableIsNotEmpty();
  await noInferenceBeyondTheRecord();
  await statesStayApart();
  noAuthorityMutation();
  thePureDefaultIsHonest();
  routeIsTheReleasedSurface();
  console.log("heby-decision-queue/queue-grounding: OK");
}

void main();
