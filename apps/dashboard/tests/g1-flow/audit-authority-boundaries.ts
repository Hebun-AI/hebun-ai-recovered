/*
 * G1 — the boundaries around the mutation ledger: one authority, append-only, server-owned.
 *
 * The database will happily let a superuser edit any row. G1 does not pretend otherwise. What it
 * claims — and what this file proves over the shipped source — is that NO PRODUCT CODE PATH can
 * rewrite an actor, a timestamp, an outcome, or an identity, because no such path is written, and
 * that the ledger's authority (`audit_log`) has exactly one writer.
 *
 * It also pins the recording BOUNDARY as a value: unauthenticated and forbidden attempts are
 * deliberately not Knowledge governance history, and that decision must stay visible rather than
 * becoming a silent gap someone rediscovers later.
 *
 * Structural + injected. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  KNOWLEDGE_AUDIT_BOUNDARY,
  KNOWLEDGE_ENTITY_TYPE,
  KNOWLEDGE_MUTATION_ACTIONS,
  type KnowledgeMutationEvent,
  type KnowledgeMutationMetadata,
} from "../../src/features/governance-audit/contracts";
import {
  auditActorFrom,
  recordKnowledgeMutationWithin,
} from "../../src/features/governance-audit/knowledge-mutation-audit.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const read = (path: string) => readFileSync(path, "utf8");

const AUDIT = "src/features/governance-audit/knowledge-mutation-audit.server.ts";
const AUDIT_CONTRACTS = "src/features/governance-audit/contracts.ts";
const CREATE = "src/features/knowledge/knowledge-create.server.ts";
const WRITER = "src/features/knowledge/durable-knowledge-writer.server.ts";
const ACTION = "src/app/(dashboard)/knowledge/actions.ts";
const G1_MODULES = [AUDIT, AUDIT_CONTRACTS];

function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

function tenant(): TenantContext {
  return asHumanTenantContext({
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    authIdentityId: "identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "33333333-3333-4333-8333-333333333333",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "req-1",
    authenticatedAt: "2026-08-11T00:00:00.000Z",
  });
}

async function main(): Promise<void> {
  /* ── 9. ONE AUDIT AUTHORITY — NO SECOND SINK WAS CREATED ────────────────── */
  {
    // G1 defines no table of its own.
    for (const file of walk("src/features/governance-audit")) {
      const code = codeOf(read(file));
      assert.ok(!code.includes("pgTable("), `${file} must not define a table`);
      assert.ok(!code.includes("pgEnum("), `${file} must not define an enum`);
    }
    // …and no migration was added FOR G1. Stated as a phase-scoped fact rather
    // than a global migration count: a later, unrelated phase adding its own
    // migration must not make this read as "G1 added one".
    const migrationNames = readdirSync("src/db/migrations").filter((n) => n.endsWith(".sql"));
    assert.ok(
      migrationNames.includes("20260711174439_audit_event_backbone.sql"),
      "audit_log came from the pre-existing audit backbone migration",
    );
    for (const name of migrationNames) {
      assert.ok(
        !/g1|governance[-_]?audit|knowledge[-_]?mutation/i.test(name),
        `G1 adds no migration — audit_log already existed (found ${name})`,
      );
    }
    /*
     * It writes the PRE-EXISTING shared sink, and every module that does is a DECLARED OWNER
     * living in `governance-audit/`.
     *
     * G1 originally asserted exactly ONE writer, because at the time there was exactly one audit
     * domain. G2.1 added a second — pre-Governance genesis entitlement — as an explicit SIBLING:
     * its own boundary constant, its own entity type, its own action vocabulary, and no reference
     * to `KNOWLEDGE_AUDIT_BOUNDARY` in either direction. That is what "do not widen G1's boundary"
     * required, and a sibling contract necessarily means a sibling module.
     *
     * The protection this test actually exists to give is UNCHANGED and still asserted: an ordinary
     * feature module may never reach the sink directly. Only the declared owners may, and adding a
     * third is a deliberate edit here, not an accident somewhere in `src/features`.
     */
    assert.ok(read(AUDIT).includes('from "@/db/schema/audit-log"'), "G1 binds to the existing sink");
    /*
     * I1.2 adds a FOURTH declared owner, on the same terms G2.1's second one was added: its own
     * boundary constant (`IDENTITY_ENROLLMENT_AUDIT_BOUNDARY`), its own entity type, its own action,
     * and no reference to any other domain's boundary in either direction. It is separate from the
     * decision writer because a completed enrollment is not a Governance decision — nobody decided
     * anything at that moment; Identity and Credential authority finished a ceremony.
     */
    const AUDIT_SINK_OWNERS = [
      "src/features/governance-audit/action-authorization-audit.server.ts",
      "src/features/governance-audit/action-execution-audit.server.ts",
      /*
       * AMA-1 — the SEVENTH declared sibling. It owns the history of what a durable agent is FOR,
       * appends to the SHARED sink like every other, and creates no second audit table. The census
       * GREW; nothing in it was widened, which is what this assertion has always been about.
       */
      "src/features/governance-audit/agent-mandate-audit.server.ts",
      "src/features/governance-audit/genesis-nomination-audit.server.ts",
      "src/features/governance-audit/governance-decision-audit.server.ts",
      "src/features/governance-audit/human-onboarding-audit.server.ts",
      "src/features/governance-audit/identity-enrollment-audit.server.ts",
      "src/features/governance-audit/integration-credential-audit.server.ts",
      "src/features/governance-audit/integration-lifecycle-audit.server.ts",
      "src/features/governance-audit/knowledge-mutation-audit.server.ts",
      /*
       * OSA-1 — the Organization Structure Authority's audit sibling. It appends to the SHARED
       * sink like every other and creates no second audit table. The census GREW; nothing in it
       * was widened.
       */
      "src/features/governance-audit/organization-structure-audit.server.ts",
      /*
       * WORK-1 — the Organizational Work Authority's audit sibling. It appends to the SHARED sink
       * like every other and creates no second audit table. The census GREW; nothing in it was
       * widened.
       */
      "src/features/governance-audit/organizational-work-audit.server.ts",
    ];
    /*
     * WRITING is asked by MECHANISM (R7.1 repair).
     *
     * This census used to be "which files import the audit-log schema", named `writers`, and
     * asserted as "may write". Until R7.1 every importer was a writer, so the imprecision was
     * invisible — and then the first READER of the sink appeared and tripped a WRITE firewall.
     * A proxy that only works while no counter-example exists is not a proof of the claim above it.
     *
     * So the write claim is now proved by the write verbs themselves. The import census is kept
     * directly below, because "nothing else touches the sink" is a separate and still-valuable
     * guarantee — it just is not the same guarantee.
     */
    const writesTheSink = (file: string) =>
      /\.(insert|update|delete)\(\s*auditLog\s*\)/.test(codeOf(read(file)));

    const sourceFiles = walk("src")
      .filter((f) => !f.replace(/\\/g, "/").startsWith("src/db/schema/"))
      .map((f) => f.replace(/\\/g, "/"));

    assert.deepEqual(
      sourceFiles.filter(writesTheSink).sort(),
      AUDIT_SINK_OWNERS,
      "only the declared governance-audit owners may write the shared sink",
    );

    /*
     * And the sink is REACHABLE from nothing but those owners plus the DECLARED READERS, each of
     * which selects rows and writes none — proved by their absence from the write census above.
     *
     * R7.1.1 adds the second: `act-history-read.server.ts`, the bounded drill-through. It is a
     * separate file from R7.1's aggregate on purpose — `read.server.ts` carries a structural
     * prohibition on `.limit(` anywhere in it, and a bounded list needs a bound, so sharing a file
     * would have forced that guarantee to be narrowed from "no bound in this file" to "no bound in
     * this function". Two files keep both properties absolute.
     *
     * This list is an ALLOWLIST and must stay one. A new name here is a deliberate, reviewable act;
     * it is not a place to relax the pattern into a directory prefix, which would let any future
     * file under `governance-activity/` reach the sink unnoticed.
     */
    assert.deepEqual(
      sourceFiles.filter((f) => read(f).includes('from "@/db/schema/audit-log"')).sort(),
      [
        ...AUDIT_SINK_OWNERS,
        "src/features/governance-activity/read.server.ts",
        "src/features/governance-activity/act-history-read.server.ts",
        /* E2-7 — the THIRD declared reader: the unbounded windowed count. It selects and writes
         * nothing, proved by its absence from the write census directly above. A third file for the
         * same reason there is a second: `read.server.ts` forbids `.limit(` anywhere and
         * `act-history-read.server.ts` carries exactly one, so windowed counts in either would have
         * narrowed a released guarantee from "this file" to "this function". ALLOWLIST — a new name
         * here is a deliberate act, never a directory prefix. */
        "src/features/governance-activity/act-window-read.server.ts",
      ].sort(),
      "the sink is imported by its writers and by the declared readers — nothing else",
    );
    for (const owner of sourceFiles.filter(writesTheSink)) {
      assert.ok(
        owner.startsWith("src/features/governance-audit/"),
        `${owner} must live in governance-audit/ — the sink has no owner outside it`,
      );
    }
  }

  /* ── 10. THE PRODUCT SURFACE IS APPEND-ONLY ─────────────────────────────
   * No update, no delete, no upsert — over the audit module's whole source, and no exported
   * function whose name even offers one.
   */
  {
    const code = codeOf(read(AUDIT));
    for (const banned of [
      ".update(", ".delete(", "onConflictDoUpdate", "onConflictDoNothing", "upsert",
      "truncate", "drop ",
    ]) {
      assert.ok(!code.toLowerCase().includes(banned), `${AUDIT} must not contain "${banned}"`);
    }
    const exported = [...read(AUDIT).matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]!);
    for (const name of exported) {
      assert.ok(
        !/update|delete|remove|rewrite|replace|amend|purge/i.test(name),
        `the audit surface must not export "${name}"`,
      );
    }
    assert.deepEqual(
      exported.sort(),
      ["auditActorFrom", "readKnowledgeMutationHistory", "recordKnowledgeMutation", "recordKnowledgeMutationWithin", "resolveAuditDbOrNull"],
      "the audit surface is exactly: project an actor, append, read, resolve the db",
    );
  }

  /* ── 11. THE RECORDING BOUNDARY IS A DECLARED VALUE ─────────────────────── */
  {
    assert.equal(KNOWLEDGE_AUDIT_BOUNDARY.recordsAuthorizedAttempts, true);
    assert.equal(
      KNOWLEDGE_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts,
      false,
      "an unauthenticated caller must never append to a tenant's governance ledger",
    );
    assert.equal(
      KNOWLEDGE_AUDIT_BOUNDARY.recordsForbiddenAttempts,
      false,
      "an authorization failure is an event about a principal, not a change to Knowledge",
    );
    assert.equal(KNOWLEDGE_AUDIT_BOUNDARY.recordsMalformedInput, false);
    assert.match(KNOWLEDGE_AUDIT_BOUNDARY.rationale, /security telemetry/i);
  }

  /* ── 12. THE BOUNDARY IS ENFORCED, NOT JUST DECLARED ───────────────────── */
  {
    let appends = 0;
    const recordMutation = async () => {
      appends += 1;
      return { recorded: true };
    };
    const valid = { factKey: "k", domainKey: "d", scope: "domain", title: "T", statement: "S" };

    // Unauthenticated → refused before anything is recorded.
    await createKnowledgeFact(null, valid, { recordMutation });
    assert.equal(appends, 0, "no ledger entry for an unauthenticated attempt");

    // Forbidden → refused before anything is recorded.
    await createKnowledgeFact(tenant(), valid, {
      resolveAuthority: async () => ({ authorized: false, roleType: "member" }),
      recordMutation,
    });
    assert.equal(appends, 0, "no ledger entry for a forbidden attempt");

    // Malformed → authorized, but no governed identity is named.
    await createKnowledgeFact(tenant(), { factKey: "", domainKey: "", scope: "nope", title: "", statement: "" }, {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => ({
        async createFact() { throw new Error("must not be reached"); },
        async supersedeFact() { throw new Error("must not be reached"); },
      }),
      recordMutation,
    });
    assert.equal(appends, 0, "no ledger entry for malformed input");

    // Authorized + refused by a governed rule → recorded.
    const duplicate = await createKnowledgeFact(tenant(), valid, {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => ({
        async createFact(_actor, input) {
          return {
            status: "duplicate" as const,
            identity: { factId: "44444444-4444-4444-8444-444444444444", factKey: input.factKey, domainKey: input.domainKey, scope: input.scope },
          };
        },
        async supersedeFact() { throw new Error("not exercised"); },
      }),
      recordMutation,
    });
    assert.equal(duplicate.status, "duplicate");
    assert.equal(appends, 1, "an authorized governed refusal IS history");
  }

  /* ── 13. A COMMITTED MUTATION IS AUDITED ONCE, INSIDE THE TRANSACTION ──── */
  {
    let outsideAppends = 0;
    const created = await createKnowledgeFact(tenant(), { factKey: "k", domainKey: "d", scope: "domain", title: "T", statement: "S" }, {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => ({
        async createFact(_actor, input) {
          return {
            status: "created" as const,
            identity: { factId: "55555555-5555-4555-8555-555555555555", factKey: input.factKey, domainKey: input.domainKey, scope: input.scope },
          };
        },
        async supersedeFact() { throw new Error("not exercised"); },
      }),
      recordMutation: async () => {
        outsideAppends += 1;
        return { recorded: true };
      },
    });
    assert.equal(created.status, "created");
    assert.equal(
      outsideAppends,
      0,
      "a committed mutation is not double-recorded outside its transaction",
    );
    // …and the writer really does append inside the transaction.
    const writer = read(WRITER);
    const txStart = writer.indexOf("db.transaction");
    assert.ok(txStart > 0, "the writer opens a transaction");
    // The append must occur AFTER the transaction opens (the import at the top does not count),
    // and must be handed the transaction handle rather than the database.
    const callSite = writer.indexOf("recordKnowledgeMutationWithin(", txStart);
    assert.ok(callSite > txStart, "the audit append happens inside the transaction");
    assert.match(
      writer.slice(callSite, callSite + 120),
      /recordKnowledgeMutationWithin\(\s*tx,/,
      "and is given the transaction handle, not the database",
    );
  }

  /* ── 14. AN AUDIT GAP IS REPORTED, NEVER SWALLOWED ─────────────────────── */
  {
    const result = await createKnowledgeFact(tenant(), { factKey: "k", domainKey: "d", scope: "domain", title: "T", statement: "S" }, {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => ({
        async createFact(_actor, input) {
          return {
            status: "duplicate" as const,
            identity: { factId: "66666666-6666-4666-8666-666666666666", factKey: input.factKey, domainKey: input.domainKey, scope: input.scope },
          };
        },
        async supersedeFact() { throw new Error("not exercised"); },
      }),
      recordMutation: async () => ({ recorded: false, detail: "sink unavailable" }),
    });
    assert.equal(result.status, "duplicate");
    if (result.status !== "duplicate") throw new Error("unreachable");
    assert.equal(result.audited, false, "a failed append is reported as a gap, not hidden");
  }

  /* ── 15. THE CLIENT CANNOT FORGE ANY AUDIT FIELD ────────────────────────
   * Structural: the append takes its actor from `AuditActor` (server-projected from TenantContext),
   * fixes actorType/entityType/simulation/authoritySource, and takes the clock as a parameter — none
   * of which the product input can reach. The server action's input carries no audit field at all.
   */
  {
    const audit = read(AUDIT);
    assert.match(audit, /actorType:\s*"human"/, "actor type is fixed, not supplied");
    assert.match(audit, /actorId:\s*actor\.userId/, "actor id comes from the resolved session");
    assert.match(audit, /tenantId:\s*actor\.tenantId/, "tenant comes from the resolved session");
    assert.match(audit, /entityType:\s*KNOWLEDGE_ENTITY_TYPE/, "entity type is fixed");
    assert.match(audit, /simulation:\s*false/, "simulation flag is fixed");
    assert.match(audit, /authoritySource:\s*"membership"/, "authority source is fixed");

    // `auditActorFrom` is the ONLY supported construction, and it reads only server-owned fields.
    const actor = auditActorFrom(tenant());
    assert.deepEqual(Object.keys(actor).sort(), ["requestId", "sessionContextId", "tenantId", "userId"]);
    assert.equal(actor.tenantId, tenant().tenantId);
    assert.equal(actor.userId, tenant().userId);

    // The client-facing action still accepts content only.
    const actionCode = codeOf(read(ACTION));
    for (const banned of ["outcome", "occurredAt", "auditId", "actorId", "actorType", "result:", "tenantId:"]) {
      assert.ok(!actionCode.includes(banned), `the server action must not accept "${banned}"`);
    }
  }

  /* ── 16. THE APPEND CANNOT EXECUTE ANYTHING ─────────────────────────────── */
  {
    for (const file of [...G1_MODULES, CREATE, WRITER]) {
      const code = codeOf(read(file)).toLowerCase();
      for (const banned of [
        "eval(", "new function(", "child_process", "execsync", "spawnsync", "spawn(",
        "/bin/sh", "fetch(", "readfilesync", "writefilesync", "node:fs", "puppeteer",
        "playwright", "computeruse", "computer_use",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not contain "${banned}"`);
      }
    }
  }

  /* ── 17. AUDIT IS INDEPENDENT OF THE PROVIDER, AND HEBY CANNOT WRITE IT ── */
  {
    for (const file of G1_MODULES) {
      const src = read(file);
      for (const banned of [
        "@/features/heby-model", "@/features/heby-answer", "@/features/heby-commands",
        "@/features/heby-provider-ops", "resolveClaudeDirectorEnabled", "anthropic",
      ]) {
        assert.ok(!src.includes(banned), `${file} must not reach "${banned}"`);
      }
    }
    // Nothing Heby can reach imports the audit writer.
    for (const file of [
      "src/app/(dashboard)/heby/actions.ts",
      "src/features/heby-answer/model-answer.server.ts",
      "src/features/heby-commands/read-commands.server.ts",
      "src/features/heby-answer/knowledge-evidence.server.ts",
    ]) {
      const src = read(file);
      for (const banned of ["governance-audit", "recordKnowledgeMutation", "auditActorFrom"]) {
        assert.ok(!src.includes(banned), `${file} must not write governance history via "${banned}"`);
      }
    }
  }

  /* ── 18. THE EVENT MODEL IS K3-READY WITHOUT CLAIMING K3 ────────────────
   * Only the mutation class that exists today is declared. The metadata already carries the fields a
   * supersession would populate, so K3 becomes an added action — not a new audit authority.
   */
  {
    /*
     * K3 added `knowledge.supersede`, K4 added `knowledge.ratify`, and R6D added
     * `knowledge.retract` — and this is the assertion G1 wrote to be updated by exactly that kind
     * of change: an added ACTION, with no new authority, no migration, and no change to the
     * metadata shape beyond the fields the new verb needs. Each time the vocabulary grew by one
     * verb that a real capability now performs, and the list stays closed to capabilities that do
     * not exist — `knowledge.delete`, `knowledge.rollback` and `knowledge.reject` are still absent,
     * the last one because a rejection changes nothing in Knowledge at all.
     *
     * `knowledge.retract` is emphatically NOT `knowledge.delete`. It names a withdrawal from
     * service: the node keeps its statement, its version and its history, and only its lifecycle
     * moves to the terminal value every reader already honours.
     */
    assert.deepEqual(
      [...KNOWLEDGE_MUTATION_ACTIONS],
      ["knowledge.create", "knowledge.supersede", "knowledge.ratify", "knowledge.retract"],
      "only what exists today",
    );
    /*
     * `knowledge.ratify` left this list when K4 built the capability it names. The list's job is
     * unchanged: a verb may not be declared before something performs it. `knowledge.reject` is
     * here now for the same reason — a rejection records a Governance decision and changes nothing
     * in Knowledge, so there is no Knowledge mutation for it to describe.
     */
    const contracts = codeOf(read(AUDIT_CONTRACTS));
    for (const notYet of [
      "knowledge.update",
      "knowledge.delete",
      "knowledge.reject",
      "knowledge.rollback",
    ]) {
      assert.ok(!contracts.includes(notYet), `"${notYet}" must not be declared before it exists`);
    }

    // A future supersession event is representable with today's types — no shape change needed.
    const futureMetadata: KnowledgeMutationMetadata = {
      factKey: "runbook",
      domainKey: "platform",
      scope: "company-wide",
      priorKnowledgeNodeId: "77777777-7777-4777-8777-777777777777",
      newKnowledgeNodeId: "88888888-8888-4888-8888-888888888888",
      factVersion: 2,
      knowledgeVersion: 2,
    };
    const futureEvent: Omit<KnowledgeMutationEvent, "action"> = {
      identity: { factId: "99999999-9999-4999-8999-999999999999", factKey: "runbook", domainKey: "platform", scope: "company-wide" },
      outcome: "committed",
      metadata: futureMetadata,
    };
    assert.equal(futureEvent.metadata.priorKnowledgeNodeId, "77777777-7777-4777-8777-777777777777");
    assert.equal(futureEvent.metadata.factVersion, 2);
    assert.equal(KNOWLEDGE_ENTITY_TYPE, "knowledge_fact", "the entity type does not change for K3");
  }

  /* ── 19. THE APPEND WRITES CONTENT NOWHERE ──────────────────────────────── */
  {
    const captured: Record<string, unknown>[] = [];
    const fakeWriter = {
      insert() {
        return {
          values(row: Record<string, unknown>) {
            captured.push(row);
            return Promise.resolve();
          },
        };
      },
    };
    await recordKnowledgeMutationWithin(
      fakeWriter as never,
      auditActorFrom(tenant()),
      {
        action: "knowledge.create",
        identity: { factId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", factKey: "k", domainKey: "d", scope: "domain" },
        outcome: "committed",
        metadata: { factKey: "k", domainKey: "d", scope: "domain", newKnowledgeNodeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      },
      new Date("2026-08-11T15:00:00.000Z"),
    );
    assert.equal(captured.length, 1);
    const row = captured[0]!;
    assert.equal(row.previousState, undefined, "no previous content");
    assert.equal(row.nextState, undefined, "no next content");
    assert.equal(row.result, "committed");
    assert.equal(row.actorType, "human");
    assert.equal(row.simulation, false);
    const serialized = JSON.stringify(row);
    assert.ok(!serialized.includes("statement"), "no statement field reaches the ledger");
    assert.ok(!serialized.includes("title"), "no title reaches the ledger");
  }

  console.log("g1 audit-authority-boundaries checks passed");
}

void main();
