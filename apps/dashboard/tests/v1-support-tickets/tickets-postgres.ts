/*
 * V1-STAGE-5 — Support tickets against a disposable PostgreSQL with the canonical migrations.
 * Acme: a director who holds Governance authority and an editor who does not. Globex: a director
 * with no Governance established. Synthetic identities only.
 *
 * Proves: any member files a ticket for their own tenant only, with one audit row (status and
 * version, never the text); members read only their own tenant's tickets; status changes are the
 * Governance authority's alone, locked, optimistic, audited from→to; a forged context mixing tenants
 * can neither read nor change another tenant's ticket; the schema refuses an unknown status.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { changeSupportTicketStatus, createSupportTicket, readSupportTickets } from "../../src/features/support-tickets/support-tickets.server";

interface Seeded { readonly tenantId: string; readonly userId: string; readonly authIdentityId: string; readonly membershipId: string; readonly roleId: string }
const JUSTIFICATION = "Establishing Governance for this organization is a deliberate act and I accept responsibility.";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("v1-support-tickets/tickets-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_v1_tickets");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
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
        mfaVerified: false, requestId: "v1-tickets-request", authenticatedAt: new Date().toISOString(),
      });
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme Rugs", companySlug: "acme-v1t", email: "director@acme.test", userName: "Ada Director" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-v1t", email: "director@globex.test", userName: "Gil Director" })) as Seeded;
    /* A second Acme member, an editor without Governance authority. */
    const editorUser = (await setup.query<{ id: string }>(`insert into users (email, name) values ('editor@acme.test','Eda Editor') returning id`)).rows[0]!.id;
    const editorIdentity = (await setup.query<{ id: string }>(
      `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at) values ($1,'local','hebun-local','local:editor@acme.test','active',true,now()) returning id`, [editorUser],
    )).rows[0]!.id;
    const editorRole = (await setup.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1,'Editor','member') returning id`, [acme.tenantId])).rows[0]!.id;
    const editorMembership = (await setup.query<{ id: string }>(
      `insert into memberships (tenant_id, user_id, role_id, status) values ($1,$2,$3,'active') returning id`, [acme.tenantId, editorUser, editorRole],
    )).rows[0]!.id;
    const editor: Seeded = { tenantId: acme.tenantId, userId: editorUser, authIdentityId: editorIdentity, membershipId: editorMembership, roleId: editorRole };

    const acmeCtx = ctxFor(acme, await session(acme, "a1"));
    const editorCtx = ctxFor(editor, await session(editor, "e1"));
    const globexCtx = ctxFor(globex, await session(globex, "b2"));
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, acmeCtx.sessionContextId],
    );
    assert.equal((await establishGovernanceAuthority(acmeCtx, { justification: JUSTIFICATION }, { getDb: () => handle.db })).status, "established");
    const deps = { getDb: () => handle.db, now: () => new Date("2026-11-10T09:00:00.000Z") };
    const audit = async (tenantId: string) =>
      (await setup.query<{ action: string; actor_id: string; entity_id: string; previous_state: unknown; next_state: unknown; metadata: unknown }>(
        `select action, actor_id, entity_id, previous_state, next_state, metadata from audit_log where tenant_id = $1 and entity_type = 'support_ticket' order by occurred_at, (next_state->>'version')::int`,
        [tenantId],
      )).rows;

    /* T1 — a plain member files a ticket for their own tenant; one audit row, no text in it. */
    const filed = await createSupportTicket(editorCtx, { title: "  Order  #1042 never arrived ", description: "Customer says the rug did not arrive.\r\nTracking shows delivered." }, deps);
    assert.equal(filed.status, "created");
    if (filed.status !== "created") throw new Error("unreachable");
    const row = (await setup.query(`select tenant_id, title, description, status, version, created_by from support_tickets where id = $1`, [filed.ticketId])).rows[0];
    assert.deepEqual(row, { tenant_id: acme.tenantId, title: "Order #1042 never arrived", description: "Customer says the rug did not arrive.\nTracking shows delivered.", status: "open", version: 1, created_by: editor.userId });
    const a1 = await audit(acme.tenantId);
    assert.equal(a1.length, 1);
    assert.deepEqual([a1[0]!.action, a1[0]!.actor_id, a1[0]!.entity_id, a1[0]!.next_state], ["support-ticket.created", editor.userId, filed.ticketId, { status: "open", version: 1 }]);
    assert.ok(!JSON.stringify(a1).includes("1042") && !JSON.stringify(a1).includes("rug"), "T1: the audit row carries no ticket text");
    for (const bad of [{ title: "", description: "x" }, { title: "x", description: "  " }, { title: "a\nb", description: "x" }, { title: "x".repeat(201), description: "x" }, { title: "x", description: "y".repeat(5001) }, { title: "a\u202eb", description: "x" }, { title: 7, description: "x" }]) {
      assert.deepEqual(await createSupportTicket(editorCtx, bad, deps), { status: "refused", reason: "invalid-input" }, JSON.stringify(bad));
    }
    await createSupportTicket(globexCtx, { title: "Globex question", description: "About invoices." }, deps);
    console.log("ok T1 member files for own tenant; one audit row without text; input rules");

    /* T2 — each tenant reads only its own tickets. */
    const acmeRead = await readSupportTickets(editorCtx, deps);
    assert.ok(acmeRead.status === "read" && acmeRead.tickets.length === 1 && acmeRead.tickets[0]!.filedByViewer && !acmeRead.viewerMayChangeStatus);
    const directorRead = await readSupportTickets(acmeCtx, deps);
    assert.ok(directorRead.status === "read" && directorRead.tickets.length === 1 && !directorRead.tickets[0]!.filedByViewer && directorRead.viewerMayChangeStatus);
    const globexRead = await readSupportTickets(globexCtx, deps);
    assert.ok(globexRead.status === "read" && globexRead.tickets.length === 1 && globexRead.tickets[0]!.title === "Globex question" && !globexRead.viewerMayChangeStatus);
    assert.deepEqual(await readSupportTickets(null, deps), { status: "unauthenticated" });
    console.log("ok T2 tenant-scoped reads; authority flag only for the Governance authority");

    /* T3 — status: Governance authority only; optimistic; audited from→to; unchanged refused. */
    const change = (ctx: TenantContext, status: string, expectedVersion: number, ticketId = filed.ticketId) => changeSupportTicketStatus(ctx, { ticketId, status, expectedVersion }, deps);
    assert.deepEqual(await change(editorCtx, "resolved", 1), { status: "refused", reason: "not-authorized" });
    assert.deepEqual(await change(globexCtx, "resolved", 1), { status: "refused", reason: "not-authorized" }, "T3: no Governance, no status change");
    assert.deepEqual(await change(acmeCtx, "in_progress", 1), { status: "updated", ticketId: filed.ticketId, version: 2 });
    assert.deepEqual(await change(acmeCtx, "resolved", 1), { status: "refused", reason: "stale-version" });
    assert.deepEqual(await change(acmeCtx, "in_progress", 2), { status: "refused", reason: "unchanged" });
    assert.deepEqual(await change(acmeCtx, "escalated", 2), { status: "refused", reason: "invalid-input" });
    assert.deepEqual(await change(acmeCtx, "resolved", 2), { status: "updated", ticketId: filed.ticketId, version: 3 });
    const a3 = await audit(acme.tenantId);
    assert.deepEqual(
      a3.map((r) => [r.action, r.actor_id, r.previous_state, r.next_state]),
      [
        ["support-ticket.created", editor.userId, null, { status: "open", version: 1 }],
        ["support-ticket.status-changed", acme.userId, { status: "open", version: 1 }, { status: "in_progress", version: 2 }],
        ["support-ticket.status-changed", acme.userId, { status: "in_progress", version: 2 }, { status: "resolved", version: 3 }],
      ],
      "T3: every state change and only those",
    );
    console.log("ok T3 status by Governance authority only, optimistic, audited from→to");

    /* T4 — a forged context mixing Acme's authority with Globex's tenant reaches nothing of Acme's. */
    const forged = asHumanTenantContext({ ...acmeCtx, tenantId: globex.tenantId });
    const forgedRead = await readSupportTickets(forged, deps);
    assert.ok(forgedRead.status === "read" && forgedRead.tickets.every((t) => t.title === "Globex question"), "T4: reads only the context tenant's rows");
    const globexTicket = (await setup.query<{ id: string }>(`select id from support_tickets where tenant_id = $1`, [globex.tenantId])).rows[0]!.id;
    assert.deepEqual(await change(acmeCtx, "closed", 1, globexTicket), { status: "refused", reason: "not-found" }, "T4: Acme's authority cannot touch Globex's ticket");
    assert.equal((await setup.query(`select status from support_tickets where id = $1`, [globexTicket])).rows[0]!.status, "open");
    console.log("ok T4 cross-tenant read and write refused");

    /* T5 — the schema refuses an unknown status and an empty title, whatever the writer. */
    for (const sql of [`update support_tickets set status = 'escalated' where id = '${filed.ticketId}'`, `update support_tickets set title = '' where id = '${filed.ticketId}'`]) {
      await assert.rejects(setup.query(sql), /violates check constraint/);
    }
    console.log("ok T5 schema CHECKs");
    finished = true;
    console.log("PASS v1 support tickets postgres");
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
