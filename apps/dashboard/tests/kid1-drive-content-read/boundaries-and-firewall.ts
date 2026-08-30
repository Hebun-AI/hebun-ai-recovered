/*
 * KID-1 BOUNDARIES — the milestone ends at the provider, and a walker proves it.
 *
 * ── THE SENTENCE THIS SUITE MAKES MECHANICAL ────────────────────────────────
 *
 *   KID-1 CANNOT PERSIST ORGANIZATIONAL TRUTH.
 *
 * Not "does not today" — CANNOT, because no import path from the content seam reaches a Knowledge
 * writer, an ingestion path, an external-reference authority, a canonical Knowledge table, an
 * execution writer or a Governance writer. G6C's lesson applies: a path-name firewall fails both
 * ways, so this walks the REAL import graph from the seam outward.
 *
 *     PROVIDER READ != KNOWLEDGE       CONTENT READ != KNOWLEDGE ADMISSION
 *     AUTHORIZED READ != PERSISTENCE   CONTENT != INSTRUCTION
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEAM = "src/features/provider-google/read-drive-content.server.ts";
const TRANSPORT = "src/features/provider-google/google-transport.server.ts";
const CONTRACTS = "src/features/provider-google/contracts.ts";

const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");

/** Strip comments BEFORE extracting edges — R6B's walker was fooled by prose containing `from"`. */
function codeOf(file: string): string {
  return read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Resolve a `@/`-rooted or relative specifier to a repo-relative .ts file, or null. */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.join(path.dirname(fromFile), specifier);
  else return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(path.join(ROOT, candidate))) return candidate;
  }
  return null;
}

/**
 * Import/export edges, anchored to line start with no `=` in the clause.
 *
 * ── TYPE-ONLY EDGES ARE NOT FOLLOWED, AND THAT IS THE POINT ──────────────────
 *
 * `import type { ControlPlaneDatabase } from "@/db/client.server"` is ERASED by the compiler: it
 * creates no runtime edge, and `client.server.ts` pulls in the whole schema barrel — including the
 * Knowledge tables. Following it would make every module in the repository that names a database
 * type look like it can reach a Knowledge writer, which is false and would make this firewall
 * meaningless by being unpassable.
 *
 * The exclusion is only safe because the shape of that import is PINNED below. A future edit that
 * turns it into a value import gains a real runtime edge AND fails the pin.
 */
function edgesFrom(file: string): string[] {
  const code = codeOf(file);
  const specifiers: string[] = [];
  for (const m of code.matchAll(/^\s*(?:import|export)([^=;]*?)from\s*["']([^"']+)["']/gm)) {
    const clause = m[1];
    /* `import type X from` and `export type { X } from` — erased, so not a runtime edge. */
    if (/^\s*type\s/.test(clause)) continue;
    specifiers.push(m[2]);
  }
  for (const m of code.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) specifiers.push(m[1]);
  return specifiers
    .map((s) => resolveSpecifier(file, s))
    .filter((f): f is string => f !== null);
}

function closureFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const next of edgesFrom(file)) if (!seen.has(next)) queue.push(next);
  }
  return seen;
}

