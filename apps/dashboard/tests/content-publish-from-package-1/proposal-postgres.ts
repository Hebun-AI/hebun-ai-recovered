/*
 * CONTENT-PUBLISH-FROM-PACKAGE-1 — a READY Content Package files the existing governed Instagram
 * proposal from the package itself, through the released inlet, on a disposable PostgreSQL.
 * Readiness is prepared ONLY through the released writers (tests/helpers/instagram-package-fixture).
 * Storage is an in-memory fake; every network call throws.
 *
 *   A READY → exactly one pending request, no permit, no attempt, no decision, no network
 *   B the same package again → refused as already waiting, nothing new filed
 *   C copy not reviewed → package-not-ready, nothing written
 *   D an older revision prepared while a newer one is current → refused, nothing written
 *   E another tenant naming this artifact → draft-not-found, nothing written
 *   F two approved images chosen → media-choice-ambiguous, nothing written
 *   G no session → unauthenticated; a malformed revision → invalid-input
 *   H the released /heby `/publish` command still files through the same inlet
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { instagramPackagePreparation } from "../helpers/instagram-package-fixture";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { proposePackagePublication } from "../../src/features/heby-action-inlet/package-publication-proposal.server";
import { runHebyProposeCommand } from "../../src/features/heby-action-inlet/propose-commands.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this post is a deliberate organizational act and I accept responsibility.";
const APP_ID = "28295264780115792";
const sha = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

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
    [seeded.authIdentityId, tag.padEnd(64, "c").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
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
    requestId: "cpfp1-request",
    authenticatedAt: new Date().toISOString(),
  });
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("content-publish-from-package-1/proposal-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cpfp1_proposal");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const store = createMemoryMediaObjectStore();
  const deps = { getDb: () => handle.db, resolveStorage: () => ({ status: "available" as const, store }) };

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-cpfp1", email: "director@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-cpfp1", email: "director@globex.test" })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "a1"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "b1"));
    const agents = new Map<string, string>();
    for (const [s, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, deps)).status, "established");
      /* Both tenants are publish-capable, so the cross-tenant refusal below is isolation, not scope. */
      await setup.query(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, created_by, created_by_type)
         values ($1,'instagram','instagram','connected','connected','healthy',$2::jsonb,$3,$4,'human')`,
        [s.tenantId, JSON.stringify(["instagram_business_basic", "instagram_business_content_publish"]), APP_ID, s.userId],
      );
      agents.set(
        s.tenantId,
        (await setup.query<{ id: string }>(
          `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type)
           values ($1,'Heby','active',$2,'human') returning id`,
          [s.tenantId, s.userId],
        )).rows[0]!.id,
      );
    }
    const prep = instagramPackagePreparation(setup, () => handle.db);

    const seedDraft = async (s: Seeded = acme, revisions = 1) => {
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
            current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft','Post','draft','operations',$2,'instagram',$3,'human') returning id`,
        [s.tenantId, revisions, s.userId],
      )).rows[0]!.id;
      for (let r = 1; r <= revisions; r++) {
        const caption = `Kilim r${r} ${randomUUID()}`;
        await setup.query(
          `insert into work_artifact_revisions
             (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
           values ($1,$2,$3,$4,$5,'human',$6)`,
          [s.tenantId, artifact, r, caption, sha(caption), s.userId],
        );
      }
      return { tenant: s, artifact, current: { artifactId: artifact, revisionNo: revisions } };
    };
    type Draft = Awaited<ReturnType<typeof seedDraft>>;
    const seedImage = async (d: Draft) => {
      const inv = (await setup.query<{ id: string }>(
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
            source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
            model, state, admission_outcome, requested_at, finalized_at, output_media_kind)
         values ($1,$2,'human',$3,$4,$5,1,'prompt',$6,'fake','fake','fake','provider-succeeded','admitted', now(), now(), 'image')
         returning id`,
        [d.tenant.tenantId, randomUUID(), d.tenant.userId, agents.get(d.tenant.tenantId), d.artifact, sha(randomUUID())],
      )).rows[0]!.id;
      const assetId = randomUUID();
      const bytes = new Uint8Array(
        await sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 10, g: 120, b: Math.floor(Math.random() * 255), alpha: 0.5 } } }).png().toBuffer(),
      );
      const key = `tenants/${d.tenant.tenantId}/media/${assetId}`;
      await store.put({ key, bytes, contentType: "image/png", sha256Hex: sha(bytes) });
      await setup.query(
        `insert into media_assets
           (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
            storage_backend, storage_key, admitted_at, asset_lifecycle_status)
         values ($1,$2,$3,'image/png',$4,$5,64,48,'test-memory',$6, now(),'admitted')`,
        [assetId, d.tenant.tenantId, inv, bytes.length, sha(bytes), key],
      );
      return assetId;
    };

    const n = async (q: string) => (await setup.query<{ n: number }>(q)).rows[0]!.n;
    const world = async () => ({
      requests: await n("select count(*)::int n from heby_action_requests"),
      permits: await n("select count(*)::int n from action_permits"),
      attempts: await n("select count(*)::int n from action_execution_attempts"),
      decisions: await n("select count(*)::int n from decision_records"),
      derivatives: await n("select count(*)::int n from media_assets where derived_from_asset_id is not null"),
      network: networkCalls,
    });
    const propose = (ctx: TenantContext | null, t: { artifactId: string; revisionNo: number }) =>
      proposePackagePublication(ctx, t, deps);
    const refusedCleanly = async (label: string, run: () => ReturnType<typeof propose>, reason: string) => {
      const before = await world();
      const result = await run();
      assert.equal(result.status === "refused" && result.reason, reason, `${label}: ${JSON.stringify(result)}`);
      assert.deepEqual(await world(), before, `${label}: nothing written (no request, permit, attempt, decision, derivative, network)`);
      return result;
    };

    /* ══ A · READY → one pending request, nothing beyond it ══ */
    const a = await seedDraft();
    const aImage = await seedImage(a);
    await prep.makeReady(acmeCtx, a.current, aImage);
    const aBefore = await world();
    const aResult = await propose(acmeCtx, a.current);
    assert.equal(aResult.status, "proposed", `A: ${JSON.stringify(aResult)}`);
    assert.equal(aResult.status === "proposed" && aResult.destination, "instagram");
    const aAfter = await world();
    assert.equal(aAfter.requests, aBefore.requests + 1, "A: exactly one request");
    assert.equal(aAfter.permits, aBefore.permits, "A: no permit");
    assert.equal(aAfter.attempts, aBefore.attempts, "A: no attempt");
    assert.equal(aAfter.decisions, aBefore.decisions, "A: no decision");
    assert.equal(aAfter.network, 0, "A: no network");
    const row = (await setup.query<{ status: string; target_ref: string; tenant_id: string; proposed_by_actor_type: string; canonical_payload: { mediaAssetRef: string } }>(
      `select status, target_ref, tenant_id, proposed_by_actor_type, canonical_payload from heby_action_requests where id=$1`,
      [aResult.status === "proposed" ? aResult.requestId : ""],
    )).rows[0]!;
    assert.equal(row.status, "pending", "A: the request is pending");
    assert.equal(row.tenant_id, acme.tenantId, "A: in the session's tenant");
    assert.equal(row.proposed_by_actor_type, "human", "A: proposed by the human, never an agent");
    assert.equal(row.target_ref, formatWorkArtifactRef(a.artifact, 1), "A: for exactly this revision");
    assert.equal(row.canonical_payload.mediaAssetRef, aImage, "A: binding the image the package chose");

    /* ══ B · the same package again → refused as waiting, nothing new ══ */
    const b = await propose(acmeCtx, a.current);
    assert.ok(
      b.status === "refused" && (b.reason === "publication-in-flight" || b.reason === "already-pending"),
      `B: ${JSON.stringify(b)}`,
    );
    assert.equal((await world()).requests, aAfter.requests, "B: no second request");

    /* ══ C · copy not reviewed → package-not-ready ══ */
    const c = await seedDraft();
    const cImage = await seedImage(c);
    await prep.select(acmeCtx, c.current, cImage);
    await prep.approveMedia(acmeCtx, cImage);
    await refusedCleanly("C", () => propose(acmeCtx, c.current), "package-not-ready");

    /* ══ D · an older revision prepared while a newer one is current ══ */
    const d = await seedDraft(acme, 2);
    const dImage = await seedImage(d);
    await prep.makeReady(acmeCtx, { artifactId: d.artifact, revisionNo: 1 }, dImage);
    await refusedCleanly("D", () => propose(acmeCtx, { artifactId: d.artifact, revisionNo: 1 }), "draft-superseded");

    /* ══ E · another tenant naming this artifact ══ */
    const e = await seedDraft();
    const eImage = await seedImage(e);
    await prep.makeReady(acmeCtx, e.current, eImage);
    await refusedCleanly("E", () => propose(globexCtx, e.current), "draft-not-found");

    /* ══ F · two approved images chosen → the human picks one first ══ */
    const f = await seedDraft();
    const f1 = await seedImage(f);
    const f2 = await seedImage(f);
    await prep.makeReady(acmeCtx, f.current, f1);
    await prep.select(acmeCtx, f.current, f2);
    await prep.approveMedia(acmeCtx, f2);
    await refusedCleanly("F", () => propose(acmeCtx, f.current), "media-choice-ambiguous");

    /* ══ G · no session; malformed input ══ */
    await refusedCleanly("G1", () => propose(null, e.current), "unauthenticated");
    await refusedCleanly("G2", () => propose(acmeCtx, { artifactId: e.artifact, revisionNo: 0 }), "invalid-input");
    await refusedCleanly("G3", () => propose(acmeCtx, { artifactId: "not-a-uuid", revisionNo: 1 }), "invalid-input");

    /* ══ H · the released /heby command files through the same inlet, unchanged ══ */
    const hBefore = await world();
    const h = await runHebyProposeCommand(
      { commandId: "publish", args: [formatWorkArtifactRef(e.artifact, 1), eImage] },
      { ...deps, resolveTenant: async () => acmeCtx },
    );
    assert.equal(h.status === "ok" && h.kind === "publish-instagram" && h.result.status, "proposed", `H: ${JSON.stringify(h)}`);
    assert.equal((await world()).requests, hBefore.requests + 1, "H: one request through the command");
    assert.equal((await world()).permits, hBefore.permits, "H: no permit");

    finished = true;
    console.log("PASS content-publish-from-package-1 proposal-postgres (A–H)");
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
