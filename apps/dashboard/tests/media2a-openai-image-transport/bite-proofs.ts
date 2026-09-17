/*
 * MEDIA-2A — BITE PROOFS.
 *
 * One targeted change to real source (transport, resolver, authority, ceremony, migration), the suite
 * that must object runs, and it must fail FOR THE INTENDED REASON; the file must come back
 * byte-identical by sha256. A killed child is VOID, never a bite. Children run sequentially.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const TRANSPORT = "src/features/media-generation-live/openai-image-transport.server.ts";
const RESOLVER = "src/features/media-assets/media-generation-transport.server.ts";
const REQUEST = "src/features/media-assets/request-media-generation.server.ts";
const CEREMONY = "scripts/lib/provider-connectivity.ts";
const MIGRATION = `src/db/migrations/${readdirSync("src/db/migrations").find((f) => /_media2a_live_image_transport\.sql$/.test(f))}`;

const CONTRACT = "tests/media2a-openai-image-transport/transport-contract.ts";
const POSTGRES = "tests/media1-asset-authority/authority-postgres.ts";
const FIREWALL = "tests/media1-asset-authority/authority-firewall.ts";
const ARMING = "tests/rung1-production-arming/arming-gate-and-firewall.ts";

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 the resolver ignores the connectivity control",
    file: RESOLVER,
    suite: CONTRACT,
    find: '  if (enabled !== true) return { status: "unavailable", reason: "generation-disabled" };',
    replace: "",
    because: "connectivity OFF",
  },
  {
    label: "B2 a credential alone selects the live transport",
    file: RESOLVER,
    suite: CONTRACT,
    find: '  if (selection !== "live" || !CREDENTIAL_RE.test(apiKey)) {',
    replace: "  if (!CREDENTIAL_RE.test(apiKey)) {",
    because: "generation-misconfigured",
  },
  {
    label: "B3 the transport retries a failed request",
    file: TRANSPORT,
    suite: CONTRACT,
    find: "      if (response.status !== 200) {",
    replace:
      '      if (response.status !== 200 && (await doFetch(OPENAI_IMAGE_GENERATIONS_URL, { method: "POST", headers: {}, body: "", redirect: "error", cache: "no-store", signal }).catch(() => null), true)) {',
    because: "exactly one request, no retry",
  },
  {
    label: "B4 the transport spends without consulting the budget",
    file: TRANSPORT,
    suite: CONTRACT,
    find: '      if (!config.spendBudget.attempt()) return failed("budget-exhausted");',
    replace: "",
    because: "one unit of the shared budget per call",
  },
  {
    label: "B5 moderation is reported as an ordinary rejection",
    file: TRANSPORT,
    suite: CONTRACT,
    find: '  if (code === "moderation_blocked") return "moderation-blocked";',
    replace: "",
    because: "moderation-blocked",
  },
  {
    label: "B6 an exhausted quota is reported as a rate limit",
    file: TRANSPORT,
    suite: CONTRACT,
    find: '    return code === "credit_balance_exhausted" || code === "insufficient_quota" ? "quota-exhausted" : "rate-limited";',
    replace: '    return "rate-limited";',
    because: "quota-exhausted",
  },
  {
    label: "B7 a provider URL is accepted beside the bytes",
    file: TRANSPORT,
    suite: CONTRACT,
    find: "  if (item.url !== undefined && item.url !== null) return null;",
    replace: "",
    because: "url beside bytes",
  },
  {
    label: "B8 the response body is buffered without a ceiling",
    file: TRANSPORT,
    suite: CONTRACT,
    find: "    if (total > limit) {",
    replace: "    if (limit < 0) {",
    because: "response over the cap",
  },
  {
    label: "B9 the authority drops the provider failure code",
    file: REQUEST,
    suite: POSTGRES,
    find: '    return finalize("provider-failed", "not-attempted", code, providerJobId);',
    replace: '    return finalize("provider-failed", "not-attempted", null, providerJobId);',
    /* The database refuses a provider failure without a code, so the finalization never lands. */
    because: "a failed job's id is still durable",
  },
  {
    label: "B10 the authority forgets provider usage",
    file: REQUEST,
    suite: POSTGRES,
    find: "  usage = validUsage(outcome.usage);",
    replace: "  usage = null;",
    because: "1056",
  },
  {
    label: "B11 the transport reads configuration itself",
    file: TRANSPORT,
    suite: FIREWALL,
    find: "  const timeoutMs = config.timeoutMs ?? OPENAI_IMAGE_TIMEOUT_MS;",
    replace: "  const timeoutMs = config.timeoutMs ?? Number(process.env.OPENAI_TIMEOUT ?? OPENAI_IMAGE_TIMEOUT_MS);",
    because: "no config, row, log or authority",
  },
  {
    /*
     * MEDIA-2B RETARGETED THIS PROOF, because its premise expired by decision rather than by
     * accident. It used to bite the INSERTION of the image key into the production-reachable list,
     * which was the right proof while no production decision existed. MEDIA-2B took that decision,
     * so insertion is now the released truth and biting it would assert the opposite of the code.
     *
     * It was NOT deleted, and it was not left to pass by coincidence — the old mutation still
     * "passed" only because inserting a duplicate happens to break a deepEqual. What matters now is
     * the SAME invariant from the other side: the list is pinned BY VALUE, so a key cannot silently
     * LEAVE it either. Removing the key must still be caught.
     */
    label: "B12 paid image generation silently loses its enumerated production decision",
    file: CEREMONY,
    suite: ARMING,
    find: "  OPENAI_IMAGE_GENERATION_CONTROL_KEY,\n]);\n\n/**\n * The dedicated production ceremony",
    replace: "]);\n\n/**\n * The dedicated production ceremony",
    because: "MEDIA-2B's generation decision, enumerated",
  },
  {
    label: "B13 the migration admits a third transport kind",
    file: MIGRATION,
    suite: POSTGRES,
    find: "in ('fake','live'));",
    replace: "in ('fake','live','openai'));",
    because: "an unknown transport kind",
  },
];

let bitten = 0;
const problems: string[] = [];
for (const m of MUTATIONS) {
  const original = readFileSync(m.file, "utf8");
  const before = sha(original);
  assert.equal(original.split(m.find).length - 1, 1, `${m.label}: anchor must be unique in ${m.file}`);
  try {
    writeFileSync(m.file, original.replace(m.find, m.replace), "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", m.suite], {
      encoding: "utf8",
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 600_000,
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    if (r.signal !== null || r.status === null) problems.push(`${m.label}: VOID (child killed)`);
    else if (r.status === 0) problems.push(`${m.label}: the suite still passed — the guard does not bite`);
    else if (!out.includes(m.because)) problems.push(`${m.label}: failed, but not for "${m.because}"\n${out.slice(-1500)}`);
    else {
      bitten += 1;
      console.log(`BITE ${m.label}`);
    }
  } finally {
    writeFileSync(m.file, original, "utf8");
    assert.equal(sha(readFileSync(m.file, "utf8")), before, `${m.label}: ${m.file} not restored byte-identically`);
  }
}
assert.deepEqual(problems, [], problems.join("\n\n"));
assert.equal(bitten, MUTATIONS.length);
console.log(`media2a-openai-image-transport/bite-proofs: ok (${bitten} bites)`);
