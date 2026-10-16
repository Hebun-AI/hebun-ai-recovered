/*
 * HEBY-PERFORMANCE-COMPARISON-1 — `/performance` against a real PostgreSQL database.
 *
 *   A. The title names the session tenant's organization, read through the Organization authority;
 *      another tenant's session gets its own name and never the first one's.
 *   B. Instagram change comes from IG-AN3 through `PublicationMeasurement.evolution`: with two stored
 *      media observations the printed change is the two observations' counts, verbatim.
 *   C. Elapsed times are drawn from the ledger's publication instant and the stored observation.
 *   D. The read writes nothing.
 *
 * Seeding helpers are copied from HOPR-1's postgres test (they are not exported there). Disposable
 * database, dropped on exit. No provider.
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
  const harness = createDisposablePostgresHarness("hebun_hpc1_performance");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  try {
    harness.migrateDatabase();
    await setup.connect();
    process.env.DATABASE_URL = harness.dbUrl;
    const acme = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-hpc1", email: "a@hpc1.test" });
    const globex = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-hpc1", email: "g@hpc1.test" });

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
    const kilim = await draft(acme, "Kilim post", 2);
    await publish(acme, kilim, 1, "111", "MEDIA-OLD", "2026-10-02T10:00:00.000Z"); // superseded revision
    await publish(acme, kilim, 2, "111", "MEDIA-NEW", "2026-10-05T10:00:00.000Z"); // current revision
    await observe(acme, "111", "2026-10-06T06:00:00.000Z", [
      { id: "MEDIA-NEW", likes: 5, comments: 2 },
      { id: "MEDIA-OLD", likes: 0, comments: null },
    ]);
    await observe(acme, "111", "2026-10-07T06:30:00.000Z", [
      { id: "MEDIA-NEW", likes: 8, comments: 2 },
      { id: "MEDIA-OLD", likes: 0, comments: 1 },
    ]);
    const rival = await draft(globex, "Globex launch", 1);
    await publish(globex, rival, 1, "999", "MEDIA-GLOBEX", "2026-10-03T10:00:00.000Z");
    await observe(globex, "999", "2026-10-06T06:00:00.000Z", [{ id: "MEDIA-GLOBEX", likes: 42, comments: 7 }]);

    const counts = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await setup.query(`select count(*)::int n from ${t}`)).rows[0].n])));
    const before = await counts();
    const run = async (s: SeededLocalIdentity) =>
      runHebyReadCommand({ commandId: "performance", args: [], route: "/heby" }, { resolveTenant: async () => asTenant(s) });

    /* ── A–C: Acme ────────────────────────────────────────────────────────────────────────── */
    const a = await run(acme);
    assert.ok(a.status === "ok");
    if (a.status !== "ok") throw new Error("unreachable");
    assert.equal(a.result.title, "Publication performance · Acme", "the session tenant's organization, by name");
    const text = a.result.lines.join("\n");
    assert.equal(a.result.lines[0], "Instagram", "grouped by provider");
    const newLine = a.result.lines.find((l) => l.includes("MEDIA-NEW"))!;
    const oldLine = a.result.lines.find((l) => l.includes("MEDIA-OLD"))!;
    assert.match(newLine, /likes 8 · comments 2 · as of 2026-10-07 06:30 UTC/);
    assert.match(newLine, /Between the two newest stored media observations \(2026-10-06 06:00 UTC → 2026-10-07 06:30 UTC\): likes 5 → 8 \(\+3\) · comments 2 → 2 \(0\)\./, "IG-AN3's change, verbatim");
    assert.match(newLine, /1 d 20 h after publication · observation age \d+ d \d+ h\./, "ledger publication → stored observation");
    assert.match(oldLine, /revision 1 \(superseded\)/);
    assert.match(oldLine, /likes 0 → 0 \(0\) · comments: Instagram did not report this count for this post in the earlier observation/, "a gap is IG-AN3's note, never a change from zero");
    assert.ok(!text.includes("GLOBEX") && !text.includes("Globex"));

    /* ── A: Globex sees its own name, never Acme's ────────────────────────────────────────── */
    const g = await run(globex);
    assert.ok(g.status === "ok" && g.result.title === "Publication performance · Globex");
    const gText = g.status === "ok" ? g.result.lines.join("\n") : "";
    assert.ok(gText.includes("MEDIA-GLOBEX") && !gText.includes("Acme") && !gText.includes("MEDIA-NEW"));
    assert.match(gText, /No change is shown: Hebun's two newest stored media observations do not both list this post\./, "one observation, no change");

    /* ── D: nothing written ───────────────────────────────────────────────────────────────── */
    assert.deepEqual(await counts(), before, "the read wrote nothing");

    console.log("heby-performance-comparison-1 postgres checks passed");
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
