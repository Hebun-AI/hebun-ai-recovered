/*
 * MEDIA-1 — the Media Asset authority against a REAL PostgreSQL.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "A human's request for an image from one exact draft revision is refused — with no row written
 *    and no transport called — unless storage, a transport, a durable agent and a same-tenant draft
 *    revision all exist. One request key reaches the transport once. Bytes become an asset only after
 *    Hebun itself verified type, size, dimensions and SHA-256, and the persisted digest is the digest
 *    of the stored object. Reads and reviews never cross a tenant. A Governance decision binds the
 *    exact asset and its digest, writes nothing to the asset, and creates no request, permit or
 *    execution. With no storage connected, every answer is `unavailable`."
 *
 * The migration is applied by the harness, so a failure here is also a migration failure.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { recordGovernanceDecision } from "../../src/features/governance-decision/decision-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { readMediaAsset } from "../../src/features/media-assets/read-media-assets.server";
import { retireMediaAsset } from "../../src/features/media-assets/retire-media-asset.server";
import { digestMediaGenerationInput } from "../../src/features/media-assets/input-digest";
import {
  acceptMediaAsset,
  declineMediaAsset,
  readMediaAssetReviewState,
} from "../../src/features/media-asset-review/review-media-asset.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import { createOpenAiImageTransport } from "../../src/features/media-generation-live/openai-image-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { startLocalVpsStore } from "../helpers/media-vps-store-process";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  FAKE_MEDIA_HOST,
  FAKE_MEDIA_MODEL,
  FAKE_MEDIA_PROVIDER,
  createFakeMediaGenerationTransport,
  createMemoryMediaObjectStore,
  gifBytes,
  jpegBytes,
  pngBytes,
  svgBytes,
  webpBytes,
} from "../helpers/media-fakes";

const NOW = new Date("2026-09-17T09:00:00.000Z");
const PROMPT = "A hand-knotted kilim on the loom, morning light, no text.";
const REASON = "Governance has looked at these exact image bytes and records its decision here.";
const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "media1-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.padEnd(64, "a").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function addMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
  const user = await client.query<{ id: string }>(`insert into users (email, name) values ($1, $1) returning id`, [email]);
  const userId = user.rows[0]!.id;
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [userId, `local:${email}`],
  );
  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type) values ($1, $2, 'owner') returning id`,
    [tenantId, `Role ${email}`],
  );
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active') returning id`,
    [tenantId, userId, role.rows[0]!.id],
  );
  return { tenantId, userId, authIdentityId: identity.rows[0]!.id, membershipId: membership.rows[0]!.id, roleId: role.rows[0]!.id };
}

async function establishGovernance(client: Client, seeded: Seeded, ctx: TenantContext, deps: unknown): Promise<void> {
  await client.query(
    `insert into genesis_nominations
       (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
        accepted_at, accepted_session_context_id, accepted_assurance_level)
     values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
    [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
  );
  const result = await establishGovernanceAuthority(
    ctx,
    { justification: "Establishing Governance authority so admitted images can be reviewed." },
    deps as never,
  );
  assert.equal(result.status, "established");
}

async function seedDraft(
  client: Client,
  tenantId: string,
  authorId: string,
  artifactType: "content-draft" | "operational-plan" = "content-draft",
): Promise<{ artifactId: string; digest: string }> {
  const content = `Draft copy for ${artifactType} ${randomUUID()}`;
  const artifact = await client.query<{ id: string }>(
    `insert into work_artifacts
       (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
        current_revision, intended_destination, created_by, created_by_type)
     values ($1,$2,'Draft','draft','operations',1,$3,$4,'human') returning id`,
    [tenantId, artifactType, artifactType === "content-draft" ? "instagram" : null, authorId],
  );
  const digest = sha(new TextEncoder().encode(content));
  await client.query(
    `insert into work_artifact_revisions
       (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
     values ($1,$2,1,$3,$4,'human',$5)`,
    [tenantId, artifact.rows[0]!.id, content, digest, authorId],
  );
  return { artifactId: artifact.rows[0]!.id, digest };
}

async function count(client: Client, table: string, where = "true", params: unknown[] = []): Promise<number> {
  const r = await client.query<{ n: string }>(`select count(*)::text as n from ${table} where ${where}`, params);
  return Number(r.rows[0]!.n);
}

async function expectDbRefusal(client: Client, label: string, statement: string, params: unknown[]): Promise<void> {
  await client.query("savepoint probe");
  let failed = false;
  try {
    await client.query(statement, params);
  } catch {
    failed = true;
  }
  await client.query("rollback to savepoint probe");
  assert.ok(failed, `the database refuses: ${label}`);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_media1_authority");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const alice = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-media1",
      email: "alice@acme.test",
    })) as Seeded;
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a1"));
    await establishGovernance(setup, alice, aliceCtx, { getDb, now: () => NOW });
    const dana = await addMember(setup, alice.tenantId, "dana@acme.test");
    const danaCtx = contextFor(dana, await sessionRowFor(setup, dana, "d1"));

    const erin = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-media1",
      email: "erin@globex.test",
    })) as Seeded;
    const erinCtx = contextFor(erin, await sessionRowFor(setup, erin, "e1"));
    await establishGovernance(setup, erin, erinCtx, { getDb, now: () => NOW });

    const draft = await seedDraft(setup, alice.tenantId, alice.userId);
    const plan = await seedDraft(setup, alice.tenantId, alice.userId, "operational-plan");
    const foreignDraft = await seedDraft(setup, erin.tenantId, erin.userId);

    const store = createMemoryMediaObjectStore();
    const connected = (): MediaStorageResolution => ({ status: "available", store });
    const transport = createFakeMediaGenerationTransport({ kind: "bytes", bytes: pngBytes(1080, 1080) });
    const deps = (overrides: Record<string, unknown> = {}) => ({
      getDb,
      now: () => NOW,
      resolveStorage: connected,
      resolveTransport: () => ({ status: "available" as const, transport }),
      ...overrides,
    });
    const ask = (requestKey = randomUUID(), extra: Record<string, unknown> = {}) => ({
      artifactId: draft.artifactId,
      revisionNo: 1,
      promptText: PROMPT,
      requestKey,
      ...extra,
    });
    const invocations = () => count(setup, "media_generation_invocations");
    const assets = () => count(setup, "media_assets");

    const refusedInPreflight = async (label: string, run: () => Promise<unknown>, reason: string) => {
      const [calls, inv, ast, puts] = [transport.calls.length, await invocations(), await assets(), store.puts.length];
      const result = (await run()) as { status: string; reason?: string };
      assert.deepEqual(result, { status: "refused", reason }, label);
      assert.equal(transport.calls.length, calls, `${label}: the transport was not called`);
      assert.equal(await invocations(), inv, `${label}: no invocation was written`);
      assert.equal(await assets(), ast, `${label}: no asset was written`);
      assert.equal(store.puts.length, puts, `${label}: storage was not touched`);
    };

    /* ── 1. PRODUCTION STORAGE UNCONFIGURED MEANS UNAVAILABLE ───────────────── */
    await refusedInPreflight(
      "released resolvers: storage not connected",
      () => requestMediaGeneration(aliceCtx, ask(), { getDb, now: () => NOW }),
      "storage-unavailable",
    );
    await refusedInPreflight(
      "released transport resolver: no generation provider",
      () => requestMediaGeneration(aliceCtx, ask(), { getDb, now: () => NOW, resolveStorage: connected }),
      "generation-transport-unavailable",
    );

    /* ── 2. NO DURABLE AGENT MEANS NO INVOCATION AND NO PROVIDER CALL ───────── */
    await refusedInPreflight("no durable agent", () => requestMediaGeneration(aliceCtx, ask(), deps()), "no-durable-agent");
    const established = await createDurableAgentIdentity(aliceCtx, { name: "Heby" }, { getDb } as never);
    assert.equal(established.status, "established");
    const agentId = established.status === "established" ? established.identity.agentId : "";

    /* ── 3. INPUT AND AUTHENTICATION ────────────────────────────────────────── */
    await refusedInPreflight("no tenant", () => requestMediaGeneration(null, ask(), deps()), "unauthenticated");
    await refusedInPreflight(
      "prompt over 4,000 code points",
      () => requestMediaGeneration(aliceCtx, ask(randomUUID(), { promptText: "ğ".repeat(4001) }), deps()),
      "invalid-input",
    );
    await refusedInPreflight(
      "blank prompt",
      () => requestMediaGeneration(aliceCtx, ask(randomUUID(), { promptText: "   " }), deps()),
      "invalid-input",
    );
    await refusedInPreflight(
      "request key not a uuid",
      () => requestMediaGeneration(aliceCtx, ask("not-a-key" as never), deps()),
      "invalid-input",
    );

    /* ── 4. CROSS-TENANT SOURCE REVISION FAILS CLOSED ───────────────────────── */
    await refusedInPreflight(
      "another tenant's draft revision",
      () => requestMediaGeneration(aliceCtx, ask(randomUUID(), { artifactId: foreignDraft.artifactId }), deps()),
      "source-revision-unresolvable",
    );
    await refusedInPreflight(
      "a revision that does not exist",
      () => requestMediaGeneration(aliceCtx, ask(randomUUID(), { revisionNo: 2 }), deps()),
      "source-revision-unresolvable",
    );
    await refusedInPreflight(
      "not a content draft",
      () => requestMediaGeneration(aliceCtx, ask(randomUUID(), { artifactId: plan.artifactId }), deps()),
      "source-revision-unresolvable",
    );

    /* ── 5. ONE ADMITTED IMAGE, END TO END ──────────────────────────────────── */
    const draftBefore = await setup.query(
      `select a.*, r.content, r.content_digest from work_artifacts a join work_artifact_revisions r on r.artifact_id = a.id where a.id = $1`,
      [draft.artifactId],
    );
    const bytes = pngBytes(1080, 1080);
    const firstKey = randomUUID();
    const admitted = await requestMediaGeneration(aliceCtx, ask(firstKey), deps());
    assert.equal(admitted.status, "admitted");
    if (admitted.status !== "admitted") throw new Error("unreachable");
    assert.equal(transport.calls.length, 1);
    assert.equal(admitted.byteDigest, sha(bytes));
    assert.deepEqual([admitted.mimeType, admitted.width, admitted.height, admitted.byteSize], ["image/png", 1080, 1080, bytes.length]);

    const invocation = (
      await setup.query(`select * from media_generation_invocations where id = $1`, [admitted.invocationId])
    ).rows[0];
    assert.equal(invocation.tenant_id, alice.tenantId);
    assert.equal(invocation.requested_by_actor_type, "human");
    assert.equal(invocation.requested_by_actor_id, alice.userId);
    assert.equal(invocation.agent_id, agentId, "the durable agent is recorded as the generating author");
    assert.equal(invocation.source_artifact_id, draft.artifactId);
    assert.equal(invocation.source_revision_no, 1);
    assert.equal(invocation.prompt_text, PROMPT);
    assert.equal(
      invocation.input_digest,
      digestMediaGenerationInput({
        promptText: PROMPT,
        sourceArtifactId: draft.artifactId,
        sourceRevisionNo: 1,
        sourceContentDigest: draft.digest,
        transport: "fake",
        provider: FAKE_MEDIA_PROVIDER,
        model: FAKE_MEDIA_MODEL,
      }),
      "the input digest is recomputable from the row plus the referenced revision",
    );
    assert.equal(transport.calls[0]!.inputDigest, invocation.input_digest);
    assert.deepEqual(
      [invocation.transport, invocation.provider, invocation.model, invocation.provider_job_id],
      ["fake", FAKE_MEDIA_PROVIDER, FAKE_MEDIA_MODEL, "fake-job-1"],
    );
    assert.deepEqual([invocation.state, invocation.admission_outcome, invocation.admission_failure], ["provider-succeeded", "admitted", null]);
    assert.ok(invocation.finalized_at);

    const asset = (await setup.query(`select * from media_assets where id = $1`, [admitted.assetId])).rows[0];
    assert.equal(asset.tenant_id, alice.tenantId);
    assert.equal(asset.invocation_id, admitted.invocationId);
    assert.equal(asset.byte_digest, sha(bytes), "persisted digest is the digest of the admitted bytes");
    assert.equal(asset.storage_backend, "test-memory");
    assert.equal(asset.storage_key, `tenants/${alice.tenantId}/media/${admitted.assetId}`);
    assert.equal(asset.asset_lifecycle_status, "admitted");
    const stored = store.objects.get(asset.storage_key);
    assert.ok(stored, "the bytes were written through the storage port under the row's key");
    assert.equal(sha(stored!.bytes), asset.byte_digest, "the STORED object's digest equals the persisted digest");
    assert.equal(stored!.contentType, "image/png");

    const draftAfter = await setup.query(
      `select a.*, r.content, r.content_digest from work_artifacts a join work_artifact_revisions r on r.artifact_id = a.id where a.id = $1`,
      [draft.artifactId],
    );
    assert.deepEqual(draftAfter.rows, draftBefore.rows, "the draft and its revision are untouched");

    const urlColumns = await setup.query(
      `select table_name, column_name from information_schema.columns
        where table_name in ('media_assets','media_generation_invocations') and column_name ~ '(url|uri|link|href)'`,
    );
    assert.equal(urlColumns.rows.length, 0, "no column can hold a provider URL");

    /* ── 6. A DUPLICATE REQUEST KEY CANNOT DOUBLE-DISPATCH ──────────────────── */
    await refusedInPreflight("same request key again", () => requestMediaGeneration(aliceCtx, ask(firstKey), deps()), "duplicate-request");
    {
      const raceKey = randomUUID();
      const callsBefore = transport.calls.length;
      const [a, b] = await Promise.all([
        requestMediaGeneration(aliceCtx, ask(raceKey), deps()),
        requestMediaGeneration(aliceCtx, ask(raceKey), deps()),
      ]);
      const statuses = [a.status, b.status].sort();
      assert.deepEqual(statuses, ["admitted", "refused"], "two concurrent submissions of one key: one attempt");
      assert.equal(transport.calls.length, callsBefore + 1, "the transport was reached exactly once");
      assert.equal(await count(setup, "media_generation_invocations", "request_key = $1", [raceKey]), 1);
    }
    /* The same key in ANOTHER tenant is a different request. */
    {
      await createDurableAgentIdentity(erinCtx, { name: "Heby" }, { getDb } as never);
      const other = await requestMediaGeneration(
        erinCtx,
        { artifactId: foreignDraft.artifactId, revisionNo: 1, promptText: PROMPT, requestKey: firstKey },
        deps(),
      );
      assert.equal(other.status, "admitted", "idempotency is per tenant");
    }

    /* ── 7. INVALID BYTES CREATE NO ASSET ───────────────────────────────────── */
    const notAdmitted = async (
      label: string,
      behaviour: Parameters<typeof createFakeMediaGenerationTransport>[0],
      failure: string,
      admissionOutcome = "refused",
      extraDeps: Record<string, unknown> = {},
    ) => {
      transport.behaviour = behaviour;
      const assetsBefore = await assets();
      const result = await requestMediaGeneration(aliceCtx, ask(), deps(extraDeps));
      assert.equal(result.status, "not-admitted", label);
      if (result.status !== "not-admitted") return;
      assert.equal(result.failure, failure, label);
      assert.equal(await assets(), assetsBefore, `${label}: no asset`);
      const row = (await setup.query(`select * from media_generation_invocations where id = $1`, [result.invocationId])).rows[0];
      assert.deepEqual([row.admission_outcome, row.admission_failure], [admissionOutcome, failure], label);
      assert.ok(row.finalized_at, `${label}: finalized`);
    };
    const putsBeforeInvalid = store.puts.length;
    await notAdmitted("GIF", { kind: "bytes", bytes: gifBytes() }, "unsupported-image-signature");
    await notAdmitted("SVG", { kind: "bytes", bytes: svgBytes(), declaredContentType: "image/svg+xml" }, "unsupported-image-signature");
    await notAdmitted("declared PNG, bytes JPEG", { kind: "bytes", bytes: jpegBytes(10, 10), declaredContentType: "image/png" }, "declared-type-mismatch");
    await notAdmitted("dimensions over 8192", { kind: "bytes", bytes: webpBytes(9000, 10) }, "dimensions-exceeded");
    await notAdmitted("oversize", { kind: "bytes", bytes: pngBytes(10, 10, 20 * 1024 * 1024) }, "byte-size-exceeded");
    await notAdmitted("truncated PNG", { kind: "bytes", bytes: pngBytes(10, 10).subarray(0, 40) }, "malformed-image");
    await notAdmitted("empty", { kind: "bytes", bytes: new Uint8Array(0) }, "empty-bytes");
    assert.equal(store.puts.length, putsBeforeInvalid, "refused bytes never reach storage");

    /* ── 8. PROVIDER URLS: FOLLOWED INSIDE THE ALLOWLIST, NEVER PERSISTED ───── */
    {
      const signed = `https://${FAKE_MEDIA_HOST}/out/1.jpg?X-Signature=secret-signed-token`;
      const jpeg = jpegBytes(800, 600);
      const fetchImpl: typeof fetch = async (input) =>
        String(input) === signed
          ? new Response(jpeg as BodyInit, { status: 200, headers: { "content-type": "image/jpeg" } })
          : new Response("no", { status: 404 });
      transport.behaviour = { kind: "url", url: signed };
      const viaUrl = await requestMediaGeneration(aliceCtx, ask(), deps({ download: { fetchImpl } }));
      assert.equal(viaUrl.status, "admitted");
      if (viaUrl.status === "admitted") assert.equal(viaUrl.byteDigest, sha(jpeg));
      await notAdmitted(
        "URL outside the allowlist",
        { kind: "url", url: "https://169.254.169.254/latest/meta-data" },
        "download-host-not-allowed",
        "refused",
        { download: { fetchImpl: async () => { throw new Error("must not fetch"); } } },
      );
      const leaked = await setup.query(
        `select 1 from media_generation_invocations i where row_to_json(i)::text ~ '(https?:|secret-signed-token)'
         union all select 1 from media_assets a where row_to_json(a)::text ~ '(https?:|secret-signed-token)'`,
      );
      assert.equal(leaked.rows.length, 0, "no provider URL or token was persisted anywhere");
    }

    /* ── 9. PROVIDER AND STORAGE FAILURES ───────────────────────────────────── */
    {
      transport.behaviour = { kind: "provider-failure" };
      const failed = await requestMediaGeneration(aliceCtx, ask(), deps());
      assert.equal(failed.status, "not-admitted");
      if (failed.status === "not-admitted") {
        assert.deepEqual([failed.state, failed.admissionOutcome], ["provider-failed", "not-attempted"]);
        const row = (await setup.query(`select provider_job_id from media_generation_invocations where id = $1`, [failed.invocationId])).rows[0];
        assert.match(String(row.provider_job_id), /^fake-job-/, "a failed job's id is still durable");
      }
      transport.behaviour = { kind: "throw" };
      const thrown = await requestMediaGeneration(aliceCtx, ask(), deps());
      assert.equal(thrown.status === "not-admitted" ? thrown.state : "", "dispatch-failed");

      transport.behaviour = { kind: "bytes", bytes: pngBytes(64, 64) };
      store.failNextPut = true;
      await notAdmitted("storage write fails", { kind: "bytes", bytes: pngBytes(64, 64) }, "storage-write-failed", "failed");
    }

    /* ── 10. THE DATABASE ITSELF REFUSES WHAT THE AUTHORITY NEVER WRITES ────── */
    await setup.query("begin");
    {
      const base = [alice.tenantId, randomUUID(), alice.userId, agentId, draft.artifactId];
      const insertInvocation = (transportName: string, actorType: string, tenantId = alice.tenantId, artifactId = draft.artifactId) =>
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
            source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider, model,
            state, requested_at)
         values ('${tenantId}', gen_random_uuid(), '${actorType}', '${alice.userId}', '${agentId}',
                 '${artifactId}', 1, 'p', repeat('a', 64), '${transportName}', 'p', 'm', 'registered', now())`;
      void base;
      /* MEDIA-2A widened the CHECK to exactly `fake | live`; any other transport kind stays unwritable. */
      await expectDbRefusal(setup, "an unknown transport kind", insertInvocation("openai", "human"), []);
      await expectDbRefusal(setup, "an agent-originated request", insertInvocation("fake", "agent"), []);
      await expectDbRefusal(setup, "a source revision from another tenant", insertInvocation("fake", "human", alice.tenantId, foreignDraft.artifactId), []);
      await expectDbRefusal(
        setup,
        "an asset whose storage key names another tenant",
        `insert into media_assets (tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
            storage_backend, storage_key, admitted_at)
         values ($1, $2, 'image/png', 10, repeat('a',64), 1, 1, 'test-memory', 'tenants/' || $3 || '/media/x', now())`,
        [alice.tenantId, admitted.invocationId, erin.tenantId],
      );
      await expectDbRefusal(
        setup,
        "a GIF",
        `update media_assets set mime_type = 'image/gif' where id = $1`,
        [admitted.assetId],
      );
      await expectDbRefusal(
        setup,
        "moving an asset to another tenant",
        `update media_assets set tenant_id = $1 where id = $2`,
        [erin.tenantId, admitted.assetId],
      );
    }
    await setup.query("rollback");

    /* ── 11. READS: TENANT-CONTROLLED, INTEGRITY-CHECKED, FAIL-CLOSED ───────── */
    {
      const unconnected = await readMediaAsset(aliceCtx, admitted.assetId, { getDb });
      assert.deepEqual(unconnected, { status: "unavailable", reason: "storage-unavailable" }, "no storage: unavailable, never not-found or empty");
      assert.deepEqual(await readMediaAsset(aliceCtx, randomUUID(), { getDb }), unconnected, "and identical for an id that does not exist");
      assert.deepEqual(await readMediaAsset(null, admitted.assetId, { getDb, resolveStorage: connected }), { status: "unauthenticated" });

      const own = await readMediaAsset(aliceCtx, admitted.assetId, { getDb, resolveStorage: connected });
      assert.equal(own.status, "read");
      if (own.status === "read") {
        assert.equal(own.asset.byteDigest, sha(bytes));
        assert.equal(own.asset.agentId, agentId);
        assert.equal(own.asset.sourceArtifactId, draft.artifactId);
        assert.equal(own.asset.transport, "fake");
        assert.ok(!("storageKey" in own.asset), "the storage key is not handed to readers");
        assert.match(own.access.url, /^memory:\/\//);
      }

      const grantsBefore = store.readGrants.length;
      const foreign = await readMediaAsset(erinCtx, admitted.assetId, { getDb, resolveStorage: connected });
      assert.deepEqual(foreign, { status: "not-found" }, "another tenant's asset is not found");
      assert.deepEqual(await readMediaAsset(aliceCtx, randomUUID(), { getDb, resolveStorage: connected }), foreign, "indistinguishable from a missing one");
      assert.equal(store.readGrants.length, grantsBefore, "no read grant was issued across the tenant boundary");

      const key = `tenants/${alice.tenantId}/media/${admitted.assetId}`;
      const original = store.objects.get(key)!;
      store.objects.set(key, { ...original, bytes: pngBytes(1080, 1081) });
      assert.deepEqual(
        await readMediaAsset(aliceCtx, admitted.assetId, { getDb, resolveStorage: connected }),
        { status: "unavailable", reason: "integrity-mismatch" },
        "a read is never granted on bytes that are not the admitted ones",
      );
      store.objects.delete(key);
      assert.deepEqual(
        await readMediaAsset(aliceCtx, admitted.assetId, { getDb, resolveStorage: connected }),
        { status: "unavailable", reason: "object-absent" },
      );
      store.objects.set(key, original);
    }

    /* ── 12. GOVERNANCE BINDS THE EXACT ASSET AND DIGEST, AND NOTHING ELSE ──── */
    const deciding = { getDb, now: () => NOW };
    const executionCounts = async () => [
      await count(setup, "heby_action_requests"),
      await count(setup, "action_permits"),
      await count(setup, "action_execution_attempts"),
    ];
    const executionBefore = await executionCounts();
    const assetRowBefore = (await setup.query(`select * from media_assets where id = $1`, [admitted.assetId])).rows;
    const decisionsBefore = await count(setup, "decision_records");
    {
      const input = { assetId: admitted.assetId, byteDigest: admitted.byteDigest, justification: REASON };

      assert.deepEqual(await acceptMediaAsset(null, input, deciding), { status: "refused", reason: "unauthenticated" });
      assert.deepEqual(await acceptMediaAsset(danaCtx, input, deciding), { status: "refused", reason: "not-the-governance-authority" });
      assert.deepEqual(
        await acceptMediaAsset(aliceCtx, { ...input, byteDigest: "b".repeat(64) }, deciding),
        { status: "refused", reason: "asset-digest-mismatch" },
      );
      assert.deepEqual(await acceptMediaAsset(erinCtx, input, deciding), { status: "refused", reason: "asset-unresolvable" });
      assert.deepEqual(
        await acceptMediaAsset(aliceCtx, { ...input, assetId: randomUUID() }, deciding),
        { status: "refused", reason: "asset-unresolvable" },
      );
      assert.deepEqual(await acceptMediaAsset(aliceCtx, { ...input, justification: "ok" }, deciding), {
        status: "refused",
        reason: "justification-required",
      });
      assert.equal(await count(setup, "decision_records"), decisionsBefore, "no refusal recorded anything");

      const generic = await recordGovernanceDecision(
        aliceCtx,
        { decisionType: "ratify", subjectType: "media_asset", subjectId: admitted.assetId, justification: REASON },
        deciding as never,
      );
      assert.deepEqual(generic, { status: "refused", reason: "subject-unresolvable" }, "the generic G2 path cannot decide about an asset");

      const accepted = await acceptMediaAsset(aliceCtx, input, deciding);
      assert.equal(accepted.status, "reviewed");
      if (accepted.status !== "reviewed") throw new Error("unreachable");
      const decision = (await setup.query(`select * from decision_records where id = $1`, [accepted.decisionId])).rows[0];
      assert.deepEqual(
        [decision.subject_type, decision.subject_id, decision.decision_type, decision.outcome, decision.actor_id],
        ["media_asset", admitted.assetId, "approve", "media-asset-accepted", alice.userId],
      );
      assert.equal((decision.evidence as Record<string, unknown>).byteDigest, admitted.byteDigest, "the ledger names the exact bytes judged");
      assert.equal((decision.evidence as Record<string, unknown>).mediaAssetId, admitted.assetId);
      const session = (await setup.query(`select governance_domain from governance_sessions where id = $1`, [accepted.governanceSessionId])).rows[0];
      assert.equal(session.governance_domain, "media-asset-review");
      assert.equal(
        await count(setup, "audit_log", "entity_id = $1 and action = 'governance.decision.recorded'", [accepted.decisionId]),
        1,
        "the decision and its audit event committed together",
      );

      const state = await readMediaAssetReviewState(aliceCtx, admitted.assetId, deciding);
      assert.deepEqual(
        state.status === "read" ? [state.decision, state.decisionCount] : [],
        ["accepted", 1],
        "review state is derived from the ledger",
      );
      const foreignState = await readMediaAssetReviewState(erinCtx, admitted.assetId, deciding);
      assert.deepEqual(foreignState.status === "read" ? [foreignState.decision, foreignState.decisionCount] : [], [null, 0]);

      const declined = await declineMediaAsset(aliceCtx, input, { getDb, now: () => new Date(NOW.getTime() + 60_000) });
      assert.equal(declined.status, "reviewed");
      const reversed = await readMediaAssetReviewState(aliceCtx, admitted.assetId, deciding);
      assert.deepEqual(reversed.status === "read" ? [reversed.decision, reversed.decisionCount] : [], ["declined", 2], "reversal is a second decision");

      assert.deepEqual(await executionCounts(), executionBefore, "acceptance created no action request, permit or execution");
      assert.deepEqual(
        (await setup.query(`select * from media_assets where id = $1`, [admitted.assetId])).rows,
        assetRowBefore,
        "review wrote nothing to the asset",
      );
    }

    /* ── 13. RETIREMENT: THE ONLY TRANSITION, TENANT-SCOPED, BYTES KEPT ─────── */
    {
      assert.deepEqual(await retireMediaAsset(erinCtx, { assetId: admitted.assetId }, { getDb }), { status: "refused", reason: "asset-not-found" });
      const retired = await retireMediaAsset(danaCtx, { assetId: admitted.assetId }, { getDb, now: () => NOW });
      assert.deepEqual(retired, { status: "retired", assetId: admitted.assetId });
      assert.deepEqual(await retireMediaAsset(aliceCtx, { assetId: admitted.assetId }, { getDb }), { status: "refused", reason: "asset-not-found" });
      const after = (await setup.query(`select * from media_assets where id = $1`, [admitted.assetId])).rows[0];
      const before = assetRowBefore[0];
      for (const column of ["byte_digest", "byte_size", "mime_type", "width", "height", "storage_key", "storage_backend", "invocation_id", "tenant_id"]) {
        assert.deepEqual(after[column], before[column], `retirement left ${column} unchanged`);
      }
      assert.equal(after.retired_by_actor_id, dana.userId);
      const stillReadable = await readMediaAsset(aliceCtx, admitted.assetId, { getDb, resolveStorage: connected });
      assert.equal(stillReadable.status === "read" ? stillReadable.asset.lifecycle : "", "retired");
      assert.deepEqual(
        await acceptMediaAsset(aliceCtx, { assetId: admitted.assetId, byteDigest: admitted.byteDigest, justification: REASON }, deciding),
        { status: "refused", reason: "asset-retired" },
      );
    }

    /* ── 15. THE SAME AUTHORITY OVER THE REAL VPS STORE PROCESS ─────────────── */
    {
      const local = await startLocalVpsStore();
      try {
        const vps = createVpsMediaObjectStore({ origin: local.origin, writeSecret: local.writeSecret, readSecret: local.readSecret });
        const viaVps = (): MediaStorageResolution => ({ status: "available", store: vps });
        const vpsBytes = pngBytes(640, 480, 256);
        transport.behaviour = { kind: "bytes", bytes: vpsBytes };

        const result = await requestMediaGeneration(aliceCtx, ask(), deps({ resolveStorage: viaVps }));
        assert.equal(result.status, "admitted", "admitted through the VPS store");
        if (result.status !== "admitted") throw new Error("unreachable");
        const row = (
          await setup.query(`select storage_backend, storage_key, byte_digest, byte_size from media_assets where id = $1`, [result.assetId])
        ).rows[0];
        assert.deepEqual([row.storage_backend, row.byte_digest, Number(row.byte_size)], ["hebun-vps", sha(vpsBytes), vpsBytes.length]);
        const onDisk = path.join(local.root, String(row.storage_key));
        assert.deepEqual(new Uint8Array(readFileSync(onDisk)), vpsBytes, "the persisted digest names the bytes on disk");
        assert.equal(statSync(onDisk).mode & 0o777, 0o440, "admitted bytes are read-only on disk");

        const read = await readMediaAsset(aliceCtx, result.assetId, { getDb, resolveStorage: viaVps });
        assert.equal(read.status, "read");
        if (read.status !== "read") throw new Error("unreachable");
        const served = await fetch(read.access.url);
        assert.equal(served.status, 200);
        assert.deepEqual(new Uint8Array(await served.arrayBuffer()), vpsBytes, "the read grant serves exactly the admitted bytes");
        assert.ok(Date.parse(read.access.expiresAt) - Date.now() <= 61_000, "the grant is short-lived");
        assert.deepEqual(await readMediaAsset(erinCtx, result.assetId, { getDb, resolveStorage: viaVps }), { status: "not-found" });

        await local.restart();
        assert.equal((await readMediaAsset(aliceCtx, result.assetId, { getDb, resolveStorage: viaVps })).status, "read", "survives a store restart");

        chmodSync(onDisk, 0o640);
        writeFileSync(onDisk, pngBytes(640, 480, 257));
        assert.deepEqual(
          await readMediaAsset(aliceCtx, result.assetId, { getDb, resolveStorage: viaVps }),
          { status: "unavailable", reason: "integrity-mismatch" },
          "bytes changed under the store are never granted",
        );

        await local.stop();
        const [inv, ast] = [await invocations(), await assets()];
        const down = await requestMediaGeneration(aliceCtx, ask(), deps({ resolveStorage: viaVps }));
        assert.equal(down.status === "not-admitted" ? down.failure : down.status, "storage-write-failed", "an unreachable store admits nothing");
        assert.equal(await assets(), ast, "no asset without stored bytes");
        assert.equal(await invocations(), inv + 1);
        assert.deepEqual(
          await readMediaAsset(aliceCtx, result.assetId, { getDb, resolveStorage: viaVps }),
          { status: "unavailable", reason: "object-absent" },
        );
      } finally {
        await local.dispose();
      }
    }

    /* ── 16. MEDIA-2A: THE LIVE OPENAI TRANSPORT THROUGH THE SAME AUTHORITY (fake HTTP) ─ */
    {
      const liveStore = createMemoryMediaObjectStore();
      const liveStorage = (): MediaStorageResolution => ({ status: "available", store: liveStore });
      let fetches = 0;
      let respond: () => Response | Promise<Response> = () => new Response("", { status: 500 });
      const budget = createLiveSpendBudget(20);
      const live = createOpenAiImageTransport({
        apiKey: "sk-test-not-a-real-key-000000000000000000",
        spendBudget: budget,
        fetchImpl: async () => {
          fetches += 1;
          return respond();
        },
      });
      const liveDeps = (overrides: Record<string, unknown> = {}) =>
        deps({ resolveStorage: liveStorage, resolveTransport: async () => ({ status: "available" as const, transport: live }), ...overrides });
      const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
      const row = async (id: string) => (await setup.query(`select * from media_generation_invocations where id = $1`, [id])).rows[0];

      /* success: provenance, request id, usage, admitted through storage */
      const liveBytes = pngBytes(1024, 1024, 128);
      respond = () =>
        new Response(JSON.stringify({ data: [{ b64_json: b64(liveBytes) }], usage: { input_tokens: 21, output_tokens: 1056 } }), {
          status: 200,
          headers: { "x-request-id": "req_live_ok" },
        });
      const liveKey = randomUUID();
      const okResult = await requestMediaGeneration(aliceCtx, ask(liveKey), liveDeps());
      assert.equal(okResult.status, "admitted");
      if (okResult.status !== "admitted") throw new Error("unreachable");
      const okRow = await row(okResult.invocationId);
      assert.deepEqual(
        [okRow.transport, okRow.provider, okRow.model, okRow.provider_job_id, okRow.provider_failure, okRow.provider_input_tokens, okRow.provider_output_tokens],
        ["live", "openai", "gpt-image-2.5-flare-2026-09-08", "req_live_ok", null, 21, 1056],
      );
      assert.equal(
        okRow.input_digest,
        digestMediaGenerationInput({
          promptText: PROMPT, sourceArtifactId: draft.artifactId, sourceRevisionNo: 1, sourceContentDigest: draft.digest,
          transport: "live", provider: "openai", model: "gpt-image-2.5-flare-2026-09-08",
        }),
        "the digest binds the live transport identity",
      );
      const okAsset = (await setup.query(`select * from media_assets where id = $1`, [okResult.assetId])).rows[0];
      assert.equal(okAsset.byte_digest, sha(liveBytes));
      assert.ok(liveStore.objects.has(String(okAsset.storage_key)), "provider bytes became an asset only through the storage port");

      /* the same request key never reaches the provider again */
      const before = fetches;
      assert.deepEqual(await requestMediaGeneration(aliceCtx, ask(liveKey), liveDeps()), { status: "refused", reason: "duplicate-request" });
      assert.equal(fetches, before, "duplicate request key: no second paid call");

      /* every provider failure is recorded by closed code, with no asset and no storage write */
      const failures: [string, () => Response | Promise<Response>, string, string | null, number | null][] = [
        ["moderation", () => new Response(JSON.stringify({ error: { code: "moderation_blocked" } }), { status: 400, headers: { "x-request-id": "req_mod" } }), "moderation-blocked", "req_mod", null],
        ["auth", () => new Response(JSON.stringify({ error: { code: "invalid_api_key" } }), { status: 401 }), "authentication-failed", null, null],
        ["rate", () => new Response("{}", { status: 429 }), "rate-limited", null, null],
        ["quota", () => new Response(JSON.stringify({ error: { code: "credit_balance_exhausted" } }), { status: 429 }), "quota-exhausted", null, null],
        ["timeout", () => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" })), "timeout", null, null],
        ["server", () => new Response("{}", { status: 503 }), "provider-unavailable", null, null],
        ["malformed", () => new Response(JSON.stringify({ data: [{ url: "https://evil.example/a.png" }], usage: { input_tokens: 5, output_tokens: 0 } }), { status: 200 }), "malformed-response", null, 5],
      ];
      for (const [label, r, code, requestId, inputTokens] of failures) {
        respond = r;
        const [a0, p0, f0] = [await assets(), liveStore.puts.length, fetches];
        const result = await requestMediaGeneration(aliceCtx, ask(), liveDeps());
        assert.equal(result.status, "not-admitted", label);
        if (result.status !== "not-admitted") throw new Error("unreachable");
        assert.deepEqual([result.state, result.admissionOutcome, result.failure], ["provider-failed", "not-attempted", code], label);
        const failedRow = await row(result.invocationId);
        assert.deepEqual(
          [failedRow.state, failedRow.provider_failure, failedRow.admission_failure, failedRow.provider_job_id, failedRow.provider_input_tokens],
          ["provider-failed", code, null, requestId, inputTokens],
          label,
        );
        assert.ok(failedRow.finalized_at, `${label}: finalized`);
        assert.equal(await assets(), a0, `${label}: no asset`);
        assert.equal(liveStore.puts.length, p0, `${label}: storage untouched`);
        assert.equal(fetches, f0 + 1, `${label}: exactly one request, no retry`);
      }

      /* oversized provider bytes: the transport hands them on, ADMISSION refuses them */
      const oversized = new Uint8Array(21 * 1024 * 1024);
      oversized.set(pngBytes(1024, 1024));
      respond = () => new Response(JSON.stringify({ data: [{ b64_json: b64(oversized) }] }), { status: 200 });
      const big = await requestMediaGeneration(aliceCtx, ask(), liveDeps());
      assert.equal(big.status === "not-admitted" ? `${big.state}/${big.admissionOutcome}/${big.failure}` : big.status, "provider-succeeded/refused/byte-size-exceeded");
      respond = () => new Response(JSON.stringify({ data: [{ b64_json: b64(svgBytes()) }] }), { status: 200 });
      const svg = await requestMediaGeneration(aliceCtx, ask(), liveDeps());
      assert.equal(svg.status === "not-admitted" ? svg.failure : svg.status, "unsupported-image-signature", "magic bytes decide, not the declared png");

      /* budget exhausted: recorded, and nothing left the process */
      const spentOut = createOpenAiImageTransport({ apiKey: "sk-test-not-a-real-key-000000000000000000", spendBudget: createLiveSpendBudget(0), fetchImpl: async () => { fetches += 1; return new Response("{}"); } });
      const f1 = fetches;
      const exhausted = await requestMediaGeneration(aliceCtx, ask(), deps({ resolveStorage: liveStorage, resolveTransport: async () => ({ status: "available" as const, transport: spentOut }) }));
      assert.equal(exhausted.status === "not-admitted" ? exhausted.failure : exhausted.status, "budget-exhausted");
      assert.equal(fetches, f1, "budget exhausted: no request");

      /* a transport that throws is dispatch-failed / dispatch-error */
      const throwing = { ...live, generate: async () => { throw new Error("boom"); } };
      const thrown = await requestMediaGeneration(aliceCtx, ask(), deps({ resolveStorage: liveStorage, resolveTransport: async () => ({ status: "available" as const, transport: throwing }) }));
      assert.equal(thrown.status === "not-admitted" ? `${thrown.state}/${thrown.failure}` : thrown.status, "dispatch-failed/dispatch-error");

      /* a transport reporting a code outside the closed set is recorded malformed-response */
      const lying = { ...live, generate: async () => ({ status: "failed" as const, providerJobId: null, failure: "totally-fine" as never, usage: null }) };
      const lied = await requestMediaGeneration(aliceCtx, ask(), deps({ resolveStorage: liveStorage, resolveTransport: async () => ({ status: "available" as const, transport: lying }) }));
      assert.equal(lied.status === "not-admitted" ? lied.failure : lied.status, "malformed-response");

      /* a resolver that is unavailable or throws writes nothing */
      await refusedInPreflight("live transport disabled", () => requestMediaGeneration(aliceCtx, ask(), deps({ resolveTransport: async () => ({ status: "unavailable" as const, reason: "generation-disabled" as const }) })), "generation-transport-unavailable");
      await refusedInPreflight("live resolver throws", () => requestMediaGeneration(aliceCtx, ask(), deps({ resolveTransport: async () => { throw new Error("db down"); } })), "generation-transport-unavailable");

      /* the database refuses provenance the code would never write */
      const anyInvocation = okResult.invocationId;
      const refusesUpdate = async (label: string, set: string) => {
        await setup.query("savepoint media2a_chk");
        await assert.rejects(setup.query(`update media_generation_invocations set ${set} where id = $1`, [anyInvocation]), /violates check constraint/, label);
        await setup.query("rollback to savepoint media2a_chk");
      };
      await setup.query("begin");
      await refusesUpdate("unknown transport", "transport = 'openai-direct'");
      await refusesUpdate("unknown failure code", "state = 'provider-failed', admission_outcome = 'not-attempted', provider_failure = 'fine'");
      await refusesUpdate("failure code on a success", "provider_failure = 'timeout'");
      await refusesUpdate("failure state without a code", "state = 'provider-failed', admission_outcome = 'not-attempted', provider_failure = null");
      await refusesUpdate("half usage", "provider_output_tokens = null");
      await refusesUpdate("negative usage", "provider_input_tokens = -1");
      await setup.query("rollback");
    }

    /* ── 14. A RETIRED DURABLE AGENT STOPS GENERATION BEFORE ANYTHING IS WRITTEN ─ */
    {
      transport.behaviour = { kind: "bytes", bytes: pngBytes(10, 10) };
      const retiredAgent = await retireDurableAgentIdentity(aliceCtx, { agentId }, { getDb } as never);
      assert.equal(retiredAgent.status, "retired");
      await refusedInPreflight("retired durable agent", () => requestMediaGeneration(aliceCtx, ask(), deps()), "no-durable-agent");
    }

    console.log("media1-asset-authority/authority-postgres: ok");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
