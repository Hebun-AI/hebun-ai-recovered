/*
 * EXTERNAL-AI-DATA-USE-B1A — the reviewed attestation record and its repository binding.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "A processor attestation can only be built from a reviewed record that is committed on
 *    origin/main and named by `<path>@<full sha>`. The record is parsed strictly: one versioned
 *    block, the exact key set, closed vocabularies, no field declared UNKNOWN, `attested` identity
 *    only. Nothing is repaired or defaulted, and the revision plan is append-only."
 *
 * Pure parsing plus a throwaway local git repository. No database, no provider, no network.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ATTESTATION_RECORD_FORMAT,
  parseAttestationRecord,
  parseReviewedRecordRef,
  planAttestationRevision,
  resolveReviewedRecord,
  gitRunnerAt,
} from "../../scripts/lib/processor-attestation";

const NOW = new Date("2026-10-04T12:00:00Z");

/** Synthetic values only — never a real provider account. */
const FIELDS = {
  service_scope: "anthropic/messages",
  account_ref: "00000000-0000-4000-8000-000000000b1a",
  identity_status: "attested",
  contract_surface: "anthropic-commercial-terms",
  training: "none",
  retention_class: "bounded-30-days",
  zdr: "not-enabled",
  model_treatment_class: "anthropic-non-covered-model",
  model_ids: ["claude-haiku-4-5-20251001"],
  region: "test-region metadata",
  evidence_refs: ["https://example.test/terms (2026-10-04)"],
  attested_at: "2026-10-04",
} as const;

function recordWith(fields: Record<string, unknown>, extra = ""): string {
  return [
    "# Test processor attestation record",
    "",
    "Prose a reviewer reads. It is not parsed.",
    "",
    "```" + ATTESTATION_RECORD_FORMAT,
    JSON.stringify(fields, null, 2),
    "```",
    extra,
  ].join("\n");
}

function refusal(markdown: string): string {
  const result = parseAttestationRecord(markdown, NOW);
  assert.equal(result.status, "refused", `expected a refusal for:\n${markdown}`);
  return result.status === "refused" ? result.reason : "";
}

/* ── 1. A valid record parses into exactly the declared values. ─────────────────────────────── */
{
  const parsed = parseAttestationRecord(recordWith(FIELDS), NOW);
  assert.equal(parsed.status, "parsed");
  if (parsed.status === "parsed") {
    assert.deepEqual(parsed.record, {
      serviceScope: "anthropic/messages",
      accountRef: FIELDS.account_ref,
      identityStatus: "attested",
      contractSurface: "anthropic-commercial-terms",
      training: "none",
      retentionClass: "bounded-30-days",
      zdr: "not-enabled",
      modelTreatmentClass: "anthropic-non-covered-model",
      modelIds: ["claude-haiku-4-5-20251001"],
      region: "test-region metadata",
      evidenceRefs: ["https://example.test/terms (2026-10-04)"],
      attestedAt: "2026-10-04",
    });
  }
  const noRegion = parseAttestationRecord(recordWith({ ...FIELDS, region: null }), NOW);
  assert.equal(noRegion.status, "parsed", "region is compliance metadata and may be null");
}

/* ── 2. The block: exactly one, of exactly this format. ──────────────────────────────────────── */
assert.equal(refusal("# no block at all"), "block-missing");
assert.equal(refusal(recordWith(FIELDS, "```" + ATTESTATION_RECORD_FORMAT + "\n{}\n```")), "block-ambiguous");
assert.equal(
  refusal(recordWith(FIELDS).replace(ATTESTATION_RECORD_FORMAT, "hebun-processor-attestation-record/v2")),
  "block-missing",
  "another version is not this format",
);
assert.equal(
  refusal(recordWith(FIELDS, "```hebun-processor-attestation-record/v0\n{}\n```")),
  "block-ambiguous",
  "a second record block of any version is ambiguous, never ignored",
);
assert.equal(refusal("```" + ATTESTATION_RECORD_FORMAT + "\nnot json\n```"), "block-malformed");
assert.equal(refusal("```" + ATTESTATION_RECORD_FORMAT + "\n[1, 2]\n```"), "block-malformed");

