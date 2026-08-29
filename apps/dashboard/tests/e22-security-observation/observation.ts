/*
 * E2-2 / S-B — SECURITY OBSERVATION SEMANTICS.
 *
 * What this proves: the Security Center can observe the governed acts Hebun recorded for ONE
 * tenant, through a bounded read it does not own, and cannot — through this connection — acquire a
 * security event, a finding, an incident, a severity, a risk or a score.
 *
 * The distinction that carries the whole milestone is between three outcomes that a careless
 * implementation collapses into one blank panel:
 *
 *     recorded     the ledger was read and holds acts
 *     known-empty  the ledger was READ and holds nothing for this organization
 *     unavailable  the ledger could not be read at all
 *
 * "Nothing was recorded" is a claim about the customer's organization. "Hebun could not look" is a
 * claim about Hebun. A surface that renders the second as the first is lying about the customer.
 *
 *     KNOWN EMPTY          != UNAVAILABLE
 *     AUTHORITATIVE RECORD != AUTHORITATIVE OBSERVATION
 *     ZERO RECORDED ACTS   != SECURE
 *
 * No database, no network, no key, no model. Every seam is injected.
 */
import assert from "node:assert/strict";

import {
  readSecurityRecordedActObservation,
  SECURITY_OBSERVATION_PROVENANCE,
  SECURITY_OBSERVATION_LIMITS,
  SECURITY_OBSERVATION_UNAVAILABLE,
} from "../../src/features/governance-activity/security-observation-source.server";
import {
  RECORDED_ACT_HISTORY_BOUNDARY,
  RECORDED_ACT_PAGE_LIMIT,
  WITHHELD_AUDIT_COLUMNS,
  type RecordedAct,
  type RecordedActHistoryResult,
} from "../../src/features/governance-activity/contracts";
import { getSecurityCenterModel, listSecuritySources, getSecuritySource } from "../../src/features/security-center";

const TENANT_A = { tenantId: "11111111-1111-4111-8111-111111111111" };
const TENANT_B = { tenantId: "22222222-2222-4222-8222-222222222222" };

function act(overrides: Partial<RecordedAct> = {}): RecordedAct {
  return {
    occurredAt: "2026-08-29T10:00:00.000Z",
    action: "knowledge.ratify",
    entityType: "knowledge_fact",
    actorType: "human",
    result: "succeeded",
    source: "governance-authority",
    authoritySource: "membership",
    simulation: false,
    ...overrides,
  };
}

/** A seam that answers for exactly one tenant, so a widened read has somewhere to go wrong. */
function ledgerFor(
  rows: Readonly<Record<string, readonly RecordedAct[]>>,
): (tenant: { tenantId: string } | null) => Promise<RecordedActHistoryResult> {
  return async (tenant) => {
    if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
    const acts = rows[tenant.tenantId] ?? [];
    const generatedAt = "2026-08-29T12:00:00.000Z";
    if (acts.length === 0) return { status: "empty", tenantId: tenant.tenantId, generatedAt };
    const page = acts.slice(0, RECORDED_ACT_PAGE_LIMIT);
    return {
      status: "recorded",
      tenantId: tenant.tenantId,
      generatedAt,
      page: { acts: page, totalRecordedActs: acts.length, truncated: page.length < acts.length },
    };
  };
}

