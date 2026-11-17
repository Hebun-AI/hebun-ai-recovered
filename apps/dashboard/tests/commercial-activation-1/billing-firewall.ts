/*
 * COMMERCIAL-ACTIVATION-1 — source firewall. The properties that keep payment the only way to Pro.
 *
 *   F1 Only `billing/billing.server.ts` writes `companies.plan` at runtime; tenant birth may write
 *      only the literal `free`, only for self-service signup.
 *   F2 The plan actions take no input: a client cannot name a tenant, a price or a plan.
 *   F3 No client component imports billing or Stripe code (the secret key is server-only).
 *   F4 The webhook route authenticates by signature: it is in the machine-ingress list, NOT in the
 *      human public list, and it reads no session.
 *   F5 The pricing page and the enforced cap read the same constants (no hand-copied numbers).
 *   F6 Finance and People routes render the retired-domain notice, never their mock children.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}
const src = walk("src");

/* F1 */
const planWriters = src.filter((f) => /\.update\(companies\)[\s\S]{0,200}?plan\s*:/.test(read(f)));
assert.deepEqual(planWriters, ["src/features/billing/billing.server.ts"], "F1 only the Stripe sync updates companies.plan");
const planInserts = src.filter((f) => /plan\s*:\s*"(free|pro|founding)"/.test(read(f)) && /\.insert\(companies\)/.test(read(f)));
assert.deepEqual(planInserts, ["src/features/tenant-provisioning/provision-tenant.server.ts"], "F1 only tenant birth inserts a plan");
const provision = read("src/features/tenant-provisioning/provision-tenant.server.ts");
assert.ok(/TENANT_PROVISIONING_SOURCE_SELF_SERVICE \? \{ plan: "free" \} : \{\}/.test(provision), "F1 birth writes only free, only for self-service");
assert.ok(!/plan: "pro"/.test(provision), "F1 birth never writes pro");
console.log("ok F1 plan writers");

/* F2 */
const actions = read("src/app/(dashboard)/account/plan/actions.ts");
assert.ok(/export async function startProCheckoutAction\(\): Promise<void>/.test(actions), "F2 checkout action takes no input");
assert.ok(/export async function openBillingPortalAction\(\): Promise<void>/.test(actions), "F2 portal action takes no input");
assert.ok(/startProCheckout\(await resolveTenantContext\(\)\)/.test(actions), "F2 the tenant comes from the session");
console.log("ok F2 actions take no client input");

/* F3 */
const clientFiles = src.filter((f) => /^\s*["']use client["']/m.test(read(f)));
for (const f of clientFiles) {
  assert.ok(!/features\/billing|stripe-api|HEBUN_STRIPE/.test(read(f)), `F3 ${f} must not reach billing code`);
}
console.log(`ok F3 ${clientFiles.length} client files reach no billing code`);

/* F4 */
const middleware = read("src/middleware.ts");
const machine = middleware.slice(middleware.indexOf("const MACHINE_INGRESS_PATHS"), middleware.indexOf("];", middleware.indexOf("const MACHINE_INGRESS_PATHS")));
assert.ok(machine.includes('"/api/billing/stripe/webhook"'), "F4 webhook is machine ingress");
assert.ok(/const PUBLIC_EXACT_PATHS = \["\/", "\/verify-email"\];/.test(middleware), "F4 the human exact list is unchanged");
const route = read("src/app/api/billing/stripe/webhook/route.ts");
assert.ok(/request\.text\(\)/.test(route) && /stripe-signature/.test(route), "F4 raw body and signature header");
assert.ok(!/resolveTenantContext|cookies\(/.test(route), "F4 the webhook reads no session");
const billing = read("src/features/billing/billing.server.ts");
const verifyAt = billing.indexOf("verifyStripeSignature(rawBody");
const parseAt = billing.indexOf("JSON.parse(rawBody)");
assert.ok(verifyAt > 0 && parseAt > verifyAt, "F4 the signature is verified before the body is parsed");
assert.ok(/eq\(billingAccounts\.stripeCustomerId, customerId\)/.test(billing), "F4 tenant resolved by the stored customer binding");
assert.ok(!/metadata\??\.\s*hebun_tenant_id|\.metadata\b/.test(billing.slice(billing.indexOf("export async function processStripeWebhook"))), "F4 the webhook never trusts metadata");
console.log("ok F4 webhook authenticated by signature, tenant by binding");

/* F5 */
const pricing = read("src/app/(public)/pricing/page.tsx");
assert.ok(/COMMERCIAL_PLAN_LIMITS/.test(pricing) && !/\b(15|100) per day\b/.test(pricing), "F5 pricing renders the constants, not literals");
assert.ok(/COMMERCIAL_PLAN_LIMITS\[plan\]\[dispatchClass\]/.test(read("src/features/tenant-entitlements/tenant-dispatch-ceiling.server.ts")), "F5 the ceiling reads the same constants");
assert.ok(/resolveTenantDispatchCeiling\(handle, input\.tenantId/.test(read("src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server.ts")), "F5 the cap admits against that ceiling");
console.log("ok F5 published limits are the enforced limits");

/* F6 */
for (const [dir, label] of [["finance", "Finance"], ["hr", "People"]] as const) {
  const layout = read(`src/app/(dashboard)/${dir}/layout.tsx`);
  assert.ok(new RegExp(`<RetiredDomainNotice domain="${label}" />`).test(layout) && !/children/.test(layout), `F6 /${dir} renders no mock children`);
}
console.log("ok F6 Finance and People show no fictional data");

console.log("PASS commercial-activation-1 billing firewall");
