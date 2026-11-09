/*
 * V1-STAGE-2 — content calendar and scheduled publishing, against a disposable PostgreSQL with the
 * canonical migrations. Two synthetic tenants (Acme, Globex), real READY packages built with the
 * released writers, the real `proposePackagePublication`, and no network (fetch throws).
 *
 * Proves: approval required to schedule; current revision only; time validation; tenant isolation
 * in code AND in the schema; optimistic reschedule/cancel; due-gated proposal through the governed
 * path only (a pending request — never a permit, attempt or decision); idempotent proposal; a refused
 * proposal leaves the schedule untouched; one open schedule per revision under concurrency; an audit
 * row per transition.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { instagramPackagePreparation } from "../helpers/instagram-package-fixture";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  cancelContentSchedule,
  createContentSchedule,
  proposeScheduledPublication,
  rescheduleContentSchedule,
} from "../../src/features/content-schedule/write-content-schedule.server";
import { readContentSchedules } from "../../src/features/content-schedule/read-content-schedules.server";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this post is a deliberate organizational act and I accept responsibility.";
const sha = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
interface Seeded { readonly tenantId: string; readonly userId: string; readonly authIdentityId: string; readonly membershipId: string; readonly roleId: string }

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("v1-content-schedule/schedule-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_v1_schedule");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const store = createMemoryMediaObjectStore();
  const proposalDeps = { getDb: () => handle.db, resolveStorage: () => ({ status: "available" as const, store }) };
  try {
    const session = async (s: Seeded, tag: string) =>
      (await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1,$2,1,$3,$4,$5,1,'aal1',false,now(),now(),now(),now()+interval '1 day',now()+interval '1 hour') returning id`,
        [s.authIdentityId, tag.padEnd(64, "c").slice(0, 64), s.userId, s.tenantId, s.membershipId],
      )).rows[0]!.id;
    const ctxFor = (s: Seeded, sessionContextId: string): TenantContext =>
      asHumanTenantContext({
        tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
        membershipVersion: 1, roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1",
        mfaVerified: false, requestId: "v1-schedule-request", authenticatedAt: new Date().toISOString(),
      });
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-v1s", email: "director@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-v1s", email: "director@globex.test" })) as Seeded;
    const acmeCtx = ctxFor(acme, await session(acme, "a1"));
    const globexCtx = ctxFor(globex, await session(globex, "b1"));
    const agents = new Map<string, string>();
    for (const [s, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
           accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, proposalDeps)).status, "established");
      await setup.query(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health, scopes, external_account_id, created_by, created_by_type)
         values ($1,'instagram','instagram','connected','connected','healthy',$2::jsonb,'28295264780115792',$3,'human')`,
        [s.tenantId, JSON.stringify(["instagram_business_basic", "instagram_business_content_publish"]), s.userId],
      );
      agents.set(s.tenantId, (await setup.query<{ id: string }>(
        `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type) values ($1,'Heby','active',$2,'human') returning id`,
        [s.tenantId, s.userId],
      )).rows[0]!.id);
    }
    const prep = instagramPackagePreparation(setup, () => handle.db);
    const seedDraft = async (s: Seeded, revisions = 1) => {
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace, current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft','Kilim post','draft','operations',$2,'instagram',$3,'human') returning id`,
        [s.tenantId, revisions, s.userId],
      )).rows[0]!.id;
      for (let r = 1; r <= revisions; r++) {
        const caption = `Kilim r${r} ${randomUUID()}`;
        await setup.query(
          `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
           values ($1,$2,$3,$4,$5,'human',$6)`,
          [s.tenantId, artifact, r, caption, sha(caption), s.userId],
        );
      }
      return { artifactId: artifact, revisionNo: revisions };
    };
    const seedImage = async (s: Seeded, artifactId: string, revisionNo: number) => {
      const inv = (await setup.query<{ id: string }>(
        `insert into media_generation_invocations (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
           source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider, model, state, admission_outcome,
           requested_at, finalized_at, output_media_kind)
         values ($1,$2,'human',$3,$4,$5,$6,'prompt',$7,'fake','fake','fake','provider-succeeded','admitted', now(), now(), 'image') returning id`,
        [s.tenantId, randomUUID(), s.userId, agents.get(s.tenantId), artifactId, revisionNo, sha(randomUUID())],
      )).rows[0]!.id;
      const assetId = randomUUID();
      const bytes = new Uint8Array(await sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 10, g: 120, b: Math.floor(Math.random() * 255), alpha: 0.5 } } }).png().toBuffer());
      const key = `tenants/${s.tenantId}/media/${assetId}`;
      await store.put({ key, bytes, contentType: "image/png", sha256Hex: sha(bytes) });
      await setup.query(
        `insert into media_assets (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height, storage_backend, storage_key, admitted_at, asset_lifecycle_status)
         values ($1,$2,$3,'image/png',$4,$5,64,48,'test-memory',$6, now(),'admitted')`,
        [assetId, s.tenantId, inv, bytes.length, sha(bytes), key],
      );
      return assetId;
    };
    const readyDraft = async (s: Seeded, ctx: TenantContext, revisions = 1) => {
      const d = await seedDraft(s, revisions);
      await prep.makeReady(ctx, d, await seedImage(s, d.artifactId, d.revisionNo));
      return d;
    };

    const n = async (q: string, p: unknown[] = []) => (await setup.query<{ n: number }>(q, p)).rows[0]!.n;
    const world = async () => ({
      schedules: await n("select count(*)::int n from content_publication_intents"),
      requests: await n("select count(*)::int n from heby_action_requests"),
      permits: await n("select count(*)::int n from action_permits"),
      attempts: await n("select count(*)::int n from action_execution_attempts"),
      network: networkCalls,
    });
    const audits = async (scheduleId: string) =>
      (await setup.query<{ action: string; tenant_id: string; entity_type: string }>(
        `select action, tenant_id, entity_type from audit_log where entity_id=$1 order by occurred_at, recorded_at`, [scheduleId],
      )).rows;

    const T0 = new Date("2026-11-10T08:00:00.000Z");
    let clock = T0;
    const deps = { getDb: () => handle.db, now: () => clock, proposalDeps };
    const create = (ctx: TenantContext | null, d: { artifactId: string; revisionNo: number }, local = "2026-11-12T09:00", timeZone = "Europe/Istanbul", extra: object = {}) =>
      createContentSchedule(ctx, { ...d, local, timeZone, ...extra }, deps);
    const refusedClean = async (label: string, run: () => Promise<{ status: string; reason?: string }>, reason: string) => {
      const before = await world();
      const r = await run();
      assert.equal(r.status === "refused" && r.reason, reason, `${label}: ${JSON.stringify(r)}`);
      assert.deepEqual(await world(), before, `${label}: nothing written`);
    };

    /* S1 — approval is required: a draft whose copy is not reviewed cannot be scheduled. */
    const unreviewed = await seedDraft(acme);
    await prep.select(acmeCtx, unreviewed, await seedImage(acme, unreviewed.artifactId, 1));
    await refusedClean("S1 unapproved", () => create(acmeCtx, unreviewed), "package-not-ready");
    await refusedClean("S1 unauthenticated", () => create(null, unreviewed), "unauthenticated");
    console.log("ok S1 an unapproved package cannot be scheduled; no session, no schedule");

    /* S2 — schedule a READY revision; the instant is UTC, the zone is kept; one audit row. */
    const a = await readyDraft(acme, acmeCtx);
    const s2 = await create(acmeCtx, a);
    assert.equal(s2.status, "scheduled", JSON.stringify(s2));
    const scheduleA = s2.status === "scheduled" ? s2.scheduleId : "";
    const rowA = (await setup.query<{ scheduled_for: Date; time_zone: string; tenant_id: string; state: string }>(`select * from content_publication_intents where id=$1`, [scheduleA])).rows[0];
    assert.equal(rowA.scheduled_for.toISOString(), "2026-11-12T06:00:00.000Z");
    assert.equal(rowA.time_zone, "Europe/Istanbul");
    assert.equal(rowA.tenant_id, acme.tenantId);
    assert.equal(rowA.state, "scheduled");
    assert.deepEqual((await audits(scheduleA)).map((r) => [r.action, r.tenant_id, r.entity_type]), [["content.schedule.created", acme.tenantId, "content_publication_schedule"]]);
    await refusedClean("S2 duplicate", () => create(acmeCtx, a, "2026-11-13T09:00"), "already-scheduled");
    console.log("ok S2 READY revision scheduled at 2026-11-12 09:00 Europe/Istanbul = 06:00Z; second open schedule refused");

    /* S3 — time and revision validation. */
    const b = await readyDraft(acme, acmeCtx);
    await refusedClean("S3 too soon", () => create(acmeCtx, b, "2026-11-10T11:03"), "too-soon");
    await refusedClean("S3 DST gap", () => create(acmeCtx, b, "2026-03-08T02:30", "America/New_York"), "nonexistent-local-time");
    await refusedClean("S3 bad zone", () => create(acmeCtx, b, "2026-11-12T09:00", "Mars/Olympus"), "invalid-time-zone");
    await refusedClean("S3 bad input", () => createContentSchedule(acmeCtx, { artifactId: "x", revisionNo: 1, local: "2026-11-12T09:00", timeZone: "UTC" }, deps), "invalid-input");
    const two = await seedDraft(acme, 2);
    await prep.makeReady(acmeCtx, { artifactId: two.artifactId, revisionNo: 1 }, await seedImage(acme, two.artifactId, 1));
    await refusedClean("S3 old revision", () => create(acmeCtx, { artifactId: two.artifactId, revisionNo: 1 }), "not-current-revision");
    console.log("ok S3 too soon, DST gap, unknown zone, malformed input and a superseded revision are refused");

    /* S4 — tenant isolation in code. */
    await refusedClean("S4 cross-tenant create", () => create(globexCtx, b), "not-found");
    await refusedClean("S4 cross-tenant cancel", () => cancelContentSchedule(globexCtx, { scheduleId: scheduleA, expectedVersion: 1 }, deps), "not-found");
    await refusedClean("S4 cross-tenant reschedule", () => rescheduleContentSchedule(globexCtx, { scheduleId: scheduleA, expectedVersion: 1, local: "2026-11-14T09:00", timeZone: "UTC" }, deps), "not-found");
    await refusedClean("S4 cross-tenant propose", () => proposeScheduledPublication(globexCtx, { scheduleId: scheduleA }, { ...deps, now: () => new Date("2026-11-13T00:00:00Z") }), "not-found");
    const globexRead = await readContentSchedules(globexCtx, deps);
    assert.ok(globexRead.status === "read" && globexRead.open.length === 0 && globexRead.closed.length === 0, "Globex sees nothing of Acme's");
    console.log("ok S4 another tenant can neither see, create, move, cancel nor propose Acme's schedules");

    /* S5 — reschedule is optimistic and audited. */
    await refusedClean("S5 stale", () => rescheduleContentSchedule(acmeCtx, { scheduleId: scheduleA, expectedVersion: 7, local: "2026-11-12T10:00", timeZone: "Europe/Istanbul" }, deps), "stale-version");
    const s5 = await rescheduleContentSchedule(acmeCtx, { scheduleId: scheduleA, expectedVersion: 1, local: "2026-11-12T08:00", timeZone: "America/New_York" }, deps);
    assert.deepEqual(s5, { status: "rescheduled", scheduleId: scheduleA, version: 2 });
    const moved = (await setup.query<{ scheduled_for: Date; time_zone: string }>(`select scheduled_for, time_zone from content_publication_intents where id=$1`, [scheduleA])).rows[0];
    assert.equal(moved.scheduled_for.toISOString(), "2026-11-12T13:00:00.000Z");
    assert.equal(moved.time_zone, "America/New_York");
    const resAudit = (await setup.query<{ previous_state: { scheduledFor: string }; next_state: { scheduledFor: string } }>(`select previous_state, next_state from audit_log where entity_id=$1 and action='content.schedule.rescheduled'`, [scheduleA])).rows[0];
    assert.equal(resAudit.previous_state.scheduledFor, "2026-11-12T06:00:00.000Z");
    assert.equal(resAudit.next_state.scheduledFor, "2026-11-12T13:00:00.000Z");
    console.log("ok S5 reschedule needs the version seen; moved to 08:00 New York = 13:00Z, before/after audited");

    /* S6 — proposal is due-gated and goes through the governed path only. */
    await refusedClean("S6 not due", () => proposeScheduledPublication(acmeCtx, { scheduleId: scheduleA }, deps), "not-due");
    clock = new Date("2026-11-12T13:00:00.000Z");
    const before6 = await world();
    const s6 = await proposeScheduledPublication(acmeCtx, { scheduleId: scheduleA }, deps);
    assert.equal(s6.status, "requested", JSON.stringify(s6));
    const requestA = s6.status === "requested" ? s6.requestId : "";
    const after6 = await world();
    assert.equal(after6.requests, before6.requests + 1, "exactly one governed request");
    assert.equal(after6.permits, 0, "no permit: approval is still a human Governance act");
    assert.equal(after6.attempts, 0, "nothing executed");
    assert.equal(after6.network, 0, "nothing sent");
    const req = (await setup.query<{ status: string; tenant_id: string; proposed_by_actor_type: string; action_kind: string }>(`select status, tenant_id, proposed_by_actor_type, action_kind from heby_action_requests where id=$1`, [requestA])).rows[0];
    assert.deepEqual([req.status, req.tenant_id, req.proposed_by_actor_type, req.action_kind], ["pending", acme.tenantId, "human", "publish-instagram-media"]);
    const afterRow = (await setup.query<{ state: string; request_id: string; version: number }>(`select state, request_id, version from content_publication_intents where id=$1`, [scheduleA])).rows[0];
    assert.deepEqual([afterRow.state, afterRow.request_id, afterRow.version], ["requested", requestA, 3]);
    console.log("ok S6 not before its moment; when due, ONE pending human request — no permit, no attempt, no send");

    /* S7 — idempotent. */
    const before7 = await world();
    assert.deepEqual(await proposeScheduledPublication(acmeCtx, { scheduleId: scheduleA }, deps), { status: "already-requested", scheduleId: scheduleA, requestId: requestA });
    assert.deepEqual(await world(), before7);
    await refusedClean("S7 cancel after request", () => cancelContentSchedule(acmeCtx, { scheduleId: scheduleA, expectedVersion: 3 }, deps), "not-scheduled");
    assert.deepEqual((await audits(scheduleA)).map((r) => r.action), ["content.schedule.created", "content.schedule.rescheduled", "content.schedule.requested"]);
    console.log("ok S7 proposing again returns the same request and writes nothing; a requested schedule cannot be cancelled");

    /* S8 — cancel, terminal; the revision can be scheduled again. */
    clock = T0;
    const s8 = await create(acmeCtx, b);
    assert.equal(s8.status, "scheduled");
    const scheduleB = s8.status === "scheduled" ? s8.scheduleId : "";
    assert.deepEqual(await cancelContentSchedule(acmeCtx, { scheduleId: scheduleB, expectedVersion: 1 }, deps), { status: "cancelled", scheduleId: scheduleB, version: 2 });
    await refusedClean("S8 cancel twice", () => cancelContentSchedule(acmeCtx, { scheduleId: scheduleB, expectedVersion: 2 }, deps), "not-scheduled");
    await refusedClean("S8 propose cancelled", () => proposeScheduledPublication(acmeCtx, { scheduleId: scheduleB }, { ...deps, now: () => new Date("2027-01-01T00:00:00Z") }), "not-scheduled");
    assert.equal((await create(acmeCtx, b, "2026-11-15T09:00")).status, "scheduled", "rescheduling after a cancel is a new schedule");
    console.log("ok S8 cancel is terminal; the same revision may be scheduled afresh");

    /* S9 — content withdrawn before its moment: the released path refuses, the schedule stays open. */
    const c = await readyDraft(acme, acmeCtx);
    const s9 = await create(acmeCtx, c);
    const scheduleC = s9.status === "scheduled" ? s9.scheduleId : "";
    await prep.requestCopyChanges(acmeCtx, c);
    clock = new Date("2026-11-13T00:00:00.000Z");
    const before9 = await world();
    const r9 = await proposeScheduledPublication(acmeCtx, { scheduleId: scheduleC }, deps);
    assert.equal(r9.status, "proposal-refused", JSON.stringify(r9));
    assert.deepEqual(await world(), before9, "no request");
    assert.equal((await setup.query<{ state: string }>(`select state from content_publication_intents where id=$1`, [scheduleC])).rows[0].state, "scheduled");
    console.log("ok S9 copy sent back for changes after scheduling: the governed path refuses at the moment; nothing proposed");

    /* S10 — the schema enforces what the code assumes. */
    const sqlRefuses = async (label: string, q: string, p: unknown[], code: string) => {
      await assert.rejects(setup.query(q, p), (e: { code?: string }) => e.code === code, label);
    };
    const ins = `insert into content_publication_intents (tenant_id, artifact_id, revision_no, destination, scheduled_for, time_zone, state, request_id, created_by, updated_by)
                 values ($1,$2,$3,'instagram', now() + interval '1 day', 'UTC', $4, $5, $6, $6)`;
    await sqlRefuses("requested without request", ins, [acme.tenantId, c.artifactId, 1, "requested", null, acme.userId], "23514");
    await sqlRefuses("second open schedule", ins, [acme.tenantId, c.artifactId, 1, "scheduled", null, acme.userId], "23505");
    const g = await readyDraft(globex, globexCtx);
    await sqlRefuses("Acme schedule on Globex revision", ins, [acme.tenantId, g.artifactId, 1, "scheduled", null, acme.userId], "23503");
    await sqlRefuses("Globex schedule pointing at Acme's request", ins, [globex.tenantId, g.artifactId, 1, "requested", requestA, globex.userId], "23503");
    await sqlRefuses("unknown destination", ins.replace("'instagram'", "'tiktok'"), [acme.tenantId, b.artifactId, 1, "cancelled", null, acme.userId], "23514");
    console.log("ok S10 schema refuses requested-without-request, two open schedules, and cross-tenant revision or request links");

    /* S11 — concurrent creates for one revision: exactly one wins. */
    const d = await readyDraft(acme, acmeCtx);
    clock = T0;
    const raced = await Promise.all(Array.from({ length: 6 }, () => create(acmeCtx, d)));
    assert.equal(raced.filter((r) => r.status === "scheduled").length, 1, JSON.stringify(raced));
    assert.ok(raced.every((r) => r.status === "scheduled" || (r.status === "refused" && r.reason === "already-scheduled")));
    console.log("ok S11 six concurrent schedules of one revision: one scheduled, five already-scheduled");

    /* S12 — the calendar read. */
    const cal = await readContentSchedules(acmeCtx, { ...deps, now: () => new Date("2026-11-13T00:00:00Z") });
    assert.equal(cal.status, "read");
    if (cal.status === "read") {
      assert.ok(cal.open.every((v) => v.state === "scheduled"));
      assert.deepEqual(cal.open.map((v) => v.scheduledFor), [...cal.open.map((v) => v.scheduledFor)].sort(), "open schedules in time order");
      assert.ok(cal.closed.some((v) => v.scheduleId === scheduleA && v.state === "requested" && v.requestId === requestA));
      assert.ok(cal.closed.some((v) => v.scheduleId === scheduleB && v.state === "cancelled"));
      assert.ok(cal.open.some((v) => v.scheduleId === scheduleC && v.due && !v.stale));
    }
    assert.equal(networkCalls, 0);
    assert.equal(await n("select count(*)::int n from action_permits"), 0, "the whole run issued no permit");
    console.log("ok S12 calendar: open in time order with due-ness, closed with their request; no permit issued in the whole run");
    finished = true;
    console.log("PASS v1 content schedule postgres");
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
