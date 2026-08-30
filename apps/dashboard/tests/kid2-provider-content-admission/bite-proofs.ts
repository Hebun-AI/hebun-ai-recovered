/*
 * KID-2 — bite proofs.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof below makes ONE
 * targeted change to real source, runs the suite that is supposed to object, requires it to fail
 * FOR THE INTENDED REASON, and restores the file byte-identically.
 *
 * The properties under proof are the ones this milestone would lose first if it drifted:
 *
 *   THE PROVIDER'S OWN WORD MUST NOT CHOOSE A PARSER      (the adapter is keyed by Hebun's contract)
 *   AUTHORIZATION COMES BEFORE THE CREDENTIAL IS SPENT     (the gate order)
 *   THE TRANSPORT MUST NOT BECOME AN ADMISSION PATH        (the direction of the import edge)
 *   THE BRIDGE COMPOSES; IT DOES NOT WRITE                 (the exact door census)
 *   NO OUTCOME IS COLLAPSED ON THE SURFACE                 (the UI names every arm)
 *
 * A proof that fails to APPLY, or whose child run times out, is VOID and reported as such — never
 * counted as a pass.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const abs = (f: string) => path.join(ROOT, f);
const read = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const ADAPTER = "src/features/provider-content-admission/content-adapter.ts";
const BRIDGE = "src/features/provider-content-admission/admit-provider-document.server.ts";
const TRANSPORT = "src/features/provider-google/google-transport.server.ts";
const CARD = "src/components/knowledge-workspace/provider-document-admission-card.tsx";

const BEHAVIOUR_SUITE = "tests/kid2-provider-content-admission/adapter-and-bridge.ts";
const FIREWALL_SUITE = "tests/kid2-provider-content-admission/boundaries-and-firewall.ts";

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180_000,
  });
  assert.ok(!result.error, `the child run failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

let bitten = 0;

function bites(
  label: string,
  file: string,
  suite: string,
  because: string,
  from: string,
  to: string,
): void {
  const original = read(file);
  const before = sha(original);
  const occurrences = original.split(from).length - 1;
  assert.equal(occurrences, 1, `${label}: the anchor must appear exactly once, found ${occurrences}`);

  try {
    writeFileSync(abs(file), original.replace(from, to), "utf8");

    /* 1 — the mutation applied. Without this a proof that missed looks like a guard that held. */
    assert.notEqual(
      sha(read(file)),
      before,
      `${label}: the mutation did not apply — the proof is vacuous`,
    );

    /* 2 + 3 — the suite failed, and for the intended reason. */
    const { ok, output } = runSuite(suite);
    assert.equal(ok, false, `${label}: the suite still passed — the guard does not bite`);
    assert.ok(
      output.includes(because),
      `${label}: failed for the wrong reason — expected ${JSON.stringify(because)}, got:\n${output.slice(-1400)}`,
    );
    bitten += 1;
  } finally {
    /* 4 — restored, byte-identical. */
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: restoration was not byte-identical`);
  }
}

function main(): void {
  /* ── 1 · THE PROVIDER'S DECLARED TYPE CHOOSES THE REPRESENTATION ────────── */
  bites(
    "the adapter derives the file name's extension from the provider's own MIME type instead of " +
      "from Hebun's normalized content kind",
    ADAPTER,
    BEHAVIOUR_SUITE,
    "Hebun's extension is appended LAST",
    "  const name = `${bounded}${representation.extension}`;",
    "  const name = content.providerMimeType === \"application/pdf\" ? `${bounded}.pdf` : `${bounded}${representation.extension}`;",
  );

  /* ── 2 · THE CLOSED ALLOWLIST STOPS BEING CLOSED ────────────────────────── */
  bites(
    "a content kind Hebun cannot actually read is added to the allowlist — the realistic drift, " +
      "since the map is one line away from admitting a format no parser stands behind",
    ADAPTER,
    BEHAVIOUR_SUITE,
    "is not an admissible content kind",
    '  markdown: Object.freeze({ extension: ".md", mediaType: "text/markdown" }),',
    '  markdown: Object.freeze({ extension: ".md", mediaType: "text/markdown" }),\n' +
      '  pdf: Object.freeze({ extension: ".pdf", mediaType: "application/pdf" }),',
  );

  /* ── 3 · THE GATE ORDER — A CREDENTIAL SPENT FOR AN UNAUTHORIZED CALLER ── */
  bites(
    "the provider is read BEFORE the Knowledge write band is resolved, so an unauthorized caller " +
      "spends a credential and learns what the organization connected",
    BRIDGE,
    BEHAVIOUR_SUITE,
    "a caller who may not author Knowledge never causes a provider read",
    "  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);\n" +
      "  if (!authority.authorized) {\n" +
      "    return { status: \"knowledge-not-authorized\", roleType: authority.roleType };\n" +
      "  }",
    "  const content0 = await (deps.readContent ?? readDriveContent)(tenant, { fileId: input?.fileId ?? \"\" }, deps.provider ?? {});\n" +
      "  void content0;\n" +
      "  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);\n" +
      "  if (!authority.authorized) {\n" +
      "    return { status: \"knowledge-not-authorized\", roleType: authority.roleType };\n" +
      "  }",
  );

  /* ── 4 · THE HUMAN'S CLASSIFICATION IS REPLACED BY THE DOCUMENT'S ───────── */
  bites(
    "the domain is inferred from the provider document instead of taken from the human",
    BRIDGE,
    BEHAVIOUR_SUITE,
    "the domain is the human's",
    "      domainKey: input?.domainKey ?? \"\",",
    "      domainKey: /DOMAIN:\\s*(\\w+)/.exec(content.content.text)?.[1] ?? input?.domainKey ?? \"\",",
  );

  /* ── 5 · THE TRANSPORT BECOMES AN ADMISSION PATH ────────────────────────── */
  bites(
    "the provider transport gains a runtime edge into the Knowledge ingestion authority, which " +
      "would make PROVIDER READ != KNOWLEDGE false at the transport itself",
    TRANSPORT,
    FIREWALL_SUITE,
    "must reach no Knowledge feature module at all",
    "export async function readDriveFileContent(",
    "import { ingestKnowledgeSource } from \"@/features/knowledge/knowledge-ingest.server\";\nvoid ingestKnowledgeSource;\n\nexport async function readDriveFileContent(",
  );

  /* ── 6 · AN UNNAMED DOOR APPEARS IN THE BRIDGE ──────────────────────────── */
  bites(
    "the bridge gains a second Knowledge authority without anybody recording it in the census",
    BRIDGE,
    FIREWALL_SUITE,
    "the bridge composes exactly",
    "import { adaptProviderContent, type ProviderContentRefusal } from \"./content-adapter\";",
    "import { adaptProviderContent, type ProviderContentRefusal } from \"./content-adapter\";\nimport { createKnowledgeFact } from \"@/features/knowledge/knowledge-create.server\";\nvoid createKnowledgeFact;",
  );

  /* ── 7 · THE BRIDGE STOPS COMPOSING AND STARTS WRITING ──────────────────── */
  bites(
    "the bridge opens a transaction of its own, which is the cross-authority ownership this " +
      "milestone refused to invent",
    BRIDGE,
    FIREWALL_SUITE,
    "must not contain `transaction(`",
    "function assertServerOnly(): void {",
    "export async function unsafeTransaction(db: { transaction(fn: () => Promise<void>): Promise<void> }) {\n  await db.transaction(async () => {});\n}\n\nfunction assertServerOnly(): void {",
  );

  /* ── 8 · A REFUSAL IS COLLAPSED INTO A GENERIC FAILURE ON THE SURFACE ───── */
  bites(
    "the surface stops naming the provider-capability refusal, so a person who granted only the " +
      "listing permission is told the import failed rather than what to grant",
    CARD,
    FIREWALL_SUITE,
    "must render the `provider-capability-unavailable` outcome by name",
    "    case \"provider-capability-unavailable\":",
    "    case \"provider-capability-not-granted\":",
  );

  /* ── 9 · THE PROVENANCE REPORT IS TREATED AS ALWAYS COMPLETE ────────────── */
  bites(
    "the surface stops distinguishing an incomplete provenance, so \"admitted\" would be printed " +
      "over a state where Hebun did not record where the content came from",
    CARD,
    FIREWALL_SUITE,
    'must state "The provenance is incomplete"',
    "            <strong>The provenance is incomplete.</strong> {provenance.declared} of{\" \"}",
    "            <strong>Some records are missing a note.</strong> {provenance.declared} of{\" \"}",
  );

  console.log(`kid2-provider-content-admission/bite-proofs: ${bitten} guards observed to bite`);
  assert.equal(bitten, 9, "every proof must have bitten");
}

main();