async function main(): Promise<void> {
  /* ── 1 · (A) A TENANT WITH RECORDED ACTIVITY ──────────────────────────────── */
  {
    const observed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: ledgerFor({ [TENANT_A.tenantId]: [act(), act({ action: "governance.decide" })] }),
    });

    assert.equal(observed.state, "recorded");
    assert.equal(observed.sourceClass, "audit");
    assert.equal(observed.acts.length, 2);
    assert.equal(observed.totalRecordedActs, 2);
    assert.equal(observed.truncated, false);
    assert.equal(observed.unavailableReason, null);
    assert.equal(observed.generatedAt, "2026-08-29T12:00:00.000Z");

    /* The VALUES travel, not a shape with plausible defaults. */
    assert.equal(observed.acts[0]!.action, "knowledge.ratify");
    assert.equal(observed.acts[1]!.action, "governance.decide");
    assert.equal(observed.acts[0]!.entityType, "knowledge_fact");
    assert.equal(observed.acts[0]!.actorType, "human");
    assert.equal(observed.acts[0]!.result, "succeeded");
    assert.equal(observed.acts[0]!.source, "governance-authority");
    assert.equal(observed.acts[0]!.authoritySource, "membership");
    assert.equal(observed.acts[0]!.simulation, false);
  }

  /* ── 2 · (B) READ SUCCEEDED, LEDGER EMPTY — AND THAT IS NOT UNAVAILABLE ───── */
  {
    const observed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: ledgerFor({}),
    });

    assert.equal(observed.state, "known-empty");
    assert.notEqual(observed.state, "unavailable");
    assert.deepEqual(observed.acts, []);
    /*
     * ZERO, NOT NULL. The read ran, so the total is known and is genuinely zero — the one case
     * where a zero is a fact about the organization rather than a substituted value.
     */
    assert.equal(observed.totalRecordedActs, 0);
    assert.equal(observed.unavailableReason, null);
    assert.equal(observed.generatedAt, "2026-08-29T12:00:00.000Z");
  }

  /* ── 3 · (C) NO AUTHORIZED TENANT — UNAVAILABLE, AND NOTHING READ ─────────── */
  {
    let called = 0;
    const observed = await readSecurityRecordedActObservation(null, {
      observe: async (tenant) => {
        called += 1;
        return tenant?.tenantId
          ? { status: "empty", tenantId: tenant.tenantId, generatedAt: "x" }
          : { status: "unavailable", reason: "no-authorized-tenant-context" };
      },
    });

    assert.equal(observed.state, "unavailable");
    assert.equal(observed.unavailableReason, SECURITY_OBSERVATION_UNAVAILABLE["no-authorized-tenant-context"]);
    assert.deepEqual(observed.acts, []);
    /* NULL, never 0: a read that did not run does not know the total. */
    assert.equal(observed.totalRecordedActs, null);
    assert.equal(observed.generatedAt, null);
    assert.equal(called, 1, "the seam decides — this module does not pre-empt it with its own rule");
  }

  /* ── 4 · (D) PERSISTENCE NOT CONFIGURED — UNAVAILABLE, NOT KNOWN-EMPTY ────── */
  {
    const observed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: async () => ({ status: "unavailable", reason: "persistence-not-configured" }),
    });

    assert.equal(observed.state, "unavailable");
    assert.notEqual(observed.state, "known-empty");
    assert.equal(observed.totalRecordedActs, null);
    assert.equal(observed.unavailableReason, SECURITY_OBSERVATION_UNAVAILABLE["persistence-not-configured"]);

    const failed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: async () => ({ status: "unavailable", reason: "read-failed", detail: "boom" }),
    });
    assert.equal(failed.state, "unavailable");
    assert.equal(failed.unavailableReason, SECURITY_OBSERVATION_UNAVAILABLE["read-failed"]);

    /*
     * THREE REASONS, THREE SENTENCES. Merging any two would turn an infrastructure state into a
     * claim about the customer, or hide a real failure behind a configuration excuse.
     */
    const sentences = Object.values(SECURITY_OBSERVATION_UNAVAILABLE);
    assert.equal(new Set(sentences).size, 3, "each unavailable reason has its own sentence");
    /* And the detail from the read failure is NOT pasted into a customer-facing sentence. */
    assert.equal(failed.unavailableReason!.includes("boom"), false, "raw error text never surfaces");
  }

  /* ── 5 · (E) TWO TENANTS EXIST — ONLY THE REQUESTING ONE SURFACES ─────────── */
  {
    const ledger = ledgerFor({
      [TENANT_A.tenantId]: [act({ action: "a.only" })],
      [TENANT_B.tenantId]: [act({ action: "b.only" }), act({ action: "b.second" })],
    });

    const a = await readSecurityRecordedActObservation(TENANT_A, { observe: ledger });
    const b = await readSecurityRecordedActObservation(TENANT_B, { observe: ledger });

    assert.deepEqual(a.acts.map((x) => x.action), ["a.only"]);
    assert.deepEqual(b.acts.map((x) => x.action), ["b.only", "b.second"]);
    assert.equal(a.totalRecordedActs, 1);
    assert.equal(b.totalRecordedActs, 2);

    /*
     * AND THERE IS NO PARAMETER BY WHICH A AND B COULD BE MIXED. The projection takes a tenant and
     * an injectable seam — no tenant id string, no filter, no slug, no "all" form. A cross-tenant
     * read is not refused here; it is unrepresentable, which is the stronger property.
     */
    assert.equal(
      readSecurityRecordedActObservation.length,
      1,
      "exactly ONE required parameter — the tenant. `deps` is defaulted, so `length` stops there",
    );
    /*
     * And the required one is the TENANT CONTEXT, not a tenant id a caller could compose. Asserted
     * against the source's own signature, because the arity above cannot tell them apart.
     */
    const signature = readSecurityRecordedActObservation.toString().slice(0, 200);
    assert.ok(/\(\s*tenant\s*,/.test(signature), `the first parameter is the tenant context: ${signature}`);
    assert.equal(/tenantId\s*:\s*string/.test(signature), false, "no tenant-id string parameter exists");
  }

  /* ── 6 · (F) THE OBSERVATION IS DERIVED, AND SAYS SO ──────────────────────── */
  {
    const ledger = ledgerFor({ [TENANT_A.tenantId]: [act()] });
    for (const observed of [
      await readSecurityRecordedActObservation(TENANT_A, { observe: ledger }),
      await readSecurityRecordedActObservation(TENANT_A, { observe: ledgerFor({}) }),
      await readSecurityRecordedActObservation(null, { observe: ledger }),
    ]) {
      assert.equal(observed.authoritative, false, "every state reports the observation as derived");
    }

    /* The ledger boundary it derives from says the same thing, and remains the reason. */
    assert.equal(RECORDED_ACT_HISTORY_BOUNDARY.isAuthoritative, false);
    assert.equal(RECORDED_ACT_HISTORY_BOUNDARY.writesAnything, false);
    assert.equal(RECORDED_ACT_HISTORY_BOUNDARY.isPersisted, false);
  }

  /* ── 7 · (O) PROVENANCE SURVIVES THE PROJECTION BY EQUALITY ───────────────── */
  {
    /*
     * BY EQUALITY, NOT BY KEYWORD. A word-ban would pass on a re-worded sentence that quietly
     * dropped a limitation, and the limitations are the most important thing this surface renders.
     */
    assert.equal(
      SECURITY_OBSERVATION_PROVENANCE,
      RECORDED_ACT_HISTORY_BOUNDARY.rationale,
      "provenance is the ledger boundary's own sentence, verbatim — this surface owns no provenance",
    );

    const observed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: ledgerFor({ [TENANT_A.tenantId]: [act()] }),
    });
    assert.equal(observed.provenance, RECORDED_ACT_HISTORY_BOUNDARY.rationale);
    assert.equal(observed.limits, SECURITY_OBSERVATION_LIMITS);

    /* The limits sentence must actually deny the four things a security page invites. */
    for (const denied of ["not security events", "findings", "incidents", "no severity or risk"]) {
      assert.ok(
        SECURITY_OBSERVATION_LIMITS.includes(denied),
        `the limits sentence denies "${denied}"`,
      );
    }
  }

  /* ── 8 · (P) THE BOUND IS THE SEAM'S, AND THE TOTAL IS INDEPENDENT ────────── */
  {
    const many = Array.from({ length: 57 }, (_, i) => act({ action: `act.${i}` }));
    const observed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: ledgerFor({ [TENANT_A.tenantId]: many }),
    });

    assert.equal(observed.acts.length, RECORDED_ACT_PAGE_LIMIT, "the page is bounded at the released limit");
    assert.ok(observed.acts.length < 57);
    /* The total is the REAL total, never `acts.length` — that is what makes truncation visible. */
    assert.equal(observed.totalRecordedActs, 57, "the total is the real total, not the page length");
    assert.notEqual(
      observed.totalRecordedActs,
      observed.acts.length,
      "the total is the real total — substituting acts.length would cap the truth at the bound",
    );
    assert.equal(observed.truncated, true, "a page smaller than the total is reported as truncated");

    /* And the projection never re-derives truncation; it carries the reader's own answer. */
    const exact = await readSecurityRecordedActObservation(TENANT_A, {
      observe: async () => ({
        status: "recorded",
        tenantId: TENANT_A.tenantId,
        generatedAt: "t",
        page: { acts: [act()], totalRecordedActs: 99, truncated: false },
      }),
    });
    assert.equal(exact.truncated, false, "truncation is the reader's, not recomputed from acts.length");
    assert.equal(exact.totalRecordedActs, 99);
  }

  /* ── 9 · (S) WITHHELD AUDIT COLUMNS CANNOT REACH THE SURFACE ──────────────── */
  {
    /*
     * The reader never selected these, so this asserts they cannot arrive through the projection
     * either — including via a seam that tries to smuggle them in an extra field.
     */
    const smuggled = {
      ...act(),
      actorId: "00000000-0000-4000-8000-000000000000",
      entityId: "00000000-0000-4000-8000-000000000001",
      metadata: { secret: "do-not-surface" },
      principalReferenceHash: "f".repeat(64),
    } as RecordedAct;

    const observed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: async () => ({
        status: "recorded",
        tenantId: TENANT_A.tenantId,
        generatedAt: "t",
        page: { acts: [smuggled], totalRecordedActs: 1, truncated: false },
      }),
    });

    const rendered = JSON.stringify(observed);
    for (const column of WITHHELD_AUDIT_COLUMNS) {
      assert.equal(
        rendered.includes(column),
        false,
        `the withheld audit column ${column} must not reach the security observation`,
      );
    }
    assert.equal(rendered.includes("do-not-surface"), false, "no jsonb payload survives the projection");
    assert.deepEqual(
      Object.keys(observed.acts[0]!).sort(),
      ["action", "actorType", "authoritySource", "entityType", "occurredAt", "result", "simulation", "source"],
      "exactly the eight admitted fields — the projection names them rather than spreading the row",
    );
  }

  /* ── 10 · NULLS ARE REPORTED, NEVER GUESSED ──────────────────────────────── */
  {
    const observed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: ledgerFor({ [TENANT_A.tenantId]: [act({ source: null, authoritySource: null })] }),
    });
    assert.equal(observed.acts[0]!.source, null);
    assert.equal(observed.acts[0]!.authoritySource, null);
  }

  /* ── 11 · (M) THE `audit` SOURCE CLASS IS CONNECTED, AND ONLY IT ──────────── */
  {
    assert.equal(getSecuritySource("audit").state, "connected");
    assert.equal(getSecuritySource("audit").usable, true);

    const connected = listSecuritySources().filter((s) => s.state === "connected");
    assert.deepEqual(
      connected.map((s) => s.sourceClass),
      ["audit"],
      "exactly one source class is connected — a real seam existing elsewhere connects nothing",
    );
  }

  /* ── 12 · (N) THE MODEL CARRIES THE OBSERVATION, AND NULL IS NOT EMPTY ────── */
  {
    const observed = await readSecurityRecordedActObservation(TENANT_A, {
      observe: ledgerFor({ [TENANT_A.tenantId]: [act()] }),
    });
    const model = getSecurityCenterModel(TENANT_A.tenantId, observed);
    assert.equal(model.recordedActObservation?.state, "recorded");
    assert.equal(model.recordedActObservation?.acts.length, 1);

    /* No observation supplied is `null` — distinctly NOT a known-empty observation. */
    const bare = getSecurityCenterModel(TENANT_A.tenantId);
    assert.equal(bare.recordedActObservation, null);

    /* And the connection changed nothing about what has no authority. */
    assert.deepEqual(model.findings, []);
    assert.deepEqual(model.signals, []);
    assert.deepEqual(model.incidents, []);
    assert.deepEqual(model.timeline, []);
  }

  console.log("e22-security-observation/observation: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
