/*
 * CGO-3 — AGENT CONTENT PREPARATION. A bounded agent prepares a content draft for a declared
 * destination, and gains nothing else.
 *
 * The whole chain — grounded model context, the real validator, the durable agent identity as
 * author, the Work Artifact Authority as owner — was already released and already executable. It
 * could be ASKED for a content draft and always failed closed at CGO-1's validator, because no
 * destination could reach it. This phase adds that one field and nothing else, so the tests below
 * are mostly about what did NOT change.
 *
 * Runs through the REAL `generateHebyModelAnswer`, the REAL validator and the REAL agent-identity
 * authority. Only the network transport is replaced — no key, no cost, no provider.
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { listWorkArtifacts } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { digestArtifactContent } from "../../src/features/work-artifacts/content-digest";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-03T14:00:00.000Z");
const CAPTION = "Three knots per centimetre.\nThat is the whole video.";
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

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

function contextFor(seeded: Seeded): TenantContext {
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
    requestId: "cgo3-prepare",
    authenticatedAt: NOW.toISOString(),
  });
}

/**
 * THE DESTINATION IS THE HUMAN'S, NOT THE MODEL'S — asserted structurally.
 *
 * The seam must carry the field from its input and must contain no path that reads the model's
 * reply looking for a destination. A classifier here would make the model the one deciding where
 * this organization intends to publish, which is a different act from writing a caption.
 */
function theModelNeverChoosesTheDestination(): void {
  const seam = readFileSync(
    path.join(REPO_ROOT, "src/features/work-artifacts/prepare-work-artifact.server.ts"),
    "utf8",
  );
  assert.ok(
    seam.includes("intendedDestination: input.intendedDestination"),
    "the destination is carried from the caller's input",
  );
  const code = seam.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const classifier of ["answer.outcome", "content.match", "body.join(\"\\n\").includes"]) {
    if (classifier === "answer.outcome") continue; /* legitimately used for origin + body */
    assert.equal(code.includes(classifier), false, `no destination classifier (${classifier})`);
  }
  assert.equal(
    /intendedDestination[^\n]*(match|includes|toLowerCase|indexOf)/.test(code),
    false,
    "the destination is never derived from text",
  );
}

/**
 * CGO-3 CHANGED NO AUTHORITY. The agent mandate governs what an agent may PROPOSE; it has never
 * governed what an artifact may say, and the artifact domain still imports it nowhere.
 */
function noMandateWasWidened(): void {
  const featureDir = path.join(REPO_ROOT, "src/features/work-artifacts");
  for (const file of ["prepare-work-artifact.server.ts", "write-work-artifacts.server.ts"]) {
    const source = readFileSync(path.join(featureDir, file), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of ["agent-mandate", "proposalScope", "proposal_scope"]) {
      assert.equal(
        code.includes(forbidden),
        false,
        `${file} must not touch the mandate — preparing content is not proposing an act`,
      );
    }
    /* And no execution, scheduling or provider reach arrived with it. */
    for (const forbidden of ["fetch(", "https://", "setInterval", "cron", "publishAt"]) {
      assert.equal(code.includes(forbidden), false, `${file} must contain no "${forbidden}"`);
    }
  }
}

