/*
 * V1-STAGE-6 — Plan & Usage is read only and invents no money. The read module and the page write
 * nothing, take no tenant from input, offer no action, and speak no price, invoice, payment or
 * plan-change vocabulary; the dispatch figure comes from the cap's own counter, not a copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const code = (f: string) => readFileSync(path.join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SERVER = code("src/features/plan-usage/plan-usage.server.ts");
const PAGE = code("src/app/(dashboard)/account/plan/page.tsx");
const CAP = code("src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts");

for (const [name, src] of [["server", SERVER], ["page", PAGE]] as const) {
  assert.ok(!/\.(insert|update|delete)\(|\.transaction\(|"use server"|<form|action=/.test(src), `${name}: no write, no action, no form`);
  assert.ok(!/[€£₺]|\$\d|\b(USD|EUR|TRY)\b|\b([Pp]rice|[Pp]ricing|[Ii]nvoice|[Aa]mount due|[Bb]alance|[Cc]heckout|[Ss]ubscribe|[Uu]pgrade)\b/.test(src), `${name}: no money or plan-change vocabulary`);
}
assert.match(SERVER, /eq\(memberships\.id, tenant\.membershipId\), eq\(memberships\.tenantId, tenant\.tenantId\), eq\(memberships\.userId, tenant\.userId\)/, "the plan is read through the session's own membership");
assert.match(PAGE, /readPlanAndUsage\(await resolveTenantContext\(\)\)/, "the page passes only the server-resolved session");
assert.ok(!/searchParams|params/.test(PAGE), "the page takes no tenant or period from the URL");
console.log("ok firewall: read only, session-keyed, no money vocabulary");

const reader = CAP.slice(CAP.indexOf("export async function readAiDispatchUsageToday"));
assert.match(reader, /admittedInWindow\(db, tenantId, dispatchClass, day\)/, "the reader uses the cap's own counter");
assert.ok(!/pg_advisory_xact_lock|\.transaction\(|commit\(/.test(reader), "the reader takes no lock and charges nothing");
console.log("ok reader: the cap's own count, no lock, no charge");
console.log("PASS v1 plan usage firewall");
