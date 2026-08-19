/*
 * G6C — Heby's Governance grounding: behaviour, provenance, tenant binding and firewalls.
 *
 * WHAT THIS PROVES:
 *   1. the adapter reads through the EXISTING Governance owners and owns nothing itself;
 *   2. AUTHORITATIVE is never flattened into DERIVED — the distinction survives into the answer;
 *   3. zero records reads as zero, and unavailable reads as unavailable, and they are different;
 *   4. no tenant context yields no Governance grounding;
 *   5. Heby's grounding path contains no Governance, provider, execution or Knowledge WRITER.
 *
 * Pure and injected — this file opens no database connection and needs none. Every owner is
 * substituted, so what is under test is the ADAPTER's translation, not the owners' SQL, which their
 * own released suites already prove.
 */
/*
 * SCHEMA FIRST — a pre-existing module-cycle quirk, not a G6C one.
 *
 * `db/schema/_base` imports `company`, and the tenant tables import `_base` back. The cycle
 * resolves correctly when the schema barrel initialises first, and throws
 * "Cannot access 'tenantColumns' before initialization" when a feature module is the process
 * entry point instead. Verified against the released baseline: importing
 * `decision-authority.server` as a bare entry fails identically at HEAD, so this is not caused by
 * the read-boundary extraction. Loading the barrel first makes the order explicit rather than
 * incidental.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  GOVERNANCE_PROVENANCE,
  GOVERNANCE_UNAVAILABLE,
  readGovernanceGroundingSource,
} from "../../src/features/governance-grounding/heby-governance-source.server";
import { buildResponse } from "../../src/features/heby-runtime/response-builder";
import { assembleEvidence } from "../../src/features/heby-runtime/evidence-assembler";
import type { SourceResolution } from "../../src/features/heby-runtime/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

const ADAPTER = "src/features/governance-grounding/heby-governance-source.server.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";

const TENANT = "11111111-1111-4111-8111-111111111111";
const HUMAN = "22222222-2222-4222-8222-222222222222";
const DECISION = "33333333-3333-4333-8333-333333333333";
const SESSION = "44444444-4444-4444-8444-444444444444";
const ROLE = "55555555-5555-4555-8555-555555555555";

const ctx = { tenantId: TENANT, userId: HUMAN, authIdentityId: "x", sessionContextId: "s", requestId: "r" };

const ROSTER_OK = {
  status: "read" as const,
  roster: {
    active: [
      {
        kind: "bootstrap" as const,
        actorId: HUMAN,
        decisionId: DECISION,
        grantedByActorId: null,
        grantorAuthorityDecisionId: null,
        since: "2026-08-19T07:38:48.790Z",
        justification: "why",
      },
    ],
    revoked: [],
    viewerIsAuthority: true,
    viewerIsBootstrapAuthority: true,
  },
};

const BOOTSTRAP_OK = {
  status: "read" as const,
  authority: {
    bootstrap: {
      decisionId: DECISION,
      sessionId: SESSION,
      decisionType: "certify",
      subjectType: "tenant",
      subjectId: TENANT,
      actorType: "human",
      actorId: HUMAN,
      bootstrap: true,
      outcome: "authority-established",
      justification: "why",
      decidedAt: "2026-08-19T07:38:48.790Z",
    },
    viewerIsGovernanceAuthority: true,
  },
};

const deps = (over: Record<string, unknown> = {}) =>
  ({
    readRoster: async () => ROSTER_OK,
    readBootstrap: async () => BOOTSTRAP_OK,
    readRoleBaseline: async () => ({
      status: "read" as const,
      viewerIsGovernanceAuthority: true,
      memberRoleId: ROLE,
    }),
    ...over,
  }) as never;

async function main(): Promise<void> {
  /* ── 1. THE HAPPY READ, KEYED TO REAL RECORDS ────────────────────────────── */
  {
    const r = await readGovernanceGroundingSource(ctx as never, deps());
    assert.equal(r.state, "resolved");
    assert.equal(r.sourceClass, "governance");
    assert.equal(r.authoritative, true, "decision_records IS the record, not a projection of one");
    assert.equal(r.provenance, GOVERNANCE_PROVENANCE);

    const refs = r.items.map((i) => i.recordRef);
    assert.deepEqual(
      refs,
      [DECISION, SESSION, ROLE],
      "every grounded item is keyed to a real record id the adapter did not invent",
    );
    assert.equal(new Set(refs).size, refs.length, "two facts must not collapse onto one reference");

    /* The authority model's declared semantics ride as quoted DATA, never as Heby's own prose. */
    const authorityItem = r.items[0]!;
    assert.ok(authorityItem.content, "the authority item carries the model's declared semantics");
    assert.match(authorityItem.content!, /does not enable providers/);
    assert.match(authorityItem.content!, /does not grant execution/);
    assert.match(authorityItem.content!, /does not ratify any Knowledge/);
    assert.match(authorityItem.content!, /Role band grants authority: false/);
    for (const item of r.items) {
      assert.ok(!/enable|execute|ratify/i.test(item.detail), `detail must stay machine-derived: ${item.detail}`);
    }
  }

  /* ── 2. ZERO RECORDS IS AN ANSWER, AND IS NOT "NOT CONNECTED" ────────────── */
  {
    const r = await readGovernanceGroundingSource(
      ctx as never,
      deps({
        readRoster: async () => ({
          status: "read" as const,
          roster: { active: [], revoked: [], viewerIsAuthority: false, viewerIsBootstrapAuthority: false },
        }),
        readBootstrap: async () => ({
          status: "read" as const,
          authority: { bootstrap: null, viewerIsGovernanceAuthority: false },
        }),
      }),
    );
    assert.equal(r.state, "unavailable");
    assert.equal(r.unavailableReason, GOVERNANCE_UNAVAILABLE.noAuthority);
    assert.match(r.unavailableReason!, /read result, not a missing connection/);
    assert.deepEqual(r.items, [], "no authority means no items — never a fabricated summary");
  }

  /* ── 3. A FAILED READ IS NOT AN EMPTY ORGANIZATION ───────────────────────── */
  {
    const r = await readGovernanceGroundingSource(
      ctx as never,
      deps({ readRoster: async () => ({ status: "unavailable" as const, reason: "persistence-unavailable" }) }),
    );
    assert.equal(r.state, "unavailable");
    assert.equal(r.unavailableReason, GOVERNANCE_UNAVAILABLE.persistence);
    assert.notEqual(
      r.unavailableReason,
      GOVERNANCE_UNAVAILABLE.noAuthority,
      "'could not read' and 'has none' must never collapse into one answer",
    );
  }

  /* ── 4. NO TENANT CONTEXT → NO GOVERNANCE GROUNDING ──────────────────────── */
  {
    for (const bad of [null, { tenantId: "", userId: HUMAN }, { tenantId: TENANT, userId: "" }]) {
      const r = await readGovernanceGroundingSource(bad as never, deps());
      assert.equal(r.state, "unavailable");
      assert.equal(r.unavailableReason, GOVERNANCE_UNAVAILABLE.noTenant);
      assert.deepEqual(r.items, []);
    }
  }

  /* ── 5. THE ADAPTER PASSES THE TENANT THROUGH; IT WRITES NO PREDICATE ────── */
  {
    const seen: unknown[] = [];
    await readGovernanceGroundingSource(
      ctx as never,
      deps({
        readRoster: async (t: unknown) => {
          seen.push(t);
          return ROSTER_OK;
        },
        readBootstrap: async (t: unknown) => {
          seen.push(t);
          return BOOTSTRAP_OK;
        },
        readRoleBaseline: async (t: unknown) => {
          seen.push(t);
          return { status: "read" as const, viewerIsGovernanceAuthority: true, memberRoleId: ROLE };
        },
      }),
    );
    assert.equal(seen.length, 3, "all three owners are consulted");
    for (const t of seen) {
      assert.equal((t as { tenantId: string }).tenantId, TENANT, "each owner receives the server-resolved tenant");
    }
    const code = codeOf(read(ADAPTER));
    for (const banned of ["tenantId:", "eq(", "sql`", "select", "from public."]) {
      assert.ok(
        !code.includes(banned),
        `the adapter must construct no query of its own — found ${banned}`,
      );
    }
  }

  /* ── 6. AUTHORITATIVE IS NOT FLATTENED INTO DERIVED ──────────────────────── */
  {
    const governance = await readGovernanceGroundingSource(ctx as never, deps());
    const derived: SourceResolution = {
      sourceClass: "operations",
      state: "resolved",
      provenance: "Executive Overview read model — derived and non-authoritative (authoritative: false).",
      authoritative: false,
      items: [{ recordRef: "active-agents", label: "Agents", detail: "health: ok", lifecycle: "unknown" }],
    };
    const context = { workspace: "governance", route: "/governance" } as never;

    const onlyAuthoritative = buildResponse("EXPLAIN", context, [governance]);
    assert.match(onlyAuthoritative.body[0]!, /authoritative organizational records/);
    assert.ok(
      !onlyAuthoritative.limitations.some((l) => /derived and non-authoritative/.test(l)),
      "an authoritative-only answer must not describe itself as derived",
    );
    assert.equal(onlyAuthoritative.uncertainty, "known");

    const onlyDerived = buildResponse("EXPLAIN", context, [derived]);
    assert.match(onlyDerived.body[0]!, /non-authoritative/);
    assert.equal(onlyDerived.uncertainty, "supported");

    const mixed = buildResponse("EXPLAIN", context, [governance, derived]);
    assert.match(mixed.body[0]!, /authoritative organizational records and derived read models/);
    assert.ok(
      mixed.limitations.some((l) => /mixed/.test(l)),
      "a mixed answer must say the sources are mixed rather than round to one class",
    );
  }

  /* ── 7. EVIDENCE CARRIES THE GOVERNANCE RECORDS ──────────────────────────── */
  {
    const governance = await readGovernanceGroundingSource(ctx as never, deps());
    const evidence = assembleEvidence([governance]);
    assert.deepEqual(
      evidence.map((e) => e.recordRef),
      [DECISION, SESSION, ROLE],
      "an answer about Governance points back at the decision, the session and the role",
    );
    for (const e of evidence) assert.equal(e.sourceClass, "governance");

    /* An unavailable source contributes NO evidence — silence, never a placeholder reference. */
    const none = await readGovernanceGroundingSource(
      ctx as never,
      deps({
        readBootstrap: async () => ({
          status: "read" as const,
          authority: { bootstrap: null, viewerIsGovernanceAuthority: false },
        }),
      }),
    );
    assert.deepEqual(assembleEvidence([none]), []);
  }

  /* ── 8. NO SECRETS, NO CONNECTION IDENTIFIERS, IN GROUNDING ──────────────── */
  {
    const r = await readGovernanceGroundingSource(ctx as never, deps());
    const blob = JSON.stringify(r);
    for (const forbidden of ["postgres://", "postgresql://", "DATABASE_URL", "secret", "password", "token"]) {
      assert.ok(!blob.toLowerCase().includes(forbidden.toLowerCase()), `grounding must not carry ${forbidden}`);
    }
  }

  /* ── 9. THE AUTHORITY FIREWALL: HEBY'S PATH HOLDS NO WRITER ──────────────── */
  {
    const WRITERS = [
      "establishGovernanceAuthority",
      "recordGovernanceDecision",
      "writeGovernanceDecisionWithin",
      "delegateGovernanceAuthority",
      "revokeGovernanceAuthority",
      "provisionMemberRole",
      "authorizeMembership",
      "issueInvitation",
      "revokeInvitation",
      "decideIdentityEnrollment",
      "ratifyKnowledgeVersion",
      "rejectKnowledgeVersion",
      "setDirectorEnabled",
      "recordActionRequest",
      "consumeActionPermit",
    ];
    for (const file of [ADAPTER, ANSWER]) {
      const code = codeOf(read(file));
      for (const writer of WRITERS) {
        assert.ok(!code.includes(writer), `${file} must not reach ${writer}`);
      }
      /* Dynamic import is a write path too. */
      assert.ok(!/import\s*\(/.test(code), `${file} must not use a dynamic import`);
    }
    /* And the adapter touches no schema module at all — it reads only through owners. */
    const adapter = codeOf(read(ADAPTER));
    assert.ok(!/@\/db\/schema/.test(adapter), "the adapter imports no table");
    assert.ok(!/db\/client\.server/.test(adapter), "the adapter opens no connection");
    for (const banned of [".insert(", ".update(", ".delete(", "transaction("]) {
      assert.ok(!adapter.includes(banned), `the adapter must contain no ${banned}`);
    }
  }

  /* ── 10. THE MOCK FIREWALL SURVIVES ──────────────────────────────────────── */
  {
    /*
     * G2's gate withholds the seeded Executive Overview whenever a real tenant is authenticated.
     * Governance grounding must not depend on that overview — otherwise connecting it would have
     * required reopening the fiction. It takes only a TenantContext, and the adapter never mentions
     * the overview at all.
     */
    const adapter = codeOf(read(ADAPTER));
    for (const banned of ["overview", "Overview", "mock", "seed"]) {
      assert.ok(!adapter.includes(banned), `Governance grounding must not depend on ${banned}`);
    }
    const governance = await readGovernanceGroundingSource(ctx as never, deps());
    assert.equal(governance.state, "resolved", "Governance resolves with no overview supplied at all");
  }

  /* ── 11. NO HEBY SURFACE GAINED A GOVERNANCE WRITER ──────────────────────── */
  {
    const hebyFiles = collect("src").filter(
      (f) => f.includes("heby-") || f.includes("/heby/") || f.includes("heby/"),
    );
    assert.ok(hebyFiles.length > 0, "the Heby surface must exist for this test to mean anything");
    const offenders = hebyFiles.filter((f) => {
      const code = codeOf(read(f));
      return (
        code.includes("establishGovernanceAuthority") ||
        code.includes("recordGovernanceDecision") ||
        code.includes("provisionMemberRole") ||
        code.includes("ratifyKnowledgeVersion")
      );
    });
    assert.deepEqual(offenders, [], "no Heby surface may reach a Governance or Knowledge writer");
  }

  console.log("PASS g6c heby governance grounding");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
