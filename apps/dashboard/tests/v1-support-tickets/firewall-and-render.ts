/*
 * V1-STAGE-5 — support tickets create no authority and reach no channel. The ticket module writes
 * only its own table and audits through its governance-audit sibling; status is gated by the
 * released Governance resolver; the action boundary exposes exactly two writes and takes no tenant
 * or user from the client; nothing imports a mail, DM, webhook or provider transport. The forms
 * render identically in every zone, and the input rules hold.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NewTicketForm, TicketStatusControl } from "../../src/components/support-tickets/ticket-forms";
import { normalizeDescription, normalizeTitle } from "../../src/features/support-tickets/contracts";

const ROOT = path.resolve(__dirname, "../..");
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SERVER = codeOf(read("src/features/support-tickets/support-tickets.server.ts"));
const AUDIT = codeOf(read("src/features/governance-audit/support-ticket-audit.server.ts"));
const writes = [...SERVER.matchAll(/\.(insert|update|delete)\(\s*([a-zA-Z]+)\s*\)/g)].map((m) => `${m[1]}(${m[2]})`);
assert.deepEqual(writes, ["insert(supportTickets)", "update(supportTickets)"], "the ticket module writes only its own table");
assert.deepEqual([...AUDIT.matchAll(/\.(insert|update|delete)\(\s*(\w+)\s*\)/g)].map((m) => `${m[1]}(${m[2]})`), ["insert(auditLog)"], "the sibling appends to the shared sink only");
assert.ok(!/title|description/.test(AUDIT), "the audit row never carries ticket text");
assert.equal((SERVER.match(/recordSupportTicketEventWithin\(/g) ?? []).length, 2, "both writes audit, inside their transaction");
assert.match(SERVER, /import \{ resolveGovernanceAuthority \} from "@\/features\/governance-decision\/authority-read\.server"/, "status is gated by the released Governance resolver");
const tenantPredicates = SERVER.match(/eq\(supportTickets\.tenantId, tenant\.tenantId\)/g) ?? [];
assert.equal(tenantPredicates.length, 3, "read, lock and update each carry the session tenant");
assert.match(SERVER, /\.values\(\{ tenantId: tenant\.tenantId,/, "the insert carries the session tenant");
for (const forbidden of ["resend", "nodemailer", "imap", "instagram", "webhook", "fetch(", "heby-action-inlet", "membership-authority", "governance-decision/decide", "governance-decision/bootstrap"]) {
  assert.ok(!SERVER.toLowerCase().includes(forbidden), `the ticket module does not reach ${forbidden}`);
}
const ACTIONS = codeOf(read("src/app/(dashboard)/tickets/actions.ts"));
assert.deepEqual([...ACTIONS.matchAll(/export async function (\w+)/g)].map((m) => m[1]), ["createSupportTicketAction", "changeSupportTicketStatusAction"], "two actions, two writes");
assert.ok(!/tenantId|userId/.test(ACTIONS.replace(/resolveTenantContext/g, "")), "the actions take no tenant or user from the client");
console.log("ok firewall: own table and shared audit sink only; tenant in every query; Governance-gated status; no channel");

assert.deepEqual(normalizeTitle("  Rug   late "), { ok: true, value: "Rug late" });
assert.deepEqual(normalizeDescription(" a\r\nb "), { ok: true, value: "a\nb" });
for (const bad of ["", "   ", "a\nb", "x".repeat(201), "a‮b", "a​b", 7, undefined]) assert.deepEqual(normalizeTitle(bad), { ok: false }, JSON.stringify(bad));
for (const bad of ["", "  ", "y".repeat(5001), "a\u0007b", null]) assert.deepEqual(normalizeDescription(bad), { ok: false }, JSON.stringify(bad));
console.log("ok input rules: one-line title ≤200, description ≤5000, no control or bidi/zero-width characters");

const markups = ["UTC", "Europe/Istanbul", "America/Los_Angeles"].map((z) => {
  process.env.TZ = z;
  return renderToStaticMarkup(createElement("div", null, createElement(NewTicketForm), createElement(TicketStatusControl, { ticketId: "00000000-0000-4000-8000-000000000005", status: "open", version: 1 })));
});
assert.equal(new Set(markups).size, 1);
assert.ok(markups[0]!.includes("File ticket") && markups[0]!.includes("Waiting on customer"));
console.log("ok render: the forms render identically in every zone");
console.log("PASS v1 support tickets firewall and render");