/* ── 3. The exact key set: nothing missing, nothing extra. ───────────────────────────────────── */
for (const key of Object.keys(FIELDS)) {
  const without: Record<string, unknown> = { ...FIELDS };
  delete without[key];
  assert.equal(refusal(recordWith(without)), "field-missing", `missing ${key}`);
}
assert.equal(refusal(recordWith({ ...FIELDS, tenant_id: "x" })), "field-unknown");
assert.equal(refusal(recordWith({ ...FIELDS, state: "active" })), "field-unknown", "the ceremony verb decides state, never the record");

/* ── 4. Closed vocabularies. ─────────────────────────────────────────────────────────────────── */
for (const [key, bad] of [
  ["service_scope", "anthropic/batches"],
  ["contract_surface", "anthropic-enterprise-agreement"],
  ["training", "unspecified"],
  ["retention_class", "bounded-60-days"],
  ["zdr", "partial"],
] as const) {
  assert.equal(refusal(recordWith({ ...FIELDS, [key]: bad })), "value-out-of-vocabulary", `${key}=${bad}`);
}

/* ── 5. Identity: `attested` only. A verified identity has no admitted observation behind it. ─ */
assert.equal(refusal(recordWith({ ...FIELDS, identity_status: "verified" })), "identity-not-attested");
assert.equal(refusal(recordWith({ ...FIELDS, identity_status: "unverified" })), "identity-not-attested");

/* ── 6. UNKNOWN is a refusal, wherever it is written. Never a value. ─────────────────────────── */
for (const [key, value] of [
  ["zdr", "UNKNOWN"],
  ["contract_surface", "unknown"],
  ["account_ref", " Unknown "],
  ["model_ids", ["claude-haiku-4-5-20251001", "UNKNOWN"]],
  ["evidence_refs", ["unknown"]],
  ["region", "UNKNOWN"],
] as const) {
  assert.equal(refusal(recordWith({ ...FIELDS, [key]: value })), "field-declared-unknown", `${key} declared UNKNOWN`);
}

/* ── 7. Shapes: no blank, no padding, no empty list, no future or invalid date. ──────────────── */
assert.equal(refusal(recordWith({ ...FIELDS, account_ref: "" })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, account_ref: " padded " })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, account_ref: "x".repeat(201) })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, model_treatment_class: "  " })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, model_ids: [] })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, model_ids: [""] })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, model_ids: "claude-haiku-4-5-20251001" })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, evidence_refs: [] })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, region: 7 })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, attested_at: "yesterday" })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, attested_at: "2026-02-30" })), "value-invalid");
assert.equal(refusal(recordWith({ ...FIELDS, attested_at: "2026-10-05" })), "value-invalid", "an attestation cannot be dated after it is admitted");

/* ── 8. The reference: `<repo-relative .md path>@<full lowercase sha>`. ──────────────────────── */
const SHA = "a".repeat(40);
assert.deepEqual(parseReviewedRecordRef(`docs/x/record.md@${SHA}`), {
  status: "parsed",
  path: "docs/x/record.md",
  sha: SHA,
  reviewedRecordRef: `docs/x/record.md@${SHA}`,
});
for (const bad of [
  `docs/x/record.md@${"a".repeat(39)}`,
  `docs/x/record.md@${"A".repeat(40)}`,
  `docs/x/record.md@main`,
  `/abs/record.md@${SHA}`,
  `docs/../record.md@${SHA}`,
  `docs\\x\\record.md@${SHA}`,
  `docs/x/record.txt@${SHA}`,
  `docs/x/record.md`,
  ``,
]) {
  assert.equal(parseReviewedRecordRef(bad).status, "refused", `refuses ${JSON.stringify(bad)}`);
}

