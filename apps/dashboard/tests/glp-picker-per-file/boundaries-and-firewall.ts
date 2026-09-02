/*
 * GOOGLE LEAST-PRIVILEGE ADAPTATION — BOUNDARIES.
 *
 * ── THE SENTENCES THIS SUITE MAKES MECHANICAL ───────────────────────────────
 *
 *   1. THE PRODUCTION ADMISSION PATH NAMES NO RESTRICTED DRIVE SCOPE.
 *   2. EXACTLY ONE MODULE IN THIS REPOSITORY HANDS A GOOGLE TOKEN TO A CALLER, and it is the
 *      Picker ceremony. INT-4 and KID-1 proved the token never escapes the server; this adaptation
 *      makes a conscious, bounded exception, and this is where the bound lives.
 *   3. NO REFRESH TOKEN AND NO CLIENT SECRET CAN REACH A BROWSER.
 *   4. SELECTION IS NOT ADMISSION — the chooser cannot write Knowledge by itself.
 *   5. NO SCHEMA, NO NEW KNOWLEDGE WRITER, NO SYNC, NO EXECUTION OR GOVERNANCE AUTHORITY.
 *
 * It walks the real import graph in comment-stripped code, so a rename cannot satisfy it and a
 * comment naming a forbidden symbol cannot trip it.
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

const CEREMONY = "src/features/provider-content-admission/authorize-picker-session.server.ts";
const PICKER_ENV = "src/features/provider-google/picker-environment.server.ts";
const PICKER_CLIENT = "src/components/knowledge-workspace/google-picker.client.ts";
const CARD = "src/components/knowledge-workspace/provider-document-admission-card.tsx";
const BRIDGE = "src/features/provider-content-admission/admit-provider-document.server.ts";
const CONTENT_SEAM = "src/features/provider-google/read-drive-content.server.ts";
const RUNNER = "src/features/provider-google/google-authorized-call.server.ts";
const ACTIONS = "src/app/(dashboard)/knowledge/actions.ts";
const PAGE = "src/app/(dashboard)/knowledge/page.tsx";

/** Google's two RESTRICTED Drive scopes, spelled as Google spells them. */
const RESTRICTED_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

/** The migration ledger this adaptation must leave exactly as it found it. */
const MIGRATION_LEDGER = 44; /* GIA-1 grew the ledger 43 -> 44: the `record-work` mandate-scope CHECK. */

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

