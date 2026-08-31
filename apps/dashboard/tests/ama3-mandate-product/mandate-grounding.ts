/*
 * AMA-3 — HEBY GROUNDS ON A RECORDED CEILING, AND GAINS NOTHING FROM IT.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Heby can state what a durable agent is FOR and the most it may PROPOSE, from the Agent Mandate
 *    Authority's own authoritative record. It distinguishes an effective mandate, a measured
 *    absence and an unreachable authority, and never merges the last two. Every item it produces
 *    carries the denial that a mandate is not permission, not a permit, not execution authority and
 *    not Governance authority — and nothing in the class can be read as a grant."
 *
 * The pins:
 *
 *   IN MANDATE   != AUTHORIZED
 *   IN MANDATE   != A PERMIT
 *   IN MANDATE   != EXECUTION
 *   NO MANDATE   != UNLIMITED MANDATE
 *   UNAVAILABLE  != NO MANDATE
 *   RECORDED MANDATE != DERIVED OBSERVATION
 *
 * Pure: no database, no network, no model. Every read seam is injected.
 */
import assert from "node:assert/strict";
import {
  AGENT_MANDATE_ABSENT_STATEMENT,
  AGENT_MANDATE_GROUNDING_PROVENANCE,
  AGENT_MANDATE_NON_CLAIM,
  AGENT_MANDATE_WITHDRAWN_STATEMENT,
  readAgentMandateGroundingSource,
} from "../../src/features/agent-mandate/heby-mandate-source.server";
import { MANDATE_DOES_NOT_MEAN } from "../../src/features/agent-mandate/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

const IDENTITY = {
  agentId: "a-1",
  name: "Heby",
  humanOwnerId: "u-1",
  humanOwnerType: "human",
  createdAt: "2026-08-01T00:00:00.000Z",
  retiredAt: null,
  inService: true,
};

const REVISION_2 = {
  mandateId: "m-2",
  agentId: "a-1",
  mandateRevision: 2,
  purpose: "Draft and propose outbound customer correspondence for review.",
  proposalScope: ["send"] as const,
  effectiveFrom: "2026-08-30T00:00:00.000Z",
  governanceDecisionId: "d-2",
  governanceSessionId: "s-2",
  establishedByActorId: "u-1",
  supersedesMandateId: "m-1",
};

const REVISION_1 = {
  ...REVISION_2,
  mandateId: "m-1",
  mandateRevision: 1,
  purpose: "An earlier, narrower statement of what this agent was for.",
  proposalScope: [] as const,
  effectiveFrom: "2026-08-10T00:00:00.000Z",
  governanceDecisionId: "d-1",
  governanceSessionId: "s-1",
  supersedesMandateId: null,
};

