/*
 * CONTENT-PUBLICATION-MEASUREMENT-LINK-1 · the projection is not an authority.
 *
 * Static proofs over the source: the new feature writes nothing, reaches no provider transport,
 * opens no credential, calls no Governance / publication / observation writer, adds no schema or
 * migration, and the Operations surface gains a read and no control.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DIR = "src/features/content-publication-measurement";
const FILES = readdirSync(path.join(ROOT, DIR)).map((f) => `${DIR}/${f}`);
assert.deepEqual(
  FILES.map((f) => path.basename(f)).sort(),
  ["contracts.ts", "derive-publication-measurement.ts", "read-publication-measurement.server.ts"],
  "the feature is exactly a contract, a pure derivation and one composition",
);

/* ═══ 1. IMPORTS: released readers and pure contracts only ══════════════════ */
const ALLOWED_IMPORTS = new Set([
  "@/features/instagram-connection-surface/media-measurement-evolution",
  "@/features/action-authorization/content-publication-state",
  "@/features/action-authorization/content-publication-state.server",
  "@/features/provider-instagram/contracts",
  /*
   * YOUTUBE-MEASUREMENT-OPERATIONS-PROJECTION-1: the released keys of the recorded YouTube
   * measurement (pure constants), and the ONE module that owns how a channel subject is spelled.
   */
  "@/features/provider-google/contracts",
  "@/features/provider-observation-history/record-youtube-channel-observation.server",
  "@/features/provider-observation-history/contracts",
  "@/features/provider-observation-history/read-provider-observations.server",
  "@/features/auth/tenant/tenant-context",
  "./contracts",
  "./derive-publication-measurement",
]);
for (const file of FILES) {
  const code = codeOf(read(file));
  for (const m of code.matchAll(/from\s+"([^"]+)"/g)) {
    assert.ok(ALLOWED_IMPORTS.has(m[1]!), `${file} imports ${m[1]} — only released readers and pure contracts are allowed`);
  }
  for (const banned of [
    "insert(", "update(", "delete(", ".execute(", "sql`", "db.transaction", "getControlPlaneDb",
    "fetch(", "withDecryptedSecret", "withConnectionScopedSecret",
    "recordActionRequest", "writeGovernanceDecision", "authorizeStandingObservation",
    "writeProviderObservation", "observeOnceUnderAuthorization", "executeAuthorizedAction",
  ]) {
    assert.ok(!code.includes(banned), `${file} must not contain \`${banned}\` — the projection writes and reaches nothing`);
  }
}

/* ═══ 2. THE PURE HALF IS PURE ═══════════════════════════════════════════════ */
const derive = codeOf(read(`${DIR}/derive-publication-measurement.ts`));
for (const banned of ["new Date(", "Date.now", "process.env"]) {
  assert.ok(!derive.includes(banned), `the derivation must not reference \`${banned}\``);
}
for (const m of derive.matchAll(/import\s+(type\s+)?\{[^}]*\}\s+from\s+"([^"]+\.server)"/g)) {
  assert.ok(m[1], `the derivation may take only TYPES from ${m[2]} — a server module is never loaded by it`);
}

/* ═══ 3. NO SECOND LIMIT, NO SECOND JOIN KEY, NO COALESCING TO ZERO ══════════ */
const compose = codeOf(read(`${DIR}/read-publication-measurement.server.ts`));
assert.ok(compose.includes("limit: MEDIA_EVOLUTION_OBSERVATION_LIMIT"), "the observation bound is IG-AN3's own constant");
assert.ok(!/limit:\s*\d/.test(compose), "no numeric limit of its own");
for (const file of FILES) {
  const code = codeOf(read(file));
  assert.ok(!/\?\?\s*0\b|\|\|\s*0\b/.test(code), `${file}: a missing count is never coalesced to 0`);
}
for (const heuristic of [".caption", ".permalink"]) {
  assert.ok(!derive.includes(heuristic), `the join never reads ${heuristic}`);
}

/* ═══ 4. NO INTERPRETATION VOCABULARY ════════════════════════════════════════ */
const contracts = read(`${DIR}/contracts.ts`);
/* The status labels only — the non-claim sentence names these words precisely to refuse them. */
const wordingStart = contracts.indexOf("PUBLICATION_MEASUREMENT_WORDING");
const wording = contracts.slice(wordingStart, contracts.indexOf("});", wordingStart));
for (const word of ["performed", "engagement rate", "score", "rank", "recommend", "best", "trend", "no-longer-in-window"]) {
  assert.ok(!wording.toLowerCase().includes(word), `surface wording must not say "${word}"`);
}
assert.ok(!codeOf(contracts).includes("no-longer-in-window"), "the underivable state does not exist");

/* ═══ 5. THE SURFACE GAINS A READ, NOT A CONTROL ═════════════════════════════ */
const panel = read("src/components/operations-preparation/content-package-panel.tsx");
const block = panel.slice(panel.indexOf("function PublicationMeasurementRecord"));
assert.ok(block.length > 0 && !/<button|onClick|<form|action=/.test(block), "the measurement block has no control");
const actions = codeOf(read("src/app/(dashboard)/operations/actions.ts"));
const action = actions.slice(actions.indexOf("export async function readContentPublicationMeasurementsAction"));
const body = action.slice(0, action.indexOf("\n}\n"));
assert.ok(body.includes("resolveTenantContext()") && body.includes("readPublicationMeasurements(tenant, revisions)"),
  "the action resolves the session tenant and calls the composition — nothing else");