function edgesFrom(file: string): string[] {
  const code = codeOf(file);
  const specifiers: string[] = [];
  for (const m of code.matchAll(/^\s*(?:import|export)([^=;]*?)from\s*["']([^"']+)["']/gm)) {
    if (/^\s*type\s/.test(m[1]!)) continue;
    specifiers.push(m[2]!);
  }
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

function main(): void {
  /* ══ 1. THE NEW PATH NAMES NO RESTRICTED SCOPE ════════════════════════════ */
  {
    /*
     * The modules the production admission path is made of. `contracts.ts` is deliberately NOT in
     * this list: it DECLARES all three scopes, including the restricted ones the historical
     * capabilities still map to, and that declaration is what keeps those records readable. What
     * must be free of them is the path — the ceremony, the chooser, the surface and the config.
     */
    for (const file of [CEREMONY, PICKER_ENV, PICKER_CLIENT, CARD]) {
      const code = codeOf(file);
      for (const restricted of RESTRICTED_SCOPES) {
        assert.ok(!code.includes(restricted), `${file} must not name the restricted scope ${restricted}`);
      }
      for (const symbol of [
        "GOOGLE_DRIVE_CONTENT_SCOPE",
        "GOOGLE_DRIVE_METADATA_SCOPE",
        "GOOGLE_DRIVE_METADATA_CAPABILITY",
        "discoverDriveSources",
        "listDriveFiles",
      ]) {
        assert.ok(!code.includes(symbol), `${file} must not reach ${symbol}`);
      }
    }
    /* The ceremony gates on the per-file capability BY NAME, and takes no capability parameter. */
    const ceremony = codeOf(CEREMONY);
    assert.ok(
      ceremony.includes("GOOGLE_DRIVE_FILE_CAPABILITY"),
      "the ceremony names the per-file capability as a constant",
    );
    assert.ok(
      !/capability\s*[:?]\s*string/.test(ceremony),
      "and takes no capability parameter — a caller cannot widen which grant opens this door",
    );
  }

  /* ══ 2. EXACTLY ONE MODULE HANDS A GOOGLE TOKEN TO A CALLER ═══════════════ */
  {
    /*
     * ── THE BOUND ON A CONSCIOUS EXCEPTION ───────────────────────────────────
     *
     * INT-4's released firewall asserts the runner never RETURNS a token and that the metadata seam
     * spends it inside its callback. Both are still true and neither file was edited. What changed
     * is that one caller now asks the runner for the token itself, because Google's Picker cannot
     * work without one in the browser.
     *
     * A census of ONE is what keeps that from spreading. A second module doing this is a decision
     * somebody has to record here.
     */
    const escapers = collect("src").filter((f) => /value:\s*accessToken/.test(codeOf(f)));
    assert.deepEqual(
      escapers,
      [CEREMONY],
      "only the Picker ceremony may hand a Google access token to its caller",
    );

    /* The runner itself is UNCHANGED in the property INT-4 pinned. */
    const runner = codeOf(RUNNER);
    assert.ok(
      !/return\s+(accessToken|token|plaintext)\b/.test(runner),
      "the runner still returns no token of its own",
    );
    assert.ok(runner.includes("withDecryptedSecret"), "and still spends through INT-2's boundary");

    /* The ceremony returns the token and NOTHING else that could be spent. */
    const ceremony = codeOf(CEREMONY);
    for (const banned of [
      "refreshToken",
      "oauth_refresh",
      "clientSecret",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "stateSecret",
      "withDecryptedSecret",
      "listCredentialMetadata",
      "replaceCredential",
    ]) {
      assert.ok(!ceremony.includes(banned), `the ceremony must not name \`${banned}\``);
    }
    /*
     * Its result carries no identifier a caller could use to reach another credential.
     *
     * ── ASKED OVER CODE, NOT PROSE — the seventh collision of this family ───
     *
     * The type's own doc comment explains that there is deliberately "no refresh token" in the
     * shape. Read raw, that denial IS the word being banned. A source that describes what it
     * refuses to carry will always trip a vocabulary ban read over its prose.
     */
    const ceremonyCode = codeOf(CEREMONY);
    const from = ceremonyCode.indexOf("export type PickerSessionResult =");
    assert.ok(from > 0, "the result type is declared");
    const resultBlock = [ceremonyCode.slice(from, ceremonyCode.indexOf("export interface", from))];
    for (const banned of ["integrationId", "credentialId", "tenantId", "refresh"]) {
      assert.ok(
        !resultBlock[0]!.includes(banned),
        `the Picker session result must not carry \`${banned}\``,
      );
    }
  }

  /* ══ 3. NOTHING A BROWSER RUNS CAN SEE A SECRET, OR KEEP THE TOKEN ════════ */
  {
    for (const file of [PICKER_CLIENT, CARD]) {
      const code = codeOf(file);
      for (const banned of [
        "refreshToken",
        "clientSecret",
        "GOOGLE_OAUTH_CLIENT_SECRET",
        "GOOGLE_OAUTH_CLIENT_ID",
        "HEBUN_GOOGLE_OAUTH_STATE_SECRET",
        "GOOGLE_PICKER_API_KEY",
        "process.env",
        "withGoogleAccessToken",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not name \`${banned}\``);
      }
      /* THE TOKEN IS NOT PERSISTED. It lives for one chooser and is never written anywhere. */
      for (const sink of ["localStorage", "sessionStorage", "document.cookie", "indexedDB"]) {
        assert.ok(!code.includes(sink), `${file} must not write anything to ${sink}`);
      }
    }
    /* The card never holds the token in component state — it passes it straight to Google. */
    const card = codeOf(CARD);
    assert.ok(
      !/useState[^\n]*accessToken/.test(card) && !/setToken|setAccessToken/.test(card),
      "the card keeps no token in state; it authorizes one per click and hands it to the chooser",
    );
    assert.ok(
      /accessToken:\s*session\.accessToken/.test(card),
      "the token goes from the server answer straight into the chooser call",
    );

    /* The picker client executes nothing it was given, and reaches no Hebun action. */
    const picker = codeOf(PICKER_CLIENT);
    for (const banned of ["eval(", "new Function", "innerHTML", "dangerouslySetInnerHTML"]) {
      assert.ok(!picker.includes(banned), `the chooser module must not contain ${banned}`);
    }
    assert.deepEqual(
      edgesFrom(PICKER_CLIENT),
      [],
      "the chooser module imports nothing at all — it cannot reach an action, an authority or Knowledge",
    );
  }

  /* ══ 4. SELECTION IS NOT ADMISSION ════════════════════════════════════════ */
  {
    /*
     * The ceremony can reach the Knowledge write AUTHORITY — it must, to refuse someone who could
     * not admit anything — but it must reach no Knowledge WRITER, no ingestion path and no
     * external-reference authority. Picking a document writes nothing.
     */
    const closure = closureFrom(CEREMONY);
    for (const forbidden of [
      "src/features/knowledge/knowledge-ingest.server.ts",
      "src/features/knowledge/knowledge-file-ingest.server.ts",
      "src/features/knowledge/durable-knowledge-writer.server.ts",
      "src/features/knowledge/external-reference-authority.server.ts",
      "src/features/knowledge/knowledge-create.server.ts",
      "src/features/knowledge/knowledge-supersede.server.ts",
      "src/features/knowledge/retract-source.server.ts",
      "src/features/provider-content-admission/admit-provider-document.server.ts",
    ]) {
      assert.ok(!closure.has(forbidden), `authorizing a chooser must not reach ${forbidden}`);
    }
    assert.ok(
      closure.has("src/features/knowledge/knowledge-write-authority.server.ts"),
      "it DOES reach the write authority — which is how it refuses someone who could not admit",
    );

    /* No execution, no governance, no agent authority at any depth. */
    for (const pattern of [
      /^src\/features\/action-execution/,
      /^src\/features\/action-authorization/,
      /^src\/features\/governance-decision/,
      /^src\/features\/knowledge-ratification/,
      /^src\/features\/agent-origination/,
    ]) {
      const hits = [...closure].filter((f) => pattern.test(f));
      assert.deepEqual(hits, [], `the ceremony must not reach ${pattern}: ${hits.join(", ")}`);
    }

    /* It writes nothing itself. */
    const ceremony = codeOf(CEREMONY);
    for (const banned of [".insert(", ".update(", ".delete(", "transaction(", "@/db/schema"]) {
      assert.ok(!ceremony.includes(banned), `the ceremony must not contain \`${banned}\``);
    }
  }

  /* ══ 5. THE ADMISSION STILL RE-RESOLVES EVERY AUTHORITY ═══════════════════ */
  {
    /*
     * A picked file id is a PROVIDER IDENTITY and grants nothing. The admission action resolves the
     * tenant from the session and calls the bridge, which resolves the Knowledge band and the
     * provider capability for itself — none of which the browser can influence.
     */
    const actions = codeOf(ACTIONS);
    assert.match(
      actions,
      /const tenant = await resolveTenantContext\(\);[\s\S]{0,400}admitPickedProviderDocument\(tenant/,
      "the tenant is resolved server-side and never accepted from the client",
    );
    const picked = actions.slice(actions.indexOf("export async function admitPickedGoogleDocumentAction"));
    const body = picked.slice(0, picked.indexOf("\n}\n") + 1);
    assert.ok(
      !/capability|scope:\s*"|tenantId|actorId|integrationId|credentialId/.test(body),
      "the picked-admission payload cannot name a capability, tenant, actor, connection or credential",
    );
    /* The chooser authorization takes no input at all. */
    assert.match(
      actions,
      /export async function authorizeGooglePickerSessionAction\(\):/,
      "the chooser authorization accepts no parameters whatsoever",
    );

    /* The bridge still gates on the Knowledge band before touching a provider. */
    const bridge = codeOf(BRIDGE);
    const bodyAt = bridge.indexOf("async function admitUnderCapability");
    assert.ok(bodyAt > 0, "the shared admission body is declared");
    const authorityAt = bridge.indexOf("deps.resolveAuthority ??", bodyAt);
    const readAt = bridge.indexOf("deps.readContent ??", bodyAt);
    assert.ok(
      authorityAt > bodyAt && readAt > authorityAt,
      "the Knowledge band is resolved BEFORE any provider read, on both entry points",
    );
  }

  /* ══ 6. THE SURFACE NO LONGER STANDS ON A RESTRICTED-SCOPE READ ═══════════ */
  {
    const card = codeOf(CARD);
    assert.ok(
      !card.includes("DriveSourceDiscovery") && !card.includes("discovery"),
      "the admission card no longer consumes the Drive-wide discovery listing",
    );
    assert.ok(
      card.includes("authorizeGooglePickerSessionAction") &&
        card.includes("admitPickedGoogleDocumentAction"),
      "it uses the chooser and the per-file admission",
    );
    assert.ok(
      !card.includes("admitProviderDocumentAction"),
      "and never the Drive-wide admission action",
    );
    /* CANCELLING IS NOT A FAILURE, and the surface says so in its own words. */
    assert.ok(card.includes('"cancelled"'), "the chooser's cancellation is a named outcome");
    assert.ok(
      read(CARD).includes("You closed the chooser"),
      "and it is stated as a decision the human made, not as an error",
    );
    const page = codeOf(PAGE);
    assert.ok(
      /ProviderDocumentAdmissionCard[\s\S]{0,160}pickerConfigured=\{isGooglePickerConfigured\(\)\}/.test(page),
      "the page passes a server-resolved BOOLEAN — the Picker's values never pass through it",
    );
    assert.ok(
      !/ProviderDocumentAdmissionCard[\s\S]{0,160}discovery=/.test(page),
      "and no longer passes the discovery listing to the admission card",
    );
  }

  /* ══ 7. NO SYNC, NO SCHEMA, NO SECOND DOCUMENT ════════════════════════════ */
  {
    for (const file of [CEREMONY, PICKER_CLIENT, PICKER_ENV]) {
      const code = codeOf(file);
      for (const banned of ["setInterval", "cron", "schedule", "sync", "crawl", "poll", "webhook"]) {
        assert.ok(
          !new RegExp(`\\b${banned}\\b`, "i").test(code),
          `no ${banned} in ${file}`,
        );
      }
    }
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
      f.endsWith(".sql"),
    );
    assert.equal(
      migrations.length,
      MIGRATION_LEDGER,
      "a permission change is not a schema change — the ledger is unmoved",
    );
    /* The content seam still reads exactly one document. */
    const seam = codeOf(CONTENT_SEAM);
    assert.ok(!/fileIds|batch|folderId/i.test(seam), "the content seam still reads one document");
  }

  console.log("glp-picker-per-file/boundaries-and-firewall: OK");
}

main();
