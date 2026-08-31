/*
 * E2-4 — THE COMPOSITION, ITS FOUR AVAILABILITIES, AND THE TENANT BOUNDARY.
 *
 * The composition's whole job is to keep four independent reads independent. So the proofs here
 * are mostly about NOT merging: an unreadable ledger must not empty the decision queue, an
 * unavailable block must not become a zero, and a decided proposal must never appear as something
 * still waiting.
 *
 *     UNAVAILABLE != NOTHING WAITING     UNAVAILABLE != ZERO DURATION
 *     RESOLVED != WAITING                OBSERVATION != DECISION
 *
 * Pure and injected. No database, no network. Every instant is a literal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  readAttentionObservation,
  type AttentionObservationDeps,
} from "../../src/features/attention-observation/read-attention-observation.server";
import { readAttentionGroundingSource } from "../../src/features/attention-observation/heby-attention-source.server";
import {
  ATTENTION_NON_CLAIMS,
  FORBIDDEN_ATTENTION_VOCABULARY,
} from "../../src/features/attention-observation/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "tenant-e24", userId: "user-e24" } as unknown as TenantContext;
const AT = new Date("2026-08-30T12:00:00.000Z");
const now = () => AT;

/** Every reader answers; the numbers below are the only ones any assertion may see. */
const HEALTHY: AttentionObservationDeps = {
  now,
  readAwaiting: async () => ({
    status: "read",
    value: { awaiting: 7, oldestFiledAt: "2026-08-27T08:00:00.000Z" },
  }),
  readApproved: async () => ({
    status: "read",
    value: { approvedWithoutAttempt: 2, oldestApprovedAt: "2026-08-29T12:00:00.000Z" },
  }),
  readPermits: async () => ({
    status: "read",
    items: [
      {
        permitId: "p-active", requestId: "r1", actionKind: "send", toolId: "t", targetLabel: null,
        state: "active", issuedAt: "2026-08-30T09:00:00.000Z", expiresAt: "2026-08-30T14:11:00.000Z",
        consumedAt: null, revokedAt: null, revocationReason: null, boundPayloadDigest: "d",
        executionStatus: null, providerAccepted: false, providerMessageId: null,
      },
      {
        /* EXPIRED is the OWNER's derivation. It must not appear as an active permit here. */
        permitId: "p-expired", requestId: "r2", actionKind: "send", toolId: "t", targetLabel: null,
        state: "expired", issuedAt: "2026-08-20T09:00:00.000Z", expiresAt: "2026-08-21T09:00:00.000Z",
        consumedAt: null, revokedAt: null, revocationReason: null, boundPayloadDigest: "d",
        executionStatus: null, providerAccepted: false, providerMessageId: null,
      },
    ],
  }),
  readActivity: async () => ({
    status: "observed",
    observation: {
      tenantId: "tenant-e24", generatedAt: AT.toISOString(), totalRecordedActs: 18,
      latestOccurredAt: "2026-08-29T14:32:38.314Z",
      actions: [], results: [], authoritySources: [],
      simulation: { simulatedCount: 0, nonSimulatedCount: 18 },
    },
  }) as never,
};

