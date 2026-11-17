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

/* The READ stays exactly as V1-STAGE-6 released it: no write, no action, no money. */
assert.ok(!/\.(insert|update|delete)\(|\.transaction\(|"use server"|<form|action=/.test(SERVER), "server: no write, no action, no form");
assert.ok(!/[€£₺]|\$\d|\b(USD|EUR|TRY)\b|\b([Pp]rice|[Pp]ricing|[Ii]nvoice|[Aa]mount due|[Bb]alance|[Cc]heckout|[Ss]ubscribe|[Uu]pgrade)\b/.test(SERVER), "server: no money or plan-change vocabulary");
/*
 * COMMERCIAL-ACTIVATION-1 (Director-approved): the PAGE gains exactly two forms, each posting to an
 * input-less server action in `./actions` (upgrade → Stripe Checkout, manage → Stripe Customer Portal).
 * The page itself still writes nothing and holds no server action of its own.
 */
assert.ok(!/\.(insert|update|delete)\(|\.transaction\(|"use server"/.test(PAGE), "page: no write and no inline server action");
assert.deepEqual(
  [...PAGE.matchAll(/<form action=\{(\w+)\}>/g)].map((m) => m[1]).sort(),
  ["openBillingPortalAction", "startProCheckoutAction"],
  "page: its only forms are the two billing actions",
);
assert.equal((PAGE.match(/<form/g) ?? []).length, 2, "page: no other form");
assert.match(SERVER, /eq\(memberships\.id, tenant\.membershipId\), eq\(memberships\.tenantId, tenant\.tenantId\), eq\(memberships\.userId, tenant\.userId\)/, "the plan is read through the session's own membership");
/* COMMERCIAL-ACTIVATION-1: the session is resolved once and passed to both reads; still never input. */
assert.match(PAGE, /const tenant = await resolveTenantContext\(\);/, "the page resolves the session server-side");
assert.match(PAGE, /readPlanAndUsage\(tenant\), readBillingState\(tenant\)/, "the page passes only the server-resolved session");
/*
 * COMMERCIAL-ACTIVATION-1: the URL carries one display word, `billing` (Stripe's return / a closed
 * refusal), looked up in a closed map and never echoed. No tenant, period or any other value is read.
 */
assert.deepEqual([...PAGE.matchAll(/params\.(\w+)/g)].map((m) => m[1]).sort(), ["billing", "billing"], "the page reads only `billing` from the URL");
assert.match(PAGE, /BILLING_NOTICE\[params\.billing\] : undefined/, "…and only as a key into the closed notice map");
assert.ok(!/params\.(tenant|tenantId|period|from|to|plan)\b/.test(PAGE), "the page takes no tenant or period from the URL");
console.log("ok firewall: read only, session-keyed, no money vocabulary");

const reader = CAP.slice(CAP.indexOf("export async function readAiDispatchUsageToday"));
assert.match(reader, /admittedInWindow\(db, tenantId, dispatchClass, day\)/, "the reader uses the cap's own counter");
assert.ok(!/pg_advisory_xact_lock|\.transaction\(|commit\(/.test(reader), "the reader takes no lock and charges nothing");
console.log("ok reader: the cap's own count, no lock, no charge");
console.log("PASS v1 plan usage firewall");
