/*
 * Membership–Role Tenant Integrity — the invariant, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A membership's role must belong to the same tenant as the membership, and PostgreSQL is what
 *    says so. A same-tenant pair is accepted, a membership with no role is still accepted, and every
 *    route to a cross-tenant pair — insert, update of the role, update of the tenant, direct SQL that
 *    bypasses every application reader — is refused by `memberships_tenant_role_fk` specifically and
 *    not by some unrelated constraint. Nothing about role provisioning, membership authorization,
 *    onboarding, sign-in or lifecycle changes."
 *
 * WHY A DATABASE TEST AND NOT A UNIT TEST. The invariant is a relational fact. A TypeScript assertion
 * would prove that one caller checks it; only the database can prove that no caller can avoid it,
 * which is the entire claim being made.
 *
 * Uses a disposable local database created and destroyed through the ownership handle.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";

/** The one constraint this phase added. Named once, asserted everywhere. */
const CONSTRAINT = "memberships_tenant_role_fk";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_membership_role_integrity");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* Two tenants, each with its own owner human and its own owner role. */
    const A = await seedLocalIdentity(setup, {
      companyName: "Acme", companySlug: "acme", email: "owner@acme.test",
    });
    const B = await seedLocalIdentity(setup, {
      companyName: "Globex", companySlug: "globex", email: "owner@globex.test",
    });

    /* ══ THE CONSTRAINT EXISTS, AND IS THE SHAPE THAT WAS AUTHORIZED ═════════ */
    {
      const fk = await setup.query<{
        conname: string; contype: string; confdeltype: string; confupdtype: string;
        parent: string; child_cols: string; parent_cols: string;
      }>(`
        select c.conname,
               c.contype,
               c.confdeltype,
               c.confupdtype,
               cf.relname as parent,
               (select string_agg(a.attname, ',' order by k.ord)
                  from unnest(c.conkey) with ordinality k(attnum, ord)
                  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as child_cols,
               (select string_agg(a.attname, ',' order by k.ord)
                  from unnest(c.confkey) with ordinality k(attnum, ord)
                  join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as parent_cols
          from pg_constraint c
          join pg_class cl on cl.oid = c.conrelid
          join pg_class cf on cf.oid = c.confrelid
         where cl.relname = 'memberships' and c.conname = $1
      `, [CONSTRAINT]);

      assert.equal(fk.rows.length, 1, "the constraint exists exactly once");
      const row = fk.rows[0]!;
      assert.equal(row.contype, "f", "it is a FOREIGN KEY");
      assert.equal(row.child_cols, "tenant_id,role_id", "child side pairs the tenant with the role");
      assert.equal(row.parent, "roles");
      assert.equal(row.parent_cols, "tenant_id,id", "parent side is the tenant-scoped role identity");
      assert.equal(row.confdeltype, "r", "ON DELETE restrict — the same as every sibling role FK");
      assert.equal(row.confupdtype, "a", "ON UPDATE no action — no cascade was introduced");
    }

    /* ══ THE PARENT SIDE NEEDED NO CHANGE — it already existed ═══════════════ */
    {
      const parent = await setup.query<{ conname: string }>(`
        select c.conname from pg_constraint c
          join pg_class cl on cl.oid = c.conrelid
         where cl.relname = 'roles' and c.contype = 'u' and c.conname = 'roles_tenant_id_id_uq'
      `);
      assert.equal(
        parent.rows.length, 1,
        "roles_tenant_id_id_uq is what makes the composite reference legal, and it predates this phase",
      );
    }

    /* ══ THE PRE-EXISTING SINGLE-COLUMN FK WAS NOT REMOVED ═══════════════════ */
    {
      const old = await setup.query<{ conname: string }>(`
        select c.conname from pg_constraint c
          join pg_class cl on cl.oid = c.conrelid
         where cl.relname = 'memberships' and c.conname = 'memberships_role_id_roles_id_fk'
      `);
      assert.equal(
        old.rows.length, 1,
        "the weaker constraint stays — this phase adds, it does not drop",
      );
    }

    /* ══ POSITIVE 1: a same-tenant pair is accepted ══════════════════════════ */
    const userA2 = await setup.query<{ id: string }>(
      `insert into users (email, name) values ('second@acme.test','Second') returning id`,
    );
    const roleA2 = await setup.query<{ id: string }>(
      `insert into roles (tenant_id, name, type) values ($1,'Analyst','operator') returning id`,
      [A.tenantId],
    );
    {
      const inserted = await setup.query<{ id: string }>(
        `insert into memberships (tenant_id, user_id, role_id, status)
         values ($1,$2,$3,'active') returning id`,
        [A.tenantId, userA2.rows[0]!.id, roleA2.rows[0]!.id],
      );
      assert.equal(inserted.rows.length, 1, "a membership whose role is its own tenant's is accepted");
    }

    /* ══ POSITIVE 2: a membership with NO role is still accepted ═════════════ */
    {
      const roleless = await setup.query<{ id: string }>(
        `insert into users (email, name) values ('roleless@globex.test','Roleless') returning id`,
      );
      const inserted = await setup.query<{ id: string }>(
        `insert into memberships (tenant_id, user_id, role_id, status)
         values ($1,$2,null,'active') returning id`,
        [B.tenantId, roleless.rows[0]!.id],
      );
      assert.equal(
        inserted.rows.length, 1,
        "MATCH SIMPLE exempts a NULL role — the resolver's 'no role' refusal stays reachable",
      );
      await setup.query(`delete from memberships where id=$1`, [inserted.rows[0]!.id]);
      await setup.query(`delete from users where id=$1`, [roleless.rows[0]!.id]);
    }

    /* ══ NEGATIVE 1: INSERT of a cross-tenant pair is refused ════════════════ */
    {
      const stranger = await setup.query<{ id: string }>(
        `insert into users (email, name) values ('stranger@globex.test','Stranger') returning id`,
      );
      await assert.rejects(
        setup.query(
          `insert into memberships (tenant_id, user_id, role_id, status) values ($1,$2,$3,'active')`,
          [B.tenantId, stranger.rows[0]!.id, roleA2.rows[0]!.id],
        ),
        (error: Error & { code?: string; constraint?: string }) => {
          assert.equal(error.code, "23503", "a foreign key violation, not a check or unique failure");
          assert.equal(error.constraint, CONSTRAINT, "and specifically THIS constraint");
          return true;
        },
        "a membership in tenant B may not be created with tenant A's role",
      );
      await setup.query(`delete from users where id=$1`, [stranger.rows[0]!.id]);
    }

    /* ══ NEGATIVE 2: UPDATE of role_id to a foreign tenant's role is refused ═ */
    {
      await assert.rejects(
        setup.query(`update memberships set role_id=$1 where id=$2`, [roleA2.rows[0]!.id, B.membershipId]),
        (error: Error & { code?: string; constraint?: string }) => {
          assert.equal(error.code, "23503");
          assert.equal(error.constraint, CONSTRAINT);
          return true;
        },
        "an existing membership may not be re-pointed at another tenant's role",
      );
      /* The row is untouched. */
      const after = await setup.query<{ role_id: string }>(
        `select role_id from memberships where id=$1`, [B.membershipId],
      );
      assert.equal(after.rows[0]!.role_id, B.roleId, "the refused update changed nothing");
    }

    /* ══ NEGATIVE 3: moving the TENANT while keeping the role is refused ═════ */
    {
      await assert.rejects(
        setup.query(`update memberships set tenant_id=$1 where id=$2`, [B.tenantId, A.membershipId]),
        (error: Error & { code?: string; constraint?: string }) => {
          assert.equal(error.code, "23503");
          assert.equal(error.constraint, CONSTRAINT);
          return true;
        },
        "the invariant binds BOTH columns — moving the tenant alone is refused too",
      );
    }

    /* ══ NEGATIVE 4: no session, no ORM, no application code involved ════════ */
    {
      /*
       * The point of the whole phase. This connection has full SQL privileges, holds no session,
       * passes through no reader, and still cannot construct the row.
       */
      await assert.rejects(
        setup.query(`
          update memberships
             set role_id = (select id from roles where tenant_id = $1 limit 1)
           where tenant_id = $2
        `, [A.tenantId, B.tenantId]),
        (error: Error & { constraint?: string }) => {
          assert.equal(error.constraint, CONSTRAINT);
          return true;
        },
        "direct SQL cannot bypass a relational invariant — that is why it is not a TypeScript check",
      );
    }

    /* ══ NEGATIVE 5: a role deletion that a membership depends on is refused ═ */
    {
      await assert.rejects(
        setup.query(`delete from roles where id=$1`, [roleA2.rows[0]!.id]),
        (error: Error & { code?: string }) => {
          assert.equal(error.code, "23503", "ON DELETE restrict, exactly as the sibling role FKs do");
          return true;
        },
        "no CASCADE was introduced — a role in use cannot be deleted out from under a membership",
      );
    }

    /* ══ LIFECYCLE IS UNCHANGED ═════════════════════════════════════════════ */
    {
      /* Revoking, suspending and soft-deleting a membership are all still legal. */
      const target = await setup.query<{ id: string }>(
        `select id from memberships where tenant_id=$1 and role_id=$2`,
        [A.tenantId, roleA2.rows[0]!.id],
      );
      const id = target.rows[0]!.id;
      await setup.query(
        `update memberships set status='revoked', revoked_at=now(), revocation_reason='test' where id=$1`,
        [id],
      );
      await setup.query(`update memberships set status='suspended', revoked_at=null, revocation_reason=null where id=$1`, [id]);
      await setup.query(`update memberships set lifecycle_status='deleted' where id=$1`, [id]);
      await setup.query(`update memberships set lifecycle_status='active', status='active' where id=$1`, [id]);
      const restored = await setup.query<{ status: string; lifecycle_status: string }>(
        `select status, lifecycle_status from memberships where id=$1`, [id],
      );
      assert.equal(restored.rows[0]!.status, "active");
      assert.equal(restored.rows[0]!.lifecycle_status, "active");
      /* And the version column is untouched by the constraint. */
      await setup.query(`update memberships set version = version + 1 where id=$1`, [id]);
    }

    /* ══ ROLE PROVISIONING STILL WORKS, INCLUDING THE I1.1 UNIQUENESS RULE ═══ */
    {
      const provisioned = await setup.query<{ id: string }>(
        `insert into roles (tenant_id, name, type) values ($1,'Member','member') returning id`,
        [B.tenantId],
      );
      assert.equal(provisioned.rows.length, 1, "a tenant may still be given its member role");
      await assert.rejects(
        setup.query(`insert into roles (tenant_id, name, type) values ($1,'Second','member')`, [B.tenantId]),
        /roles_one_member_per_tenant_uq/,
        "I1.1's one-member-role invariant is untouched",
      );
      /* And that freshly provisioned role can immediately carry a membership in its own tenant. */
      const newcomer = await setup.query<{ id: string }>(
        `insert into users (email, name) values ('newcomer@globex.test','Newcomer') returning id`,
      );
      const membership = await setup.query<{ id: string }>(
        `insert into memberships (tenant_id, user_id, role_id, status)
         values ($1,$2,$3,'active') returning id`,
        [B.tenantId, newcomer.rows[0]!.id, provisioned.rows[0]!.id],
      );
      assert.equal(membership.rows.length, 1, "provision-then-onboard still works end to end");
    }

    /* ══ THE SIBLING TENANT-ROLE CONSTRAINTS ARE UNCHANGED ══════════════════ */
    {
      const siblings = await setup.query<{ conname: string }>(`
        select c.conname
          from pg_constraint c
          join pg_class cl on cl.oid = c.conrelid
          join pg_class cf on cf.oid = c.confrelid
         where cf.relname = 'roles' and c.contype = 'f'
         order by c.conname
      `);
      const names = siblings.rows.map((r) => r.conname);
      for (const expected of [
        "invitations_tenant_role_fk",
        "membership_authorizations_tenant_role_fk",
        "role_permissions_tenant_role_fk",
        "memberships_role_id_roles_id_fk",
        CONSTRAINT,
      ]) {
        assert.ok(names.includes(expected), `roles must still be referenced by ${expected}`);
      }
      assert.equal(
        names.filter((n) => n === CONSTRAINT).length, 1,
        "exactly one new reference was added",
      );
    }

    /* ══ THE INVARIANT HOLDS FOR EVERY ROW THAT EXISTS ══════════════════════ */
    {
      const violations = await setup.query<{ c: string }>(`
        select count(*)::text as c
          from memberships m join roles r on r.id = m.role_id
         where m.tenant_id is distinct from r.tenant_id
      `);
      assert.equal(Number(violations.rows[0]!.c), 0, "no surviving cross-tenant pair, by construction");
    }

    console.log("PASS membership-role tenant integrity (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
