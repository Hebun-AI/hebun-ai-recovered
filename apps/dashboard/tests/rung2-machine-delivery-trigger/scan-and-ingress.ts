/*
 * RUNG 2 — the automatic delivery trigger's BEHAVIOUR, with the executor and the register injected.
 *
 * WHAT THIS FILE PROVES:
 *
 *   "A scan takes no scope. It hands the executor a permit id and nothing else. It calls the
 *    executor once per candidate, in order, and never for zero candidates. One refusal, and even
 *    one THROW, does not stop the candidates after it. An unreadable register is reported as
 *    unavailable and never as an empty scan. The ingress refuses before the scan is started when
 *    the secret is unset, absent or wrong, and its body carries counts and refusal words — never a
 *    tenant, a permit, a payload or a work title."
 *
 * The database and the executor are FAKES here. What is real is the scan module, the route handler,
 * the contracts and the boundary between them. `delivery-postgres.ts` proves the discovery
 * predicate and the single spend against a real PostgreSQL.
 */
import assert from "node:assert/strict";

/*
 * IMPORTED FIRST, AND DELIBERATELY. The schema barrel initialises `_base` lazily; reaching a table
 * module before the client has been loaded resolves `tenantColumns` to `undefined` at runtime. The
 * released suites all load this module ahead of any feature import for the same reason.
 */
import "../../src/db/client.server";

import {
  scanDeliverablePermits,
  type ScanDeliverablePermitsDeps,
} from "../../src/features/machine-delivery-trigger/scan-deliverable-permits.server";
import { MACHINE_DELIVERABLE_PERMIT_SCAN_LIMIT } from "../../src/features/action-authorization/read-machine-deliverable-permits.server";
import { classifyDeliveryOutcome } from "../../src/features/machine-delivery-trigger/contracts";
import type { MachineRecordWorkResult } from "../../src/features/governed-machine-execution/execute-record-work-as-machine.server";

const SECRET = "rung2-delivery-trigger-secret-value";

/**
 * A fake control plane whose ONLY job is to answer the reader's one query.
 *
 * The reader is the released module — not stubbed — so the drizzle call chain it builds is
 * exercised for real; only the terminal `limit()` resolves to fixture rows.
 */
function fakeDb(rows: readonly { permitId: string; tenantId: string }[] | "throw"): () => never {
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async (n: number) => {
      if (rows === "throw") throw new Error("control plane unreachable");
      return rows.slice(0, n);
    },
  };
  return (() => chain) as never;
}

const executed = (invocationId: string): MachineRecordWorkResult => ({
  status: "executed",
  permitId: "ignored",
  handoffId: "ignored",
  invocationId,
  agentId: "ignored",
  outcome: { status: "recorded" } as never,
});

async function scanWith(
  rows: readonly { permitId: string; tenantId: string }[] | "throw",
  execute: ScanDeliverablePermitsDeps["execute"],
  extra: Partial<ScanDeliverablePermitsDeps> = {},
) {
  return scanDeliverablePermits({ getDb: fakeDb(rows), execute, ...extra });
}

async function theScanCallsTheExecutorOncePerCandidate(): Promise<void> {
  /* ZERO CANDIDATES: the executor is never reached at all. */
  {
    let calls = 0;
    const result = await scanWith([], async () => {
      calls += 1;
      return executed("never");
    });
    assert.equal(calls, 0, "no candidates means the executor is not called");
    assert.deepEqual(
      result.status === "scanned" && [result.considered, result.attempted, result.delivered],
      [0, 0, 0],
      "and an empty scan reports zeroes, not an absence",
    );
  }

  /* ONE CANDIDATE: exactly one call, carrying exactly one field. */
  {
    const seen: unknown[] = [];
    const result = await scanWith([{ permitId: "p-1", tenantId: "t-1" }], async (input) => {
      seen.push(input);
      return executed("inv-1");
    });
    assert.deepEqual(seen, [{ permitId: "p-1" }], "ONLY the permit id crosses to the executor");
    assert.equal(
      Object.keys(seen[0] as object).length,
      1,
      "and it is the only key — no tenant travels, though the scan had one in hand",
    );
    assert.equal(result.status === "scanned" && result.delivered, 1);
    assert.deepEqual(
      result.status === "scanned" && result.outcomes[0],
      { permitId: "p-1", outcome: { status: "delivered", invocationId: "inv-1" } },
    );
  }

  /* N CANDIDATES: one call each, in the register's order. */
  {
    const order: string[] = [];
    const rows = ["p-a", "p-b", "p-c"].map((permitId) => ({ permitId, tenantId: "t" }));
    const result = await scanWith(rows, async ({ permitId }) => {
      order.push(permitId);
      return executed(`inv-${permitId}`);
    });
    assert.deepEqual(order, ["p-a", "p-b", "p-c"], "one call per candidate, in order");
    assert.equal(result.status === "scanned" && result.delivered, 3);
  }
}