/* ── 9. The revision plan is append-only and refuses every other shape. ─────────────────────── */
const head = (revision: number, state: "active" | "withdrawn") => ({ id: `id-${revision}`, attestationRevision: revision, state });
assert.deepEqual(planAttestationRevision("admit", null), { status: "planned", revision: 1, state: "active", supersedesId: null });
assert.deepEqual(planAttestationRevision("admit", head(1, "active")), { status: "refused", reason: "lineage-exists" });
assert.deepEqual(planAttestationRevision("supersede", null), { status: "refused", reason: "lineage-empty" });
assert.deepEqual(planAttestationRevision("withdraw", null), { status: "refused", reason: "lineage-empty" });
assert.deepEqual(planAttestationRevision("supersede", head(2, "active")), { status: "planned", revision: 3, state: "active", supersedesId: "id-2" });
assert.deepEqual(planAttestationRevision("withdraw", head(2, "active")), { status: "planned", revision: 3, state: "withdrawn", supersedesId: "id-2" });
assert.deepEqual(planAttestationRevision("supersede", head(3, "withdrawn")), { status: "refused", reason: "lineage-withdrawn" });
assert.deepEqual(planAttestationRevision("withdraw", head(3, "withdrawn")), { status: "refused", reason: "lineage-withdrawn" });

/* ── 10. THE BINDING: only a commit reachable from origin/main may be read. ─────────────────── */
{
  const root = mkdtempSync(path.join(tmpdir(), "hebun-b1a-git-"));
  try {
    const git = (cwd: string, ...args: string[]) => {
      const r = spawnSync("git", ["-c", "user.name=b1a", "-c", "user.email=b1a@example.test", "-c", "init.defaultBranch=main", ...args], { cwd, encoding: "utf8" });
      assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
      return r.stdout.trim();
    };
    const origin = path.join(root, "origin.git");
    const work = path.join(root, "work");
    mkdirSync(work);
    git(root, "init", "--bare", origin);
    git(work, "init");
    git(work, "remote", "add", "origin", origin);
    mkdirSync(path.join(work, "docs"));
    writeFileSync(path.join(work, "docs", "record.md"), recordWith(FIELDS));
    git(work, "add", "docs/record.md");
    git(work, "commit", "-m", "reviewed record");
    const onMain = git(work, "rev-parse", "HEAD");
    git(work, "push", "origin", "HEAD:refs/heads/main");
    writeFileSync(path.join(work, "docs", "record.md"), recordWith({ ...FIELDS, training: "customer-opt-in" }));
    git(work, "commit", "-am", "unreviewed edit, never pushed");
    const offMain = git(work, "rev-parse", "HEAD");

    const runner = gitRunnerAt(work);
    const read = resolveReviewedRecord({ path: "docs/record.md", sha: onMain }, runner);
    assert.equal(read.status, "read");
    if (read.status === "read") assert.equal(read.markdown, recordWith(FIELDS), "the committed bytes, not the working tree");

    assert.deepEqual(
      resolveReviewedRecord({ path: "docs/record.md", sha: offMain }, runner),
      { status: "refused", reason: "not-on-origin-main", detail: `commit ${offMain} is not reachable from origin/main` },
    );
    assert.equal(resolveReviewedRecord({ path: "docs/other.md", sha: onMain }, runner).status, "refused");
    assert.equal(resolveReviewedRecord({ path: "docs/record.md", sha: "b".repeat(40) }, runner).status, "refused");
    /*
     * A FAILED FETCH REFUSES, even though the CACHED origin/main still contains the commit. The
     * remote is made unreachable after a successful read, so every later step would succeed against
     * the stale local ref — only the fetch check can stop it.
     */
    git(work, "remote", "set-url", "origin", path.join(root, "gone.git"));
    assert.equal(git(work, "merge-base", "--is-ancestor", onMain, "refs/remotes/origin/main"), "", "the cached ref still vouches");
    assert.deepEqual(
      resolveReviewedRecord({ path: "docs/record.md", sha: onMain }, runner),
      { status: "refused", reason: "fetch-failed", detail: "origin/main could not be fetched, so nothing can vouch for the record" },
      "a failed fetch refuses rather than trusting a stale origin/main",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("PASS external-ai-data-use-b1a record-and-binding");
