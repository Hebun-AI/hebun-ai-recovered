/*
 * KID-2 BOUNDARIES — the bridge may reach Knowledge; nothing else gained that reach.
 *
 * ── THE SENTENCES THIS SUITE MAKES MECHANICAL ───────────────────────────────
 *
 *   1. THE PROVIDER TRANSPORT STILL CANNOT PERSIST ORGANIZATIONAL TRUTH. KID-1's firewall said
 *      that of a seam with no consumers. It has one now, and the direction of the edge is what
 *      makes it still true: the BRIDGE imports the seam, never the reverse.
 *   2. THE BRIDGE IS A COMPOSITION, NOT AN AUTHORITY. It issues no write of its own, names no
 *      table, opens no transaction and holds no database handle. Every act it causes belongs to a
 *      released module it calls by name, and those names are an EXACT census.
 *   3. KNOWLEDGE STILL OWNS NO CONNECTION. I1 §5 is untouched — the bridge lives outside
 *      `src/features/knowledge` for exactly that reason, as `discover-drive-sources` already does.
 *   4. NO SCHEMA, NO MIGRATION, NO RATIFICATION, NO SYNC, NO SECOND DOCUMENT.
 *
 * It walks the REAL import graph in comment-stripped code, so a renamed file cannot satisfy it and
 * a comment naming a forbidden symbol cannot trip it.
 *
 * No database, no network, no key.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (f: string): string =>
  read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const BRIDGE = "src/features/provider-content-admission/admit-provider-document.server.ts";
const ADAPTER = "src/features/provider-content-admission/content-adapter.ts";
const CONTENT_SEAM = "src/features/provider-google/read-drive-content.server.ts";
const TRANSPORT = "src/features/provider-google/google-transport.server.ts";
const DISCOVERY = "src/features/provider-google/discover-drive-sources.server.ts";
const ACTIONS = "src/app/(dashboard)/knowledge/actions.ts";
const CARD = "src/components/knowledge-workspace/provider-document-admission-card.tsx";
const PAGE = "src/app/(dashboard)/knowledge/page.tsx";

/** The ledger this milestone must leave exactly as it found it. */
const MIGRATION_LEDGER = 47; /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). */

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(rel) : /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.join(path.dirname(fromFile), specifier);
  else return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    const abs = path.join(ROOT, candidate);
    if (existsSync(abs) && statSync(abs).isFile()) return candidate;
  }
  return null;
}

/**
 * Runtime import edges only — `import type` is erased and creates none.
 *
 * KID-1 established both the exclusion and the discipline that keeps it honest: the shape of every
 * `@/db/*` import is pinned below, so a future edit that turns one into a value import gains a real
 * runtime edge AND fails that pin.
 */
