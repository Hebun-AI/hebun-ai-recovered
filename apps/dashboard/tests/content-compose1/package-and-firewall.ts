/*
 * CONTENT-COMPOSE-1 — selection is a fact, readiness is a derivation, and neither is authority.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "A human can put admitted images into a draft revision and read back one coherent content
 *    package — destination, copy, selected media, both review states — whose readiness is computed
 *    from live Governance and custody every time it is read. Selection is gated by custody alone;
 *    readiness is gated by Governance. Nothing here writes a Media Asset, a decision, a permit or
 *    an execution, and nothing can publish."
 *
 * Against a real Postgres. The migration is applied by the harness, so a failure here is also a
 * migration failure.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { acceptMediaAsset, declineMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import { acceptArtifactRevision } from "../../src/features/work-artifact-review/review-revision.server";
import {
  deselectMediaForRevision,
  selectMediaForRevision,
} from "../../src/features/content-composition/select-media.server";
import { readContentPackage } from "../../src/features/content-composition/read-content-package.server";
import { CONTENT_PACKAGE_NON_CLAIMS } from "../../src/features/content-composition/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { readFileSync } from "node:fs";

const NOW = new Date("2026-09-22T09:00:00.000Z");
const REASON = "Governance has looked at this exact subject and records its decision here.";
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
    requestId: "compose1-request",
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
    { justification: "Establishing Governance authority so a package can be judged." },
    deps as never,
  );
  assert.equal(result.status, "established");
}

async function seedDraft(
  client: Client,
  tenantId: string,
  authorId: string,
  opts: { destination?: string | null; copy?: string } = {},
): Promise<{ id: string; revisionId: string }> {
  const content = opts.copy ?? `Draft copy ${randomUUID()}`;
  const dest = opts.destination === undefined ? "instagram" : opts.destination;
  const artifact = await client.query<{ id: string }>(
    `insert into work_artifacts
       (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
        current_revision, intended_destination, created_by, created_by_type)
     values ($1,'content-draft','Draft','draft','operations',1,$3,$2,'human') returning id`,
    [tenantId, authorId, dest],
  );
  const rev = await client.query<{ id: string }>(
    `insert into work_artifact_revisions
       (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
     values ($1,$2,1,$3,$4,'human',$5) returning id`,
    [tenantId, artifact.rows[0]!.id, content, sha(new TextEncoder().encode(content)), authorId],
  );
  return { id: artifact.rows[0]!.id, revisionId: rev.rows[0]!.id };
}

/** An admitted asset with its invocation, written directly: MEDIA-1's writer is not under test. */
async function seedAsset(
  client: Client,
  tenantId: string,
  actorId: string,
  agentId: string,
  artifactId: string,
  sourceRevisionNo: number,
): Promise<{ id: string; digest: string }> {
  const inv = await client.query<{ id: string }>(
    `insert into media_generation_invocations
       (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
        source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
        model, state, admission_outcome, requested_at, finalized_at)
     values ($1,$2,'human',$3,$4,$5,$6,'prompt',$7,'fake','fake','fake','provider-succeeded',
             'admitted', now(), now())
     returning id`,
    [tenantId, randomUUID(), actorId, agentId, artifactId, sourceRevisionNo, sha(new TextEncoder().encode(randomUUID()))],
  );
  const assetId = randomUUID();
  const bytes = new TextEncoder().encode(assetId);
  await client.query(
    `insert into media_assets
       (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
        storage_backend, storage_key, admitted_at, asset_lifecycle_status)
     values ($1,$2,$3,'image/png',1024,$4,1024,1024,'test-memory',$5, now(),'admitted')`,
    [assetId, tenantId, inv.rows[0]!.id, sha(bytes), `tenants/${tenantId}/media/${assetId}`],
  );
  return { id: assetId, digest: sha(bytes) };
}

