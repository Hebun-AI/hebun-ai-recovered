/*
 * K1 closure — the Knowledge AUTHORITY reconciliation guard.
 *
 * THE CONTRADICTION THIS PINS. `knowledge-canonical-repository` marks the SEEDED in-memory store
 * `authoritative: true` and the canonical Postgres read `authoritative: false`. Read as a claim
 * about organizational truth that is alarming. It is not one: in `CanonicalRepositoryDescriptor`
 * the flag is the DUAL-READ ROUTER ROLE — which participant's result is returned versus which is
 * compared and discarded — and the values are correct for that meaning
 * (`routeKnowledgeRead` hardcodes `authoritativeProvider: "memory"` to match).
 *
 * The real invariant is not the flag's value. It is that the seeded store owns no organizational
 * Knowledge and can never answer a product read. That is what this file pins, so that the day
 * someone wires the migration scaffolding into a product surface, or lets a K1 module import the
 * seeded store, or adds a runtime branch on the routing flag, the build says so.
 *
 * Structural, over the shipped source. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createKnowledgeCanonicalRepository } from "../../src/features/knowledge-canonical-repository";

const read = (path: string) => readFileSync(path, "utf8");

/** The migration/diagnostics scaffolding — legitimate, but never a product Knowledge path. */
const SCAFFOLDING = [
  "@/features/knowledge-canonical-repository",
  "@/features/knowledge-read-facade",
  "@/features/knowledge-silent-dual-read",
  "@/features/knowledge-shadow-read",
];

/** The seeded / mock Knowledge stores. Never organizational truth. */
const SEEDED = [
  "@/features/knowledge-crud",
  "@/features/knowledge-graph",
  "@/features/knowledge-domain",
];

/** The K1 product Knowledge path, plus everything Heby's answer flow runs through. */
const PRODUCT_KNOWLEDGE_PATH = [
  "src/features/knowledge/contracts.ts",
  "src/features/knowledge/capability-map.ts",
  "src/features/knowledge/durable-knowledge-repository.server.ts",
  "src/features/knowledge/knowledge-read.server.ts",
  "src/features/heby-answer/knowledge-evidence.server.ts",
  "src/features/heby-answer/model-answer.server.ts",
  "src/features/heby-commands/read-commands.server.ts",
  "src/app/(dashboard)/heby/actions.ts",
];

