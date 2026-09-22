/*
 * MEDIA-1 — structural firewall.
 *
 * What only reading the source can prove:
 *   - the asset's byte identity has no writer; the ONLY update of `media_assets` sets retirement;
 *   - nothing outside the Media Asset authority and its review reaches it (no route, action, surface);
 *   - review cannot reach action requests, permits or execution;
 *   - no storage SDK, no vendor name, no new dependency, no logging of URLs;
 *   - the test fakes never enter the application;
 *   - the code limits and the database CHECKs state the same numbers;
 *   - the migration is additive and touches no existing table.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  MEDIA_ASSET_LIMITS,
  MEDIA_ASSET_MIME_TYPES,
} from "../../src/features/media-assets/contracts";
import {
  GOVERNANCE_SUBJECT_TYPES,
  SUBJECT_GOVERNANCE_DOMAIN,
} from "../../src/features/governance-decision/contracts";

const read = (f: string): string => readFileSync(f, "utf8");
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const SRC = walk("src");
const MEDIA = SRC.filter((f) => f.startsWith("src/features/media-assets/"));
const REVIEW = SRC.filter((f) => f.startsWith("src/features/media-asset-review/"));
const code = (f: string): string => stripComments(read(f));

/* ── 1. Byte identity has no writer; retirement is the only update ────────── */
{
  const updaters = SRC.filter((f) => /\.update\(\s*mediaAssets\s*\)/.test(code(f)));
  assert.deepEqual(updaters, ["src/features/media-assets/retire-media-asset.server.ts"], "only retirement updates media_assets");
  const retire = code("src/features/media-assets/retire-media-asset.server.ts");
  const setBlock = /\.set\(\{([^}]*)\}\)/.exec(retire)?.[1] ?? "";
  const keys = setBlock.split(",").map((part) => part.split(":")[0]!.trim()).filter(Boolean).sort();
  assert.deepEqual(keys, ["assetLifecycleStatus", "retiredAt", "retiredByActorId"], "retirement sets only the retirement columns");

  const inserters = SRC.filter((f) => /\.insert\(\s*mediaAssets\s*\)/.test(code(f)));
  assert.deepEqual(inserters, ["src/features/media-assets/request-media-generation.server.ts"], "only admission inserts an asset");
  const invocationWriters = SRC.filter((f) => /\.(insert|update)\(\s*mediaGenerationInvocations\s*\)/.test(code(f)));
  assert.deepEqual(invocationWriters, ["src/features/media-assets/request-media-generation.server.ts"]);
  for (const f of SRC) {
    assert.ok(!/\.delete\(\s*(mediaAssets|mediaGenerationInvocations)\s*\)/.test(code(f)), `${f} deletes nothing media`);
    assert.ok(!/delete\s+from\s+media_/i.test(code(f)), `${f} issues no raw media delete`);
  }
  assert.ok(!/\b(delete|remove|purge)\s*\(/.test(code("src/features/media-assets/media-object-store.ts")), "the storage port has no delete verb");
}