async function count(client: Client, table: string, where = "true", params: unknown[] = []): Promise<number> {
  const r = await client.query<{ n: string }>(`select count(*)::text as n from ${table} where ${where}`, params);
  return Number(r.rows[0]!.n);
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("content-compose1/package-and-firewall: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  /* ── 0. Source firewall: this capability grants nothing ──────────────────── */
  {
    const writer = readFileSync("src/features/content-composition/select-media.server.ts", "utf8");
    const reader = readFileSync("src/features/content-composition/read-content-package.server.ts", "utf8");
    const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    for (const [name, src] of [["writer", writer], ["reader", reader]] as const) {
      const c = code(src);
      for (const forbidden of [
        "decisionRecords",
        "actionPermits",
        "actionExecutionAttempts",
        "hebyActionRequests",
        "mediaGenerationInvocations.state",
        "publish",
        "schedule",
        "process.env",
      ]) {
        assert.ok(!c.includes(forbidden), `${name} must not reference ${forbidden}`);
      }
    }
    /* The reader may INSERT nothing at all; the writer may only touch its own table. */
    const rc = code(reader);
    for (const verb of [".insert(", ".update(", ".delete("]) {
      assert.ok(!rc.includes(verb), `the package reader must not ${verb}`);
    }
    const wc = code(writer);
    assert.ok(!wc.includes(".update("), "the selection writer never updates a row");
    assert.equal(
      (wc.match(/\.insert\(/g) ?? []).length,
      1,
      "the selection writer inserts into exactly one table",
    );
    assert.ok(wc.includes("contentSelectedMedia"), "and that table is content_selected_media");

    assert.ok(
      CONTENT_PACKAGE_NON_CLAIMS.some((c) => /no publishing capability/i.test(c)),
      "the non-claims say out loud that Hebun cannot publish",
    );
  }

  const harness = createDisposablePostgresHarness("hebun_compose1");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const alice = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-compose1",
      email: "alice@acme.test",
    })) as Seeded;
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a1"));
    await establishGovernance(setup, alice, aliceCtx, { getDb, now: () => NOW });

    const erin = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-compose1",
      email: "erin@globex.test",
    })) as Seeded;
    const erinCtx = contextFor(erin, await sessionRowFor(setup, erin, "e1"));
    await establishGovernance(setup, erin, erinCtx, { getDb, now: () => NOW });

    const agent = await setup.query<{ id: string }>(
      `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type)
       values ($1,'Heby','active',$2,'human') returning id`,
      [alice.tenantId, alice.userId],
    );
    const foreignAgent = await setup.query<{ id: string }>(
      `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type)
       values ($1,'Heby','active',$2,'human') returning id`,
      [erin.tenantId, erin.userId],
    );

    const draftSeed = await seedDraft(setup, alice.tenantId, alice.userId);
    const draft = draftSeed.id;
    const seedA = await seedAsset(setup, alice.tenantId, alice.userId, agent.rows[0]!.id, draft, 1);
    const assetA = seedA.id;
    const seedB = await seedAsset(setup, alice.tenantId, alice.userId, agent.rows[0]!.id, draft, 1);
    const assetB = seedB.id;

    const foreignDraft = (await seedDraft(setup, erin.tenantId, erin.userId)).id;
    const foreignAsset = (await seedAsset(
      setup, erin.tenantId, erin.userId, foreignAgent.rows[0]!.id, foreignDraft, 1,
    )).id;

    const sel = (input: { artifactId: string; revisionNo: number; mediaAssetId: string }, ctx = aliceCtx) =>
      selectMediaForRevision(ctx, input, { getDb });
    const pkg = (ctx = aliceCtx, artifactId = draft, revisionNo = 1) =>
      readContentPackage(ctx, { artifactId, revisionNo }, { getDb });

    /* ── 1. Empty package: real, not an error, and NOT ready ──────────────── */
    {
      const p = await pkg();
      assert.equal(p.status, "read");
      if (p.status !== "read") throw new Error("unreachable");
      assert.equal(p.package.destination, "instagram", "destination comes from CGO-1, not from here");
      assert.equal(p.package.selected.length, 0);
      assert.equal(p.package.ready, false);
      assert.deepEqual(
        [...p.package.blockers],
        ["no-media-selected", "copy-unreviewed"],
        "an empty package blocks on media and on its own unreviewed copy",
      );
    }

    /* ── 2. Selection is idempotent, and custody — not Governance — gates it ─ */
    {
      assert.deepEqual(await sel({ artifactId: draft, revisionNo: 1, mediaAssetId: assetA }), { status: "selected" });
      assert.deepEqual(await sel({ artifactId: draft, revisionNo: 1, mediaAssetId: assetA }), { status: "selected" });
      assert.equal(await count(setup, "content_selected_media"), 1, "selecting twice is one row");

      /* A DECLINED image is still selectable: declining may not forbid an internal act. */
      const declined = await declineMediaAsset(
        aliceCtx, { assetId: assetB, byteDigest: seedB.digest, justification: REASON }, { getDb, now: () => NOW } as never,
      );
      assert.equal(declined.status, "reviewed");
      assert.deepEqual(await sel({ artifactId: draft, revisionNo: 1, mediaAssetId: assetB }), { status: "selected" });
      assert.deepEqual(
        await deselectMediaForRevision(aliceCtx, { artifactId: draft, revisionNo: 1, mediaAssetId: assetB }, { getDb }),
        { status: "deselected" },
      );
      assert.equal(await count(setup, "content_selected_media"), 1);
    }

    /* ── 3. Tenant isolation, in both directions ─────────────────────────────── */
    {
      assert.deepEqual(
        await sel({ artifactId: draft, revisionNo: 1, mediaAssetId: foreignAsset }),
        { status: "refused", reason: "asset-unresolvable" },
        "another tenant's image is indistinguishable from absent",
      );
      assert.deepEqual(
        await sel({ artifactId: foreignDraft, revisionNo: 1, mediaAssetId: assetA }),
        { status: "refused", reason: "revision-unresolvable" },
        "another tenant's revision is indistinguishable from absent",
      );
      const foreignRead = await pkg(erinCtx, draft, 1);
      assert.equal(foreignRead.status, "not-found", "another tenant cannot read this package at all");
    }

    /* ── 3b. MEDIA-SELECT-INTEGRITY: the image must come FROM this draft ─────── */
    {
      /* Same tenant, a different draft: its image is not this draft's, however valid it is. */
      const otherDraft = (await seedDraft(setup, alice.tenantId, alice.userId)).id;
      const otherAsset = (await seedAsset(setup, alice.tenantId, alice.userId, agent.rows[0]!.id, otherDraft, 1)).id;
      const before = await count(setup, "content_selected_media");
      assert.deepEqual(
        await sel({ artifactId: draft, revisionNo: 1, mediaAssetId: otherAsset }),
        { status: "refused", reason: "asset-unresolvable" },
        "another draft's image is indistinguishable from absent — provenance, not the caller, says where it belongs",
      );
      assert.equal(await count(setup, "content_selected_media"), before, "a refused selection writes no row");
      assert.deepEqual(
        await sel({ artifactId: otherDraft, revisionNo: 1, mediaAssetId: otherAsset }),
        { status: "selected" },
        "the same image is selectable for the draft it was generated from",
      );
      await deselectMediaForRevision(aliceCtx, { artifactId: otherDraft, revisionNo: 1, mediaAssetId: otherAsset }, { getDb });

      /* Cross-revision within ONE draft stays allowed: CONTENT-COMPOSE-1's production-proven case. */
      await setup.query(
        `insert into work_artifact_revisions
           (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
         values ($1,$2,2,'Revision two',$3,'human',$4)`,
        [alice.tenantId, otherDraft, sha(new TextEncoder().encode("Revision two")), alice.userId],
      );
      assert.deepEqual(
        await sel({ artifactId: otherDraft, revisionNo: 2, mediaAssetId: otherAsset }),
        { status: "selected" },
        "an image generated in revision 1 may be chosen for revision 2 of the same draft",
      );
      await deselectMediaForRevision(aliceCtx, { artifactId: otherDraft, revisionNo: 2, mediaAssetId: otherAsset }, { getDb });
      assert.equal(await count(setup, "content_selected_media"), before, "and deselecting leaves the world as it was");
      assert.equal(await count(setup, "content_selected_media"), 1, "no refusal wrote a row");
    }

    /* ── 4. Readiness is derived from LIVE Governance, and blocks on unreviewed ─ */
    {
      let p = await pkg();
      if (p.status !== "read") throw new Error("unreachable");
      assert.deepEqual([...p.package.blockers], ["selected-media-unreviewed", "copy-unreviewed"]);

      await acceptMediaAsset(aliceCtx, { assetId: assetA, byteDigest: seedA.digest, justification: REASON }, { getDb, now: () => NOW } as never);
      p = await pkg();
      if (p.status !== "read") throw new Error("unreachable");
      assert.deepEqual([...p.package.blockers], ["copy-unreviewed"], "the image is approved; the copy is not");
      assert.equal(p.package.mediaReviewStates[assetA], "approved");

      await acceptArtifactRevision(
        aliceCtx, { artifactId: draft, revisionId: draftSeed.revisionId, justification: REASON }, { getDb, now: () => NOW } as never,
      );
      p = await pkg();
      if (p.status !== "read") throw new Error("unreachable");
      assert.deepEqual([...p.package.blockers], [], "everything is present and judged");
      assert.equal(p.package.ready, true, "THE PACKAGE IS READY");
      assert.equal(p.package.copyReviewState, "approved");
      assert.equal(p.package.selected[0]?.sourceRevisionNo, 1, "provenance survives being selected");
    }

    /* ── 5. READY IS NOT STORED: retire the image, readiness falls, no writer ─ */
    {
      const before = await count(setup, "content_selected_media");
      await setup.query(
        `update media_assets
           set asset_lifecycle_status='retired', retired_at=now(), retired_by_actor_id=$2
         where id=$1`,
        [assetA, alice.userId],
      );
      const p = await pkg();
      if (p.status !== "read") throw new Error("unreachable");
      assert.equal(p.package.ready, false, "a package is ready only while it still is");
      assert.ok(p.package.blockers.includes("selected-media-retired"));
      assert.equal(
        await count(setup, "content_selected_media"), before,
        "readiness changed without anything writing a selection row",
      );
      /* Deselecting a retired image is allowed — custody must not strand it in the package. */
      assert.deepEqual(
        await deselectMediaForRevision(aliceCtx, { artifactId: draft, revisionNo: 1, mediaAssetId: assetA }, { getDb }),
        { status: "deselected" },
      );
      /* And re-selecting it is refused, because custody gates selection. */
      assert.deepEqual(
        await sel({ artifactId: draft, revisionNo: 1, mediaAssetId: assetA }),
        { status: "refused", reason: "asset-retired" },
      );
    }

    /* ── 6. Unauthenticated and malformed input write nothing ────────────────── */
    {
      const before = await count(setup, "content_selected_media");
      assert.deepEqual(
        await selectMediaForRevision(null, { artifactId: draft, revisionNo: 1, mediaAssetId: assetB }, { getDb }),
        { status: "refused", reason: "unauthenticated" },
      );
      assert.deepEqual(
        await sel({ artifactId: "not-a-uuid", revisionNo: 1, mediaAssetId: assetB }),
        { status: "refused", reason: "invalid-input" },
      );
      assert.deepEqual(
        await sel({ artifactId: draft, revisionNo: 0, mediaAssetId: assetB }),
        { status: "refused", reason: "invalid-input" },
      );
      assert.equal(await count(setup, "content_selected_media"), before);
    }

    /* ── 7. Empty copy blocks; a destination-less package is UNREPRESENTABLE ── */
    {
      const bare = (await seedDraft(setup, alice.tenantId, alice.userId, { copy: "   " })).id;
      const p = await pkg(aliceCtx, bare, 1);
      if (p.status !== "read") throw new Error("unreachable");
      assert.equal(p.package.destination, "instagram");
      assert.deepEqual(
        [...p.package.blockers],
        ["copy-empty", "no-media-selected", "copy-unreviewed"],
        "every missing part is named, in order",
      );

      /*
       * The database refuses a content-draft without a destination, which is why there is no
       * `destination-missing` blocker: the state it would describe cannot exist.
       */
      await assert.rejects(
        () => seedDraft(setup, alice.tenantId, alice.userId, { destination: null }),
        /content_draft_destination_chk/,
        "a content-draft without a destination is refused by the schema, not by a blocker",
      );
    }

    /* ── 8. NOTHING ELSE WAS WRITTEN ─────────────────────────────────────────── */
    {
      assert.equal(await count(setup, "action_permits"), 0, "no permit was created");
      assert.equal(await count(setup, "action_execution_attempts"), 0, "no execution was attempted");
      assert.equal(await count(setup, "heby_action_requests"), 0, "no action request was created");
      assert.equal(
        await count(setup, "media_assets", "asset_lifecycle_status <> 'retired' and id = $1", [assetB]),
        1,
        "the unselected image is untouched",
      );
      /* Exactly the four decisions this suite asked Governance for, and not one more. */
      assert.equal(
        await count(setup, "decision_records", "subject_type in ('media_asset','work_artifact_revision')"),
        3,
        "one decline, one accept, one revision accept — composition added none",
      );
    }

    finished = true;
    console.log("content-compose1/package-and-firewall: all assertions passed.");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
