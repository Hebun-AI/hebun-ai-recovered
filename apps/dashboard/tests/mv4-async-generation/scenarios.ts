/*
 * MV-4 lifecycle scenarios, parameterised by the lifecycle module so the SAME claims run against the
 * released writer (lifecycle-postgres.ts) and against deliberately broken copies (bite-proofs.ts).
 * Every scenario seeds its own tenants, so runs never share state.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import type * as Lifecycle from "../../src/features/media-assets/async-generation-lifecycle.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { createFakeAsyncVideoTransport, SIMULATED_SECRET_MARKER, type FakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";

type LifecycleModule = typeof Lifecycle;
const NOW = new Date("2026-09-26T14:00:00.000Z");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

export interface Tenant {
  readonly ctx: TenantContext;
  readonly tenantId: string;
  readonly draft: string;
}

async function sessionRowFor(client: Client, s: Seeded): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [s.authIdentityId, sha(randomUUID()), s.userId, s.tenantId, s.membershipId],
  );
  return row.rows[0]!.id;
}

export async function seedTenant(client: Client, getDb: () => ControlPlaneDatabase, name: string): Promise<Tenant> {
  const slug = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}`;
  const s = (await seedLocalIdentity(client, { companyName: name, companySlug: slug, email: `${slug}@mv4.test` })) as Seeded;
  const ctx = asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
    membershipVersion: 1, roleId: s.roleId, sessionContextId: await sessionRowFor(client, s), provider: "local",
    assuranceLevel: "aal1", mfaVerified: false, requestId: "mv4", authenticatedAt: NOW.toISOString(),
  });
  await client.query(
    `insert into genesis_nominations
       (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
        accepted_at, accepted_session_context_id, accepted_assurance_level)
     values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
    [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
  );
  assert.equal(
    (await establishGovernanceAuthority(ctx, { justification: "Establishing Governance authority for the MV-4 lifecycle proof." }, { getDb, now: () => NOW } as never)).status,
    "established",
  );
  await createDurableAgentIdentity(ctx, { name: "Heby" }, { getDb } as never);
  const content = `Draft ${randomUUID()}`;
  const art = await client.query<{ id: string }>(
    `insert into work_artifacts (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
       current_revision, intended_destination, created_by, created_by_type)
     values ($1,'content-draft','Draft','draft','operations',1,'instagram',$2,'human') returning id`,
    [s.tenantId, s.userId],
  );
  await client.query(
    `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
     values ($1,$2,1,$3,$4,'human',$5)`,
    [s.tenantId, art.rows[0]!.id, content, sha(content), s.userId],
  );
  return { ctx, tenantId: s.tenantId, draft: art.rows[0]!.id };
}

export async function row(client: Client, id: string): Promise<Record<string, unknown>> {
  return (await client.query<{ j: Record<string, unknown> }>(`select row_to_json(m)::jsonb j from media_generation_invocations m where id=$1`, [id])).rows[0]!.j;
}
async function assetCount(client: Client): Promise<number> {
  return (await client.query<{ n: number }>(`select count(*)::int n from media_assets`)).rows[0]!.n;
}

export async function runScenarios(mod: LifecycleModule, client: Client, getDb: () => ControlPlaneDatabase, label: string): Promise<void> {
  const a = await seedTenant(client, getDb, "Acme");
  const b = await seedTenant(client, getDb, "Beta");
  const assetsAtStart = await assetCount(client);
  const depsFor = (t: FakeAsyncVideoTransport) => ({ getDb, now: () => NOW, resolveTransport: () => ({ status: "available" as const, transport: t }) });
  const register = async (tenant: Tenant, t: FakeAsyncVideoTransport): Promise<string> => {
    const r = await mod.registerAsyncMediaGeneration(tenant.ctx, { artifactId: tenant.draft, revisionNo: 1, promptText: "A slow pan across a kilim.", requestKey: randomUUID() }, depsFor(t));
    assert.equal(r.status, "registered", `${label}: registers (${JSON.stringify(r)})`);
    return (r as { invocationId: string }).invocationId;
  };

  /* ── 1. pending → pending (repeated) → succeeded, and NO Media asset ── */
  {
    const t = createFakeAsyncVideoTransport("accept");
    const id = await register(a, t);
    let r0 = await row(client, id);
    assert.equal(r0.state, "registered");
    assert.equal(r0.output_media_kind, "video", "the invocation records that a video was asked for");
    assert.equal(r0.transport, "fake", "simulated is recorded as fake");

    assert.deepEqual(await mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "no-transition", state: "registered" }, `${label}: a registered job is not polled`);
    assert.equal(t.pollCalls.length, 0);

    assert.deepEqual(await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "transitioned", from: "registered", state: "provider-pending" });
    r0 = await row(client, id);
    assert.equal(r0.state, "provider-pending");
    assert.equal(r0.provider_job_id, "sim-job-1");
    assert.ok(r0.provider_accepted_at, "acceptance time recorded");
    assert.equal(r0.admission_outcome, "not-attempted");
    assert.equal(await assetCount(client), assetsAtStart, `${label}: provider-pending creates no Media asset`);

    assert.deepEqual(await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "no-transition", state: "provider-pending" }, `${label}: no second dispatch`);
    assert.equal(t.dispatchCalls.length, 1, `${label}: the provider was asked exactly once`);

    for (let i = 1; i <= 3; i++) {
      assert.deepEqual(await mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "observed-pending", state: "provider-pending" });
      const r = await row(client, id);
      assert.equal(r.state, "provider-pending", `${label}: pending poll ${i} is not a transition`);
      assert.equal(r.poll_count, i, `${label}: poll ${i} counted once`);
      assert.ok(r.last_polled_at);
      assert.equal(r.provider_completed_at, null);
    }
    t.pollScript.push(new Error("simulated poll timeout"));
    assert.equal((await mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t))).status, "observed-pending", `${label}: an unreadable poll is not a failure`);
    assert.equal((await row(client, id)).state, "provider-pending");

    t.pollScript.push({ status: "succeeded", outputRef: "sim-output-1" });
    assert.deepEqual(await mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "transitioned", from: "provider-pending", state: "provider-succeeded" });
    const done = await row(client, id);
    assert.equal(done.provider_output_ref, "sim-output-1");
    assert.ok(done.provider_completed_at && done.finalized_at);
    assert.equal(done.poll_count, 5);
    assert.equal(done.admission_outcome, "not-attempted", `${label}: completion is not admission`);
    assert.equal(await assetCount(client), assetsAtStart, `${label}: provider-succeeded creates no Media asset`);

    const callsBefore = t.pollCalls.length;
    t.pollScript.push({ status: "failed", failure: "provider-unavailable" });
    assert.deepEqual(await mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "no-transition", state: "provider-succeeded" }, `${label}: a terminal job is never re-observed`);
    assert.equal(t.pollCalls.length, callsBefore, "and the provider is not asked");
    t.pollScript.length = 0;
    assert.deepEqual(await row(client, id), done, `${label}: the completed row is untouched`);

    const view = await mod.readAsyncMediaGeneration(a.ctx, id, { getDb });
    assert.equal(view.status, "read");
    if (view.status === "read") {
      assert.equal(view.generation.simulated, true, "the read model says SIMULATED");
      assert.equal(view.generation.providerOutputReported, true);
      assert.ok(!("providerOutputRef" in view.generation), "the opaque ref itself is not exposed");
    }
  }

  /* ── 2. duplicate completion observation: two overlapping polls, one transition ── */
  {
    const t = createFakeAsyncVideoTransport("accept");
    const id = await register(a, t);
    await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t));
    let release!: () => void;
    t.pollGate = new Promise<void>((r) => (release = r));
    t.pollScript.push({ status: "succeeded", outputRef: "sim-output-x" }, { status: "succeeded", outputRef: "sim-output-y" });
    const both = Promise.all([mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t)), mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t))]);
    await new Promise((r) => setTimeout(r, 50));
    release();
    const results = await both;
    assert.equal(results.filter((r) => r.status === "transitioned").length, 1, `${label}: exactly one observation transitions (${JSON.stringify(results)})`);
    assert.equal(results.filter((r) => r.status === "no-transition").length, 1, `${label}: the duplicate is a no-op`);
    const r = await row(client, id);
    assert.equal(r.state, "provider-succeeded");
    assert.equal(r.poll_count, 1, `${label}: the losing observation wrote nothing`);
    assert.equal(await assetCount(client), assetsAtStart);
  }

  /* ── 3. concurrent dispatch: intent is claimed once, the provider is asked once ── */
  {
    const t = createFakeAsyncVideoTransport("accept");
    const id = await register(a, t);
    const results = await Promise.all([1, 2, 3].map(() => mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t))));
    assert.equal(t.dispatchCalls.length, 1, `${label}: one dispatch under contention (${JSON.stringify(results)})`);
    assert.equal(results.filter((r) => r.status === "transitioned").length, 1);
  }

  /* ── 4. pending → failed ── */
  {
    const t = createFakeAsyncVideoTransport("accept");
    const id = await register(a, t);
    await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t));
    t.pollScript.push({ status: "failed", failure: "moderation-blocked" });
    assert.deepEqual(await mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "transitioned", from: "provider-pending", state: "provider-failed" });
    const r = await row(client, id);
    assert.equal(r.provider_failure, "moderation-blocked");
    assert.ok(r.provider_completed_at);
    assert.equal(r.provider_output_ref, null);
    assert.equal(await assetCount(client), assetsAtStart, `${label}: provider-failed creates no Media asset`);
  }

  /* ── 5. rejected at dispatch → provider-failed (the provider answered) ── */
  {
    const t = createFakeAsyncVideoTransport("reject");
    const id = await register(a, t);
    assert.deepEqual(await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "transitioned", from: "registered", state: "provider-failed" });
    assert.equal((await row(client, id)).provider_failure, "moderation-blocked");
  }

  /* ── 6. dispatch-unknown: distinct from failure, terminal, never retried or polled ── */
  for (const behaviour of ["unknown", "throw", "accept-without-job"] as const) {
    const t = createFakeAsyncVideoTransport(behaviour);
    const id = await register(a, t);
    assert.deepEqual(await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "transitioned", from: "registered", state: "dispatch-unknown" }, `${label}: ${behaviour} is unknown`);
    const r = await row(client, id);
    assert.equal(r.state, "dispatch-unknown", `${label}: ${behaviour} → dispatch-unknown, not dispatch-failed`);
    assert.equal(r.provider_failure, null, `${label}: an unknown dispatch carries no failure code`);
    assert.equal(r.provider_job_id, null);
    t.dispatchBehaviour = "accept";
    assert.deepEqual(await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "no-transition", state: "dispatch-unknown" }, `${label}: ambiguous dispatch is not retried`);
    assert.deepEqual(await mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t)), { status: "no-transition", state: "dispatch-unknown" });
    assert.equal(t.dispatchCalls.length, 1, `${label}: ${behaviour}: one call, ever`);
    assert.equal(t.pollCalls.length, 0);
    assert.deepEqual(await row(client, id), r);
  }

  /* ── 7. a provider "output ref" that is a URL is never persisted ── */
  {
    const t = createFakeAsyncVideoTransport("accept");
    const id = await register(a, t);
    await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(t));
    t.pollScript.push({ status: "succeeded", outputRef: "https://cdn.example/out.mp4?sig=abc" });
    await mod.pollAsyncMediaGeneration(a.ctx, id, depsFor(t));
    const r = await row(client, id);
    assert.equal(r.state, "provider-failed");
    assert.equal(r.provider_failure, "malformed-response");
    assert.equal(r.provider_output_ref, null, `${label}: no URL is stored`);
  }

  /* ── 8. tenant isolation ── */
  {
    const t = createFakeAsyncVideoTransport("accept");
    const id = await register(a, t);
    const before = await row(client, id);
    assert.deepEqual(await mod.dispatchAsyncMediaGeneration(b.ctx, id, depsFor(t)), { status: "refused", reason: "invocation-not-found" }, `${label}: B cannot dispatch A's job`);
    assert.deepEqual(await mod.pollAsyncMediaGeneration(b.ctx, id, depsFor(t)), { status: "refused", reason: "invocation-not-found" });
    assert.deepEqual(await mod.readAsyncMediaGeneration(b.ctx, id, { getDb }), { status: "not-found" }, `${label}: B cannot read A's job`);
    assert.equal(t.dispatchCalls.length, 0);
    assert.deepEqual(await row(client, id), before, `${label}: A's row is untouched by B`);
    const cross = await mod.registerAsyncMediaGeneration(b.ctx, { artifactId: a.draft, revisionNo: 1, promptText: "x", requestKey: randomUUID() }, depsFor(t));
    assert.deepEqual(cross, { status: "refused", reason: "source-revision-unresolvable" }, `${label}: B cannot register against A's draft`);
  }

  /* ── 9. transport identity is bound to the row ── */
  {
    const t = createFakeAsyncVideoTransport("accept");
    const id = await register(a, t);
    const other = { ...createFakeAsyncVideoTransport("accept"), model: "some-other-model" };
    assert.deepEqual(await mod.dispatchAsyncMediaGeneration(a.ctx, id, depsFor(other as FakeAsyncVideoTransport)), { status: "refused", reason: "transport-mismatch" });
    assert.equal((await row(client, id)).state, "registered");
  }

  /* ── 10. fail closed without a transport (the production resolver) or a session ── */
  {
    const r = await mod.registerAsyncMediaGeneration(a.ctx, { artifactId: a.draft, revisionNo: 1, promptText: "x", requestKey: randomUUID() }, { getDb, now: () => NOW });
    assert.deepEqual(r, { status: "refused", reason: "generation-transport-unavailable" }, `${label}: no real video provider is connected`);
    assert.deepEqual(await mod.registerAsyncMediaGeneration(null, null), { status: "refused", reason: "unauthenticated" });
    const t = createFakeAsyncVideoTransport("accept");
    const id = await register(a, t);
    assert.deepEqual(await mod.dispatchAsyncMediaGeneration(a.ctx, id, { getDb, now: () => NOW }), { status: "refused", reason: "generation-transport-unavailable" });
    assert.equal((await row(client, id)).state, "registered");
  }

  /* ── 11. no secret anywhere Hebun keeps or returns ── */
  {
    const all = (await client.query(`select row_to_json(m)::text j from media_generation_invocations m`)).rows.map((r) => r.j as string).join("\n");
    assert.ok(!all.includes(SIMULATED_SECRET_MARKER), `${label}: no transport secret in any invocation row`);
  }

  assert.equal(await assetCount(client), assetsAtStart, `${label}: the whole lifecycle created no Media asset`);
}
