/*
 * R2F.1 — recorded provider usage aggregation, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Totalling recorded provider usage returns exactly the tenant's own live-transport rows,
 *    excludes simulated and non-model rows, counts rows the provider did not fully report
 *    instead of summing them as zero, groups by provider / model / UTC calendar day, and
 *    writes nothing."
 *
 * The arithmetic is deliberately proven HERE rather than against a fake, because three of the
 * four things that could go wrong are properties of PostgreSQL and not of the TypeScript:
 * the `filter (where ...)` restriction on the sums, the `at time zone 'UTC'` day boundary, and
 * the driver returning `count()`/`sum()` as strings rather than numbers. A fake database would
 * have agreed with a wrong implementation on all three.
 *
 * Uses a disposable database, dropped on exit. Canonical is never opened. No provider, no network.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createControlPlaneDb } from "../../src/db/client.server";
import { readRecordedProviderUsage } from "../../src/features/heby-provider-ops/provider-usage-aggregation.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/** The minimum a TenantContext needs to be for a tenant-scoped read. */
function tenantContext(tenantId: string): TenantContext {
  return { tenantId, userId: "11111111-1111-1111-1111-111111111111" } as TenantContext;
}

async function seedCompany(client: Client, name: string, slug: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into companies (name, slug, plan, tenant_status)
     values ($1, $2, 'free', 'active')
     returning id`,
    [name, slug],
  );
  return row.rows[0]!.id;
}

async function seedConversation(client: Client, tenantId: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into conversations (tenant_id, subject) values ($1, $2) returning id`,
    [tenantId, "usage fixture"],
  );
  return row.rows[0]!.id;
}

interface MessageFixture {
  readonly tenantId: string;
  readonly conversationId: string;
  readonly origin: string;
  readonly transport: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  /** ISO-8601 with an explicit offset — the UTC day boundary cases depend on it. */
  readonly createdAt: string;
}