async function main(): Promise<void> {
  const closure = closureFrom(SEAM);
  console.log(`  walked ${closure.size} modules from the content seam`);

  /* ── 1 · NO KNOWLEDGE CAPABILITY IS REACHABLE AT ANY DEPTH ──────────────── */
  {
    /*
     * THE ASSERTION IS ABOUT CAPABILITY, NOT VOCABULARY — R2F.1's correction, applied here.
     *
     * Three Knowledge SCHEMA files are in this closure and always will be: the availability seam
     * needs a database handle, `db/client.server.ts` imports the schema BARREL, and the barrel names
     * every table in the product. That is structurally true of every database-touching module in the
     * repository and it grants nothing — a Drizzle table declaration is a description of a table,
     * not permission to write one. Asserting their absence would be asserting that this seam never
     * touches a database, which is false and would be "fixed" by weakening something real.
     *
     * What must be absent is every module that can DECIDE or PERFORM an admission.
     */
    const featureLevel = [...closure].filter((f) => f.startsWith("src/features/knowledge"));
    assert.deepEqual(
      featureLevel,
      [],
      `no Knowledge feature module may be reachable: ${featureLevel.join(", ")}`,
    );

    for (const f of [
      "src/features/knowledge/knowledge-ingest.server.ts",
      "src/features/knowledge/knowledge-file-ingest.server.ts",
      "src/features/knowledge/durable-knowledge-writer.server.ts",
      "src/features/knowledge/external-reference-authority.server.ts",
      "src/features/knowledge/knowledge-create.server.ts",
      "src/features/knowledge/knowledge-supersede.server.ts",
      "src/features/knowledge/retract-source.server.ts",
      "src/features/knowledge/knowledge-write-authority.server.ts",
    ]) {
      assert.ok(!closure.has(f), `KID-1 must not reach ${f}`);
    }

    /*
     * And the schema files that ARE present arrive ONLY through the shared barrel — never because
     * this milestone named a Knowledge table. Pinning the route is what keeps the exemption honest.
     */
    const knowledgeSchema = [...closure].filter((f) => /^src\/db\/schema\/knowledge/.test(f));
    assert.ok(knowledgeSchema.length > 0, "the barrel really is in the closure — this pin is not vacuous");
    assert.ok(closure.has("src/db/schema/index.ts"), "and it arrives through the barrel");
    for (const file of [SEAM, TRANSPORT, CONTRACTS]) {
      assert.ok(
        !/@\/db\/schema/.test(codeOf(file)),
        `${file} must not name a schema module directly`,
      );
    }
  }

  /* ── 1b · THE ERASED EDGE IS PINNED, SO EXCLUDING IT STAYS HONEST ────────── */
  {
    /*
     * The walker above skips type-only imports. That is only sound while the database handle is
     * imported as a TYPE — a value import would give this seam a real runtime path into the schema
     * barrel, and the Knowledge tables with it. Pin the shape, not the absence.
     */
    const seam = codeOf(SEAM);
    const dbImports = [...seam.matchAll(/^\s*(import|export)([^=;]*?)from\s*["'](@\/db\/[^"']+)["']/gm)];
    assert.ok(dbImports.length > 0, "the seam does name a database type — this pin is not vacuous");
    for (const m of dbImports) {
      assert.match(
        m[2],
        /^\s*type\s/,
        `every @/db import in the content seam must be type-only, found: ${m[0].trim()}`,
      );
    }
    /* And it holds nothing it could write THROUGH: no handle is ever resolved here. */
    assert.ok(!seam.includes("getControlPlaneDb"), "the seam resolves no database handle of its own");
  }

  /* ── 2 · NO EXECUTION AND NO GOVERNANCE WRITER IS REACHABLE ──────────────── */
  {
    /*
     * Same rule as above, for the same reason: `db/schema/action-execution.ts` rides in on the
     * barrel and is a table declaration. What must be unreachable is every module that can
     * AUTHORIZE or PERFORM an act.
     */
    const featureModules = [...closure].filter((f) => f.startsWith("src/features/"));
    for (const pattern of [
      /^src\/features\/action-execution/,
      /execute-authorized-action/,
      /^src\/features\/governance-decision/,
      /decide-action-request/,
      /consume-action-permit/,
      /^src\/features\/agent-origination/,
    ]) {
      const hits = featureModules.filter((f) => pattern.test(f));
      assert.deepEqual(hits, [], `KID-1 must not reach ${pattern}: ${hits.join(", ")}`);
    }
    /* And it names no execution or governance table of its own. */
    for (const file of [SEAM, TRANSPORT, CONTRACTS]) {
      const code = codeOf(file);
      assert.ok(!/action_permits|action_execution|decision_records|audit_log/.test(code),
        `${file} names no authorization, execution or governance table`);
    }

    /*
     * ── THE INTEGRATION AUTHORITY'S OWN AUDIT WRITERS ARE REACHABLE, BY DESIGN ──
     *
     * `governance-audit/integration-credential-audit` and `…-lifecycle-audit` are in this closure
     * because spending a credential may REFRESH it, and the integration authority records its own
     * credential events. Banning them would ban the released token runner.
     *
     * So the pin is not their absence — it is that KID-1 REACHES NO MORE THAN THE RELEASED
     * METADATA SEAM ALREADY DID. This milestone added a second capability, not a wider reach.
     */
    const metadataClosure = closureFrom("src/features/provider-google/read-drive-metadata.server.ts");
    const sensitive = (set: Set<string>) =>
      [...set].filter((f) => /^src\/features\/(governance|action|agent|knowledge)/.test(f)).sort();
    assert.deepEqual(
      sensitive(closure),
      sensitive(metadataClosure),
      "KID-1's reach into governance, action, agent and Knowledge features must equal INT-4's exactly",
    );
  }

  /* ── 3 · THE SEAM ITSELF ISSUES NO WRITE ─────────────────────────────────── */
  {
    for (const file of [SEAM, TRANSPORT]) {
      const code = codeOf(file);
      for (const banned of [".insert(", ".update(", ".delete(", "transaction(", "drizzle"]) {
        assert.ok(!code.includes(banned), `${file} must not contain ${banned}`);
      }
    }
  }

  /* ── 4 · NO CREDENTIAL, TOKEN OR SECRET LEAVES THE BOUNDARY ──────────────── */
  {
    const contracts = read(CONTRACTS);
    const contentType = contracts.slice(contracts.indexOf("export interface GoogleDriveContent"));
    const body = contentType.slice(0, contentType.indexOf("}"));
    for (const banned of ["token", "Token", "credential", "secret", "authorization", "Bearer"]) {
      assert.ok(!body.includes(banned), `GoogleDriveContent must not carry ${banned}`);
    }
    /* The token exists only as a parameter and a header — never in a result or a log. */
    const transport = codeOf(TRANSPORT);
    const contentFn = transport.slice(transport.indexOf("export async function readDriveFileContent"));
    assert.ok(!/console\.(log|error|warn|info)/.test(contentFn), "the content transport logs nothing");
    assert.ok(
      (contentFn.match(/accessToken/g) ?? []).length <= 3,
      "accessToken appears only where it is received and spent",
    );
  }

  /* ── 5 · THE CALLER CHOOSES A DOCUMENT, NEVER A SCOPE OR AN EXPORT TYPE ──── */
  {
    const transport = codeOf(TRANSPORT);
    const contentFn = transport.slice(transport.indexOf("export async function readDriveFileContent"));
    assert.ok(
      !/searchParams\.set\(\s*["']q["']/.test(contentFn),
      "no caller-supplied Drive query, for listDriveFiles' own reason",
    );
    assert.ok(
      contentFn.includes("GOOGLE_DRIVE_EXPORT_MIME"),
      "the export type is the frozen constant, never a parameter",
    );
    assert.ok(
      contentFn.includes("GOOGLE_DRIVE_READABLE_TYPES"),
      "the readable-type map is consulted, not supplied",
    );
    /* Shared drives are not claimed by this capability, exactly as INT-4 declined them. */
    assert.ok(contentFn.includes('"supportsAllDrives"'), "shared drives stay unclaimed");
  }

  /* ── 6 · NO UI, NO SCHEDULER, NO CRAWL WAS ADDED ─────────────────────────── */
  {
    const app = path.join(ROOT, "src/app");
    const grep = (dir: string): string[] => {
      const out: string[] = [];
      const walk = (d: string) => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
            if (readFileSync(p, "utf8").includes("readDriveContent")) out.push(p);
          }
        }
      };
      walk(dir);
      return out;
    };
    assert.deepEqual(grep(app), [], "KID-1 adds no route, action or UI — the seam is server-side only");

    /*
     * ── EXTENDED BY KID-2, AND EXTENDED RATHER THAN RELAXED ──────────────────
     *
     * The assertion above still holds and still means what it meant: no route, action or component
     * names this seam. What CHANGED is that the seam now has a consumer at all — KID-2's admission
     * bridge — and a census that passes because a new caller happened to sit one file away would be
     * passing by accident.
     *
     * So the census is stated exactly: repository-wide, under `src/`, this seam is named by ONE
     * module. That is stricter than the window above, because a second consumer appearing anywhere
     * in the product now has to be written down here.
     */
    const srcImporters: string[] = [];
    const walkSrc = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (entry.isDirectory()) walkSrc(p);
        else if (/\.tsx?$/.test(entry.name)) {
          const rel = path.relative(ROOT, p).replace(/\\/g, "/");
          if (rel !== SEAM && codeOf(rel).includes("readDriveContent")) srcImporters.push(rel);
        }
      }
    };
    walkSrc(path.join(ROOT, "src"));
    assert.deepEqual(
      srcImporters.sort(),
      ["src/features/provider-content-admission/admit-provider-document.server.ts"],
      "exactly one module consumes the content seam: KID-2's admission bridge, which is what a " +
        "bridge is for. A second consumer is a decision somebody records here.",
    );

    /*
     * WORD BOUNDARIES, NOT SUBSTRINGS. `async` contains `sync`, and a substring ban would have
     * failed on the seam's own function keyword — the same collision family this repository has
     * recorded five times in prose guards, arriving here in code.
     */
    const seamCode = codeOf(SEAM);
    for (const banned of ["setInterval", "cron", "schedule", "sync", "crawl", "walkFolder", "poll"]) {
      assert.ok(
        !new RegExp(`\\b${banned}\\b`, "i").test(seamCode),
        `no ${banned} in the content seam`,
      );
    }
    /* One document per call: no array, no list, no batch in the input. */
    assert.ok(!/fileIds|documents\s*:|batch/i.test(seamCode), "the seam reads exactly one document");
  }

  console.log("kid1-drive-content-read/boundaries-and-firewall: OK");
}

void main();
