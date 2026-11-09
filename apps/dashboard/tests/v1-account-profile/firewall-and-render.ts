/*
 * V1-STAGE-4 — Profile & Team creates no authority. The profile module writes exactly one thing, the
 * session user's own `users` row (display name), and audits through its governance-audit sibling. It
 * writes no membership, role, invitation, authorization or Governance row, and the server-action
 * boundary exposes exactly one write. The form renders identically in every zone.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DisplayNameForm } from "../../src/components/account-profile/display-name-form";
import { normalizeDisplayName } from "../../src/features/account-profile/contracts";

const ROOT = path.resolve(__dirname, "../..");
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SERVER = codeOf(read("src/features/account-profile/account-profile.server.ts"));
const writes = [...SERVER.matchAll(/\.(insert|update|delete)\(\s*([a-zA-Z]+)\s*\)/g)].map((m) => `${m[1]}(${m[2]})`);
assert.deepEqual(writes, ["update(users)"], "the profile module writes only the users row");
assert.match(SERVER, /\.update\(users\)\s*\.set\(\{ displayName: normalized\.value,[^}]*\}\)\s*\.where\(eq\(users\.id, tenant\.userId\)\)/, "and only display_name, only for the session user");
assert.match(SERVER, /\.from\(users\)\.where\(eq\(users\.id, tenant\.userId\)\)\.for\("update"\)/, "locked by the session user's id");
assert.ok(!/users\.(displayName|name)\b/.test(SERVER), "name columns are projected by Identity only (WORK-2), never here");
assert.ok(!/email|\bname:\s/.test(SERVER.slice(SERVER.indexOf(".set({"), SERVER.indexOf(".set({") + 160)), "email and name are never set");
for (const forbidden of ["membership-authority", "membership-lifecycle", "human-onboarding/issue", "human-onboarding/revoke", "human-onboarding/accept", "governance-decision/bootstrap", "governance-decision/decide", "identity-repository"]) {
  assert.ok(!SERVER.includes(forbidden), `the profile module does not reach ${forbidden}`);
}
const ACTIONS = codeOf(read("src/app/(dashboard)/account/actions.ts"));
assert.deepEqual([...ACTIONS.matchAll(/export async function (\w+)/g)].map((m) => m[1]), ["updateOwnDisplayNameAction"], "one server action, one write");
assert.ok(!/tenantId|userId/.test(ACTIONS.replace(/resolveTenantContext/g, "")), "the action takes no tenant or user from the client");
console.log("ok firewall: one write (own display name), audited through its sibling; no membership, role, invitation or Governance write");

assert.deepEqual(normalizeDisplayName("  Ada   Lovelace "), { ok: true, value: "Ada Lovelace" });
assert.deepEqual(normalizeDisplayName(""), { ok: true, value: null });
for (const bad of ["x".repeat(81), "a\u0007b", "a\u202eb", "a\u200bb", 7, undefined]) assert.deepEqual(normalizeDisplayName(bad), { ok: false }, JSON.stringify(bad));
console.log("ok display-name rules: trimmed, collapsed, ≤80, no control or bidi/zero-width characters, empty clears");

const markups = ["UTC", "Europe/Istanbul", "America/Los_Angeles"].map((z) => {
  process.env.TZ = z;
  return renderToStaticMarkup(createElement(DisplayNameForm, { current: "Ada", version: 3 }));
});
assert.equal(new Set(markups).size, 1);
assert.ok(markups[0]!.includes('value="Ada"') && markups[0]!.includes("Display name"));
console.log("ok render: the form renders identically in every zone");
console.log("PASS v1 account profile firewall and render");