async function seedMessage(client: Client, fixture: MessageFixture): Promise<void> {
  await client.query(
    `insert into messages
       (tenant_id, conversation_id, role, content, origin, transport, provider, model,
        input_tokens, output_tokens, created_at)
     values ($1, $2, 'assistant', 'fixture', $3, $4, $5, $6, $7, $8, $9)`,
    [
      fixture.tenantId,
      fixture.conversationId,
      fixture.origin,
      fixture.transport,
      fixture.provider,
      fixture.model,
      fixture.inputTokens,
      fixture.outputTokens,
      fixture.createdAt,
    ],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r2f1_usage");
  await harness.createDatabase();
  const controlPlane = createControlPlaneDb(harness.dbUrl);
  const setup = new Client({ connectionString: harness.dbUrl });
  const getDb = () => controlPlane.db;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const alpha = await seedCompany(setup, "Alpha", "alpha");
    const beta = await seedCompany(setup, "Beta", "beta");
    const empty = await seedCompany(setup, "Empty", "empty");
    const alphaConv = await seedConversation(setup, alpha);
    const betaConv = await seedConversation(setup, beta);

    /* ── ALPHA: two fully measured live rows on two models, one live row the provider
          did not fully report, one SIMULATED row, one deterministic row. ───────────── */
    await seedMessage(setup, {
      tenantId: alpha, conversationId: alphaConv, origin: "model", transport: "live",
      provider: "claude", model: "claude-haiku-4-5", inputTokens: 100, outputTokens: 20,
      createdAt: "2026-08-10T09:00:00Z",
    });
    await seedMessage(setup, {
      tenantId: alpha, conversationId: alphaConv, origin: "model", transport: "live",
      provider: "claude", model: "claude-opus-4", inputTokens: 200, outputTokens: 30,
      createdAt: "2026-08-10T10:00:00Z",
    });
    /* The provider reported an input count and no output count. NOT zero — unknown. */
    await seedMessage(setup, {
      tenantId: alpha, conversationId: alphaConv, origin: "model", transport: "live",
      provider: "claude", model: "claude-haiku-4-5", inputTokens: 7777, outputTokens: null,
      createdAt: "2026-08-10T11:00:00Z",
    });
    /* The local dev-proof transport. Contacts no provider; its 0/0 is synthetic. */
    await seedMessage(setup, {
      tenantId: alpha, conversationId: alphaConv, origin: "model", transport: "fake",
      provider: "claude", model: "claude-haiku-4-5", inputTokens: 0, outputTokens: 0,
      createdAt: "2026-08-10T12:00:00Z",
    });
    /* A deterministic answer: no transport, no provider, no tokens. */
    await seedMessage(setup, {
      tenantId: alpha, conversationId: alphaConv, origin: "deterministic", transport: null,
      provider: null, model: null, inputTokens: null, outputTokens: null,
      createdAt: "2026-08-10T13:00:00Z",
    });

    /* ── BETA: one live row, so cross-tenant leakage would be unmistakable. ─────────── */
    await seedMessage(setup, {
      tenantId: beta, conversationId: betaConv, origin: "model", transport: "live",
      provider: "claude", model: "claude-haiku-4-5", inputTokens: 999, outputTokens: 111,
      createdAt: "2026-08-10T09:00:00Z",
    });

    /* ── D. AGGREGATION ARITHMETIC ─────────────────────────────────────────────────── */
    const alphaRead = await readRecordedProviderUsage(tenantContext(alpha), { getDb });
    assert.equal(alphaRead.status, "read", "an authorized tenant with a database can read");
    if (alphaRead.status !== "read") throw new Error("unreachable");
    const t = alphaRead.usage.totals;

    assert.equal(t.recordedCalls, 3, "3 live rows — the fake and deterministic rows are not usage");
    assert.equal(t.fullyMeasuredCalls, 2, "only 2 rows carry BOTH counts");
    assert.equal(t.unknownTokenRows, 1, "the half-reported row is counted, not summed");
    assert.equal(t.inputTokens, 300, "100 + 200; the unknown row's 7777 input is NOT included");
    assert.equal(t.outputTokens, 50, "20 + 30");
    assert.equal(t.totalTokens, 350, "the lower bound is the sum over fully measured rows only");
    assert.equal(
      t.recordedCalls,
      t.fullyMeasuredCalls + t.unknownTokenRows,
      "the contract invariant holds",
    );

    /* ── C. NULL SEMANTICS, STATED AS ITS OWN ASSERTION ────────────────────────────── */
    assert.notEqual(
      t.inputTokens,
      8077,
      "a half-measured row must not contribute its known half to the sum",
    );
    assert.ok(t.unknownTokenRows > 0, "the unmeasured row survives as a count rather than a zero");

    /* ── B. REAL-TRANSPORT FILTERING ───────────────────────────────────────────────── */
    assert.equal(
      alphaRead.usage.byModel.reduce((sum, g) => sum + g.recordedCalls, 0),
      3,
      "no simulated row entered any group",
    );

    /* ── A. TENANT ISOLATION ───────────────────────────────────────────────────────── */
    const betaRead = await readRecordedProviderUsage(tenantContext(beta), { getDb });
    assert.equal(betaRead.status, "read");
    if (betaRead.status !== "read") throw new Error("unreachable");
    assert.equal(betaRead.usage.totals.recordedCalls, 1, "Beta sees only its own row");
    assert.equal(betaRead.usage.totals.inputTokens, 999, "Beta's own input tokens");
    assert.equal(betaRead.usage.totals.outputTokens, 111, "Beta's own output tokens");
    assert.notEqual(
      betaRead.usage.totals.inputTokens,
      t.inputTokens + 999,
      "Alpha's tokens are absent from Beta's total",
    );
    assert.equal(
      t.recordedCalls + betaRead.usage.totals.recordedCalls,
      4,
      "the two tenants partition the live rows; neither sees the other's",
    );

    /* ── GROUPING: MODEL ───────────────────────────────────────────────────────────── */
    const haiku = alphaRead.usage.byModel.find((g) => g.key === "claude-haiku-4-5");
    const opus = alphaRead.usage.byModel.find((g) => g.key === "claude-opus-4");
    assert.ok(haiku, "the haiku group exists");
    assert.ok(opus, "the opus group exists");
    assert.equal(alphaRead.usage.byModel.length, 2, "exactly two models were used");
    assert.equal(haiku.recordedCalls, 2, "haiku: one measured + one unknown");
    assert.equal(haiku.fullyMeasuredCalls, 1);
    assert.equal(haiku.unknownTokenRows, 1);
    assert.equal(haiku.inputTokens, 100, "haiku's unknown row contributes no tokens");
    assert.equal(opus.recordedCalls, 1);
    assert.equal(opus.totalTokens, 230);
    assert.equal(
      alphaRead.usage.byModel[0]!.key,
      "claude-haiku-4-5",
      "by-volume ordering puts the busier model first",
    );

    /* ── GROUPING: PROVIDER ────────────────────────────────────────────────────────── */
    assert.equal(alphaRead.usage.byProvider.length, 1, "one provider so far");
    assert.equal(alphaRead.usage.byProvider[0]!.key, "claude");
    assert.equal(alphaRead.usage.byProvider[0]!.recordedCalls, 3);
    assert.equal(alphaRead.usage.byProvider[0]!.totalTokens, 350);

    /* ── E. EMPTY STATE ────────────────────────────────────────────────────────────── */
    const emptyRead = await readRecordedProviderUsage(tenantContext(empty), { getDb });
    assert.equal(emptyRead.status, "read", "a tenant with no usage still reads successfully");
    if (emptyRead.status !== "read") throw new Error("unreachable");
    assert.equal(emptyRead.usage.totals.recordedCalls, 0);
    assert.equal(emptyRead.usage.totals.totalTokens, 0);
    assert.deepEqual(emptyRead.usage.byModel, [], "no groups are invented");
    assert.deepEqual(emptyRead.usage.byDay, []);

    /* ── H. UTC DAY BOUNDARY ───────────────────────────────────────────────────────── *
     * The two rows below are 2 seconds apart and MUST land on different UTC days. Under a
     * local-timezone grouping in any zone west of UTC they would collapse into one day, and
     * in any zone east of UTC the first would move to the following day. Written with a
     * non-UTC offset on purpose so an implementation that merely trusted the literal fails.  */
    const boundary = await seedCompany(setup, "Boundary", "boundary");
    const boundaryConv = await seedConversation(setup, boundary);
    await seedMessage(setup, {
      tenantId: boundary, conversationId: boundaryConv, origin: "model", transport: "live",
      provider: "claude", model: "m", inputTokens: 1, outputTokens: 1,
      createdAt: "2026-03-01T20:59:59-03:00", // = 2026-03-01T23:59:59Z
    });
    await seedMessage(setup, {
      tenantId: boundary, conversationId: boundaryConv, origin: "model", transport: "live",
      provider: "claude", model: "m", inputTokens: 2, outputTokens: 2,
      createdAt: "2026-03-01T21:00:01-03:00", // = 2026-03-02T00:00:01Z
    });

    const boundaryRead = await readRecordedProviderUsage(tenantContext(boundary), { getDb });
    assert.equal(boundaryRead.status, "read");
    if (boundaryRead.status !== "read") throw new Error("unreachable");
    assert.equal(boundaryRead.usage.byDay.length, 2, "two seconds apart, two UTC days");
    assert.equal(boundaryRead.usage.byDay[0]!.key, "2026-03-02", "newest UTC day first");
    assert.equal(boundaryRead.usage.byDay[1]!.key, "2026-03-01");
    assert.equal(boundaryRead.usage.byDay[0]!.totalTokens, 4, "the later row is on 03-02");
    assert.equal(boundaryRead.usage.byDay[1]!.totalTokens, 2, "the earlier row is on 03-01");
    assert.equal(
      boundaryRead.usage.totals.totalTokens,
      6,
      "grouping does not change the tenant total",
    );

    /* ── J. THE READ WRITES NOTHING ────────────────────────────────────────────────── *
     * Counted across every table a usage read could plausibly touch, before and after.     */
    const countsBefore = await tableCounts(setup);
    await readRecordedProviderUsage(tenantContext(alpha), { getDb });
    await readRecordedProviderUsage(tenantContext(beta), { getDb });
    await readRecordedProviderUsage(tenantContext(empty), { getDb });
    const countsAfter = await tableCounts(setup);
    assert.deepEqual(countsAfter, countsBefore, "reading usage wrote nothing, anywhere");

    /* ── UNAUTHORIZED / UNCONFIGURED ───────────────────────────────────────────────── */
    assert.deepEqual(
      await readRecordedProviderUsage(null, { getDb }),
      { status: "unavailable", reason: "no-authorized-tenant-context" },
      "no tenant context → refused, never a zero total",
    );
    assert.deepEqual(
      await readRecordedProviderUsage(tenantContext(alpha), { getDb: () => null }),
      { status: "unavailable", reason: "persistence-not-configured" },
      "no database → refused, never a zero total",
    );

    console.log("R2F.1 provider usage aggregation (postgres): OK");
  } finally {
    await setup.end().catch(() => {});
    await controlPlane.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

/** Row counts for every table a usage read could plausibly write to. */
async function tableCounts(client: Client): Promise<Record<string, number>> {
  const tables = [
    "messages",
    "conversations",
    "companies",
    "audit_log",
    "provider_connectivity_controls",
    "action_permits",
    "action_execution_attempts",
    "heby_action_requests",
    "telemetry_events",
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const row = await client.query<{ n: string }>(`select count(*)::text as n from "${table}"`);
    counts[table] = Number(row.rows[0]!.n);
  }
  return counts;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