async function oneBadCandidateDoesNotStopTheRest(): Promise<void> {
  /* A REFUSAL IS DATA. The candidates after it are still offered to the authority. */
  {
    const order: string[] = [];
    const rows = ["p-1", "p-2", "p-3"].map((permitId) => ({ permitId, tenantId: "t" }));
    const result = await scanWith(rows, async ({ permitId }) => {
      order.push(permitId);
      return permitId === "p-2"
        ? {
            status: "refused",
            reason: "machine-execution-not-reachable",
            authorityReason: "tenant-authorization-withdrawn",
          }
        : executed(`inv-${permitId}`);
    });
    assert.deepEqual(order, ["p-1", "p-2", "p-3"], "a refusal does not abort the tick");
    assert.equal(result.status === "scanned" && result.delivered, 2, "and only the spends count");
    assert.deepEqual(
      result.status === "scanned" && result.outcomes[1]!.outcome,
      {
        status: "refused",
        reason: "machine-execution-not-reachable",
        authorityReason: "tenant-authorization-withdrawn",
      },
      "the authority's own words are carried through, never collapsed",
    );
  }

  /* A THROW IS NOT A REFUSAL, and it does not abort the tick either. */
  {
    const order: string[] = [];
    const rows = ["p-1", "p-2", "p-3"].map((permitId) => ({ permitId, tenantId: "t" }));
    const result = await scanWith(rows, async ({ permitId }) => {
      order.push(permitId);
      if (permitId === "p-2") throw new Error("control plane vanished mid-spend");
      return executed(`inv-${permitId}`);
    });
    assert.deepEqual(order, ["p-1", "p-2", "p-3"], "a throw does not abort the tick");
    assert.deepEqual(
      result.status === "scanned" && result.outcomes[1]!.outcome,
      { status: "failed" },
      "and it is reported as `failed`, never as a refusal the system chose",
    );
    assert.equal(result.status === "scanned" && result.delivered, 2);
  }
}

async function unreadableIsNotEmpty(): Promise<void> {
  let calls = 0;
  const result = await scanWith("throw", async () => {
    calls += 1;
    return executed("never");
  });
  assert.deepEqual(
    result,
    { status: "unavailable", reason: "persistence-unavailable" },
    "an unreadable register is UNAVAILABLE — never `scanned` with zero candidates",
  );
  assert.equal(calls, 0, "and nothing was attempted");
}

async function theCeilingCannotBeRaised(): Promise<void> {
  /*
   * The limit is clamped DOWNWARD ONLY. A caller may ask for less work; asking for more yields the
   * constant. Proved through the released reader's own clamp, via the scan's forwarding.
   */
  const rows = Array.from({ length: 40 }, (_, i) => ({ permitId: `p-${i}`, tenantId: "t" }));

  const wide = await scanWith(rows, async () => executed("inv"), { limit: 10_000 });
  assert.equal(
    wide.status === "scanned" && wide.considered,
    MACHINE_DELIVERABLE_PERMIT_SCAN_LIMIT,
    "a caller cannot raise the scan ceiling above the released constant",
  );
  assert.ok(
    MACHINE_DELIVERABLE_PERMIT_SCAN_LIMIT < rows.length,
    "and the fixture is larger than the ceiling, so the clamp is what produced that number",
  );

  const narrow = await scanWith(rows, async () => executed("inv"), { limit: 3 });
  assert.equal(narrow.status === "scanned" && narrow.considered, 3, "but it may ask for less");

  const defaulted = await scanWith(rows, async () => executed("inv"));
  assert.equal(
    defaulted.status === "scanned" && defaulted.considered,
    MACHINE_DELIVERABLE_PERMIT_SCAN_LIMIT,
    "and omitting the limit entirely still bounds the tick",
  );
}