for (const banned of ["revalidatePath", "insert(", "update(", "record", "write"]) {
  assert.ok(!body.includes(banned), `the read action must not contain \`${banned}\``);
}

/* ═══ 6. NO SCHEMA, NO MIGRATION ═════════════════════════════════════════════ */
for (const f of readdirSync(path.join(ROOT, "src/db/schema"))) {
  assert.ok(!read(`src/db/schema/${f}`).includes("content-publication-measurement"), "no schema names this projection");
}
assert.ok(!readdirSync(path.join(ROOT, "src/db/migrations")).some((f) => /measurement_link/i.test(f)), "no migration");

/* ═══ 7. YOUTUBE-MEASUREMENT-OPERATIONS-PROJECTION-1 ═══════════════════════════ */
/* The subject format has ONE owner: only the composition names it, and only by importing it. */
for (const file of FILES) {
  assert.ok(!codeOf(read(file)).includes("youtube/channel/"), `${file} must not spell the channel subject format`);
}
assert.ok(!derive.includes("youtubeChannelSubjectRef"), "the pure derivation is handed the subject reference, it never builds one");
assert.ok(compose.includes("subjectRef = youtubeChannelSubjectRef(channel)"), "the composition asks the format's owner");
const ownerImports = [...compose.matchAll(/import\s+\{([^}]*)\}\s+from\s+"@\/features\/provider-observation-history\/record-youtube-channel-observation\.server"/g)].map((m) => m[1]!.trim());
assert.deepEqual(ownerImports, ["youtubeChannelSubjectRef"], "and takes ONLY the format from that module — no read, no write");
/* The YouTube read names no limit: the page is the observation history's own, and its size is the history's constant. */
const youtubeRead = compose.slice(compose.indexOf("providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY"), compose.indexOf("windowSize:"));
assert.ok(youtubeRead.includes("capabilityKey: GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY") && youtubeRead.includes("subjectRef"), "scoped to the recorded-measurement capability and the channel subject");
assert.ok(!youtubeRead.includes("limit"), "the YouTube read names no limit of its own");
assert.ok(compose.includes("windowSize: MAX_OBSERVATIONS_PER_READ"), "the window size is the reader's own page constant");
assert.ok(!/\b\d{2,}\b/.test(compose), "no numeric bound appears in the composition");
/* Every YouTube predicate is re-checked in the pure join. */
for (const predicate of [
  "o.providerKey === GOOGLE_YOUTUBE_PROVIDER_KEY",
  "o.capabilityKey === GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY",
  "o.subjectRef === channel.subjectRef",
  ".videoId === videoId",
]) {
  assert.ok(derive.includes(predicate), `the YouTube join re-checks \`${predicate}\``);
}
for (const heuristic of [".title", ".url", "publishedAt <", "publishedAt >", "indexOf("]) {
  assert.ok(!derive.includes(heuristic), `the join never uses ${heuristic}`);
}
/* No freshness class, no delta, no judgement — in the YouTube vocabulary or its wording. */
const youtubeVocabulary = contracts.slice(
  contracts.indexOf("export type YouTubePublicationMeasurement"),
  contracts.indexOf("export const PUBLICATION_MEASUREMENT_WORDING"),
);
assert.ok(youtubeVocabulary.includes("describeYouTubePublicationMeasurement") && youtubeVocabulary.includes("YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM"), "the slice holds the whole YouTube vocabulary");
const youtubeCode = codeOf(youtubeVocabulary);
for (const word of ["live", "monitored", "up to date", "trend", "rank", "performed", "stale", "fresh", "delta", "change", "current"]) {
  assert.ok(!youtubeCode.toLowerCase().includes(word), `the YouTube projection must not say "${word}"`);
}
/* "score" appears exactly once: in the sentence that refuses it. */
assert.equal((youtubeCode.toLowerCase().match(/score/g) ?? []).length, 1, "`score` appears only in the non-claim that refuses it");
assert.ok(youtubeCode.includes("Not a rate, a score or a judgement."));
assert.ok(!codeOf(contracts).includes("YOUTUBE_MEASUREMENT_NOT_AVAILABLE"), "the hardcoded 'no measurement' sentence is gone");
assert.ok(!panel.includes("YOUTUBE_MEASUREMENT_NOT_AVAILABLE") && block.includes("describeYouTubePublicationMeasurement(m)"), "the panel prints the derived sentence");
assert.ok(block.includes("YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM"), "with YouTube's own non-claim");
/* Operations cannot trigger a measurement: the recording action is not reachable from this surface. */
assert.ok(!panel.includes("recordYouTubeMeasurementAction") && !actions.includes("recordYouTubeMeasurementAction") && !actions.includes("recordYouTubePublicationMeasurement"), "Operations has no way to record a measurement");

console.log(
  "content-publication-measurement-link-1/measurement-firewall: released readers only, no writer / transport / " +
    "credential / governance reach, pure derivation, IG-AN3's bound, no zero-coalescing, no interpretation, " +
    "read-only surface, no schema or migration; YouTube: one subject-format owner, the reader's own page, " +
    "re-checked join, no freshness / delta / judgement wording, no Operations-triggered measurement",
);
