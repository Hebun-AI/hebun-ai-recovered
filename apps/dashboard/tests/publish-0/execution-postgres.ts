/*
 * PUBLISH-0 — the governed Instagram publish on a disposable PostgreSQL, end to end, with EVERY
 * provider seam faked (labelled below). No Meta call, no media-store call, no credential is opened.
 *
 *   recipient binding CHECK · proposal ≠ authorization · capability is a prerequisite only ·
 *   tenant arming + root control respected · accepted records the real media id · rejected is
 *   failed · ambiguous is unknown · wrong tenant cannot execute · no secret in the ledger ·
 *   original + derivative both bound · provider receives the DERIVATIVE grant only · a retired
 *   original or a tampered derivative stops the publish · derivation authorizes nothing
 *
 * The storage port is an in-memory FAKE holding REAL image bytes; the sharp transform is real.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { publishDerivativeId } from "../../src/features/media-assets/derive-publish-jpeg.server";
import { retireMediaAsset } from "../../src/features/media-assets/retire-media-asset.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeAuthorizedAction } from "../../src/features/action-execution/execute-authorized-action.server";
import type { InstagramPublishExecutionPorts } from "../../src/features/action-execution/execute-authorized-action.server";
import { proposeInstagramPublish } from "../../src/features/heby-action-inlet/instagram-publish-proposal.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import type { InstagramPublishOutcome } from "../../src/features/provider-instagram/instagram-publish-transport.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this post is a deliberate organizational act and I accept responsibility.";
const SECRET = "FAKE-TOKEN-never-real-must-not-persist";
const APP_ID = "28295264780115792";
const IG_ID = "17841408635351823";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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
    requestId: "publish0-request",
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_publish0_execution");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  /* FAKE: the storage port, in memory, holding real bytes. */
  const store = createMemoryMediaObjectStore();
  const resolveStorage = () => ({ status: "available" as const, store });
  const baseDeps = { getDb: () => handle.db, resolveStorage };

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme", companySlug: "acme-p0", email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex", companySlug: "globex-p0", email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "a1"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "b1"));
    for (const [s, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status, "established");
    }

    /* FIXTURE: a connected Instagram connection (the connection authority's writer is not under test). */
    const connect = async (tenantId: string, userId: string, scopes: string[]) =>
      (await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, created_by, created_by_type)
         values ($1,'instagram','instagram','connected','connected','healthy',$2::jsonb,$3,$4,'human') returning id`,
        [tenantId, JSON.stringify(scopes), APP_ID, userId],
      )).rows[0]!.id;
    const acmeIntegration = await connect(acme.tenantId, acme.userId, ["instagram_business_basic", "instagram_business_content_publish"]);
    await connect(globex.tenantId, globex.userId, ["instagram_business_basic"]);

    const agent = (await setup.query<{ id: string }>(
      `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type)
       values ($1,'Heby','active',$2,'human') returning id`,
      [acme.tenantId, acme.userId],
    )).rows[0]!.id;

    /* FIXTURE: an Instagram content draft and an admitted, REAL image of it, stored. */
    const imageBytes = async (mime: string) => {
      const img = sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 10, g: 120, b: 200, alpha: 0.5 } } });
      return new Uint8Array(await (mime === "image/png" ? img.png() : img.flatten({ background: "#000" }).jpeg()).toBuffer());
    };
    const seedContent = async (mime = "image/png", tenant: Seeded = acme, agentId = agent) => {
      const caption = `Kilim ${randomUUID()}`;
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
            current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft','Post','draft','operations',1,'instagram',$2,'human') returning id`,
        [tenant.tenantId, tenant.userId],
      )).rows[0]!.id;
      await setup.query(
        `insert into work_artifact_revisions
           (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
         values ($1,$2,1,$3,$4,'human',$5)`,
        [tenant.tenantId, artifact, caption, sha(caption), tenant.userId],
      );
      const inv = (await setup.query<{ id: string }>(
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
            source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
            model, state, admission_outcome, requested_at, finalized_at)
         values ($1,$2,'human',$3,$4,$5,1,'prompt',$6,'fake','fake','fake','provider-succeeded','admitted', now(), now())
         returning id`,
        [tenant.tenantId, randomUUID(), tenant.userId, agentId, artifact, sha(randomUUID())],
      )).rows[0]!.id;
      const assetId = randomUUID();
      const bytes = await imageBytes(mime);
      const digest = createHash("sha256").update(bytes).digest("hex");
      const key = `tenants/${tenant.tenantId}/media/${assetId}`;
      await store.put({ key, bytes, contentType: mime, sha256Hex: digest });
      await setup.query(
        `insert into media_assets
           (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
            storage_backend, storage_key, admitted_at, asset_lifecycle_status)
         values ($1,$2,$3,$4,$5,$6,64,48,'test-memory',$7, now(),'admitted')`,
        [assetId, tenant.tenantId, inv, mime, bytes.length, digest, key],
      );
      const derivedId = publishDerivativeId(tenant.tenantId, assetId);
      return {
        draftRef: formatWorkArtifactRef(artifact, 1), assetId, digest, caption, key,
        derivedId, derivedKey: `tenants/${tenant.tenantId}/media/${derivedId}`,
      };
    };

    const permitFor = async (content: Awaited<ReturnType<typeof seedContent>>) => {
      const proposed = await proposeInstagramPublish(acmeCtx, { draftRef: content.draftRef, mediaAssetId: content.assetId }, baseDeps);
      assert.equal(proposed.status, "proposed", JSON.stringify(proposed));
      if (proposed.status !== "proposed") throw new Error("unreachable");
      const approved = await approveActionRequest(acmeCtx, { requestId: proposed.requestId, justification: JUSTIFICATION }, baseDeps);
      assert.equal(approved.status, "authorized", JSON.stringify(approved));
      if (approved.status !== "authorized") throw new Error("unreachable");
      return { requestId: proposed.requestId, permitId: approved.permitId };
    };

    /* FAKE PORTS. Records what publish was asked; answers as the case requires. */
    const calls: Array<{ publishingAccountId: string; imageUrl: string; caption: string; token: string }> = [];
    const portsFor = (
      outcome: InstagramPublishOutcome,
      over: Partial<InstagramPublishExecutionPorts> = {},
    ): InstagramPublishExecutionPorts => ({
      resolveCapability: async () => ({ status: "available", integrationId: acmeIntegration, publishingAccountId: IG_ID }),
      /* The REAL media authority reads lineage + verifies bytes + mints the grant, over the fake store. */
      resolveStorage,
      withToken: async (_t, _id, run) => run(SECRET),
      publish: async (input, token) => {
        calls.push({ ...input, token });
        return outcome;
      },
      ...over,
    });
    let tenantArmed = true;
    let rootOn = true;
    const execDeps = (ports: InstagramPublishExecutionPorts) => ({
      ...baseDeps,
      readTenant: (async () =>
        tenantArmed
          ? { status: "read", effective: { state: "active" } }
          : { status: "absent" }) as never,
      rootEnabled: async () => rootOn,
      instagramPublish: ports,
    });
    const permitStatus = async (id: string) =>
      (await setup.query<{ status: string }>("select status from action_permits where id=$1", [id])).rows[0]!.status;
    const attempts = async () => (await setup.query("select * from action_execution_attempts order by started_at")).rows;

    /* ══ 1. PROPOSAL: a PNG original is bound WITH its JPEG derivative; fails closed otherwise ══ */
    const png = await seedContent("image/png");
    const pngProposal = await proposeInstagramPublish(acmeCtx, { draftRef: png.draftRef, mediaAssetId: png.assetId }, baseDeps);
    assert.equal(pngProposal.status, "proposed", JSON.stringify(pngProposal));
    const bound = (await setup.query<{ canonical_payload: Record<string, string> }>(
      "select canonical_payload from heby_action_requests where id=$1",
      [pngProposal.status === "proposed" ? pngProposal.requestId : ""],
    )).rows[0]!.canonical_payload;
    const derivedRow = (await setup.query("select * from media_assets where id=$1", [png.derivedId])).rows[0];
    assert.equal(bound.mediaAssetRef, png.assetId, "the authoritative original is bound");
    assert.equal(bound.mediaAssetDigest, png.digest);
    assert.equal(bound.publishAssetRef, png.derivedId, "the derivative is bound");
    assert.equal(bound.publishAssetDigest, derivedRow.byte_digest);
    assert.equal(derivedRow.mime_type, "image/jpeg");
    assert.equal(derivedRow.derived_from_asset_id, png.assetId);
    assert.equal((await setup.query("select count(*)::int n from action_permits")).rows[0]!.n, 0, "derivation + proposal mint no permit");
    const derivativeAsMedia = await proposeInstagramPublish(acmeCtx, { draftRef: png.draftRef, mediaAssetId: png.derivedId }, baseDeps);
    assert.equal(
      derivativeAsMedia.status === "refused" && derivativeAsMedia.reason,
      "media-not-found",
      "a derivative is not creative work and cannot be proposed as the image",
    );
    const noStore = await proposeInstagramPublish(acmeCtx, { draftRef: (await seedContent()).draftRef, mediaAssetId: png.assetId }, {
      ...baseDeps, resolveStorage: () => ({ status: "unavailable" as const, reason: "storage-not-connected" as const }),
    });
    assert.equal(noStore.status, "refused");
    const globexRefusal = await proposeInstagramPublish(globexCtx, { draftRef: png.draftRef, mediaAssetId: png.assetId }, baseDeps);
    assert.equal(
      globexRefusal.status === "refused" && globexRefusal.reason,
      "publish-not-possible",
      "a basic-only connection (connected, healthy) is not publish-capable",
    );

    /* ══ 2. PREPARED ≠ AUTHORIZED ≠ EXECUTED ══ */
    const c1 = await seedContent("image/jpeg");
    const proposedOnly = await proposeInstagramPublish(acmeCtx, { draftRef: c1.draftRef, mediaAssetId: c1.assetId }, baseDeps);
    assert.equal(proposedOnly.status, "proposed");
    assert.equal((await setup.query("select count(*)::int n from action_permits")).rows[0]!.n, 0, "a proposal mints no permit");
    const unauthorized = await executeAuthorizedAction(acmeCtx, { permitId: randomUUID() }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" })));
    assert.deepEqual(unauthorized, { status: "refused", reason: "permit-not-executable" }, "no permit, no execution");
    assert.equal(calls.length, 0);

    /* ══ 3. PREREQUISITES: capability, tenant arming, root control — all pre-spend ══ */
    const p3 = await permitFor(await seedContent());
    const unavailable = await executeAuthorizedAction(
      acmeCtx, { permitId: p3.permitId },
      execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" }, {
        resolveCapability: async () => ({ status: "unavailable", reason: "publish-scope-not-granted" }),
      })),
    );
    assert.deepEqual(unavailable, { status: "refused", reason: "capability-unavailable" });
    tenantArmed = false;
    assert.deepEqual(
      await executeAuthorizedAction(acmeCtx, { permitId: p3.permitId }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" }))),
      { status: "refused", reason: "tenant-not-armed" },
    );
    tenantArmed = true;
    rootOn = false;
    assert.deepEqual(
      await executeAuthorizedAction(acmeCtx, { permitId: p3.permitId }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" }))),
      { status: "refused", reason: "execution-disabled" },
    );
    rootOn = true;
    assert.equal(await permitStatus(p3.permitId), "active", "no prerequisite refusal spends the permit");
    assert.equal((await attempts()).length, 0);
    assert.equal(calls.length, 0);

    /* ══ 4. WRONG TENANT ══ */
    assert.deepEqual(
      await executeAuthorizedAction(globexCtx, { permitId: p3.permitId }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" }))),
      { status: "refused", reason: "permit-not-executable" },
    );

    /* ══ 5. ACCEPTED: the real returned media id, recipient-less, no secret ══ */
    const c5 = await seedContent();
    const p5 = await permitFor(c5);
    const accepted = await executeAuthorizedAction(
      acmeCtx, { permitId: p5.permitId },
      execDeps(portsFor({ class: "accepted", mediaId: "18099999999999999", containerId: "900" }, {})),
    );
    assert.equal(accepted.status, "attempted", JSON.stringify(accepted));
    if (accepted.status !== "attempted") throw new Error("unreachable");
    assert.equal(accepted.attempt.status, "accepted");
    assert.equal(accepted.attempt.providerMessageId, "18099999999999999", "the media id Meta returned");
    assert.equal(accepted.attempt.recipientId, null);
    assert.equal(accepted.attempt.adapterId, "instagram-graph-publish-v1");
    assert.deepEqual(calls.at(-1), {
      publishingAccountId: IG_ID, imageUrl: `memory://test-memory/${c5.derivedKey}?ttl=60`, caption: c5.caption, token: SECRET,
    }, "the runtime publishing id, the approved caption, the grant for the DERIVATIVE");
    assert.equal(store.readGrants.includes(c5.key), false, "no grant was ever minted for the original");
    assert.equal(calls.some((c) => c.imageUrl.includes(c5.assetId)), false, "the provider never sees the original");
    assert.equal(await permitStatus(p5.permitId), "consumed");
    const replay = await executeAuthorizedAction(acmeCtx, { permitId: p5.permitId }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" }, {})));
    assert.deepEqual(replay, { status: "refused", reason: "permit-not-executable" }, "one permit, one publish");

    /* ══ 6. REJECTED → failed; AMBIGUOUS → unknown; neither is success ══ */
    const c6 = await seedContent();
    const rejected = await executeAuthorizedAction(acmeCtx, { permitId: (await permitFor(c6)).permitId },
      execDeps(portsFor({ class: "rejected", reason: "instagram-rejected-400", containerId: null }, {})));
    assert.equal(rejected.status === "attempted" && rejected.attempt.status, "failed");
    assert.equal(rejected.status === "attempted" && rejected.attempt.providerMessageId, null);
    const c7 = await seedContent();
    const ambiguous = await executeAuthorizedAction(acmeCtx, { permitId: (await permitFor(c7)).permitId },
      execDeps(portsFor({ class: "ambiguous", reason: "instagram-publish-answer-lost", containerId: "901" }, {})));
    assert.equal(ambiguous.status === "attempted" && ambiguous.attempt.status, "unknown", "a lost answer is unknown, never failed");
    assert.equal(ambiguous.status === "attempted" && ambiguous.attempt.providerMessageId, null);
    const c8 = await seedContent();
    const threw = await executeAuthorizedAction(acmeCtx, { permitId: (await permitFor(c8)).permitId },
      execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" }, { publish: async () => { throw new Error("boom"); } })));
    assert.equal(threw.status === "attempted" && threw.attempt.status, "unknown", "a throw after dispatch is unknown");

    /* ══ 6b. LINEAGE / INTEGRITY RE-VERIFIED AT EXECUTION ══ */
    const callsBefore = calls.length;
    const cRetired = await seedContent();
    const pRetired = await permitFor(cRetired);
    assert.equal((await retireMediaAsset(acmeCtx, { assetId: cRetired.assetId }, baseDeps)).status, "retired");
    assert.deepEqual(
      await executeAuthorizedAction(acmeCtx, { permitId: pRetired.permitId }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" }))),
      { status: "refused", reason: "artifact-retired" },
      "a retired original stops the publish before spend",
    );
    assert.equal(await permitStatus(pRetired.permitId), "active");
    const cRetiredD = await seedContent();
    const pRetiredD = await permitFor(cRetiredD);
    assert.equal((await retireMediaAsset(acmeCtx, { assetId: cRetiredD.derivedId }, baseDeps)).status, "retired");
    assert.deepEqual(
      await executeAuthorizedAction(acmeCtx, { permitId: pRetiredD.permitId }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" }))),
      { status: "refused", reason: "artifact-retired" },
      "a retired derivative stops the publish before spend",
    );
    const cTamper = await seedContent();
    const pTamper = await permitFor(cTamper);
    store.objects.get(cTamper.derivedKey)!.bytes[20] ^= 0xff;
    const tamperedRun = await executeAuthorizedAction(acmeCtx, { permitId: pTamper.permitId }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" })));
    assert.equal(tamperedRun.status, "refused-after-spend", "tampered derivative bytes: no grant, no publish");
    assert.equal(tamperedRun.status === "refused-after-spend" && tamperedRun.attempt.failureClass, "artifact-unresolvable");
    const cTamperO = await seedContent();
    const pTamperO = await permitFor(cTamperO);
    store.objects.get(cTamperO.key)!.bytes[20] ^= 0xff;
    assert.equal(
      (await executeAuthorizedAction(acmeCtx, { permitId: pTamperO.permitId }, execDeps(portsFor({ class: "accepted", mediaId: "1", containerId: "2" })))).status,
      "refused-after-spend",
      "tampered original bytes: the lineage no longer verifies, nothing is published",
    );
    assert.equal(calls.length, callsBefore, "none of the lineage refusals reached the provider");

    /* ══ 7. NO SECRET anywhere durable ══ */
    const dump = JSON.stringify([
      (await setup.query("select * from action_execution_attempts")).rows,
      (await setup.query("select metadata from audit_log")).rows,
      (await setup.query("select canonical_payload from heby_action_requests")).rows,
    ]);
    assert.equal(dump.includes(SECRET), false, "the token is in no row");
    assert.equal(dump.includes("memory://"), false, "the image grant is in no row");

    /* ══ 8. THE RECIPIENT BINDING CHECK, directly against the database ══ */
    const row = (await attempts()).find((r) => r.status === "accepted")!;
    const violates = async (sql: string, params: unknown[], constraint: string) => {
      await assert.rejects(setup.query(sql, params), (e: { constraint?: string }) => e.constraint === constraint, constraint);
    };
    await violates(
      "update action_execution_attempts set action_kind='send-external-communication' where id=$1",
      [row.id], "action_execution_attempts_recipient_binding_chk",
    );
    await violates(
      "update action_execution_attempts set action_kind='some-future-kind' where id=$1",
      [row.id], "action_execution_attempts_recipient_binding_chk",
    );
    const recipient = (await setup.query<{ id: string }>(
      `insert into external_recipients (tenant_id, display_name, endpoint_kind, endpoint_value, endpoint_digest, created_by, created_by_type)
       values ($1,'R','email','r@example.com',$2,$3,'human') returning id`,
      [acme.tenantId, sha("r@example.com"), acme.userId],
    )).rows[0]!.id;
    await violates(
      "update action_execution_attempts set recipient_id=$2, recipient_endpoint_digest=$3 where id=$1",
      [row.id, recipient, sha("r@example.com")], "action_execution_attempts_recipient_binding_chk",
    );
    await violates(
      "update action_execution_attempts set action_kind='send-external-communication', recipient_id=$2, recipient_endpoint_digest=$3 where id=$1",
      [row.id, randomUUID(), sha("x")], "action_execution_attempts_tenant_recipient_fk",
    );
    /* And the recipient-bound shape is still accepted for a recipient-bound kind. */
    await setup.query("begin");
    await setup.query(
      "update action_execution_attempts set action_kind='send-external-communication', recipient_id=$2, recipient_endpoint_digest=$3 where id=$1",
      [row.id, recipient, sha("r@example.com")],
    );
    await setup.query("rollback");

    console.log("PASS publish-0 execution (postgres, all provider seams faked)");
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