const knownIdentities = async () =>
  ({ status: "known", genesisSpent: true, identities: [IDENTITY] }) as never;

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE CLASS EXISTS, IS ITS OWN, AND IS AUTHORITATIVE.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theClassIsItsOwnAndAuthoritative(): Promise<void> {
  assert.ok(
    (HEBY_SOURCE_CLASSES as readonly string[]).includes("agent-mandate"),
    "the source class is registered",
  );
  assert.ok(
    (HEBY_SOURCE_CLASSES as readonly string[]).includes("agents"),
    "and the derived outcome class still exists beside it — this replaced nothing",
  );

  const resolved = await readAgentMandateGroundingSource(TENANT, {
    readIdentities: knownIdentities,
    readEffective: async () => ({ status: "known", mandate: REVISION_2 }) as never,
    readHistory: async () =>
      ({ status: "known", revisions: [REVISION_2, REVISION_1], limit: 50 }) as never,
  });

  assert.equal(resolved.sourceClass, "agent-mandate");
  assert.equal(resolved.state, "resolved");
  /*
   * TRUE, and this is the whole reason it is not folded into `agents`. That class declares
   * `authoritative: false` because it carries recomputed counts; a mandate is a stored row a human
   * wrote under a bound Governance decision.
   */
  assert.equal(resolved.authoritative, true, "RECORDED MANDATE != DERIVED OBSERVATION");
  assert.equal(resolved.provenance, AGENT_MANDATE_GROUNDING_PROVENANCE);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. AN EFFECTIVE MANDATE GROUNDS, AND ITS PROSE CANNOT BE READ AS A GRANT.
 * ═════════════════════════════════════════════════════════════════════════ */
async function anEffectiveMandateGrounds(): Promise<void> {
  const resolved = await readAgentMandateGroundingSource(TENANT, {
    readIdentities: knownIdentities,
    readEffective: async () => ({ status: "known", mandate: REVISION_2 }) as never,
    readHistory: async () =>
      ({ status: "known", revisions: [REVISION_2, REVISION_1], limit: 50 }) as never,
  });

  const effective = resolved.items.find((item) => item.recordRef === "agent-mandate/m-2");
  assert.ok(effective, "the effective revision is cited by its own record reference");
  assert.equal(effective!.lifecycle, "settled");
  assert.ok(effective!.detail.includes("May propose: send"), "the scope is stated as PROPOSAL");
  assert.ok(effective!.detail.includes("revision 2") || effective!.label.includes("revision 2"));
  assert.ok(effective!.detail.includes("d-2"), "the Governance decision binding travels with it");

  /*
   * THE PURPOSE IS OPERATOR-AUTHORED PROSE AND TRAVELS IN `content`, NEVER `detail`. E2-6's rule:
   * `detail` flows into Heby's own validated response body, so a purpose sentence that happened to
   * read like a claim would become a sentence Heby appeared to be making.
   */
  assert.ok(
    effective!.content?.includes(REVISION_2.purpose),
    "the recorded purpose is carried as quoted content",
  );
  assert.ok(
    !effective!.detail.includes(REVISION_2.purpose),
    "and never inside the machine-derived detail",
  );

  /* THE DENIAL RIDES WITH THE RECORD. Not in a prompt, not in a surface — on the item. */
  assert.ok(effective!.detail.includes(AGENT_MANDATE_NON_CLAIM), "IN MANDATE != AUTHORIZED");

  /* A SUPERSEDED REVISION IS LABELLED AS ONE, so a past ceiling cannot be cited as the current. */
  const superseded = resolved.items.find((item) => item.recordRef === "agent-mandate/m-1");
  assert.ok(superseded, "history is reachable");
  assert.equal(
    superseded!.lifecycle,
    "superseded",
    "a past ceiling can never be cited as the effective one",
  );
  assert.ok(superseded!.detail.includes("No longer effective"));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE THREE ANSWERS ARE THREE, AND THE LAST TWO NEVER MERGE.
 * ═════════════════════════════════════════════════════════════════════════ */
async function absenceIsNotUnavailabilityAndNeitherIsPermission(): Promise<void> {
  /* (a) NO MANDATE — a real, resolved answer that says the agent may propose nothing. */
  const absent = await readAgentMandateGroundingSource(TENANT, {
    readIdentities: knownIdentities,
    readEffective: async () => ({ status: "known", mandate: null }) as never,
    readHistory: async () => ({ status: "known", revisions: [], limit: 50 }) as never,
  });
  assert.equal(absent.state, "resolved", "a measured absence is an ANSWER, not an outage");
  const absentItem = absent.items[0]!;
  assert.ok(absentItem.detail.includes(AGENT_MANDATE_ABSENT_STATEMENT));
  assert.ok(
    /propose NOTHING/.test(absentItem.detail),
    "NO MANDATE != UNLIMITED MANDATE — the consequence is stated, never left to the reader",
  );
  /*
   * BANNED: THE CLAIM, NOT THE WORD. A bare `anything` ban failed here on the sentence's own honest
   * clause — "its proposals are refused before anything is written" — which is the absence being
   * stated, not a permission. Same shape AMA-2 hit on a refusal NAME and AMA-1 hit on the writer
   * that must SAY the words it denies. So the ban is on phrases that would assert a permission.
   */
  for (const permissionClaim of [
    /may propose anything/i,
    /unlimited/i,
    /unrestricted/i,
    /no limit/i,
    /any action kind/i,
  ]) {
    assert.ok(
      !permissionClaim.test(absentItem.detail),
      `an absent mandate never reads as ${permissionClaim.source}`,
    );
  }

  /* (b) UNAVAILABLE — and it must not say a mandate is absent. */
  const unavailable = await readAgentMandateGroundingSource(TENANT, {
    readIdentities: knownIdentities,
    readEffective: async () => ({ status: "unavailable", reason: "read-failed" }) as never,
    readHistory: async () => ({ status: "known", revisions: [], limit: 50 }) as never,
  });
  assert.equal(unavailable.state, "unavailable");
  assert.deepEqual(unavailable.items, [], "an outage cites nothing");
  assert.ok(
    unavailable.unavailableReason?.includes("UNAVAILABLE is not NO MANDATE"),
    "UNAVAILABLE != NO MANDATE, said in the reason itself",
  );
  assert.ok(
    !/no mandate has been established|may propose nothing/i.test(unavailable.unavailableReason ?? ""),
    "an outage never states an absence",
  );

  /* (c) THE IDENTITY AUTHORITY WENT DARK — its own outage, and also not an absence. */
  const noIdentities = await readAgentMandateGroundingSource(TENANT, {
    readIdentities: async () => ({ status: "unavailable" }) as never,
  });
  assert.equal(noIdentities.state, "unavailable");
  assert.ok(
    noIdentities.unavailableReason?.includes("unread state"),
    "an unreadable identity authority is unread, never empty",
  );

  /* (d) NO DURABLE AGENT AT ALL — resolved, and still not a permission. */
  const noAgent = await readAgentMandateGroundingSource(TENANT, {
    readIdentities: async () =>
      ({ status: "known", genesisSpent: false, identities: [] }) as never,
  });
  assert.equal(noAgent.state, "resolved");
  assert.ok(noAgent.items[0]!.detail.includes("propose NOTHING"));

  /* (e) NO TENANT — refused before anything is read. */
  const anonymous = await readAgentMandateGroundingSource(null);
  assert.equal(anonymous.state, "unavailable");
  assert.equal(anonymous.unavailableReason, "no-authorized-tenant-context");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. WITHDRAWAL IS AN EMPTY CEILING, AND IT READS AS A DECISION.
 * ═════════════════════════════════════════════════════════════════════════ */
async function withdrawalReadsAsADecision(): Promise<void> {
  const withdrawn = await readAgentMandateGroundingSource(TENANT, {
    readIdentities: knownIdentities,
    readEffective: async () =>
      ({ status: "known", mandate: { ...REVISION_2, proposalScope: [] } }) as never,
    readHistory: async () => ({ status: "known", revisions: [], limit: 50 }) as never,
  });
  const item = withdrawn.items[0]!;
  assert.ok(item.detail.includes(AGENT_MANDATE_WITHDRAWN_STATEMENT));
  assert.ok(
    /by decision rather than by absence/.test(item.detail),
    "an empty ceiling is a DECISION, and is distinguishable from nobody having bounded the agent",
  );
  assert.notEqual(
    AGENT_MANDATE_WITHDRAWN_STATEMENT,
    AGENT_MANDATE_ABSENT_STATEMENT,
    "NO MANDATE != EMPTY MANDATE",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE CLASS CANNOT SAY IT IS AUTHORIZED, PERMITTED OR EXECUTING.
 *
 * Run over what the source CLAIMS — the machine-derived `detail` and `label` — and deliberately
 * NOT over the non-claim constants, which must SAY these words because denying them is their job.
 * AMA-1, AMA-2 and E2-4 through E2-8 each recorded that collision; this is the settled remedy.
 * ═════════════════════════════════════════════════════════════════════════ */
async function nothingClaimsAnAuthority(): Promise<void> {
  const resolved = await readAgentMandateGroundingSource(TENANT, {
    readIdentities: knownIdentities,
    readEffective: async () => ({ status: "known", mandate: REVISION_2 }) as never,
    readHistory: async () =>
      ({ status: "known", revisions: [REVISION_2, REVISION_1], limit: 50 }) as never,
  });

  const DENIALS = [AGENT_MANDATE_NON_CLAIM, AGENT_MANDATE_ABSENT_STATEMENT];
  const stripDenials = (text: string): string =>
    DENIALS.reduce((acc, denial) => acc.split(denial).join(" "), text);

  for (const item of resolved.items) {
    const claimed = stripDenials(`${item.label} ${item.detail}`);
    for (const forbidden of [
      /\bauthorized to\b/i,
      /\bpermission to\b/i,
      /\bmay execute\b/i,
      /\bwithout approval\b/i,
      /\bgrants\b/i,
      /\bentitled to\b/i,
      /\bcan send\b/i,
    ]) {
      assert.ok(
        !forbidden.test(claimed),
        `no item claims ${forbidden.source} — a ceiling is not a grant (${item.recordRef})`,
      );
    }
    /* And every one of them says what it may PROPOSE, in those words. */
    assert.ok(
      /propose/i.test(item.detail),
      `${item.recordRef} states a PROPOSAL surface, never a capability`,
    );
  }

  /* The frozen list of what a mandate never means is carried, whole, by the authority. */
  assert.deepEqual(
    [...MANDATE_DOES_NOT_MEAN],
    [
      "authorized to execute",
      "authorized to approve",
      "authorized to issue permits",
      "authorized to access a provider",
      "authorized to grant permissions",
      "authorized to modify Governance",
      "authorized to widen its own mandate",
      "authorized to perform every technically available capability",
    ],
    "AMA-1's frozen denial list is unchanged by AMA-3",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE PURE RESOLVER'S DEFAULT NEVER STATES AN ABSENCE.
 *
 * G6D's correction, and here it runs in the dangerous direction: this same resolution is what the
 * answer flow falls back to when the real read THROWS, so a sentence saying "no mandate" would
 * turn a failed read into a claim that an agent is unbounded.
 * ═════════════════════════════════════════════════════════════════════════ */
function thePureDefaultIsHonest(): void {
  const pure = resolveSource("agent-mandate");
  assert.equal(pure.sourceClass, "agent-mandate");
  assert.equal(pure.state, "unavailable");
  assert.deepEqual(pure.items, []);
  assert.ok(
    /read tenant-scoped on the server/.test(pure.unavailableReason ?? ""),
    "it reports a server-side read, not an absent connection",
  );
  assert.ok(
    !/no mandate|unbounded|unlimited|may propose anything/i.test(pure.unavailableReason ?? ""),
    "and it never states an absence or a permission",
  );
}

async function main(): Promise<void> {
  await theClassIsItsOwnAndAuthoritative();
  await anEffectiveMandateGrounds();
  await absenceIsNotUnavailabilityAndNeitherIsPermission();
  await withdrawalReadsAsADecision();
  await nothingClaimsAnAuthority();
  thePureDefaultIsHonest();
  console.log("ama3-mandate-product/mandate-grounding: OK");
}

void main();
