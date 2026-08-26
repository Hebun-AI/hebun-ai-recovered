/*
 * R7.1.1 — THE RECORDED ACT DRILL-THROUGH: SEMANTICS.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "`/audit` reports the acts Hebun recorded for the asking tenant, states the bound it applied
 *    whenever one bit, and keeps `nothing was recorded` and `Hebun could not look` apart."
 *
 * Injected end to end. No database, no network, no model, no clock read inside the seam.
 */
import assert from "node:assert/strict";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import { observeRecordedActHistory } from "../../src/features/governance-activity/observe.server";
import {
  RECORDED_ACT_HISTORY_BOUNDARY,
  RECORDED_ACT_PAGE_LIMIT,
  WITHHELD_AUDIT_COLUMNS,
  type RecordedAct,
  type RecordedActHistoryResult,
} from "../../src/features/governance-activity/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "10000000-0000-4000-8000-00000000a001" } as TenantContext;
const NOW = new Date("2026-08-26T12:00:00.000Z");

function act(overrides: Partial<RecordedAct> = {}): RecordedAct {
  return {
    occurredAt: "2026-08-26T11:00:00.000Z",
    action: "knowledge.ratify",
    entityType: "knowledge_fact",
    actorType: "human",
    result: "committed",
    source: "governance-authority",
    authoritySource: "membership",
    simulation: false,
    ...overrides,
  };
}

async function audit(history: RecordedActHistoryResult) {
  return runHebyReadCommand(
    { commandId: "audit", args: [], route: "/heby" },
    { resolveTenant: async () => TENANT, readActHistory: async () => history },
  );
}

function linesOf(result: Awaited<ReturnType<typeof audit>>): string[] {
  assert.equal(result.status, "ok");
  return result.status === "ok" ? [...result.result.lines] : [];
}

