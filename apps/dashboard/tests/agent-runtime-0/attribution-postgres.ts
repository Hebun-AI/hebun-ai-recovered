/*
 * AGENT-RUNTIME-0 — DURABLE AGENT ATTRIBUTION, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "When Heby prepares work, the revision names the tenant's REAL durable agent identity as its
 *    author — never the human who asked, never a fabricated uuid, never a client-supplied id — and
 *    when no such identity is in service the work is REFUSED rather than attributed to somebody."
 *
 * The refusal half matters more than the attribution half. An attribution test alone would still
 * pass in a world where the seam quietly fell back to `tenant.userId` whenever the agent was
 * missing, because the happy path would never exercise the fallback. So every refusal is observed
 * against a real database in the order a tenant would actually meet it.
 *
 * WHAT THIS PHASE DID NOT GRANT is asserted too: after a full preparation the agent holds no
 * membership, no role, no permission, no session, no permit and no execution. Attribution is not
 * authority, and the counts are how that is proved rather than claimed.
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened. No
 * live provider: the transport is the repository's fake. No network, no key, no cost.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import type { HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import {
  generateHebyModelAnswer,
  type ClaudeTransport,
} from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import {
  createWorkArtifact,
  createWorkArtifactFromHebyPreparation,
  reviseWorkArtifactFromHebyPreparation,
} from "../../src/features/work-artifacts/write-work-artifacts.server";
import {
  isAgentAuthorship,
  resolveAgentAuthorship,
  type AgentAuthorship,
} from "../../src/features/work-artifacts/agent-authorship.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { readDurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-27T09:00:00.000Z");
const DRAFTED = "Merhaba Ayşe,\nHere is the quarterly summary you asked for.";
const REVISED = "Merhaba Ayşe,\nSecond pass, shorter.";
const OWNER_WORKSPACE = "operations";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
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
  const harness = createDisposablePostgresHarness("hebun_ar0_attribution");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  /* Every authority in this file is pointed at the disposable database, never the ambient URL. */
  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-ar0",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-ar0",
      email: "other@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, "ar0-acme");
    const globexCtx = contextFor(globex, "ar0-globex");

    const repo = createDurableConversationRepository(handle.db);
    const transportReturning = (text: string): ClaudeTransport => ({
      async send(request) {
        return {
          id: "req_ar0_fake",
          model: request.model,
          content: [{ type: "text", text }],
          stopReason: "end_turn",
          usage: { inputTokens: 40, outputTokens: 6 },
        };
      },
    });
    const answerDeps = (tenant: TenantContext, text: string): HebyModelAnswerDeps => ({
      resolveTenant: async () => tenant,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport: transportReturning(text), transportProvenance: "fake" }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-ar0",
      resolveWorkArtifacts: (t) => resolveWorkArtifactSource(t, dbDeps),
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. BEFORE ANY IDENTITY EXISTS, THERE IS NO AUTHOR — AND NO FALLBACK.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const resolved = await resolveAgentAuthorship(acmeCtx, dbDeps);
      assert.equal(resolved.status, "refused");
      assert.equal(
        resolved.status === "refused" ? resolved.reason : "",
        "no-durable-agent-identity",
        "a tenant with no durable agent has no agent author",
      );

      /* The refusal is not a disguised human attribution: no id of any kind is returned. */
      assert.equal(
        JSON.stringify(resolved).includes(acme.userId),
        false,
        "THE REFUSAL MUST NOT CARRY THE HUMAN USER ID — no fallback, not even in the shape",
      );

      const prepared = await prepareWorkArtifact(
        {
          prompt: "Draft a quarterly summary email for Ayşe.",
          route: "/operations",
          artifactType: "message-draft",
          title: "Cannot be authored yet",
        },
        { ...answerDeps(acmeCtx, DRAFTED), write: writeDeps, agentIdentity: dbDeps },
      );
      assert.equal(prepared.status, "refused");
      assert.equal(
        prepared.status === "refused" ? prepared.reason : "",
        "no-durable-agent-identity",
        "and the whole preparation seam refuses for that exact reason",
      );
      assert.ok(
        prepared.status === "refused" && prepared.answer,
        "the human still receives the answer Heby genuinely produced",
      );

      const rows = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifact_revisions`,
      );
      assert.equal(rows.rows[0]!.n, 0, "and nothing was filed");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. AN UNREACHABLE AUTHORITY IS NOT AN ABSENT AGENT.
     *
     * Folding these into one code would tell a tenant that owns an agent that it owns none — a
     * fabricated absence, and the exact failure `DurableAgentIdentityState` added a third state to
     * avoid.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const resolved = await resolveAgentAuthorship(acmeCtx, { getDb: () => null });
      assert.equal(
        resolved.status,
        "refused",
        "unreachable is its own answer, distinct from nonexistent",
      );
      assert.equal(
        resolved.status === "refused" ? resolved.reason : "",
        "agent-identity-authority-unavailable",
        "unreachable is its own answer, distinct from nonexistent",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. WITH A REAL DURABLE IDENTITY, THE REVISION NAMES IT.
     * ═════════════════════════════════════════════════════════════════════ */
    const established = await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, dbDeps);
    assert.equal(established.status, "established");
    const acmeAgentId = established.status === "established" ? established.identity.agentId : "";
    assert.notEqual(acmeAgentId, acme.userId, "an agent id is not a person's id");

    let artifactId = "";
    {
      const resolved = await resolveAgentAuthorship(acmeCtx, dbDeps);
      assert.equal(resolved.status, "resolved");
      assert.equal(
        resolved.status === "resolved" ? resolved.authorship.agentId : "",
        acmeAgentId,
        "the authorship names the identity the authority actually established",
      );

      const prepared = await prepareWorkArtifact(
        {
          prompt: "Draft a quarterly summary email for Ayşe.",
          route: "/operations",
          artifactType: "message-draft",
          title: "Quarterly summary to Ayşe",
        },
        { ...answerDeps(acmeCtx, DRAFTED), write: writeDeps, agentIdentity: dbDeps },
      );
      assert.equal(prepared.status, "prepared");
      if (prepared.status !== "prepared") throw new Error("unreachable");
      artifactId = prepared.artifactId;

      const row = await setup.query<{ actor: string; actorId: string; content: string }>(
        `select authored_by_actor_type as actor, authored_by_actor_id as "actorId", content
           from work_artifact_revisions where artifact_id = $1 and revision_no = 1`,
        [artifactId],
      );
      assert.equal(row.rows[0]!.actor, "agent", "the type half still says a machine wrote it");
      assert.equal(
        row.rows[0]!.actorId,
        acmeAgentId,
        "AND THE ID HALF NAMES THE DURABLE AGENT — the two halves describe one actor",
      );
      assert.notEqual(
        row.rows[0]!.actorId,
        acme.userId,
        "THE HUMAN USER ID IS NEVER THE AGENT AUTHOR",
      );
      assert.equal(row.rows[0]!.content, DRAFTED, "the model's bytes, verbatim");

      /*
       * The artifact's own `created_by` still names the HUMAN, and that is correct: a person asked
       * for this work. Authorship and requesting are different facts and the row holds both.
       */
      const artifact = await setup.query<{ createdBy: string; createdByType: string }>(
        `select created_by as "createdBy", created_by_type as "createdByType"
           from work_artifacts where id = $1`,
        [artifactId],
      );
      assert.equal(artifact.rows[0]!.createdBy, acme.userId);
      assert.equal(artifact.rows[0]!.createdByType, "human");
    }

    /* A Heby revision of the same artifact names the same durable agent. */
    {
      const prepared = await prepareWorkArtifact(
        {
          prompt: "Make it shorter.",
          route: "/operations",
          artifactType: "message-draft",
          title: "ignored on revise",
          artifactId,
        },
        { ...answerDeps(acmeCtx, REVISED), write: writeDeps, agentIdentity: dbDeps },
      );
      assert.equal(prepared.status, "prepared");
      const row = await setup.query<{ actorId: string }>(
        `select authored_by_actor_id as "actorId" from work_artifact_revisions
          where artifact_id = $1 and revision_no = 2`,
        [artifactId],
      );
      assert.equal(
        row.rows[0]!.actorId,
        acmeAgentId,
        "A HEBY REVISION NAMES THE SAME DURABLE AGENT — never the human who asked for it",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. THE HUMAN PATH IS UNCHANGED.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const created = await createWorkArtifact(
        acmeCtx,
        { artifactType: "operational-plan", title: "Human plan", content: "written by hand" },
        OWNER_WORKSPACE,
        writeDeps,
      );
      assert.equal(created.status, "created");
      const id = created.status === "created" ? created.artifactId : "";
      const row = await setup.query<{ actor: string; actorId: string }>(
        `select authored_by_actor_type as actor, authored_by_actor_id as "actorId"
           from work_artifact_revisions where artifact_id = $1`,
        [id],
      );
      assert.equal(row.rows[0]!.actor, "human", "a human author is still a human author");
      assert.equal(
        row.rows[0]!.actorId,
        acme.userId,
        "and the human path still names the acting person — this phase changed only the agent half",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. A FORGED AUTHORSHIP CANNOT AUTHOR.
     *
     * The brand is a module-private symbol, so this object is what a caller who read an agent id
     * off a request body and cast it could produce. The compiler accepts the cast; the writer does
     * not, and that is the difference between a convention and a boundary.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const forged = { agentId: acmeAgentId } as unknown as AgentAuthorship;
      assert.equal(isAgentAuthorship(forged), false, "an unbranded value is not an authorship");

      const created = await createWorkArtifactFromHebyPreparation(
        acmeCtx,
        { artifactType: "message-draft", title: "Forged", content: "should not exist" },
        OWNER_WORKSPACE,
        forged,
        writeDeps,
      );
      assert.equal(
        created.status,
        "refused",
        "A CLIENT-SUPPLIED AGENT ID CANNOT BECOME AN AUTHOR, even when the uuid is real",
      );
      assert.equal(
        created.status === "refused" ? created.reason : "",
        "unverified-agent-authorship",
        "A CLIENT-SUPPLIED AGENT ID CANNOT BECOME AN AUTHOR, even when the uuid is real",
      );

      const revised = await reviseWorkArtifactFromHebyPreparation(
        acmeCtx,
        { artifactId, content: "should not exist either" },
        forged,
        writeDeps,
      );
      assert.equal(revised.status, "refused");
      assert.equal(revised.status === "refused" ? revised.reason : "", "unverified-agent-authorship");

      const rows = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifact_revisions where artifact_id = $1`,
        [artifactId],
      );
      assert.equal(rows.rows[0]!.n, 2, "no third revision was appended");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. ANOTHER ORGANIZATION'S AGENT IS UNREACHABLE.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const resolved = await resolveAgentAuthorship(globexCtx, dbDeps);
      assert.equal(resolved.status, "refused");
      assert.equal(
        resolved.status === "refused" ? resolved.reason : "",
        "no-durable-agent-identity",
        "Globex owns no agent — Acme's is not visible to it",
      );
      assert.equal(
        JSON.stringify(resolved).includes(acmeAgentId),
        false,
        "and Acme's agent id never appears in another tenant's answer",
      );

      /*
       * There is no parameter through which Globex could name Acme's agent. `Function.length`
       * counts only the arguments BEFORE the first default, so the single required parameter is
       * the tenant — the deps object defaults to `{}` and carries no agent id either.
       */
      assert.equal(
        resolveAgentAuthorship.length,
        1,
        "the resolver requires a tenant and nothing else — never an agent id",
      );

      const prepared = await prepareWorkArtifact(
        {
          prompt: "Draft something for us.",
          route: "/operations",
          artifactType: "message-draft",
          title: "Globex draft",
        },
        { ...answerDeps(globexCtx, DRAFTED), write: writeDeps, agentIdentity: dbDeps },
      );
      assert.equal(prepared.status, "refused");
      assert.equal(
        prepared.status === "refused" ? prepared.reason : "",
        "no-durable-agent-identity",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. ATTRIBUTION GRANTED NOTHING.
     *
     * The agent authored durable work. It must still hold no membership, no role, no permission,
     * no session, no credential, no permit and no execution — and no row anywhere may have started
     * treating its id as a principal.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const counts = await setup.query<{
        memberships: number;
        permits: number;
        requests: number;
        decisions: number;
        executions: number;
        sessions: number;
        credentials: number;
      }>(
        `select (select count(*)::int from memberships where user_id = $1) as memberships,
                (select count(*)::int from action_permits) as permits,
                (select count(*)::int from heby_action_requests) as requests,
                (select count(*)::int from decision_records) as decisions,
                (select count(*)::int from action_execution_attempts) as executions,
                (select count(*)::int from user_session_contexts) as sessions,
                (select count(*)::int from auth_credentials) as credentials`,
        [acmeAgentId],
      );
      const row = counts.rows[0]!;
      assert.equal(row.memberships, 0, "the agent holds no membership");
      assert.equal(row.permits, 0, "no permit was issued");
      assert.equal(row.requests, 0, "no action was proposed — AGENT_PROPOSAL_CAPABLE stays NO");
      assert.equal(row.decisions, 0, "no Governance decision was recorded");
      assert.equal(row.executions, 0, "nothing was executed");
      assert.equal(row.sessions, 0, "the agent has no session");
      assert.equal(row.credentials, 0, "and no credential was issued to anybody");

      /* The agent id appears in exactly ONE place: the authorship column it was written to. */
      const authored = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifact_revisions where authored_by_actor_id = $1`,
        [acmeAgentId],
      );
      assert.equal(authored.rows[0]!.n, 2, "two revisions, both authored by the durable agent");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. A RETIRED AGENT MAY NOT AUTHOR NEW WORK.
     *
     * Retirement happens LAST, so everything above was proved against a serving identity and the
     * transition is observed as a real change of behaviour rather than as a separate fixture.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const retired = await retireDurableAgentIdentity(acmeCtx, { agentId: acmeAgentId }, dbDeps);
      assert.equal(retired.status, "retired");

      /* The identity still EXISTS — retirement is not deletion, and genesis stays spent. */
      const state = await readDurableAgentIdentityState(acmeCtx, dbDeps);
      assert.equal(state.status, "known");
      if (state.status !== "known") throw new Error("unreachable");
      assert.equal(state.genesisSpent, true, "the door did not reopen");
      assert.equal(state.identities.length, 1);
      assert.equal(state.identities[0]!.inService, false);

      const resolved = await resolveAgentAuthorship(acmeCtx, dbDeps);
      assert.equal(
        resolved.status,
        "refused",
        "A RETIRED AGENT AUTHORS NOTHING — resolving one at all is the failure",
      );
      assert.equal(
        resolved.status === "refused" ? resolved.reason : "",
        "durable-agent-identity-retired",
        "A RETIRED AGENT AUTHORS NOTHING — and the reason is not confused with never having one",
      );

      const prepared = await prepareWorkArtifact(
        {
          prompt: "Draft one more thing.",
          route: "/operations",
          artifactType: "message-draft",
          title: "After retirement",
        },
        { ...answerDeps(acmeCtx, DRAFTED), write: writeDeps, agentIdentity: dbDeps },
      );
      assert.equal(prepared.status, "refused");
      assert.equal(
        prepared.status === "refused" ? prepared.reason : "",
        "durable-agent-identity-retired",
      );

      /* The work the agent authored while serving is untouched. Retirement is not erasure. */
      const rows = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifact_revisions where authored_by_actor_id = $1`,
        [acmeAgentId],
      );
      assert.equal(rows.rows[0]!.n, 2, "past authorship survives retirement");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. TWO SERVING IDENTITIES DO NOT NAME ONE AGENT.
     *
     * Unreachable through the product: `createDurableAgentIdentity` is a one-shot, so this state is
     * manufactured with a RAW INSERT on a third tenant. That is legitimate here precisely because
     * the boundary must hold even in a state the product cannot currently produce — the day a
     * second durable agent is legitimate, this refusal is what forces the caller to say which one
     * instead of letting the resolver guess.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const initech = (await seedLocalIdentity(setup, {
        companyName: "Initech",
        companySlug: "initech-ar0",
        email: "third@initech.test",
      })) as Seeded;
      const initechCtx = contextFor(initech, "ar0-initech");

      await setup.query(
        `insert into agents (tenant_id, name, human_owner_type, human_owner_id, created_by, created_by_type)
         values ($1, 'Alpha', 'human', $2, $2, 'human'), ($1, 'Beta', 'human', $2, $2, 'human')`,
        [initech.tenantId, initech.userId],
      );

      const resolved = await resolveAgentAuthorship(initechCtx, dbDeps);
      assert.equal(
        resolved.status,
        "refused",
        "two serving identities are refused, never resolved to whichever sorted first",
      );
      assert.equal(
        resolved.status === "refused" ? resolved.reason : "",
        "ambiguous-durable-agent-identity",
        "two serving identities are refused, never resolved to whichever sorted first",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. THE SEVEN HUMAN-ONLY CHECKS, AS THE MIGRATED DATABASE HOLDS THEM.
     *
     * The firewall suite asserts what the schema DECLARES. This asserts what PostgreSQL actually
     * enforces at head, which is the only version of that claim a running system can rely on.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const checks = await setup.query<{ conname: string }>(
        `select conname from pg_constraint
          where contype = 'c' and pg_get_constraintdef(oid) ilike '%human%'
          order by conname`,
      );
      assert.deepEqual(
        checks.rows.map((r) => r.conname),
        [
          "action_permits_human_authorizer_chk",
          /*
           * SIA-3. The census GREW; nothing in it was widened — which is what this assertion has
           * always been about. A new table constrained its OWN AUTHOR to `human`, the strictest
           * direction, so that an agent cannot file an improvement hypothesis about itself.
           *
           * Extending the enumeration is the strict repair. Loosening it to "at least seven" would
           * be the weak one: it would let a future phase DELETE a released CHECK and still pass.
           */
          "agent_improvement_hypotheses_human_author_chk",
          "decision_records_bootstrap_human_chk",
          "heby_action_requests_human_approver_chk",
          "identity_enrollment_requests_human_approver_chk",
          "knowledge_external_references_human_declarer_chk",
          "knowledge_external_references_human_withdrawer_chk",
          "membership_authorizations_human_authorizer_chk",
        ],
        "the eight human-only CHECKs are enforced by the database, and this phase widened none of them",
      );
    }

    console.log("PASS agent-runtime-0 durable agent attribution (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