/* ── 2. Nothing outside the authority reaches it: no human door in MEDIA-1 ── */
{
  /* The storage acceptance run reaches the storage PORT only (resolver, port types, key function);
     tests/media-storage-acceptance pins that it imports nothing else and holds no authority. */
  const allowedImporters = new Set([
    ...MEDIA,
    ...REVIEW,
    "src/db/schema/index.ts",
    "src/features/governance-decision/decision-authority.server.ts",
    "src/features/media-storage-acceptance/run-storage-acceptance.server.ts",
    /* MEDIA-2A: the OpenAI transport imports only the port's TYPES (see section 4c). */
    "src/features/media-generation-live/openai-image-transport.server.ts",
    /* MEDIA-2B: the human door — exactly one action and one surface (section 2b). */
    "src/app/(dashboard)/operations/actions.ts",
    "src/components/operations-preparation/generate-image-with-hebun.tsx",
    /* MEDIA-3: seeing and deciding — the asset surface and the composer that places it. */
    "src/components/operations-preparation/revision-media-assets.tsx",
    "src/components/operations-preparation/operations-preparation.tsx",
    /*
     * CONTENT-COMPOSE-1: composition CONSUMES the authority and never becomes one. The writer reads
     * `media_assets.asset_lifecycle_status` to gate selection on custody and writes only
     * `content_selected_media`; the reader joins the asset row for display and the review reader for
     * judgement. Neither writes a media row, a lifecycle or a decision — pinned in
     * tests/content-compose1/package-and-firewall.
     */
    "src/features/content-composition/select-media.server.ts",
    "src/features/content-composition/read-content-package.server.ts",
  ]);
  for (const f of SRC) {
    const c = code(f);
    const touches =
      /features\/media-assets\//.test(c) ||
      /features\/media-asset-review\//.test(c) ||
      /schema\/media-asset["']/.test(c);
    if (touches) assert.ok(allowedImporters.has(f), `${f} must not reach the Media Asset authority in MEDIA-1`);
  }
  const decisionAuthority = code("src/features/governance-decision/decision-authority.server.ts");
  assert.match(decisionAuthority, /from "@\/features\/media-asset-review\/contracts"/);
  assert.ok(!/media-asset-review\/review-media-asset/.test(decisionAuthority), "the G2 writer imports only the review vocabulary");
  /* ── 2b. MEDIA-2B: the door is EXACTLY these three files, and nothing more ──
     MEDIA-1 banned every mention under src/app and src/components. MEDIA-2B does not relax that
     into "anything may reach it" — it names the whole reachable set and pins it, so a fourth file
     cannot acquire a generation path without this assertion failing. */
  const doorFiles = SRC.filter(
    (f) =>
      (f.startsWith("src/app/") || f.startsWith("src/components/")) &&
      /media[-_]?asset|mediaAsset|requestMediaGeneration/i.test(code(f)),
  ).sort();
  assert.deepEqual(
    doorFiles,
    [
      "src/app/(dashboard)/operations/actions.ts",
      "src/components/operations-preparation/content-package-panel.tsx",
      "src/components/operations-preparation/generate-image-with-hebun.tsx",
      "src/components/operations-preparation/operations-preparation.tsx",
      "src/components/operations-preparation/revision-media-assets.tsx",
    ],
    /* CONTENT-COMPOSE-1 added the package panel: it renders selected images and a readiness the
       reader already decided. It holds no authority and issues no generation — the set is still
       enumerated exactly, so a sixth file cannot acquire a path without this failing. */
    "exactly one action file and the MEDIA-3 + CONTENT-COMPOSE-1 surfaces may reach the Media Asset authority",
  );

  /* The action is a pass-through: it calls the authority and holds none of its own. */
  const doorAction = code("src/app/(dashboard)/operations/actions.ts");
  assert.match(doorAction, /requestMediaGeneration\(tenant, input\)/, "the door passes the session tenant, never a client one");
  assert.ok(!/tenantId\s*[:,]/.test(doorAction), "no action in this file accepts a tenant id");
  /*
   * MEDIA-3 READS, AND THAT IS ALL IT DOES. These bans apply to EVERY file that may reach the
   * authority, reading or writing: none may name a media table, write a media row, reach the
   * provider or its credential, approve on its own, publish, or retire. The review surface calls
   * the released Governance writers through the action seam — it never touches `decision_records`.
   */
  for (const f of doorFiles) {
    const c = code(f);
    assert.ok(!/mediaAssets|mediaGenerationInvocations/.test(c), `${f}: names no media table`);
    assert.ok(!/\.(insert|update|delete)\(/.test(c) || !/media/i.test(c), `${f}: writes no media row`);
    /* Naming the provider in user-facing copy is honest and stays allowed; REACHING it does not.
       What is banned is the endpoint, the credential, the transport module and its constants. */
    assert.ok(
      !/api\.openai\.com|HEBUN_OPENAI|OPENAI_IMAGE_|media-generation-live|createOpenAiImageTransport/.test(c),
      `${f}: never reaches the provider, its credential or its transport`,
    );
    assert.ok(!/process\.env/.test(c), `${f}: reads no configuration, so it cannot infer capability`);
    assert.ok(!/writeGovernanceDecision|decisionRecords|governanceSessions/.test(c), `${f}: never writes a Governance record itself`);
    /* Again: SAYING "this is not published" is the honest copy; REACHING a publishing authority is
       what must be impossible. Identifiers and module paths, never prose. */
    assert.ok(
      !/recordActionRequest|action-authorization|action-execution|standing-mutation|heby-action-inlet/.test(c),
      `${f}: generation is not publication`,
    );
    assert.ok(!/retireMediaAsset/.test(c), `${f}: cannot retire an asset`);
  }

  /* The surface offers ONE generation control and no second, retrying, or batching one. */
  const surface = code("src/components/operations-preparation/generate-image-with-hebun.tsx");
  assert.equal(
    (surface.match(/requestMediaGenerationAction\(/g) ?? []).length,
    1,
    "exactly one call site, so a retry cannot become a second paid call",
  );
  assert.ok(!/setTimeout|setInterval|useEffect/.test(surface), "nothing dispatches on its own; only a human click does");
  assert.match(surface, /crypto\.randomUUID\(\)/, "the idempotency key is minted once per form");
  assert.match(surface, /useMemo/, "the key is stable across re-renders, so a resubmit collides rather than pays twice");
}

/* ── 3. Review cannot create a request, a permit or an execution ──────────── */
{
  for (const f of REVIEW) {
    const c = code(f);
    assert.ok(!/action-authorization|action-execution|standing-mutation|heby-action-inlet/.test(c), `${f} imports no act authority`);
    assert.ok(!/hebyActionRequests|actionPermits|actionExecutionAttempts/.test(c), `${f} names no act table`);
    assert.ok(!/\.(insert|update|delete)\(\s*media/.test(c), `${f} writes nothing to the media tables`);
    assert.ok(!/request-media-generation|retire-media-asset/.test(c), `${f} imports no media writer`);
  }
  for (const f of MEDIA) {
    const c = code(f);
    assert.ok(!/decisionRecords|governanceSessions|writeGovernanceDecisionWithin/.test(c), `${f} writes no Governance decision`);
    assert.ok(!/action-authorization|action-execution|knowledge/.test(c), `${f} reaches no act or Knowledge authority`);
  }
}

/* ── 4. No storage vendor, no SDK, no new dependency, no logging ──────────── */
{
  for (const f of [...MEDIA, ...REVIEW]) {
    const c = code(f);
    assert.ok(!/@aws-sdk|@vercel\/blob|@supabase|S3Client|createSignedUrl|putObject|BLOB_READ_WRITE_TOKEN/i.test(c), `${f}: no storage SDK`);
    assert.ok(!/console\./.test(c), `${f}: nothing is logged, so no URL can be`);
    assert.ok(
      !/process\.env/.test(c) ||
        f.endsWith("media-db.server.ts") ||
        f.endsWith("media-storage.server.ts") ||
        f.endsWith("media-generation-transport.server.ts"),
      `${f}: no configuration contract beyond the database URL, the storage resolver and the generation resolver`,
    );
    if (!f.endsWith("provider-output-download.server.ts") && !f.endsWith("vps-media-object-store.server.ts")) {
      assert.ok(!/\bfetch\b/.test(c), `${f}: only the download seam and the storage adapter may open a socket`);
    }
    assert.ok(!/tests\/|media-fakes/.test(c), `${f}: test fakes never enter the application`);
    assert.ok(!/higgsfield/i.test(c), `${f}: no generation provider is named`);
  }
  const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
  assert.deepEqual(
    Object.keys(pkg.dependencies).sort(),
    ["clsx", "drizzle-orm", "lucide-react", "next", "pdfjs-dist", "pg", "react", "react-dom", "tailwind-merge"],
    "MEDIA-1 installs no dependency",
  );
}

/* ── 4b. The VPS storage adapter is a transport, reached only by the resolver ─ */
{
  const ADAPTER = "src/features/media-assets/vps-media-object-store.server.ts";
  const importers = SRC.filter((f) => f !== ADAPTER && /vps-media-object-store/.test(code(f)));
  assert.deepEqual(importers, ["src/features/media-assets/media-storage.server.ts"], "only the resolver selects the VPS adapter");
  const adapter = code(ADAPTER);
  assert.ok(!/@\/db|drizzle|schema\/|TenantContext|governance|permit|action-/i.test(adapter), "the adapter reads no row and holds no authority");
  assert.ok(!/\b(delete|remove|purge)\s*\(|method:\s*"DELETE"/.test(adapter), "the adapter has no delete verb");
  /*
   * THREE since MEDIA-5, not two: `put`, `verify` and now the server-side `get`. The count is pinned
   * rather than merely "at least one" so a FOURTH fetch cannot appear in this adapter without a
   * diff — and every one of them must refuse redirects.
   */
  assert.ok(!/redirect:\s*"follow"/.test(adapter) && (adapter.match(/redirect:\s*"error"/g) ?? []).length === 3, "the adapter never follows a redirect");
  const resolver = code("src/features/media-assets/media-storage.server.ts");
  assert.ok(!/media-fakes|createMemoryMediaObjectStore|tests\//.test(resolver), "the resolver has no test fallback");
}

/* ── 4c. MEDIA-2A: the OpenAI transport is a transport, reached only by the resolver ─ */
{
  const TRANSPORT = "src/features/media-generation-live/openai-image-transport.server.ts";
  const CONTROL = "src/features/media-generation-live/openai-image-control.ts";
  const RESOLVER = "src/features/media-assets/media-generation-transport.server.ts";
  const LIVE = SRC.filter((f) => f.startsWith("src/features/media-generation-live/"));
  assert.deepEqual(LIVE.sort(), [CONTROL, TRANSPORT].sort(), "the live generation feature is exactly the control key and the transport");

  const t = code(TRANSPORT);
  const imports = [...t.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, [
    "@/features/heby-model-live/live-spend-budget.server",
    "@/features/media-assets/contracts",
    "@/features/media-assets/media-generation-transport",
  ]);
  assert.ok([...t.matchAll(/^import (type )?/gm)].every((m) => m[1] === "type "), "the transport imports TYPES only");
  assert.ok(!/process\.env|@\/db|drizzle|console\.|governance|permit|action-|media-storage|MediaObjectStore|request-media-generation/i.test(t), "no config, row, log or authority");
  /*
   * TWO fixed official endpoints since MEDIA-5, listed by exact value: generations for
   * text-to-image, edits for a one-image reference edit. Pinned as a set, so a THIRD endpoint —
   * variations, files, uploads, a Responses-API path — cannot appear without this line failing.
   */
  assert.deepEqual(
    (t.match(/https:\/\/[a-z0-9.-]+[^"]*/g) ?? []).sort(),
    ["https://api.openai.com/v1/images/edits", "https://api.openai.com/v1/images/generations"],
    "exactly the two fixed official endpoints",
  );
  assert.ok(/redirect: "error"/.test(t) && !/redirect: "follow"/.test(t), "redirects refused");
  assert.ok(/allowedDownloadHosts: Object\.freeze\(\[\]\)/.test(t), "no download host: the transport never hands out a URL");
  assert.ok(/OPENAI_IMAGE_MODEL = "gpt-image-2\.5-flare-2026-09-08"/.test(t), "the model snapshot is pinned");
  assert.ok(!/\b(image|images|mask|reference_images?|stream|partial_images|response_format|input_fidelity)\s*:/.test(t.replace(/allowedDownloadHosts/g, "")), "text-to-image only: no image, mask, stream or url request parameter");
  /*
   * MEDIA-5 admits `/images/edits` — pinned by exact value in the endpoint set above, so it is named
   * once and cannot multiply. What must NEVER return is the retry loop: a paid call that failed is
   * finished, and a second attempt is a new human request with a new request key.
   */
  assert.ok(!/\bwhile\s*\(|retry|backoff/i.test(t), "no retry loop, in either mode");

  const r = code(RESOLVER);
  assert.ok(/resolveDirectorEnabled/.test(r) && /OPENAI_IMAGE_GENERATION_CONTROL_KEY/.test(r), "the resolver reads the connectivity control");
  const selectors = SRC.filter((f) => f !== TRANSPORT && /openai-image-transport/.test(code(f)));
  assert.deepEqual(selectors, [RESOLVER], "only the resolver constructs the OpenAI transport");
  assert.ok(!/media-fakes|tests\//.test(r), "the resolver has no test fallback");
}

/* ── 5. Code limits and database CHECKs state the same numbers ────────────── */
{
  const schema = read("src/db/schema/media-asset.ts");
  assert.ok(schema.includes(`between 1 and ${MEDIA_ASSET_LIMITS.maxByteSize}`), "byte size CHECK matches");
  assert.equal((schema.match(new RegExp(`between 1 and ${MEDIA_ASSET_LIMITS.maxDimension}\\b`, "g")) ?? []).length, 2, "width and height CHECKs match");
  assert.ok(schema.includes(`between 1 and ${MEDIA_ASSET_LIMITS.maxPromptCodePoints}`), "prompt CHECK matches");
  assert.ok(schema.includes(`in (${MEDIA_ASSET_MIME_TYPES.map((m) => `'${m}'`).join(",")})`), "MIME CHECK matches");
  assert.ok(schema.includes("in ('fake','live')"), "the transport CHECK admits exactly fake and live (MEDIA-2A)");
  assert.ok(!/duration|media_kind|video/i.test(stripComments(schema)), "no premature video capability in the schema");
}

/* ── 6. Governance vocabulary ─────────────────────────────────────────────── */
{
  assert.ok(GOVERNANCE_SUBJECT_TYPES.includes("media_asset"));
  assert.equal(SUBJECT_GOVERNANCE_DOMAIN.media_asset, "media-asset-review");
  assert.ok(read("src/db/schema/_enums.ts").includes('"media-asset-review",'));
  const g2 = code("src/features/governance-decision/decision-authority.server.ts");
  const existence = /async function subjectExistsInTenant[\s\S]*?\n}\n/.exec(g2)?.[0] ?? "";
  assert.ok(existence.length > 0 && !/media/.test(existence), "the generic G2 existence check does not resolve assets");
}

/* ── 7. The migration is additive and touches no existing table ───────────── */
{
  const dir = "src/db/migrations";
  const file = readdirSync(dir).filter((f) => /_media1_media_asset_authority\.sql$/.test(f));
  assert.equal(file.length, 1);
  const sql = read(path.join(dir, file[0]!));
  assert.ok(!/\bDROP\b/i.test(sql), "no DROP");
  const altered = [...sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(altered.every((t) => t === "media_assets" || t === "media_generation_invocations"), `only new tables altered: ${altered}`);
  const types = [...sql.matchAll(/ALTER TYPE "public"\."([a-z_]+)" ADD VALUE '([a-z-]+)'/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(types, ["governance_domain:media-asset-review"]);
  assert.ok(!/CREATE TYPE/.test(sql), "no new enum type");
}

console.log("media1-asset-authority/authority-firewall: ok");
