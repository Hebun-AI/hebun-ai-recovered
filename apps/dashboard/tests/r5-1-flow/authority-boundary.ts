/*
 * R5.1 — THE GLOBAL PROVIDER CONTROL AUTHORITY BOUNDARY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "No tenant-scoped role may mutate a root-scoped provider connectivity control — because the
 *    application holds no writer for it at all, not because the writer it holds refuses."
 *
 * ── WHY THE ASSERTION IS SHAPED THIS WAY ─────────────────────────────────────
 *
 * The obvious test is "call the server action as an owner and expect `forbidden`". That test cannot
 * be written, and its absence is the point: there is no action to call. R5.1 removed the write
 * CAPABILITY rather than re-gating it, so the claim to prove is a property of the code, not of an
 * authority decision. A refusal test would also rot — it only covers the callers that exist today.
 *
 * The five role bands still appear below, but as the reason rather than the mechanism: every
 * authority Hebun can resolve in-app is tenant-scoped, and the row is not.
 *
 * Structural assertions run over source with comments stripped: they are about what the code can
 * reach, not what its prose promises. The DB half runs against a disposable database.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { roleTypeEnum } from "../../src/db/schema/_enums";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });

const SRC_FILES = collect("src");
const SRC_CODE = SRC_FILES.map((f) => codeOf(read(f))).join("\n");

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE APPLICATION CANNOT WRITE THE CONTROL — the invariant itself.
 * ═════════════════════════════════════════════════════════════════════════ */
function applicationHoldsNoWriter(): void {
  /*
   * Asked as "which files write this table", not "who calls the writer". A caller census is only
   * true until the next file is added; this is true of the codebase.
   */
  const writers = SRC_FILES.filter((f) => {
    const code = codeOf(read(f));
    return (
      /\.insert\(\s*providerConnectivityControls/.test(code) ||
      /\.update\(\s*providerConnectivityControls/.test(code) ||
      /\.delete\(\s*providerConnectivityControls/.test(code) ||
      /insert\s+into\s+provider_connectivity_controls/i.test(code) ||
      /update\s+provider_connectivity_controls/i.test(code) ||
      /delete\s+from\s+provider_connectivity_controls/i.test(code)
    );
  });
  assert.deepEqual(
    writers,
    [],
    "no module under src may INSERT, UPDATE or DELETE provider_connectivity_controls",
  );

  /* No named write seam survives for a future caller to discover. */
  for (const seam of [
    "setClaudeDirectorEnabled",
    "setExternalSendDirectorEnabled",
    "setClaudeConnectivityAction",
    "setExternalSendConnectivityAction",
    "resolveProviderControlAuthority",
    "PROVIDER_CONTROL_ROLE_TYPES",
  ]) {
    assert.ok(!SRC_CODE.includes(seam), `${seam} must not exist anywhere under src`);
  }

  /* The repository interface itself is read-only. */
  const repoCode = codeOf(read("src/features/heby-provider-ops/provider-connectivity-control.server.ts"));
  assert.ok(repoCode.includes("getControl("), "the read seam remains");
  assert.ok(!repoCode.includes("setDirectorEnabled"), "the repository declares no write method");

  /* The files that carried the tenant-gated write are gone, not merely emptied. */
  for (const removed of [
    "src/app/(dashboard)/platform/actions.ts",
    "src/features/heby-provider-ops/provider-authority.server.ts",
  ]) {
    assert.ok(!existsSync(path.join(ROOT, removed)), `${removed} must no longer exist`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. WHY — a tenant-scoped authority may never gate a root-scoped row.
 *
 * These assertions are the REASON the writer left. If either half ever stops being true, the
 * decision deserves to be re-examined rather than silently inherited.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theReason(client: Client): Promise<void> {
  /* Every role band in the enum — none of them can exist without a tenant. */
  const bands = [...roleTypeEnum.enumValues];
  assert.deepEqual(
    [...bands].sort(),
    ["auditor", "director", "member", "operator", "owner"],
    "the role vocabulary is unchanged by R5.1",
  );

  const roleTenant = await client.query<{ is_nullable: string }>(
    `select is_nullable from information_schema.columns
      where table_name = 'roles' and column_name = 'tenant_id'`,
  );
  assert.equal(
    roleTenant.rows[0]?.is_nullable,
    "NO",
    "roles.tenant_id is NOT NULL — every in-app role band is tenant-scoped by schema",
  );

  const controlTenant = await client.query<{ n: string }>(
    `select count(*)::text as n from information_schema.columns
      where table_name = 'provider_connectivity_controls' and column_name = 'tenant_id'`,
  );
  assert.equal(
    controlTenant.rows[0]?.n,
    "0",
    "the control row has no tenant_id — one row governs every tenant",
  );

  /* And exactly one row can exist per provider key, which is what makes the blast radius global. */
  const unique = await client.query<{ indexdef: string }>(
    `select indexdef from pg_indexes
      where tablename = 'provider_connectivity_controls'
        and indexname = 'provider_connectivity_controls_provider_key_uq'`,
  );
  assert.ok(
    unique.rows[0]?.indexdef.includes("UNIQUE"),
    "provider_key is globally unique — one row per provider for the whole deployment",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE UI IS READ-ONLY, AND SAYS SO.
 *
 * A hidden control implies the viewer merely lacks a permission somebody else holds. Nobody holds
 * this one in-product, so a disabled button would be the lie.
 * ═════════════════════════════════════════════════════════════════════════ */
function uiIsHonestlyReadOnly(): void {
  for (const card of [
    "src/components/platform-providers/provider-connectivity-control-card.tsx",
    "src/components/platform-providers/external-send-arming-card.tsx",
  ]) {
    const code = codeOf(read(card));
    assert.ok(!/platform\/actions"/.test(code), `${card} imports no server action`);
    assert.ok(!code.includes("<Button"), `${card} renders no control at all — not even a disabled one`);
    assert.ok(
      code.includes("provider:connectivity"),
      `${card} names the ceremony that owns the change`,
    );
    /* It must not tell the viewer they lack a permission — nobody has it. */
    assert.ok(
      !/owner\/director only/.test(code),
      `${card} must not imply some other role could do this`,
    );
  }

  /* The route still renders both cards over the same projections — placement did not change. */
  const page = codeOf(read("src/app/(dashboard)/director/provider-matrix/page.tsx"));
  for (const kept of [
    "ProviderConnectivityControlCard",
    "ExternalSendArmingCard",
    "readProviderOpsView",
    "readExternalSendOpsView",
    "readRecordedProviderUsage",
  ]) {
    assert.ok(page.includes(kept), `the provider surface still renders ${kept}`);
  }
}

async function main(): Promise<void> {
  applicationHoldsNoWriter();
  uiIsHonestlyReadOnly();

  const harness = createDisposablePostgresHarness("hebun_r51_authority");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  try {
    harness.migrateDatabase();
    await client.connect();
    await theReason(client);
  } finally {
    await client.end().catch(() => undefined);
    await harness.dropDatabase();
  }

  console.log("R5.1 authority boundary: all assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