async function main(): Promise<void> {
  /* ── 1 · RECORDED — the acts are reported verbatim ───────────────────────── */
  {
    const result = await audit({
      status: "recorded",
      tenantId: TENANT.tenantId,
      generatedAt: NOW.toISOString(),
      page: { acts: [act()], totalRecordedActs: 1, truncated: false },
    });
    const body = linesOf(result).join("\n");
    assert.ok(/1 recorded act,/.test(body), "a single act is counted in the singular");
    assert.ok(body.includes("knowledge.ratify"), "the writer's own verb is reported verbatim");
    assert.ok(body.includes("knowledge_fact"), "and the entity KIND");
    assert.ok(body.includes("committed"), "and the stored result");
    assert.ok(body.includes("membership"), "and the authority source");
    assert.ok(!/showing/i.test(body), "an untruncated page does not claim truncation");
  }

  /* ── 2 · TRUNCATION IS STATED, NEVER SILENT ──────────────────────────────
   * The defect this phase exists to prevent: a bounded list that reads as completeness.
   */
  {
    const acts = Array.from({ length: RECORDED_ACT_PAGE_LIMIT }, (_, i) =>
      act({ occurredAt: `2026-08-26T10:${String(i).padStart(2, "0")}:00.000Z` }),
    );
    const result = await audit({
      status: "recorded",
      tenantId: TENANT.tenantId,
      generatedAt: NOW.toISOString(),
      page: { acts, totalRecordedActs: 137, truncated: true },
    });
    const body = linesOf(result).join("\n");
    assert.ok(
      body.includes(`Showing ${RECORDED_ACT_PAGE_LIMIT} of 137 recorded acts`),
      "a truncated page says exactly how many of how many it shows",
    );
  }

  /* ── 3 · EMPTY IS AN ESTABLISHED FACT, AND SAYS SO ───────────────────────── */
  {
    const body = linesOf(
      await audit({ status: "empty", tenantId: TENANT.tenantId, generatedAt: NOW.toISOString() }),
    ).join("\n");
    assert.ok(/recorded no acts/i.test(body), "it states the emptiness plainly");
    assert.ok(/not a read failure/i.test(body), "and distinguishes it from a failed read");
  }

  /* ── 4 · UNAVAILABLE IS NEVER RENDERED AS EMPTY ──────────────────────────
   * "Nothing was recorded" and "Hebun could not look" are different sentences. Collapsing them
   * would be Hebun asserting an organizational fact it never established.
   */
  {
    for (const reason of ["persistence-not-configured", "read-failed"] as const) {
      const result = await audit({ status: "unavailable", reason });
      assert.equal(result.status, "ok");
      if (result.status !== "ok") return;
      const body = result.result.lines.join("\n");
      assert.equal(result.result.tone, "unavailable", `${reason} is toned unavailable`);
      assert.ok(/UNKNOWN, not empty/i.test(body), `${reason} says UNKNOWN rather than empty`);
      assert.ok(
        !/recorded no acts|has no recorded/i.test(body),
        `${reason} must never claim nothing was recorded`,
      );
      assert.ok(body.includes(reason), "and names the reason");
    }
  }

  /* ── 5 · NO TENANT FAILS CLOSED, AT THE SEAM ─────────────────────────────
   * Asked of the seam itself, not only of the command: the guarantee belongs to the reader.
   */
  {
    const nothing = await observeRecordedActHistory(null);
    assert.equal(nothing.status, "unavailable");
    assert.equal(
      nothing.status === "unavailable" ? nothing.reason : "",
      "no-authorized-tenant-context",
    );

    const unauthorized = await runHebyReadCommand(
      { commandId: "audit", args: [], route: "/heby" },
      { resolveTenant: async () => null },
    );
    assert.equal(unauthorized.status, "unauthorized", "and the command refuses before reading");
  }

  /* ── 6 · A READ THAT THROWS BECOMES UNAVAILABLE, NEVER EMPTY ─────────────── */
  {
    const thrown = await observeRecordedActHistory(TENANT, {
      getDb: () => {
        throw new Error("connection refused");
      },
    });
    assert.equal(thrown.status, "unavailable", "a throwing read is unavailable");
    assert.notEqual(thrown.status, "empty");
  }

  /* ── 7 · A SIMULATED ACT IS LABELLED, NEVER PRESENTED AS REAL ────────────── */
  {
    const body = linesOf(
      await audit({
        status: "recorded",
        tenantId: TENANT.tenantId,
        generatedAt: NOW.toISOString(),
        page: { acts: [act({ simulation: true })], totalRecordedActs: 1, truncated: false },
      }),
    ).join("\n");
    assert.ok(/SIMULATED/.test(body), "a simulated act is marked");
    assert.ok(/no real effect occurred/i.test(body), "and says what that means");
  }

  /* ── 8 · NULLABLE COLUMNS ARE REPORTED, NEVER HIDDEN ─────────────────────
   * `source` and `authority_source` are both nullable. Dropping a null would make an act look
   * better-attributed than the ledger recorded it.
   */
  {
    const body = linesOf(
      await audit({
        status: "recorded",
        tenantId: TENANT.tenantId,
        generatedAt: NOW.toISOString(),
        page: {
          acts: [act({ source: null, authoritySource: null })],
          totalRecordedActs: 1,
          truncated: false,
        },
      }),
    ).join("\n");
    assert.ok(/no authority source recorded/i.test(body), "a null authority source is stated");
    assert.ok(/no source recorded/i.test(body), "and a null source is stated");
  }

  /* ── 9 · THE SURFACE NEVER PROMISES WHAT THE LEDGER CANNOT EVIDENCE ──────
   * `audit_log` records what AUTHORIZED actors did, so no reading of it can show an intrusion.
   */
  {
    const result = await audit({
      status: "recorded",
      tenantId: TENANT.tenantId,
      generatedAt: NOW.toISOString(),
      page: { acts: [act()], totalRecordedActs: 1, truncated: false },
    });
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    const whole = `${result.result.title} ${result.result.lines.join(" ")}`;
    for (const forbidden of [
      "intrusion", "breach", "attack", "threat", "incident", "malicious",
      "suspicious", "anomaly", "severity", "risk score",
    ]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(whole),
        `/audit must never say "${forbidden}" — the ledger cannot evidence it`,
      );
    }
    assert.ok(
      /not an intrusion log/i.test(result.result.provenance),
      "and the provenance says so out loud",
    );
    assert.ok(
      /authorized/i.test(result.result.provenance),
      "naming the reason: only authorized acts are recorded",
    );
  }

  /* ── 10 · THE BOUNDARY IS A DECLARED VALUE, NOT PROSE ────────────────────── */
  {
    const b = RECORDED_ACT_HISTORY_BOUNDARY;
    assert.equal(b.showsRecordedActs, true);
    assert.equal(b.statesItsOwnBound, true);
    for (const [key, value] of Object.entries(b)) {
      if (key === "showsRecordedActs" || key === "statesItsOwnBound" || key === "rationale") continue;
      assert.equal(value, false, `${key} must be false — R7.1.1 claims none of it`);
    }
    assert.ok(WITHHELD_AUDIT_COLUMNS.includes("metadata"), "metadata is declared withheld");
    assert.ok(WITHHELD_AUDIT_COLUMNS.includes("previousState"), "previousState is declared withheld");
    assert.ok(WITHHELD_AUDIT_COLUMNS.includes("nextState"), "nextState is declared withheld");
  }

  console.log("r7-1-1-flow/act-history-truth: OK");
}

void main();