function theClassifierIsTotalAndDoesNotInterpret(): void {
  assert.deepEqual(classifyDeliveryOutcome(executed("inv-9")), {
    status: "delivered",
    invocationId: "inv-9",
  });
  assert.deepEqual(
    classifyDeliveryOutcome({ status: "refused", reason: "machine-execution-disarmed" }),
    { status: "refused", reason: "machine-execution-disarmed" },
    "a refusal without an authority reason does not grow one",
  );
  assert.deepEqual(
    classifyDeliveryOutcome({
      status: "refused",
      reason: "agent-not-in-service",
      authorityReason: "retired",
    }),
    { status: "refused", reason: "agent-not-in-service", authorityReason: "retired" },
  );
}

async function theIngressRefusesBeforeItScans(): Promise<void> {
  const { GET } = await import("../../src/app/api/machine-delivery/scan/route");
  const url = "https://hebun.test/api/machine-delivery/scan";

  /* UNSET SECRET REFUSES EVERYTHING — an unconfigured deployment is closed, never open. */
  delete process.env.HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET;
  for (const headers of [
    undefined,
    { authorization: `Bearer ${SECRET}` },
    { authorization: "Bearer " },
  ]) {
    const response = await GET(new Request(url, headers ? { headers } : {}));
    assert.equal(response.status, 401, "an unset secret refuses every request, correct bearer included");
  }

  /* CONFIGURED: absent, malformed, wrong-length and wrong-value headers all refuse alike. */
  process.env.HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET = SECRET;
  for (const headers of [
    undefined,
    { authorization: SECRET },
    { authorization: "Bearer" },
    { authorization: `Bearer ${SECRET}x` },
    { authorization: `Bearer ${SECRET.slice(0, -1)}` },
    { authorization: `Basic ${SECRET}` },
  ]) {
    const response = await GET(new Request(url, headers ? { headers } : {}));
    assert.equal(response.status, 401, `refused: ${JSON.stringify(headers)}`);
    assert.equal(await response.text(), "Unauthorized", "and the body hints at nothing");
  }
}

async function theIngressBodyCarriesNoScope(): Promise<void> {
  process.env.HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET = SECRET;
  /*
   * WITH A CORRECT BEARER AND NO CONTROL PLANE, the released route reaches its own scan, whose
   * released reader finds no database and reports `unavailable`. That is the honest 503 path, and
   * it proves the guard admits a correct bearer without needing a database to do it.
   */
  const { GET } = await import("../../src/app/api/machine-delivery/scan/route");
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await GET(
      new Request("https://hebun.test/api/machine-delivery/scan", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    assert.equal(response.status, 503, "a correct bearer is admitted; the register is what failed");
    const body = (await response.json()) as Record<string, unknown>;
    assert.deepEqual(
      body,
      { status: "unavailable", reason: "persistence-unavailable" },
      "and 'we could not find out' is never reported as 'nothing was deliverable'",
    );
    const serialized = JSON.stringify(body);
    for (const leak of ["tenant", "permit", "payload", "agent", "title", "@", SECRET]) {
      assert.ok(!serialized.includes(leak), `the response carries no ${leak}`);
    }
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
}

async function main(): Promise<void> {
  await theScanCallsTheExecutorOncePerCandidate();
  await oneBadCandidateDoesNotStopTheRest();
  await unreadableIsNotEmpty();
  await theCeilingCannotBeRaised();
  theClassifierIsTotalAndDoesNotInterpret();
  await theIngressRefusesBeforeItScans();
  await theIngressBodyCarriesNoScope();
  console.log(
    "rung2 machine delivery trigger — scan and ingress: one call per candidate, only a permit id " +
      "crosses, refusals and throws are isolated, unreadable != empty, ceiling cannot be raised, " +
      "unset/absent/wrong secret refused before any scan, no scope in the body",
  );
}

void main();