function edgesFrom(file: string): string[] {
  const code = codeOf(file);
  const specifiers: string[] = [];
  for (const m of code.matchAll(/^\s*(?:import|export)([^=;]*?)from\s*["']([^"']+)["']/gm)) {
    if (/^\s*type\s/.test(m[1]!)) continue;
    specifiers.push(m[2]!);
  }
  for (const m of code.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) specifiers.push(m[1]!);
  return specifiers.map((s) => resolveSpecifier(file, s)).filter((f): f is string => f !== null);
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

/** Every specifier a file names, type-only included — the census reads the surface, not the graph. */
function specifiersOf(file: string): string[] {
  return [...new Set([...codeOf(file).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!))].sort();
}

async function main(): Promise<void> {
  /* ══ 1. THE EDGE POINTS ONE WAY: BRIDGE → PROVIDER, NEVER PROVIDER → BRIDGE ══ */
  {
    for (const providerModule of [CONTENT_SEAM, TRANSPORT, DISCOVERY]) {
      const closure = closureFrom(providerModule);
      assert.ok(
        !closure.has(BRIDGE),
        `${providerModule} must not reach the admission bridge — a provider transport that could ` +
          `admit content would make "provider read is not Knowledge" false`,
      );
      const knowledgeFeature = [...closure].filter((f) => f.startsWith("src/features/knowledge"));
      assert.deepEqual(
        knowledgeFeature,
        [],
        `${providerModule} must reach no Knowledge feature module at all`,
      );
    }
    /*
     * And the bridge does reach the seam — so the assertion above is a statement about DIRECTION,
     * not a coincidence of two unrelated modules.
     */
    assert.ok(
      closureFrom(BRIDGE).has(CONTENT_SEAM),
      "the bridge really does consume the released content seam — this pin is not vacuous",
    );
  }

  /* ══ 2. I1 §5 IS INTACT — KNOWLEDGE STILL OWNS NO CONNECTION ═══════════════ */
  {
    const offenders = collect("src/features/knowledge").filter((file) => {
      const code = codeOf(file);
      return (
        code.includes("integration-authority") ||
        code.includes("provider-catalog") ||
        code.includes("provider-google") ||
        code.includes("provider-content-admission") ||
        /from\s+"@\/db\/schema\/integration"/.test(code)
      );
    });
    assert.deepEqual(
      offenders,
      [],
      "no Knowledge module reads connection, capability or provider state — which is exactly why " +
        "the bridge lives outside that directory, as discovery already does",
    );
    assert.ok(
      !BRIDGE.startsWith("src/features/knowledge/") && !ADAPTER.startsWith("src/features/knowledge/"),
      "and the bridge is not smuggled in under the Knowledge feature",
    );
  }

  /* ══ 3. THE BRIDGE ISSUES NO WRITE AND HOLDS NO HANDLE ════════════════════ */
  {
    for (const file of [BRIDGE, ADAPTER]) {
      const code = codeOf(file);
      for (const banned of [
        ".insert(",
        ".update(",
        ".delete(",
        "transaction(",
        "drizzle",
        "getControlPlaneDb",
        "@/db/schema",
        "audit_log",
        "knowledge_facts",
        "knowledge_nodes",
        "knowledge_external_references",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not contain \`${banned}\``);
      }
      /* No credential, token or secret is named anywhere in this milestone's own modules. */
      for (const banned of [/accessToken/, /refreshToken/, /clientSecret/, /Bearer/, /decrypt/i]) {
        assert.ok(!banned.test(code), `${file} must not name ${banned}`);
      }
    }
    /* The adapter is PURE: no I/O, no clock, no randomness, no tenant. */
    const adapter = codeOf(ADAPTER);
    for (const banned of [/(?<![\w.])fetch\b/, /new Date/, /Math\.random/, /TenantContext/, /process\.env/]) {
      assert.ok(!banned.test(adapter), `the adapter must stay pure: ${banned}`);
    }
  }

  /* ══ 4. THE BRIDGE'S DOORS ARE AN EXACT CENSUS ════════════════════════════ */
  {
    /*
     * EXACT, and that is the whole value of it. Everything the bridge can reach, it reaches through
     * a named released authority; there is no unnamed door. A fifth Knowledge module, a second
     * provider, or a Governance import would have to be written down here by a person.
     *
     * `@/features/provider-google/contracts` and two Knowledge contracts modules appear once each
     * even though the file names some of them in both a value and a type clause — the census is a
     * SET of specifiers, so it measures which doors exist rather than how often each is mentioned.
     */
    assert.deepEqual(
      specifiersOf(BRIDGE),
      [
        "./content-adapter",
        "@/features/auth/tenant/tenant-context",
        "@/features/knowledge/contracts",
        "@/features/knowledge/external-reference-authority.server",
        "@/features/knowledge/external-reference-contracts",
        "@/features/knowledge/file-ingestion-contracts",
        "@/features/knowledge/ingestion-contracts",
        "@/features/knowledge/knowledge-file-ingest.server",
        "@/features/knowledge/knowledge-read.server",
        "@/features/knowledge/knowledge-write-authority.server",
        "@/features/provider-google/contracts",
        "@/features/provider-google/read-drive-content.server",
      ],
      "the bridge composes exactly: the adapter, the tenant type, one provider read, the Knowledge " +
        "write band, the Knowledge file door, one Knowledge read, the reference authority, and " +
        "three pure contracts modules. Nothing else has a door here.",
    );
    assert.deepEqual(
      specifiersOf(ADAPTER),
      ["@/features/knowledge/ingestion-contracts", "@/features/provider-google/contracts"],
      "and the adapter names only the two pure vocabularies it maps between",
    );
  }

  /* ══ 5. THE ACTS IT DOES NOT PERFORM ARE ABSENT, NOT GUARDED ══════════════ */
  {
    const bridge = codeOf(BRIDGE);
    for (const symbol of [
      /* Knowledge acts this milestone is not. */
      "createKnowledgeFact",
      "supersedeKnowledgeFact",
      "retractKnowledgeSource",
      "withdrawExternalReference",
      "createDurableKnowledgeWriter",
      /* Ratification — admission is not approval. */
      "ratifyKnowledgeVersion",
      "rejectKnowledgeVersion",
      "knowledge-ratification",
      /* Governance and execution. */
      "establishGovernanceAuthority",
      "recordDecision",
      "consumeActionPermit",
      "executeAction",
      "dispatchExecution",
      /* Provider lifecycle. */
      "createConnection",
      "disconnectConnection",
      "verifyGoogleConnection",
      "replaceCredential",
    ]) {
      assert.ok(!bridge.includes(symbol), `the bridge must not name \`${symbol}\``);
    }

    /* And ratification is unreachable at ANY depth, not merely unnamed here. */
    const closure = closureFrom(BRIDGE);
    for (const pattern of [
      /^src\/features\/knowledge-ratification/,
      /^src\/features\/action-execution/,
      /^src\/features\/action-authorization/,
      /^src\/features\/agent-origination/,
      /execute-authorized-action/,
      /consume-action-permit/,
    ]) {
      const hits = [...closure].filter((f) => pattern.test(f));
      assert.deepEqual(hits, [], `KID-2 must not reach ${pattern}: ${hits.join(", ")}`);
    }
  }

  /* ══ 6. EVERY @/db IMPORT IN THIS MILESTONE IS TYPE-ONLY, OR ABSENT ═══════ */
  {
    /*
     * The walker above skips type-only imports, which is only sound while the shape is pinned.
     * KID-2's own modules name no database module at all — value or type — so the pin here is the
     * stronger one: the absence itself.
     */
    for (const file of [BRIDGE, ADAPTER]) {
      assert.deepEqual(
        [...codeOf(file).matchAll(/from\s+"(@\/db\/[^"]+)"/g)].map((m) => m[1]!),
        [],
        `${file} names no database module at all — the released authorities hold every handle`,
      );
    }
  }

  /* ══ 7. NO SCHEDULE, NO CRAWL, NO SECOND DOCUMENT ═════════════════════════ */
  {
    const bridge = codeOf(BRIDGE);
    /*
     * WORD BOUNDARIES, NOT SUBSTRINGS — KID-1's finding, reapplied: `async` contains `sync`, and a
     * substring ban would fail on this file's own function keyword.
     */
    for (const banned of ["setInterval", "setTimeout", "cron", "schedule", "sync", "crawl", "poll", "webhook", "watch"]) {
      assert.ok(
        !new RegExp(`\\b${banned}\\b`, "i").test(bridge),
        `no ${banned} in the admission bridge`,
      );
    }
    assert.ok(
      !/fileIds|documents\s*:|batch|folderId|recurse/i.test(bridge),
      "the bridge admits exactly one document — no array, list, batch, folder or recursion",
    );
    /* One provider read per call, and the input has exactly one document field. */
    const inputBlock = /export interface AdmitProviderDocumentInput \{[\s\S]*?\n\}/.exec(bridge);
    assert.ok(inputBlock, "the input contract is declared");
    assert.ok(
      !/tenantId|userId|roleId|actorId|integrationId|credentialId|sourceType|sourceText|standing|digest/.test(
        inputBlock![0],
      ),
      "no tenant, actor, role, connection, credential, source type, text, standing or digest is " +
        "representable in the caller's input",
    );
    assert.match(
      inputBlock![0],
      /readonly fileId: string/,
      "the only provider-shaped field is which document",
    );
  }

  /* ══ 8. THE ACTION IS THE ONLY CLIENT-CROSSABLE ENTRY, AND IS NOT A ROUTE ══ */
  {
    const actions = codeOf(ACTIONS);
    assert.match(actions, /export async function admitProviderDocumentAction/);
    assert.match(
      actions,
      /const tenant = await resolveTenantContext\(\);[\s\S]{0,400}admitProviderDocument\(tenant/,
      "the tenant is resolved server-side and never accepted from the client",
    );
    const action = actions.slice(actions.indexOf("export async function admitProviderDocumentAction"));
    const body = action.slice(0, action.indexOf("\n}\n") + 1);
    assert.ok(
      !/resolveKnowledgeWriteAuthority|getCapabilityAvailability/.test(body),
      "the action holds no gate of its own, which would be a second gate that could drift",
    );
    assert.ok(
      !/tenantId|actorId|roleId|integrationId|credentialId/.test(body),
      "and no authority field is representable in its payload",
    );

    /* KID-2 introduces no HTTP surface. The census is exhaustive on purpose. */
    const routes = collect("src/app")
      .filter((file) => /\/route\.tsx?$/.test(file))
      .map((file) => file.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      routes,
      [
        "src/app/api/integrations/github/setup/route.ts",
        "src/app/api/integrations/github/start/route.ts",
        "src/app/api/integrations/google/callback/route.ts",
        "src/app/api/integrations/google/start/route.ts",
      ],
      "the only route handlers are still the two OAuth pairs — admission is a server action",
    );
  }

  /* ══ 9. NO SCHEMA AND NO MIGRATION ════════════════════════════════════════ */
  {
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
      f.endsWith(".sql"),
    );
    assert.equal(
      migrations.length,
      MIGRATION_LEDGER,
      "KID-0 concluded no schema change is required, and KID-2 adds none — the ledger is unmoved",
    );
  }

  /* ══ 10. THE SURFACE CLAIMS ONLY WHAT HAPPENED ════════════════════════════ */
  {
    const card = read(CARD);
    /* Provisional standing and the trust boundary are stated BEFORE the control, not after it. */
    for (const required of [
      "provisional",
      "not ratified organizational",
      "never as instructions",
      /*
       * ── AMENDED BY THE GOOGLE LEAST-PRIVILEGE ADAPTATION ──────────────────
       *
       * The card used to say the content read was a "separate Google permission" from listing —
       * true while selection needed the restricted metadata scope. Selection now happens in
       * Google's own chooser under the per-file scope, so that sentence would describe a listing
       * this flow no longer performs. The claim it is replaced by is stronger and is the one the
       * whole adaptation exists to make truthful.
       */
      "only the document you choose",
      "The provenance is incomplete",
    ]) {
      assert.ok(card.includes(required), `the admission card must state "${required}"`);
    }
    /*
     * NO OUTCOME IS COLLAPSED. Every arm of the released result type has a branch here, so a new
     * arm cannot be added upstream and silently render as a generic failure.
     */
    for (const arm of [
      "not-authenticated",
      "knowledge-not-authorized",
      "provider-capability-unavailable",
      "provider-refused",
      "provider-read-failed",
      "document-not-admissible",
      "content-refused",
      "classification-refused",
      "admission-unavailable",
      "admission-failed",
      "admitted",
      "already-admitted",
    ]) {
      assert.ok(card.includes(`"${arm}"`), `the card must render the \`${arm}\` outcome by name`);
    }
    const cardCode = codeOf(CARD);
    /*
     * ASKED OVER CODE, NOT PROSE — the sixth collision of this family, and the remedy is the one
     * already recorded: a source that DENIES a phrase contains it. The card's own header says
     * `"Import failed" is never one of them`, which is the truth this assertion checks and would
     * have been read as its violation.
     */
    assert.ok(
      !/Import failed|Something went wrong|Unknown error/i.test(cardCode),
      "and never collapses a refusal into a generic failure",
    );
    /*
     * ── IT OFFERS NO CAPABILITY THAT DOES NOT EXIST, ASSERTED BY MECHANISM ──
     *
     * A vocabulary ban is the wrong instrument here and this suite proved it twice: the card's own
     * honest copy says the read "does not open the folder it is in", which a `\bfolder\b` ban reads
     * as a folder control. So single-selection is asserted by the CONTROL SHAPE instead — a
     * mechanism cannot be talked out of a verdict by prose, and a checkbox appearing later fails
     * this whether or not anybody uses the word "multi-select".
     */
    /*
     * ── THE MECHANISM CHANGED, SO THE MECHANISM ASSERTION CHANGED WITH IT ───
     *
     * KID-2 enforced "exactly one document" with a radio group over a list Hebun had discovered.
     * Selection now happens in GOOGLE'S chooser, so there is no radio group to assert and asserting
     * one would fail for a reason that is not a defect. What replaces it is not weaker: single
     * selection is now enforced at the chooser itself by NOT enabling Google's multi-select
     * feature, and the card still submits exactly one identifier through exactly one call site.
     */
    const PICKER = "src/components/knowledge-workspace/google-picker.client.ts";
    const pickerCode = codeOf(PICKER);
    assert.ok(
      !pickerCode.includes("MULTISELECT_ENABLED") && !pickerCode.includes("MultiSelect"),
      "Google's multi-select feature is never enabled — one document per chooser",
    );
    assert.ok(
      pickerCode.includes("setSelectFolderEnabled(false)") &&
        pickerCode.includes("setIncludeFolders(false)"),
      "and folders are excluded explicitly rather than left to a default",
    );
    assert.ok(
      !cardCode.includes('type="checkbox"') && !/\bmultiple\b/.test(cardCode),
      "there is no multi-select control on the card either",
    );
    assert.equal(
      (cardCode.match(/admitPickedGoogleDocumentAction\(/g) ?? []).length,
      1,
      "exactly one call site, so one confirmation admits one document",
    );
    assert.match(
      cardCode,
      /fileId:\s*picked\.fileId/,
      "and it submits the ONE chosen identifier, never a collection",
    );
    for (const absent of ["folderId", "Sync(", "setInterval", "setTimeout", "Select all", "Import all"]) {
      assert.ok(!cardCode.includes(absent), `the card must offer no \`${absent}\``);
    }
    /* Presentational: it resolves nothing itself. */
    for (const forbidden of [/resolveTenantContext/, /getCapabilityAvailability/, /readDriveContent/, /discoverDriveSources\(/]) {
      assert.ok(!forbidden.test(cardCode), `the card must resolve nothing itself: ${forbidden}`);
    }

    /* Its section declares the authority that actually writes, and the same band as authoring. */
    const page = read(PAGE);
    const idx = page.indexOf('id="provider-admission"');
    assert.ok(idx > 0, "the admission section exists on the canonical Knowledge page");
    const end = page.indexOf("</WorkspaceSection>", idx);
    const section = page.slice(idx, end);
    assert.match(section, /provenance="authoritative"/, "admission writes canonical Knowledge");
    assert.match(section, /authority=\{authoringBand\}/, "under the SAME band that authors it");
  }

  console.log("kid2-provider-content-admission/boundaries-and-firewall: OK");
}

void main();
