/*
 * V1-STAGE-3 — notifications are a read-time projection. The module and the page write nothing,
 * store nothing, send nothing (no mail, Resend, webhook or provider transport), read no mock, start
 * no timer or worker, take nothing from the URL, and reach Governance only through the released
 * resolver. The top-bar bell is a plain link to the center.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const code = (f: string) => readFileSync(path.join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SERVER = code("src/features/notifications/notifications.server.ts");
const PAGE = code("src/app/(dashboard)/notifications/page.tsx");

for (const [name, src] of [["server", SERVER], ["page", PAGE]] as const) {
  assert.ok(!/\.(insert|update|delete)\(|\.transaction\(|"use server"|<form|\binsert into\b|\bupdate\s+"|\bdelete from\b/i.test(src), `${name}: no write`);
  assert.ok(!/resend|nodemailer|smtp|webhook|fetch\(|mock|setInterval|setTimeout|cron|queue/i.test(src), `${name}: no channel, mock, timer or worker`);
}
const imports = [...SERVER.matchAll(/^import [^;]*? from "([^"]+)";/gm)].map((m) => m[1]).sort();
assert.deepEqual(imports, [
  "@/db/client.server",
  "@/features/action-authorization/awaiting-decision-aggregate.server",
  "@/features/action-execution/contracts",
  "@/features/auth/tenant/tenant-context",
  "@/features/governance-decision/authority-read.server",
  "@/features/instagram-publishing/contracts",
  "@/features/youtube-publishing/contracts",
  "drizzle-orm",
], "released readers and constants only");
assert.match(SERVER, /where "tenant_id" = \$\{tenant\.tenantId\}/, "the attempt aggregate carries the session tenant");
assert.match(SERVER, /if \(authority\.authorized !== true\) return \{ status: "not-addressed" \};/, "addressed to the Governance authority only");
assert.ok(!/canonical_payload|target_ref|provider_message_id|recipient|failure_class|"title"/.test(SERVER), "no identifying column is selected");
assert.match(PAGE, /readNotifications\(await resolveTenantContext\(\)\)/, "the page passes only the server-resolved session");
assert.ok(!/searchParams|params/.test(PAGE), "the page takes nothing from the URL");
const TOPBAR = code("src/components/layout/topbar.tsx");
assert.match(TOPBAR, /<Link\s+href="\/notifications"\s+aria-label="Notifications"/, "the bell links to the center");
assert.ok(!/Notifications — coming soon/.test(TOPBAR), "the disabled placeholder is gone");
console.log("PASS v1 notifications firewall");