function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/** Every .ts/.tsx file under a directory. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

function main(): void {
  /* ── 36. THE FLAG MEANS ROUTING ROLE, AND SAYS SO WHERE IT IS DEFINED ───── */
  {
    const types = read("src/features/canonical-repository/types.ts");
    assert.match(
      types,
      /DUAL-READ ROUTING ROLE/,
      "the descriptor field states its routing meaning at its own definition",
    );
    assert.match(
      types,
      /does NOT mean "source of organizational truth"/i,
      "and explicitly disclaims the organizational-truth reading",
    );

    const repository = read("src/features/knowledge-canonical-repository/index.ts");
    assert.match(repository, /DUAL-READ MIGRATION/, "the pair declares what it is");
    assert.match(
      repository,
      /owns no organizational Knowledge/i,
      "and states that the seeded store owns none",
    );
    assert.match(
      repository,
      /knowledge_facts[\s\S]*knowledge_nodes/,
      "and names where the real Knowledge authority lives",
    );
  }

  /* ── 37. THE VALUES ARE UNCHANGED — RECONCILIATION MOVED NO AUTHORITY ────
   * Flipping these booleans would MISSTATE the routing role, which is the thing they describe.
   * They are pinned so a later "fix" cannot silently redefine the dual-read pair.
   */
  {
    const pair = createKnowledgeCanonicalRepository({ memoryNodes: [] });
    assert.equal(pair.authoritative.descriptor.provider, "memory");
    assert.equal(pair.authoritative.descriptor.authoritative, true, "memory is the read-router primary");
    assert.equal(pair.shadow.descriptor.provider, "postgres");
    assert.equal(pair.shadow.descriptor.authoritative, false, "postgres is the shadow participant");
    // Neither participant may ever write.
    assert.equal(pair.authoritative.descriptor.capabilities.write, false);
    assert.equal(pair.shadow.descriptor.capabilities.write, false);
  }

  /* ── 38. NOTHING BRANCHES ON THE ROUTING FLAG ────────────────────────────
   * The flag is descriptive metadata. A runtime branch on it would turn a migration detail into a
   * truth decision — exactly the confusion this reconciliation exists to prevent.
   */
  {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const code = codeOf(read(file));
      // `repositories.authoritative` / `pair.authoritative` is the repository SLOT, which is fine.
      // Reading `.descriptor.authoritative` would be a branch on the routing flag.
      if (/\.descriptor\s*\.\s*authoritative\b/.test(code)) offenders.push(file);
    }
    assert.deepEqual(offenders, [], "no source module reads the routing flag");
  }

  /* ── 39. THE SEEDED STORE CANNOT REACH A PRODUCT KNOWLEDGE READ ─────────── */
  {
    for (const file of PRODUCT_KNOWLEDGE_PATH) {
      const src = read(file);
      for (const banned of [...SEEDED, ...SCAFFOLDING]) {
        assert.ok(
          !src.includes(banned),
          `${file} must not import "${banned}" — the product Knowledge path reads the canonical authority only`,
        );
      }
    }
  }

  /* ── 40. THE SCAFFOLDING STAYS BEHIND THE GATED DIAGNOSTICS PAGE ─────────
   * Its only permitted consumers are the canonical-read diagnostics module and tests. Any other
   * importer means the migration pair has acquired a product consumer.
   */
  {
    const permitted = new Set([
      "src/features/canonical-read/diagnostics.ts",
      "src/features/knowledge-read-facade/service.ts",
      "src/features/knowledge-read-facade/router.ts",
      "src/features/knowledge-canonical-repository/index.ts",
      "src/features/knowledge-silent-dual-read/hook.ts",
      // The diagnostics PAGE renders that model. Type-only imports, and the page itself lives at
      // the double-gated /_internal/canonical-read route.
      "src/components/canonical-read/diagnostics-page.tsx",
    ]);
    const importers: string[] = [];
    for (const file of walk("src")) {
      const normalized = file.replace(/\\/g, "/");
      if (permitted.has(normalized)) continue;
      if (normalized.startsWith("src/features/knowledge-read-facade/")) continue;
      if (normalized.startsWith("src/features/knowledge-shadow-read/")) continue;
      if (normalized.startsWith("src/features/knowledge-silent-dual-read/")) continue;
      const src = read(file);
      if (SCAFFOLDING.some((module) => src.includes(module))) importers.push(normalized);
    }
    assert.deepEqual(
      importers,
      [],
      "the Knowledge dual-read scaffolding has no consumer outside diagnostics and its own modules",
    );

    // And the diagnostics surface itself stays double-gated.
    const diagnostics = read("src/features/canonical-read/diagnostics.ts");
    assert.match(
      diagnostics,
      /env\.NODE_ENV\s*!==\s*"production"\s*&&/,
      "diagnostics are off in production",
    );
    assert.match(
      diagnostics,
      /HEBUN_ENABLE_CANONICAL_READ_DIAGNOSTICS/,
      "and additionally require an explicit opt-in flag",
    );
  }

  /* ── 41. ONE KNOWLEDGE AUTHORITY, NAMED ─────────────────────────────────
   * The product read reaches the canonical tables directly, and nothing else in the product path
   * claims to own Knowledge truth.
   */
  {
    const repository = read("src/features/knowledge/durable-knowledge-repository.server.ts");
    assert.ok(
      repository.includes('from "@/db/schema/knowledge-fact"') &&
        repository.includes('from "@/db/schema/knowledge"'),
      "the product Knowledge read binds to the canonical schema",
    );
    assert.ok(
      repository.includes('from "@/db/client.server"'),
      "over the R1 control-plane database",
    );
    // Enterprise Memory is a DIFFERENT authority and must not be borrowed as Knowledge.
    for (const file of PRODUCT_KNOWLEDGE_PATH.filter((path) => path.includes("/knowledge/"))) {
      const src = read(file);
      assert.ok(
        !src.includes("@/features/enterprise-memory"),
        `${file} must not treat Enterprise Memory as Knowledge`,
      );
    }
  }

  console.log("k1 authority-reconciliation checks passed");
}

main();
