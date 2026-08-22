/*
 * K2.1 — governance hardening: the authority is coarse, and it says so everywhere.
 *
 * K2 shipped with a real limitation: Knowledge authoring is gated on a role BAND, because the
 * fine-grained `permissions` / `role_permissions` model has no runtime. That limitation is fine.
 * What is not fine is a stray UI sentence, report, or later phase quietly presenting it as a
 * per-capability grant. So K2.1 made the authority KIND a declared value, and this file pins it —
 * including the structural fact that no permission runtime exists to justify a finer claim.
 *
 * It also pins the auditability distinction: durable per-record attribution is not an append-only
 * audit log, and K2.1 invented neither.
 *
 * Pure/structural. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { KNOWLEDGE_WRITE_AUTHORITY_MODEL } from "../../src/features/knowledge/create-contracts";
import { KNOWLEDGE_AUTHOR_ROLE_TYPES } from "../../src/features/knowledge/knowledge-write-authority.server";

const read = (path: string) => readFileSync(path, "utf8");

const CARD = "src/components/knowledge-workspace/knowledge-authoring-card.tsx";
const RECORDS = "src/components/knowledge-workspace/knowledge-records.tsx";
const PAGE = "src/app/(dashboard)/knowledge/page.tsx";
const AUTHORITY = "src/features/knowledge/knowledge-write-authority.server.ts";
const CONTRACTS = "src/features/knowledge/create-contracts.ts";
const WRITER = "src/features/knowledge/durable-knowledge-writer.server.ts";

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

function main(): void {
  /* ── 30. THE AUTHORITY KIND IS DECLARED, NOT DESCRIBED IN PROSE ─────────── */
  {
    assert.equal(KNOWLEDGE_WRITE_AUTHORITY_MODEL.kind, "role-band");
    assert.equal(
      KNOWLEDGE_WRITE_AUTHORITY_MODEL.fineGrainedPermissionRuntimeConnected,
      false,
      "Hebun must not claim a per-capability Knowledge permission it does not have",
    );
    assert.deepEqual([...KNOWLEDGE_WRITE_AUTHORITY_MODEL.bands], ["owner", "director"]);
    // The resolver's set is DERIVED from the declaration, so the two cannot drift apart.
    assert.deepEqual(
      [...KNOWLEDGE_AUTHOR_ROLE_TYPES].sort(),
      [...KNOWLEDGE_WRITE_AUTHORITY_MODEL.bands].sort(),
      "the enforced bands are the declared bands",
    );
    assert.match(
      KNOWLEDGE_WRITE_AUTHORITY_MODEL.operatorSummary,
      /coarse authority check, not a fine-grained grant/,
      "and the operator sentence says so plainly",
    );
  }

  /* ── 31. THE CLAIM MATCHES REPOSITORY REALITY ───────────────────────────
   * `fineGrainedPermissionRuntimeConnected: false` is only honest while no code reads the
   * permission tables. If a real runtime lands, this test fails and the declaration must change
   * with it — which is the point.
   */
  {
    const consumers: string[] = [];
    for (const file of walk("src")) {
      if (file.replace(/\\/g, "/").startsWith("src/db/schema/")) continue;
      const src = read(file);
      if (
        src.includes("rolePermissions") ||
        src.includes('from "@/db/schema/role-permission"') ||
        src.includes('from "@/db/schema/permission"')
      ) {
        consumers.push(file);
      }
    }
    assert.deepEqual(
      consumers,
      [],
      "no permission-resolution runtime exists, so the coarse-authority declaration is accurate",
    );
  }

  /* ── 32. THE UI READS THE DECLARATION RATHER THAN RESTATING IT ──────────── */
  {
    const card = read(CARD);
    assert.ok(
      card.includes("KNOWLEDGE_WRITE_AUTHORITY_MODEL.operatorSummary"),
      "the refusal copy comes from the declaration, not a hand-written duplicate",
    );
    // A hard-coded band list in the component would be exactly that duplicate.
    const code = codeOf(card);
    assert.ok(
      !/owner and director authority bands/.test(code),
      "the component does not carry its own copy of the band sentence",
    );
  }

  /* ── 33. K2.1 INVENTED NO PERMISSION MODEL, ROLE, OR AUTH STORE ──────────
   * NOTE for future readers: `"knowledge.create"` is NOT banned here. G1 introduced it as an AUDIT
   * ACTION name on `audit_log`, which is a different concept from a permission key — recording that
   * a create happened does not grant anyone the right to perform one. What stays banned is the
   * permission-catalogue machinery itself.
   */
  {
    for (const file of [AUTHORITY, CONTRACTS, WRITER, PAGE, CARD]) {
      const code = codeOf(read(file));
      for (const banned of [
        "createPermission",
        "grantPermission",
        "hasPermission",
        "permissionKey",
        "insert(permissions",
        "insert(rolePermissions",
        "roleTypeEnum",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not introduce "${banned}"`);
      }
    }
  }

  /* ── 34. CREATION COPY CLAIMS NOTHING THE RECORD DOES NOT OWN ───────────
   * The record is written draft/provisional/unratified, so the UI may not call it approved,
   * verified, trusted, certified, or authoritative.
   */
  {
    const card = read(CARD);
    // The consequence block must state each of these, so the operator is not guessing.
    for (const required of [
      "This will create organizational Knowledge",
      "draft",
      "provisional",
      "no ratification",
      "evidence",
      "grants no execution authority",
      "cannot be edited or deleted",
    ]) {
      assert.ok(card.includes(required), `the consequence step must state "${required}"`);
    }
    // The final action is unambiguous.
    assert.ok(card.includes(">Create Knowledge<") || card.includes("Create Knowledge"), "final action reads Create Knowledge");
    for (const vague of [">Save<", ">OK<", ">Done<", ">Submit<"]) {
      assert.ok(!card.includes(vague), `the final action must not be "${vague}"`);
    }
    // No fabricated quality signal anywhere on the Knowledge surfaces.
    for (const file of [CARD, RECORDS]) {
      const code = codeOf(read(file)).toLowerCase();
      for (const banned of ["confidence", "trust score", "quality score", "certified", "verified badge", "relevance"]) {
        assert.ok(!code.includes(banned), `${file} must not display "${banned}"`);
      }
    }
  }

  /* ── 35. ATTRIBUTION IS NOT AN AUDIT LOG, AND KNOWLEDGE OWNS NEITHER ────
   * Per-record attribution answers "who established the CURRENT record"; mutation history answers
   * "what was attempted and how did it end". They stayed distinct through K2.1, and G1 connected the
   * second one — over the pre-existing shared `audit_log` sink, owned by `features/governance-audit`.
   * What must remain true either way: Knowledge does not define, and does not directly write, an
   * audit table of its own.
   */
  {
    // No Knowledge module defines a table or reaches an audit/event sink directly. The ONLY
    // permitted route is the governance-audit module's own API.
    for (const file of walk("src/features/knowledge")) {
      const code = codeOf(read(file));
      for (const banned of [
        '@/db/schema/audit-log',
        '@/db/schema/event-log',
        "eventLogs",
        "commandAudit",
        "telemetryEvents",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not reach "${banned}" directly`);
      }
      assert.ok(!code.includes("pgTable("), `${file} must not define a table`);
    }

    /*
     * Only declared `governance-audit` owners write the shared sink.
     *
     * This was "exactly one module" until G2.1 added pre-Governance genesis entitlement as a
     * SIBLING audit domain — its own boundary constant and entity type, with neither side
     * referencing the other's. The claim that matters for K2 is unchanged and still asserted just
     * above: no Knowledge module reaches the sink directly. Knowledge's route remains
     * `knowledge-mutation-audit.server.ts`, and nothing else writes Knowledge history.
     */
    /*
     * R7.1 repair: writing is detected by the write verbs, not by importing the schema.
     *
     * The list was built from `from "@/db/schema/audit-log"` and named `sinkWriters`. Every importer
     * was a writer until R7.1 added the sink's first reader, which counts rows and writes nothing —
     * and a write assertion flagged it. K2's own claim is unchanged and is the one proved first
     * below; the reachability census follows, so nothing slips into the sink unnoticed either.
     */
    const sinkOwners = [
      "src/features/governance-audit/action-authorization-audit.server.ts",
      "src/features/governance-audit/action-execution-audit.server.ts",
      "src/features/governance-audit/genesis-nomination-audit.server.ts",
      "src/features/governance-audit/governance-decision-audit.server.ts",
      "src/features/governance-audit/human-onboarding-audit.server.ts",
      "src/features/governance-audit/identity-enrollment-audit.server.ts",
      "src/features/governance-audit/integration-lifecycle-audit.server.ts",
      "src/features/governance-audit/knowledge-mutation-audit.server.ts",
    ];
    const sinkWriters: string[] = [];
    const sinkImporters: string[] = [];
    for (const file of walk("src")) {
      const normalized = file.replace(/\\/g, "/");
      if (normalized.startsWith("src/db/schema/")) continue;
      const source = read(file);
      if (/\.(insert|update|delete)\(\s*auditLog\s*\)/.test(codeOf(source))) sinkWriters.push(normalized);
      if (source.includes('from "@/db/schema/audit-log"')) sinkImporters.push(normalized);
    }
    assert.deepEqual(
      sinkWriters.sort(),
      sinkOwners,
      "only declared governance-audit owners write the sink; Knowledge goes through its own",
    );
    assert.deepEqual(
      sinkImporters.sort(),
      [...sinkOwners, "src/features/governance-activity/read.server.ts"].sort(),
      "and no Knowledge module reaches the sink — the only non-writer that imports it is R7.1's reader",
    );
    // The genesis sibling must not have quietly taken over Knowledge's entity type.
    assert.ok(
      !read("src/features/governance-audit/genesis-nomination-audit.server.ts").includes(
        "KNOWLEDGE_ENTITY_TYPE",
      ),
      "the genesis writer must never file events under Knowledge's entity type",
    );

    // The writer records attribution on the canonical rows themselves.
    const writer = codeOf(read(WRITER));
    assert.match(writer, /createdBy:\s*actor\.userId/, "the node records the authenticated actor");
    assert.match(writer, /createdByType:\s*"human"/);
    assert.match(writer, /selectedByActorId:\s*actor\.userId/, "and so does the fact's selection");
    assert.match(writer, /selectedByActorType:\s*"human"/);
  }

  /* ── 36. K2.1 ADDED NO EDIT, DELETE, OR RATIFY PATH ─────────────────────── */
  {
    const surfaces = [CARD, RECORDS, PAGE, "src/app/(dashboard)/knowledge/actions.ts"];
    for (const file of surfaces) {
      const code = codeOf(read(file)).toLowerCase();
      /*
       * K3 added correction-by-supersession, so "supersede" is legitimate. K4 added
       * Governance-backed ratification of one exact version, so "ratify" and "reject" are now
       * legitimate too — and they are NOT Knowledge editing themselves: a ratification adds
       * Governance linkage and a rejection writes nothing at all.
       *
       * Editing, deleting, rolling back and blanket "approve" remain absent, because those
       * capabilities still do not exist. That is what this assertion has always been for.
       */
      for (const banned of ["deleteknowledge", "updateknowledge", "editknowledge", "approveknowledge", "rollbackknowledge"]) {
        assert.ok(!code.includes(banned), `${file} must not expose "${banned}"`);
      }
    }
    /*
     * The action module's surface is a closed list, and it grows only when a real capability does.
     * K4 added Governance review of one exact version: `ratify` binds a decision to that version,
     * `reject` records a decision and writes nothing to Knowledge at all. Still absent, because
     * they still do not exist: delete, edit, rollback, un-ratify.
     */
    const actions = read("src/app/(dashboard)/knowledge/actions.ts");
    const exported = [...actions.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]);
    assert.deepEqual(
      exported.sort(),
      [
        "createKnowledgeAction",
        "ingestKnowledgeAction",
        /* R4C.1 — the file boundary. Create-class like the paste beside it, and no wider. */
        "ingestKnowledgeFileAction",
        "ratifyKnowledgeVersionAction",
        "readKnowledgeVersionsAction",
        "rejectKnowledgeVersionAction",
        /*
         * R6D — retracting one ingestion source. Create-class authority, withdrawal-class effect:
         * it resolves the SAME write band and deletes nothing.
         */
        "retractKnowledgeSourceAction",
        "supersedeKnowledgeAction",
      ],
      "create, ingest, ingest-a-file, supersede, ratify, reject, retract a source, plus one read. Ingest is\n"
      + "create-class: many facts through the same writer, never an edit. No delete, no edit, no rollback.",
    );
  }

  console.log("k2.1 governance-hardening checks passed");
}

main();