async function main(): Promise<void> {
  /* ── 1. EVERY BLOCK OBSERVED, EVERY DURATION FROM ITS OWN COLUMN ──────────── */
  {
    const read = await readAttentionObservation(TENANT, HEALTHY);
    assert.equal(read.status, "observed");
    if (read.status !== "observed") throw new Error("unreachable");
    const o = read.observation;

    assert.equal(o.evaluatedAt, AT.toISOString(), "one instant, carried");

    assert.equal(o.awaitingDecision.status, "observed");
    if (o.awaitingDecision.status !== "observed") throw new Error("unreachable");
    assert.equal(o.awaitingDecision.value.awaiting, 7, "the UNBOUNDED count, not a page length");
    assert.equal(o.awaitingDecision.value.oldestWaiting?.label, "3d 4h");
    assert.equal(
      o.awaitingDecision.value.oldestWaiting?.basis,
      "action-request.created_at",
      "the oldest wait names the column it was measured from",
    );

    /* APPROVED IS NOT EXECUTED — the count SIA-1 publishes, now with the instant it was approved. */
    assert.equal(o.approvedUnexecuted.status, "observed");
    if (o.approvedUnexecuted.status !== "observed") throw new Error("unreachable");
    assert.equal(o.approvedUnexecuted.value.approvedWithoutAttempt, 2);
    assert.equal(o.approvedUnexecuted.value.oldestApproved?.label, "1d");
    assert.equal(
      o.approvedUnexecuted.value.oldestApproved?.basis,
      "action-request.approved_at",
      "approval age comes from the proposal's OWN approval instant, never from a permit's issuance",
    );

    assert.equal(o.authorizedUnspent.status, "observed");
    if (o.authorizedUnspent.status !== "observed") throw new Error("unreachable");
    assert.equal(o.authorizedUnspent.value.active, 1, "the expired permit is not counted as active");
    assert.equal(o.authorizedUnspent.value.soonestExpiry?.label, "2h 11m");
    assert.equal(
      o.authorizedUnspent.value.soonestExpiry?.basis,
      "action-permit.expires_at",
      "expiry is measured from the permit's OWN authoritative expiry, never from issuance + a guess",
    );
    assert.equal(o.authorizedUnspent.value.longestHeld?.label, "3h");
    assert.equal(o.authorizedUnspent.value.longestHeld?.basis, "action-permit.issued_at");

    assert.equal(o.recordedActRecency.status, "observed");
    if (o.recordedActRecency.status !== "observed") throw new Error("unreachable");
    assert.equal(o.recordedActRecency.value.totalRecordedActs, 18);
    assert.equal(o.recordedActRecency.value.sinceMostRecent?.basis, "audit-log.occurred_at");
  }

  /* ── 2. NOTHING AWAITING IS A COUNT OF ZERO AND NO DURATION AT ALL ────────── */
  {
    const read = await readAttentionObservation(TENANT, {
      ...HEALTHY,
      readAwaiting: async () => ({ status: "read", value: { awaiting: 0, oldestFiledAt: null } }),
    });
    if (read.status !== "observed") throw new Error("unreachable");
    const block = read.observation.awaitingDecision;
    if (block.status !== "observed") throw new Error("unreachable");
    assert.equal(block.value.awaiting, 0);
    assert.equal(
      block.value.oldestWaiting,
      null,
      "nothing awaiting is NOT a wait of zero — there is no oldest to measure",
    );
  }

  /* ── 3. ONE UNAVAILABLE BLOCK DOES NOT DAMAGE THE OTHER THREE ─────────────── */
  {
    const read = await readAttentionObservation(TENANT, {
      ...HEALTHY,
      readPermits: async () => ({ status: "unavailable", reason: "read-failed" }),
    });
    if (read.status !== "observed") throw new Error("unreachable");
    assert.equal(read.observation.authorizedUnspent.status, "unavailable");
    assert.equal(read.observation.awaitingDecision.status, "observed");
    assert.equal(read.observation.approvedUnexecuted.status, "observed");
    assert.equal(read.observation.awaitingDecision.status, "observed");
    assert.equal(read.observation.recordedActRecency.status, "observed");
  }

  /* ── 4. UNAVAILABLE PERSISTENCE NEVER FABRICATES A ZERO ───────────────────── */
  {
    const allDown: AttentionObservationDeps = {
      now,
      readAwaiting: async () => ({ status: "unavailable", reason: "persistence-not-configured" }),
    readApproved: async () => ({ status: "unavailable", reason: "persistence-not-configured" }),
      readPermits: async () => ({ status: "unavailable", reason: "persistence-not-configured" }),
        readActivity: async () => ({ status: "unavailable", reason: "persistence-not-configured" }) as never,
    };
    const read = await readAttentionObservation(TENANT, allDown);
    if (read.status !== "observed") throw new Error("unreachable");
    const o = read.observation;
    for (const block of [o.awaitingDecision, o.approvedUnexecuted, o.authorizedUnspent, o.recordedActRecency]) {
      assert.equal(block.status, "unavailable");
      assert.ok(!("value" in block), "there is no shape in which a value and a failure coexist");
    }
    /* And the grounding source says so in words rather than contributing four zeros. */
    const source = await readAttentionGroundingSource(TENANT, { readAttention: async () => read });
    const details = source.items.map((item) => item.detail).join(" ");
    assert.match(details, /not read/);
    assert.ok(!/\b0 awaiting\b/.test(details), "an unread block must never render as a count of zero");
  }

  /* ── 5. TENANT BOUNDARY: NULL CONTEXT, AND NO TENANT PARAMETER TO ABUSE ───── */
  {
    const read = await readAttentionObservation(null, HEALTHY);
    assert.deepEqual(read, { status: "unavailable", reason: "no-authorized-tenant-context" });

    const source = await readAttentionGroundingSource(null);
    assert.equal(source.state, "unavailable");
    assert.equal(source.sourceClass, "operations");
    assert.match(String(source.unavailableReason), /No authorized tenant context/);
    assert.equal(source.items.length, 0, "an unauthorized read contributes no evidence at all");

    /*
     * A FOREIGN TENANT IS UNREPRESENTABLE, not refused. Neither entry point takes a tenant
     * IDENTIFIER — only an already-resolved server context — so there is no argument through which a
     * caller could name another organization.
     */
    /* Arity 1 because `deps` is defaulted: the ONE required parameter is the resolved context. */
    assert.equal(readAttentionObservation.length, 1, "one required parameter: the tenant context");
    assert.equal(readAttentionGroundingSource.length, 1, "one required parameter: the tenant context");
    const composition = readFileSync(
      "src/features/attention-observation/read-attention-observation.server.ts",
      "utf8",
    );
    assert.ok(
      !/tenantId\s*:\s*string\s*[,)]/.test(composition),
      "no entry point may take a tenant IDENTIFIER — only an already-resolved context",
    );
  }

  /* ── 6. THE GROUNDING SOURCE IS DERIVED, AND NEVER SAYS A FORBIDDEN WORD ──── */
  {
    const read = await readAttentionObservation(TENANT, HEALTHY);
    const source = await readAttentionGroundingSource(TENANT, { readAttention: async () => read });
    assert.equal(source.sourceClass, "operations");
    assert.equal(source.state, "resolved");
    assert.equal(
      source.authoritative,
      false,
      "the RECORDS are authoritative; these durations are recomputed on read",
    );
    /* KGA added the fifth block. Bounded by SHAPE still — there is no list to page. */
    assert.equal(source.items.length, 5, "five blocks, five items, bounded by shape not by a limit");

    /*
     * THE BAN IS SCOPED TO WHAT E2-4 ASSERTS, AND MATCHES WHOLE WORDS.
     *
     * Seventh recorded instance of the prose-shaped-guard trap in this repository, and the first
     * where BOTH failure modes appeared at once: the first draft banned these words across the
     * whole resolution and failed on the provenance sentence, whose entire job is to say Hebun has
     * "no definition of late" — the source's own DENIAL. A substring match also read "late" inside
     * "related".
     *
     * So the ban runs over the machine-derived label and detail lines only, on word boundaries, and
     * the denials are asserted separately BY EQUALITY below.
     */
    const asserted = source.items.map((i) => `${i.label} ${i.detail}`).join(" ").toLowerCase();
    for (const word of FORBIDDEN_ATTENTION_VOCABULARY) {
      assert.ok(
        !new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(asserted),
        `the grounding source must not use "${word}" — it encodes a policy Hebun has no authority for`,
      );
    }
    /* THE DENIALS, BY EQUALITY. They are the reason those words appear at all. */
    assert.match(source.provenance, /no target, no threshold and no definition of late/);
    assert.equal(
      ATTENTION_NON_CLAIMS[0],
      "age is not importance — a proposal filed long ago is not thereby more worth approving",
    );
    assert.equal(
      ATTENTION_NON_CLAIMS[1],
      "waiting is not late — no target, deadline or service level exists for a human decision here",
    );
    /* And every duration line names the column it came from. */
    assert.match(source.items.map((i) => i.detail).join(" "), /basis action-request\.created_at/);
  }

  console.log("E2-4 observation and boundaries: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