async function main(): Promise<void> {
  theModelNeverChoosesTheDestination();
  noMandateWasWidened();

  const harness = createDisposablePostgresHarness("hebun_cgo3_agent_content");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-cgo3",
      email: "director@acme.test",
    })) as Seeded;
    const tenant = contextFor(acme);
    const repo = createDurableConversationRepository(handle.db);
    const writeDeps = { getDb: () => handle.db } as never;
    const agentIdentityDeps = { getDb: () => handle.db } as never;

    const transportReturning = (text: string): ClaudeTransport => ({
      async send(request) {
        return {
          id: "req_cgo3_fake",
          model: request.model,
          content: [{ type: "text", text }],
          stopReason: "end_turn",
          usage: { inputTokens: 42, outputTokens: 7 },
        };
      },
    });

    const answerDeps = (text: string): HebyModelAnswerDeps => ({
      resolveTenant: async () => tenant,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport: transportReturning(text), transportProvenance: "fake" }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-cgo3",
      resolveWorkArtifacts: (t) => resolveWorkArtifactSource(t, writeDeps),
    });

    const established = await createDurableAgentIdentity(tenant, { name: "Heby" }, agentIdentityDeps);
    assert.equal(established.status, "established", "the tenant has a durable agent");
    const agentId = established.status === "established" ? established.identity.agentId : "";

    /* ── 1. THE STATE BEFORE CGO-3, STILL REACHABLE: no destination ⇒ REFUSED ──
     * This is the gap this phase closed, kept as a live proof rather than a claim in prose. The
     * agent path could always be asked for a content draft; the released validator always stopped
     * it, and it still does when nobody declares a destination.
     */
    {
      const refused = await prepareWorkArtifact(
        {
          prompt: "Draft an Instagram caption about the loom weaving reel.",
          route: "/operations",
          artifactType: "content-draft",
          title: "Reel caption",
        },
        { ...answerDeps(CAPTION), write: writeDeps, agentIdentity: agentIdentityDeps },
      );
      assert.equal(
        refused.status,
        "refused",
        "a content draft with no declared destination is still refused",
      );
      const { rows } = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifacts`,
      );
      assert.equal(rows[0]!.n, 0, "and nothing was written");
    }

    /* ── 2. THE CAPABILITY: an agent prepares a content draft for a declared destination ── */
    const prepared = await prepareWorkArtifact(
      {
        prompt: "Draft an Instagram caption about the loom weaving reel.",
        route: "/operations",
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Loom weaving reel caption",
      },
      { ...answerDeps(CAPTION), write: writeDeps, agentIdentity: agentIdentityDeps },
    );
    assert.equal(prepared.status, "prepared", "the agent prepares the content draft");
    if (prepared.status !== "prepared") throw new Error("unreachable");

    /* ── 3. THE BYTES ARE THE MODEL'S, VERBATIM — no parser, no reformatting ── */
    assert.equal(
      prepared.contentDigest,
      digestArtifactContent(CAPTION),
      "the reply is stored verbatim; nothing extracted a 'draft part'",
    );
    assert.equal(prepared.revisionNo, 1);
    assert.match(prepared.ref, /^work-artifact\/[0-9a-f-]{36}@1$/);

    /* ── 4. AUTHORSHIP IS THE DURABLE AGENT, NOT THE HUMAN ── */
    const rev = await setup.query<{
      authored_by_actor_type: string;
      authored_by_actor_id: string;
      source_message_id: string | null;
    }>(
      `select authored_by_actor_type, authored_by_actor_id, source_message_id
         from work_artifact_revisions where artifact_id = $1`,
      [prepared.artifactId],
    );
    assert.equal(rev.rows[0]!.authored_by_actor_type, "agent", "the author is an agent");
    assert.equal(rev.rows[0]!.authored_by_actor_id, agentId, "and it is THIS tenant's durable agent");
    assert.notEqual(rev.rows[0]!.authored_by_actor_id, acme.userId, "never the requesting human");
    assert.ok(rev.rows[0]!.source_message_id, "provenance points at the message that produced it");

    /* ── 5. THE DESTINATION IS DURABLE, AND IT IS THE HUMAN'S ── */
    const listed = await listWorkArtifacts(tenant, writeDeps);
    assert.equal(listed.status, "read");
    const view =
      listed.status === "read" ? listed.artifacts.find((a) => a.id === prepared.artifactId) : undefined;
    assert.ok(view, "the draft is in the register");
    assert.equal(view.artifactType, "content-draft");
    assert.equal(view.intendedDestination, "instagram", "the declared destination is durable");

    /* ── 6. HEBY CAN READ IT BACK, WITH CGO-2's DENIAL INTACT ── */
    const grounding = await resolveWorkArtifactSource(tenant, writeDeps);
    assert.equal(grounding.state, "resolved");
    const item = grounding.items.find((i) => i.recordRef === prepared.ref);
    assert.ok(item, "the agent-prepared draft is groundable");
    assert.ok(item.detail.includes("prepared for: Instagram"), "Heby is told the destination");
    assert.ok(item.detail.includes("DECLARED ONLY"), "and CGO-2's denial still travels with it");
    assert.ok(item.detail.includes("authored by: agent"), "and that an agent wrote it");

    /* ── 7. PREPARING CAUSED NOTHING ELSE. Counted, not asserted in prose. ── */
    for (const table of [
      "decision_records",
      "heby_action_requests",
      "action_execution_attempts",
      "integration_credentials",
      "agent_mandates",
    ]) {
      const { rows } = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(
        rows[0]!.n,
        0,
        `an agent preparing content wrote no ${table} row: preparation is not an act`,
      );
    }
    /* Exactly one artifact and one revision — the refusal in step 1 left nothing behind. */
    for (const [table, expected] of [["work_artifacts", 1], ["work_artifact_revisions", 1]] as const) {
      const { rows } = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(rows[0]!.n, expected, `${table} holds exactly ${expected}`);
    }
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }

  console.log("PASS cgo3 agent content preparation");
}

void main();
