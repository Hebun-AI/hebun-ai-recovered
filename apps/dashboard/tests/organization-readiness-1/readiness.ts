/*
 * ORGANIZATION-READINESS-1 — the readiness card is a read-only composition of released readers.
 * No database, no network.
 *
 *   1 · each row says `ready` only when its owning authority does; unreadable is `unknown`, never "no"
 *   2 · the composer asks every reader for the SESSION's tenant, and one failing reader is that row's
 *       `unknown` only
 *   3 · no writer, no provider, no credential, no control anywhere in the new files
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  describeOrganizationReadiness,
  type OrganizationReadinessFacts,
} from "../../src/features/organization-readiness/organization-readiness";
import { readOrganizationReadiness } from "../../src/features/organization-readiness/read-organization-readiness.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const code = (p: string): string =>
  readFileSync(path.join(ROOT, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const READY: OrganizationReadinessFacts = {
  governance: { status: "read", established: true, viewerIsAuthority: true },
  externalAi: { status: "active", purposes: ["assistance", "work-planning"] },
  modelDispatch: "permitted",
  capabilities: { status: "read", available: ["instagram.media.publish"], unavailableCount: 2 },
  publishing: { status: "read", tenantArming: "armed", effectiveSend: "reachable" },
  workDomains: { status: "read", count: 3 },
};
const state = (facts: OrganizationReadinessFacts) =>
  Object.fromEntries(describeOrganizationReadiness(facts).map((r) => [r.key, r.state]));

function describer(): void {
  assert.deepEqual(state(READY), { governance: "ready", "external-ai": "ready", integrations: "ready", publishing: "ready", "work-domains": "ready" });
  const ready = describeOrganizationReadiness(READY);
  assert.ok(ready.every((r) => r.next === null || r.key === "integrations"), "a ready row offers no next step (connecting more stays optional)");
  assert.match(ready[1]!.facts, /Authorized for: assistance, work-planning\./);

  /* A fresh self-service organization: nothing in place, and every next step names who can take it. */
  const fresh = describeOrganizationReadiness({
    governance: { status: "read", established: false, viewerIsAuthority: false },
    externalAi: { status: "absent" },
    modelDispatch: "permitted",
    capabilities: { status: "read", available: [], unavailableCount: 4 },
    publishing: { status: "read", tenantArming: "never-armed", effectiveSend: "blocked" },
    workDomains: { status: "read", count: 0 },
  });
  assert.ok(fresh.every((r) => r.state === "not-ready"), JSON.stringify(fresh));
  assert.deepEqual(fresh.map((r) => r.next?.actor), ["platform-operator", "governance-authority", "you", "platform-operator", "platform-operator"]);
  assert.equal(fresh[0]!.next?.href, "/governance/genesis");
  assert.equal(fresh[2]!.next?.href, "/integrations");

  /* Authorized, but the platform model is off: not ready, and the operator is named. */
  const off = describeOrganizationReadiness({ ...READY, modelDispatch: "blocked-by-director" });
  assert.equal(off[1]!.state, "not-ready");
  assert.equal(off[1]!.next?.actor, "platform-operator");

  /* Armed for the organization but off for the platform: still blocked, and said so. */
  const halfArmed = describeOrganizationReadiness({ ...READY, publishing: { status: "read", tenantArming: "armed", effectiveSend: "blocked" } });
  assert.equal(halfArmed[3]!.state, "not-ready");
  assert.match(halfArmed[3]!.facts, /switched off for the platform/);
  assert.equal(describeOrganizationReadiness({ ...READY, externalAi: { status: "withdrawn" } })[1]!.state, "not-ready");

  /* Unreadable is unknown, never "no", and offers no step. */
  const unreadable = describeOrganizationReadiness({
    governance: { status: "unavailable" },
    externalAi: { status: "unavailable" },
    modelDispatch: "unknown",
    capabilities: { status: "unavailable" },
    publishing: { status: "unavailable" },
    workDomains: { status: "unavailable" },
  });
  assert.ok(unreadable.every((r) => r.state === "unknown" && r.next === null), JSON.stringify(unreadable));
}

async function composer(): Promise<void> {
  const tenant = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "u" } as unknown as TenantContext;
  const asked: string[] = [];
  const deps = {
    readGovernance: (async (t: TenantContext) => {
      asked.push(`governance:${t.tenantId}`);
      return { status: "read", authority: { bootstrap: null, viewerIsGovernanceAuthority: false } };
    }) as never,
    readExternalAi: (async (tenantId: string) => {
      asked.push(`ai:${tenantId}`);
      throw new Error("down");
    }) as never,
    readModelOps: (async () => ({ dispatch: "permitted" })) as never,
    readCapabilities: (async (t: TenantContext) => {
      asked.push(`capabilities:${t.tenantId}`);
      return { readiness: "catalog-ready", capabilities: [{ capability: "b", state: "available" }, { capability: "a", state: "available" }, { capability: "c", state: "not-connected" }] };
    }) as never,
    readSendOps: (async (d: { tenantId: string }) => {
      asked.push(`send:${d.tenantId}`);
      return { tenantArming: "never-armed", effectiveSend: "blocked" };
    }) as never,
    readDomains: (async (t: TenantContext) => {
      asked.push(`domains:${t.tenantId}`);
      return { status: "refused", reason: "authority-unavailable" };
    }) as never,
  };
  const result = await readOrganizationReadiness(tenant, deps);
  assert.equal(result.status, "read");
  const rows = result.status === "read" ? result.rows : [];
  assert.deepEqual(asked.sort(), [
    `ai:${tenant.tenantId}`,
    `capabilities:${tenant.tenantId}`,
    `domains:${tenant.tenantId}`,
    `governance:${tenant.tenantId}`,
    `send:${tenant.tenantId}`,
  ], "every reader is asked for the session's tenant");
  assert.deepEqual(rows.map((r) => r.state), ["not-ready", "unknown", "ready", "not-ready", "unknown"], "a throwing reader is its own row's unknown only");
  assert.match(rows[2]!.facts, /^Available: a, b\. 1 more not available\.$/);
  assert.deepEqual(await readOrganizationReadiness(null, deps), { status: "unauthenticated" });
}

function boundaries(): void {
  const files = [
    "src/features/organization-readiness/organization-readiness.ts",
    "src/features/organization-readiness/read-organization-readiness.server.ts",
    "src/components/governance-authority/organization-readiness-card.tsx",
  ];
  for (const f of files) {
    const c = code(f);
    for (const banned of [
      ".insert(", ".update(", ".delete(", "@/db/", "drizzle-orm", "process.env", "fetch(",
      "authorizeTenantExternalAiDataUse", "armTenantExternalSend", "setProviderConnectivity", "recordWorkDomain",
      "establishGovernanceAuthority", "recordActionRequest", "credential-store", "readCredential",
    ]) {
      assert.ok(!c.includes(banned), `${f} must not reach ${banned}`);
    }
  }
  const card = code(files[2]!);
  assert.ok(!/"use client"|onClick|<button|<form|Action\(/.test(card), "the card offers no control");
  const page = code("src/app/(dashboard)/governance/authority/page.tsx");
  assert.match(page, /readOrganizationReadiness\(tenant\)/, "the page reads it for the session's tenant");
  assert.match(page, /<OrganizationReadinessCard rows=\{readiness\.rows\} \/>/);
}

async function main(): Promise<void> {
  describer();
  await composer();
  boundaries();
  console.log("PASS organization-readiness-1 describer, composer and boundaries");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
