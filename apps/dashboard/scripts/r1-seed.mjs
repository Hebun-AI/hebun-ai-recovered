/*
 * R1 local pilot seed (browser proof only). Idempotently seeds two tenants with
 * a full local-identity chain into the database named by DATABASE_URL:
 *   company (tenant) -> user -> auth_identity(provider='local') -> role -> membership
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:55432/hebun_r1 node scripts/r1-seed.mjs
 *
 * Never run against a shared/production database. Intended for the isolated local
 * throwaway cluster used to demonstrate the R1 durable proof in a browser.
 */

import { Client } from "pg";

const TENANTS = [
  { companyName: "Acme", slug: "acme", email: "alice@acme.test", userName: "Alice" },
  { companyName: "Globex", slug: "globex", email: "bob@globex.test", userName: "Bob" },
];

async function seedTenant(client, tenant) {
  const company = await client.query(
    `insert into companies (name, slug, plan, tenant_status)
     values ($1, $2, 'free', 'active')
     on conflict (slug) do update set name = excluded.name
     returning id`,
    [tenant.companyName, tenant.slug],
  );
  const tenantId = company.rows[0].id;

  const user = await client.query(
    `insert into users (email, name)
     values ($1, $2)
     on conflict (email) do update set name = excluded.name
     returning id`,
    [tenant.email, tenant.userName],
  );
  const userId = user.rows[0].id;

  await client.query(
    `insert into auth_identities
       (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now())
     on conflict (provider, issuer, subject)
       do update set status = 'active', verified_at = now()`,
    [userId, `local:${tenant.email}`],
  );

  const existingRole = await client.query(
    `select id from roles where tenant_id = $1 and name = 'Owner' limit 1`,
    [tenantId],
  );
  const roleId = existingRole.rows[0]
    ? existingRole.rows[0].id
    : (
        await client.query(
          `insert into roles (tenant_id, name, type)
           values ($1, 'Owner', 'owner') returning id`,
          [tenantId],
        )
      ).rows[0].id;

  await client.query(
    `insert into memberships (tenant_id, user_id, role_id, status)
     values ($1, $2, $3, 'active')
     on conflict (tenant_id, user_id)
       do update set role_id = excluded.role_id, status = 'active'`,
    [tenantId, userId, roleId],
  );

  return { tenantId, email: tenant.email };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const host = new URL(connectionString).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    console.error(`Refusing to seed a non-local host: ${host}`);
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const tenant of TENANTS) {
      const seeded = await seedTenant(client, tenant);
      console.log(`seeded tenant ${tenant.slug} (${seeded.tenantId}) — ${seeded.email}`);
    }
    console.log("r1 seed complete");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
