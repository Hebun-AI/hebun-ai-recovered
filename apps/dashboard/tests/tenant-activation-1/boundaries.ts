/*
 * TENANT-ACTIVATION-1 — "awaiting platform review" is derived wording, and `--pending` is a read.
 *
 *   1 · the derivation is true only when both authoritative reads succeeded and both say so
 *   2 · Organization Readiness words the wait only when told `true`; otherwise the released row
 *   3 · the genesis page derives the block from the two reads and offers no new control
 *   4 · the genesis read is tenant-scoped and selects one column
 *   5 · `--pending` runs read-only, nominates nobody, prompts for nothing, and stays out of `src/`
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  GENESIS_ACTIVATION_STEPS,
  isAwaitingPlatformReview,
  type GenesisActivationOrigin,
  type GenesisNominationLookup,
} from "../../src/features/governance-genesis/contracts";
import {
  describeOrganizationReadiness,
  type OrganizationReadinessFacts,
} from "../../src/features/organization-readiness/organization-readiness";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const code = (p: string): string =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel);
    return e.isFile() && /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });
}

/* 1 ─ derivation */
{
  const selfService: GenesisActivationOrigin = { status: "read", selfService: true };
  const operatorBorn: GenesisActivationOrigin = { status: "read", selfService: false };
  const unreadable: GenesisActivationOrigin = { status: "unavailable" };
  const none: GenesisNominationLookup = { status: "read", nomination: null };
  const pending: GenesisNominationLookup = {
    status: "read",
    nomination: {
      nominationId: "n",
      status: "pending",
      nominatedAt: "2026-10-23T00:00:00.000Z",
      acceptedAt: null,
      viewerIsNominatedHuman: true,
    },
  };
  const down: GenesisNominationLookup = { status: "unavailable", reason: "persistence-unavailable" };

  assert.equal(isAwaitingPlatformReview(selfService, none), true);
  assert.equal(isAwaitingPlatformReview(operatorBorn, none), false, "an operator-born tenant is not 'awaiting review'");
  assert.equal(isAwaitingPlatformReview(selfService, pending), false, "a nomination ends the wait");
  assert.equal(isAwaitingPlatformReview(unreadable, none), false, "an unreadable origin is never a claim");
  assert.equal(isAwaitingPlatformReview(selfService, down), false, "an unreadable nomination is never a claim");
  assert.equal(GENESIS_ACTIVATION_STEPS.length, 4);
  assert.ok(Object.isFrozen(GENESIS_ACTIVATION_STEPS));
  assert.match(GENESIS_ACTIVATION_STEPS[0]!, /platform operator reviews/);
  assert.ok(!GENESIS_ACTIVATION_STEPS.some((s) => /\b(minutes|hours|days|email you|notify)\b/i.test(s)), "no timeframe or notification is promised");
}

/* 2 ─ readiness wording */
{
  const base: Omit<OrganizationReadinessFacts, "governance"> = {
    externalAi: { status: "absent" },
    modelDispatch: "permitted",
    capabilities: { status: "read", available: [], unavailableCount: 0 },
    publishing: { status: "read", tenantArming: "never-armed", effectiveSend: "blocked" },
    workDomains: { status: "read", count: 0 },
  };
  const row = (governance: OrganizationReadinessFacts["governance"]) =>
    describeOrganizationReadiness({ ...base, governance }).find((r) => r.key === "governance")!;

  const awaiting = row({ status: "read", established: false, viewerIsAuthority: false, awaitingPlatformReview: true });
  assert.equal(awaiting.state, "not-ready");
  assert.match(awaiting.facts, /created through sign-up and is awaiting platform review/);
  assert.equal(awaiting.next?.actor, "platform-operator");
  assert.equal(awaiting.next?.href, "/governance/genesis");

  const released = row({ status: "read", established: false, viewerIsAuthority: false });
  const unknownOrigin = row({ status: "read", established: false, viewerIsAuthority: false, awaitingPlatformReview: false });
  assert.deepEqual(unknownOrigin, released, "false and absent both keep the released row");
  assert.doesNotMatch(released.facts, /awaiting platform review/);

  const established = row({ status: "read", established: true, viewerIsAuthority: true, awaitingPlatformReview: true });
  assert.equal(established.state, "ready", "an established Governance is ready whatever the origin");
}

/* 3 ─ the page derives, the card offers no new control */
{
  const page = code("src/app/(dashboard)/governance/genesis/page.tsx");
  assert.match(page, /readGenesisActivationOrigin\(tenant\)/, "origin is read for the session's tenant");
  assert.match(page, /isAwaitingPlatformReview\(origin, lookup\)\s*\?\s*\{ kind: "awaiting-platform-review" \}\s*:\s*\{ kind: "no-nomination" \}/);
  const card = code("src/components/governance-genesis/genesis-acceptance-card.tsx");
  const notice = card.slice(card.indexOf("function AwaitingPlatformReviewNotice"), card.indexOf("function BlockNotice"));
  assert.ok(notice.length > 0);
  assert.ok(!/<button|<Button|onClick|<form|Action\(|href=/.test(notice), "the wait offers no control");
  assert.match(notice, /GENESIS_ACTIVATION_STEPS\.map/, "the steps are rendered from the frozen list");
  assert.equal((card.match(/acceptGenesisNominationAction\(/g) ?? []).length, 1, "still exactly one action call");
}

/* 4 ─ the genesis read */
{
  const acceptance = code("src/features/governance-genesis/genesis-acceptance.server.ts");
  const fn = acceptance.slice(acceptance.indexOf("export async function readGenesisActivationOrigin"), acceptance.indexOf("export async function acceptGenesisNomination"));
  assert.match(fn, /\.select\(\{ provisioningSource: companies\.provisioningSource \}\)/, "one column");
  assert.match(fn, /\.where\(eq\(companies\.id, tenant\.tenantId\)\)/, "the session's tenant only");
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|transaction\(/.test(fn), "the read writes nothing");
}

/* 5 ─ `--pending` */
{
  const lib = code("scripts/lib/nominate-genesis-human.ts");
  const list = lib.slice(lib.indexOf("export async function listPendingSelfServiceTenants"));
  assert.match(list, /client\.query\("begin transaction read only"\)/, "read-only by the database");
  assert.match(list, /finally \{\s*await client\.query\("rollback"\);/, "always rolled back");
  assert.ok(!/insert into|update \w+ set|delete from/i.test(list), "the listing has no write statement");
  assert.match(list, /g\.status <> 'revoked'/, "a revoked nomination frees the slot, like the index");

  const cli = code("scripts/genesis-nominate.ts");
  const branch = cli.slice(cli.indexOf("if (listPending) {"), cli.indexOf("const target = await resolveNominationTarget"));
  assert.match(branch, /printPendingSelfServiceTenants\(client\)[\s\S]*return;/, "the listing returns before the ceremony");
  const printer = cli.slice(cli.indexOf("async function printPendingSelfServiceTenants"), cli.indexOf("main().catch"));
  assert.ok(!/nominateGenesisHuman|promptVisible|resolveNominationTarget/.test(printer), "listing nominates nobody and prompts for nothing");
  assert.ok(cli.indexOf("preflight(client, environment.posture") < cli.indexOf("if (listPending) {"), "the listing runs after target verification");

  for (const file of collect("src")) {
    assert.ok(!/listPendingSelfServiceTenants|PendingSelfServiceTenant|--pending/.test(read(file)), `${file} must not reach the operator listing`);
  }
}

console.log("PASS tenant-activation-1 boundaries");
