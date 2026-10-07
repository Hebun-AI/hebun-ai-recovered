/*
 * AP-4 Release B preflight — READ-ONLY OPERATOR CHECK (AP-4A).
 *
 *   npm run platform:ap4-release-b-preflight
 *
 * Release B turns `record-work` strict: an agent must hold a declared responsibility, and a request
 * must carry a typed work scope. This answers, before B is pushed, whether that would take anything
 * away silently. It writes nothing: the session is set read-only before the first query, and every
 * query runs in a transaction that is rolled back.
 *
 *   CLEAR      every in-service agent whose effective mandate names `record-work` has at least one
 *              responsibility grant that still admits work (organization-level, or an in-service
 *              domain), AND no unscoped record-work item can still be decided or spent: no pending
 *              request, and no permit that is active and unexpired (see lib/ap4-release-b-blockers.ts
 *              for why approved requests with a consumed, revoked or expired permit are history).
 *   NOT CLEAR  anything else — each item is listed. Nothing is decided here; the Director resolves
 *              each one (a new mandate revision, rejecting a request, letting a permit expire) and
 *              re-runs this.
 *
 * Exit 0 only when CLEAR. Also checks that migration ap4a is applied.
 */
import { Client } from "pg";
import { readUnscopedRecordWorkPermitBlockers, readUnscopedRecordWorkRequestBlockers } from "./lib/ap4-release-b-blockers";

const AP4A_TAG = "20261007175237_ap4a_work_domain_foundation";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const problems: string[] = [];
  try {
    await client.query("set session characteristics as transaction read only");
    await client.query("begin");
    const ledger = (await client.query<{ n: number }>("select count(*)::int n from drizzle.__drizzle_migrations")).rows[0]!.n;
    const applied = (
      await client.query<{ n: number }>(`select count(*)::int n from information_schema.tables where table_name in ('work_domains','agent_mandate_responsibilities')`)
    ).rows[0]!.n;
    console.log(`\n  AP-4 RELEASE B PREFLIGHT (read-only)\n  ledger: ${ledger} · ${AP4A_TAG}: ${applied === 2 ? "applied" : "NOT APPLIED"}`);
    if (applied !== 2) problems.push("migration ap4a is not applied");
    else {
      const agents = (
        await client.query<{ slug: string; agent_id: string; name: string; revision: number; scope: string[]; admitting: number; grants: number }>(
          `with effective as (
             select distinct on (m.tenant_id, m.agent_id) m.tenant_id, m.agent_id, m.id, m.mandate_revision, m.proposal_scope
               from agent_mandates m order by m.tenant_id, m.agent_id, m.mandate_revision desc)
           select c.slug, a.id agent_id, a.name, e.mandate_revision revision, e.proposal_scope scope,
                  count(r.id)::int grants,
                  count(r.id) filter (where r.responsibility_kind = 'organization' or d.lifecycle_status = 'active')::int admitting
             from agents a
             join companies c on c.id = a.tenant_id
             join effective e on e.tenant_id = a.tenant_id and e.agent_id = a.id
             left join agent_mandate_responsibilities r on r.tenant_id = e.tenant_id and r.mandate_id = e.id
             left join work_domains d on d.tenant_id = r.tenant_id and d.id = r.work_domain_id
            where a.retired_at is null and a.deleted_at is null and 'record-work' = any(e.proposal_scope)
            group by c.slug, a.id, a.name, e.mandate_revision, e.proposal_scope
            order by c.slug, a.name`,
        )
      ).rows;
      console.log("\n  in-service agents whose effective mandate names record-work:");
      for (const a of agents) {
        const ok = a.admitting > 0;
        console.log(`    ${ok ? "ok  " : "FAIL"} ${a.slug}/${a.name} (${a.agent_id}) rev ${a.revision} · grants ${a.grants} · admitting ${a.admitting}`);
        if (!ok) problems.push(`${a.slug}/${a.agent_id}: record-work without an admitting responsibility`);
      }
      const requests = await readUnscopedRecordWorkRequestBlockers(client);
      const permits = await readUnscopedRecordWorkPermitBlockers(client);
      console.log("\n  unscoped live record-work items (Release B would refuse them):");
      if (requests.length + permits.length === 0) console.log("    none");
      for (const r of requests) {
        console.log(`    request ${r.slug}/${r.id} (${r.status === "approved" ? "approved, no permit" : r.status})`);
        problems.push(`request ${r.id} is ${r.status} and unscoped`);
      }
      for (const p of permits) {
        console.log(`    permit  ${p.slug}/${p.id} for request ${p.request}`);
        problems.push(`permit ${p.id} is live and unscoped`);
      }
    }
    await client.query("rollback");
  } finally {
    await client.end().catch(() => {});
  }
  console.log(`\n  VERDICT: ${problems.length === 0 ? "CLEAR" : `NOT CLEAR (${problems.length})`}\n`);
  if (problems.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\n  ✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
