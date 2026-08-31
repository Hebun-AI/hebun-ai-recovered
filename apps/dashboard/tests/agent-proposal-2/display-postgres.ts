/*
 * AGENT-PROPOSAL-2 — the review surface names the agent, against a REAL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A pending proposal an agent originated is readable as 'proposed by <that agent's name>', the
 *    name comes from the authoritative durable-identity authority, the raw actor id never leaves
 *    the server, and a human proposal on the same queue still reads as human."
 *
 * The last clause is not decoration. A reader that resolved a name for every row would make the
 * badge meaningless; the value of naming the agent is that it is VISIBLY not a person.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { readPendingActionRequests } from "../../src/features/action-authorization/read-action-authorizations.server";
import { resolveAgentProposerDisplays } from "../../src/features/action-authorization/agent-proposer-display.server";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { proposeSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import type { ClaudeTransport } from "../../src/features/heby-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-27T11:00:00.000Z");
const OWNER_WORKSPACE = "operations";
const AGENT_NAME = "Heby";
const GOAL = "Ayşe is waiting on the quarterly summary. Put it in front of me for sign-off.";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
} as const;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap2_display");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const transportReturning = (text: string): ClaudeTransport => ({
    async send(request) {
      return {
        id: "req_ap2_fake",
        model: request.model,
        content: [{ type: "text", text }],
        stopReason: "end_turn",
        usage: { inputTokens: 80, outputTokens: 25 },
      };
    },
  });

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-ap2",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-ap2",
      email: "other@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, "ap2-acme");
    const globexCtx = contextFor(globex, "ap2-globex");

    const recipient = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.test" },
      writeDeps,
    );
    const recipientRef = recipient.status === "created" ? recipient.recipient.recordRef : "";

    const draft = await createWorkArtifact(
      acmeCtx,
      { artifactType: "message-draft", title: "Quarterly summary", content: "Merhaba Ayşe," },
      OWNER_WORKSPACE,
      writeDeps,
    );
    const draftRef = draft.status === "created" ? draft.ref : "";

    const established = await createDurableAgentIdentity(acmeCtx, { name: AGENT_NAME }, dbDeps);
    assert.equal(established.status, "established");
    const agentId = established.status === "established" ? established.identity.agentId : "";

    /*
     * AMA-2 — THE CEILING IS NOW A PRECONDITION OF PROPOSING AT ALL. A durable agent that exists
     * but has not been bounded is refused `no-agent-mandate` by the proposal writer, so this suite
     * records the ceiling before exercising what it was written to prove. The mandate admits the
     * full released originable vocabulary, so it subtracts nothing here and weakens no assertion
     * below.
     */
    await seedAgentMandate(setup, acme, agentId, dbDeps, { tag: "ap2a" });

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. AN AGENT-ORIGINATED PROPOSAL READS BACK WITH THE AGENT'S NAME.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const originated = await originateAgentAction(
        { goal: GOAL },
        {
          resolveTenant: async () => acmeCtx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({
            transport: transportReturning(
              JSON.stringify({
                kind: "send",
                args: { recipientRef, draftRef },
                reason: "The draft answers the goal and Ayşe is a recorded recipient.",
              }),
            ),
            transportProvenance: "fake",
          }),
          agentIdentity: dbDeps,
          candidates: { recipients: dbDeps, artifacts: dbDeps },
          proposal: writeDeps,
        } as never,
      );
      assert.equal(originated.status, "proposed");

      const read = await readPendingActionRequests(acmeCtx, dbDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      assert.equal(read.items.length, 1);

      const item = read.items[0]!;
      assert.equal(item.proposedByActorType, "agent");

      /*
       * THE RAW ID NEVER LEAVES THE SERVER — ASSERTED FIRST.
       *
       * The view crosses into a client component, so every field on it is serialized; asserting
       * over the whole serialized object is stronger than asserting the absence of one key somebody
       * could rename. It comes before the name assertion because the realistic leak IS a name that
       * fell back to an id: a value assertion placed above would report a missing name rather than
       * the identifier sitting on a client payload.
       */
      const serialized = JSON.stringify(item);
      assert.equal(
        serialized.includes(agentId),
        false,
        "THE AGENT'S RAW ACTOR ID IS NOT SERIALIZED TO THE CLIENT",
      );
      assert.equal(serialized.includes(acme.userId), false, "and neither is the human's user id");
      assert.equal(serialized.includes(acme.tenantId), false, "and neither is the tenant id");

      assert.equal(
        item.proposedByAgentName,
        AGENT_NAME,
        "THE REVIEW SURFACE NAMES THE AGENT THAT PROPOSED — not merely the actor class",
      );
      assert.equal(item.proposedByAgentInService, true, "and says it is still in service");

      /*
       * The proposal is PENDING. Naming the proposer authorized nothing.
       *
       * AMA-2 — THE DECISION COUNT IS SCOPED, NOT DROPPED. It was a global zero while nothing in
       * this suite wrote a decision; bounding the agent is a real Governance act and writes two.
       * The claim was never "this database holds no decisions" — it was "NOTHING DECIDED ABOUT
       * THIS ACT" — so it is now asserted over the action-authorization subjects, which is what it
       * always meant and is what a decision about the proposal would land in.
       */
      const counts = await setup.query<{ permits: number; decisions: number; attempts: number }>(
        `select (select count(*)::int from action_permits) as permits,
                (select count(*)::int from decision_records
                  where subject_type in ('heby_action_request','action_permit')) as decisions,
                (select count(*)::int from action_execution_attempts) as attempts`,
      );
      assert.equal(counts.rows[0]!.permits, 0);
      assert.equal(counts.rows[0]!.decisions, 0, "NO decision was taken about the proposed act");
      assert.equal(counts.rows[0]!.attempts, 0);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. A HUMAN PROPOSAL ON THE SAME QUEUE STILL READS AS HUMAN.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const second = await createWorkArtifact(
        acmeCtx,
        { artifactType: "message-draft", title: "Follow-up", content: "Short follow-up." },
        OWNER_WORKSPACE,
        writeDeps,
      );
      const secondRef = second.status === "created" ? second.ref : "";
      const typed = await proposeSendAction(
        acmeCtx,
        { recipientRef, draftRef: secondRef },
        writeDeps,
      );
      assert.equal(typed.status, "proposed");

      const read = await readPendingActionRequests(acmeCtx, dbDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      assert.equal(read.items.length, 2, "both proposals are on one queue");

      const human = read.items.find((i) => i.proposedByActorType === "human");
      const agent = read.items.find((i) => i.proposedByActorType === "agent");
      assert.ok(human && agent, "one of each");
      assert.equal(
        human!.proposedByAgentName,
        null,
        "A HUMAN PROPOSAL NAMES NO AGENT — the badge is meaningless if every row resolves a name",
      );
      assert.equal(human!.proposedByAgentInService, null);
      assert.equal(agent!.proposedByAgentName, AGENT_NAME);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE DISPLAY SEAM IS TENANT-SCOPED.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      /* Globex asking about Acme's agent id gets nothing — not a name, not a placeholder. */
      const foreign = await resolveAgentProposerDisplays(globexCtx, [agentId], dbDeps);
      assert.equal(foreign.size, 0, "another tenant cannot resolve this agent's name");

      /* Acme asking about an id it does not own also gets nothing. */
      const unknown = await resolveAgentProposerDisplays(
        acmeCtx,
        ["99999999-9999-4999-8999-999999999999"],
        dbDeps,
      );
      assert.equal(unknown.size, 0, "an unowned id resolves to nothing, never to a placeholder");

      /* No tenant, no lookup. */
      const anonymous = await resolveAgentProposerDisplays(null, [agentId], dbDeps);
      assert.equal(anonymous.size, 0);

      /* An unavailable authority degrades to no names, never to a throw. */
      const unavailable = await resolveAgentProposerDisplays(acmeCtx, [agentId], {
        getDb: () => null,
      });
      assert.equal(unavailable.size, 0, "an unreachable identity authority names nobody");

      /* And the queue still READS when names cannot be resolved — degraded, not broken. */
      const degraded = await readPendingActionRequests(acmeCtx, dbDeps);
      assert.equal(degraded.status, "read");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. RETIREMENT DOES NOT ERASE PAST AUTHORSHIP.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const retired = await retireDurableAgentIdentity(acmeCtx, { agentId }, dbDeps);
      assert.equal(retired.status, "retired");

      const read = await readPendingActionRequests(acmeCtx, dbDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      const agent = read.items.find((i) => i.proposedByActorType === "agent");
      assert.ok(agent);
      assert.equal(
        agent!.proposedByAgentName,
        AGENT_NAME,
        "A RETIRED AGENT'S PAST PROPOSAL KEEPS ITS NAME — retirement is not erasure",
      );
      assert.equal(
        agent!.proposedByAgentInService,
        false,
        "and the surface can say the agent has since been withdrawn",
      );
    }

    console.log("PASS agent-proposal-2 agent identity display (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
