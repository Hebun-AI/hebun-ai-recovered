/*
 * HEBY-OBSERVED-PERFORMANCE-READ-1 — `/performance` against a real PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES, through the released readers end to end:
 *   A. A publication made from a SUPERSEDED revision is found: revisions come from the revision
 *      authority, the ledger decides which were published.
 *   B. Recorded zero stays "0", a withheld count stays "not reported", and every line names the
 *      provider, the measurement type and the observation instant.
 *   C. Unpublished revisions and non-content artifacts produce nothing.
 *   D. One tenant never sees another's publication, observation or draft.
 *   E. The read writes nothing.
 *
 * The ledger and observation rows are seeded directly (replica mode bypasses the FK chain and the
 * append-only triggers; every CHECK still holds). Disposable database, dropped on exit. No provider.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const asTenant = (s: SeededLocalIdentity) => ({ tenantId: s.tenantId, userId: s.userId }) as unknown as TenantContext;

const TABLES = [
  "work_artifacts", "work_artifact_revisions", "heby_action_requests", "action_permits",
  "action_execution_attempts", "provider_observations", "audit_log", "messages", "conversations",
];

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_hopr1_performance");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  try {
    harness.migrateDatabase();
    await setup.connect();
    process.env.DATABASE_URL = harness.dbUrl;
    const acme = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-hopr1", email: "a@hopr1.test" });
    const globex = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-hopr1", email: "g@hopr1.test" });

    const draft = async (s: SeededLocalIdentity, title: string, revisions: number, type = "content-draft") => {
      const id = (await setup.query<{ id: string }>(
        `insert into work_artifacts (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace, current_revision, intended_destination, created_by, created_by_type)
         values ($1,$2,$3,'draft','operations',$4,$5,$6,'human') returning id`,
        [s.tenantId, type, title, revisions, type === "content-draft" ? "instagram" : null, s.userId],
      )).rows[0]!.id;
      for (let n = 1; n <= revisions; n += 1) {
        const copy = `${title} r${n} ${randomUUID()}`;
        await setup.query(
          `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
           values ($1,$2,$3,$4,$5,'human',$6)`,
          [s.tenantId, id, n, copy, sha(copy), s.userId],
        );
      }
      return id;
    };

    /* An accepted Instagram publication of one revision, as the executor would have left it. */
    const publish = async (s: SeededLocalIdentity, artifactId: string, revisionNo: number, account: string, mediaId: string, completedAt: string) => {
      await setup.query("set session_replication_role = replica");
      const payload = { externalAccountId: account, artifactRef: `work-artifact/${artifactId}@${revisionNo}` };
      const digest = sha(JSON.stringify(payload));
      const request = (await setup.query<{ id: string }>(
        `insert into heby_action_requests
           (tenant_id, action_id, payload_digest, action_kind, tool_id, side_effect, reversibility, owner_workspace, requesting_workspace,
            canonical_payload, expected_effect, consequences, proposed_by_actor_type, proposed_by_actor_id, target_kind, target_ref,
            status, approved_by_actor_type, approved_by_actor_id, approved_at, approval_decision_id)
         values ($1,$2,$3,'publish-instagram-media','instagram.publish','external','irreversible','operations','heby',
                 $4::jsonb,'publish','[]'::jsonb,'human',$5,'work-artifact',$6,'approved','human',$5,now(),$7)
         returning id`,
        [s.tenantId, randomUUID().replace(/-/g, ""), digest, JSON.stringify(payload), s.userId, `work-artifact/${artifactId}@${revisionNo}`, randomUUID()],
      )).rows[0]!.id;
      const permit = (await setup.query<{ id: string }>(
        `insert into action_permits (tenant_id, action_request_id, governance_decision_id, governance_session_id, handoff_id, status, authorized_by_actor_type, authorized_by_actor_id, bound_payload_digest, issued_at, expires_at, ttl_seconds, consumed_at)
         values ($1,$2,$5,$6,$7,'consumed','human',$3,$4, now() - interval '1 hour', now() + interval '1 hour', 7200, now()) returning id`,
        [s.tenantId, request, s.userId, digest, randomUUID(), randomUUID(), randomUUID()],
      )).rows[0]!.id;
      await setup.query(
        `insert into action_execution_attempts (tenant_id, permit_id, handoff_id, action_request_id, action_kind, adapter_id, bound_payload_digest, draft_revision_digest,
            status, provider_response_class, provider_message_id, started_at, completed_at)
         values ($1,$2,$3,$4,'publish-instagram-media','instagram-publish-v1',$5,$5,'accepted','accepted',$6,$7::timestamptz - interval '1 minute',$7)`,
        [s.tenantId, permit, randomUUID(), request, digest, mediaId, completedAt],
      );
      await setup.query("set session_replication_role = origin");
    };

    const observe = async (s: SeededLocalIdentity, account: string, observedAt: string, media: { id: string; likes: number | null; comments: number | null }[]) => {
      await setup.query("set session_replication_role = replica");
      const facts = {
        accountId: account, recentMediaCount: media.length, moreMediaExist: false,
        recentMedia: media.map((m) => ({ mediaId: m.id, mediaType: "IMAGE", caption: "c", permalink: null, publishedAt: "2026-10-01T10:00:00+0000", likeCount: m.likes, commentCount: m.comments })),
      };
      await setup.query(
        `insert into provider_observations (tenant_id, integration_id, provider_key, capability_key, subject_kind, subject_ref, observed_at, facts, facts_digest, standing_authorization_id, invocation_id)
         values ($1,$2,'instagram','instagram.media.public.read','instagram-account',$3,$4,$5::jsonb,$8,$6,$7)`,
        [s.tenantId, randomUUID(), `instagram/account/${account}`, observedAt, JSON.stringify(facts), randomUUID(), randomUUID(), sha(JSON.stringify(facts))],
      );
      await setup.query("set session_replication_role = origin");
    };

    /* ── seed ─────────────────────────────────────────────────────────────────────────────── */
    const kilim = await draft(acme, "Kilim post", 3);
    await draft(acme, "Unpublished idea", 2);
    const other = await draft(acme, "Internal memo", 2, "message-draft");
    await publish(acme, kilim, 2, "111", "MEDIA-OLD", "2026-10-02T10:00:00.000Z"); // superseded revision
    await publish(acme, kilim, 3, "111", "MEDIA-NEW", "2026-10-05T10:00:00.000Z"); // current revision
    await observe(acme, "111", "2026-10-06T06:00:00.000Z", [
      { id: "MEDIA-NEW", likes: 5, comments: 2 },
      { id: "MEDIA-OLD", likes: 0, comments: null },
    ]);
    const rival = await draft(globex, "Globex launch", 1);
    await publish(globex, rival, 1, "999", "MEDIA-GLOBEX", "2026-10-03T10:00:00.000Z");
    await observe(globex, "999", "2026-10-06T06:00:00.000Z", [{ id: "MEDIA-GLOBEX", likes: 42, comments: 7 }]);
    void other;

    const counts = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await setup.query(`select count(*)::int n from ${t}`)).rows[0].n])));
    const before = await counts();

    const run = async (s: SeededLocalIdentity | null) =>
      runHebyReadCommand({ commandId: "performance", args: [], route: "/heby" }, { resolveTenant: async () => (s ? asTenant(s) : null) });

    /* ── A–C: Acme ────────────────────────────────────────────────────────────────────────── */
    const a = await run(acme);
    assert.equal(a.status, "ok");
    if (a.status !== "ok") throw new Error("unreachable");
    const text = a.result.lines.join("\n");
    assert.equal(a.result.tone, "info");
    assert.ok(text.includes("Instagram media MEDIA-OLD") && text.includes("“Kilim post” revision 2 (superseded)"), "the superseded revision's post is found");
    assert.ok(text.includes("Instagram media MEDIA-NEW") && text.includes("“Kilim post” revision 3 (current)"));
    assert.ok(/MEDIA-OLD[^\n]*likes 0 · comments not reported/.test(text), "zero stays 0, a withheld count stays 'not reported'");
    assert.ok(/MEDIA-NEW[^\n]*likes 5 · comments 2 · as of 2026-10-06 06:00 UTC \(stored media observation/.test(text), "provider, type and instant on every metric");
    assert.ok(text.indexOf("MEDIA-NEW") < text.indexOf("MEDIA-OLD"), "newest publication first");
    assert.ok(!text.includes("Unpublished idea") && !text.includes("Internal memo"), "unpublished revisions and non-content artifacts say nothing");
    assert.ok(!text.includes("GLOBEX") && !text.includes("Globex"), "no foreign tenant's row");
    assert.ok(text.includes("Not a rate, a score or a judgement of the post."), "the existing non-claim");
    assert.ok(!/only the newest|could not be read/i.test(text), "a complete, readable answer claims no gap");
    assert.match(a.result.provenance, /no provider was contacted, nothing was written, and nothing here was sent to a model/);

    /* ── D: Globex, and nobody ────────────────────────────────────────────────────────────── */
    const g = await run(globex);
    assert.ok(g.status === "ok");
    const gText = g.status === "ok" ? g.result.lines.join("\n") : "";
    assert.ok(gText.includes("MEDIA-GLOBEX") && gText.includes("likes 42 · comments 7"));
    assert.ok(!gText.includes("MEDIA-OLD") && !gText.includes("MEDIA-NEW") && !gText.includes("Kilim"));
    assert.deepEqual(await run(null), { status: "unauthorized" });

    /* ── E: nothing written ───────────────────────────────────────────────────────────────── */
    assert.deepEqual(await counts(), before, "the read wrote nothing");

    console.log("heby-observed-performance-read-1 postgres checks passed");
  } finally {
    await handle.dispose().catch(() => undefined);
    await setup.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
