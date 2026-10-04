/*
 * Processor attestation admission ceremony (EXTERNAL-AI-DATA-USE-B1A) — OPERATOR CLI.
 *
 *   npm run platform:processor-attestation -- admit     <record-path>@<sha>
 *   npm run platform:processor-attestation -- supersede <record-path>@<sha>
 *   npm run platform:processor-attestation -- withdraw  <record-path>@<sha>
 *
 * WHAT IT DOES. Appends ONE revision to the root `processor_attestations` lineage the reviewed
 * record names — the facts Hebun has established about one external processing boundary (a service
 * scope on one provider account) and the treatment that boundary was reviewed under.
 *
 * WHAT IT DOES NOT DO. It does not allow anything: the platform disclosure policy is reviewed code
 * and is untouched (B1D). It does not authorize any organization: that is each tenant's own
 * Governance. It does not change the model runtime, the transport, or R2E. It reads no credential,
 * calls no provider, and writes no audit row — a terminal has no actor to name.
 *
 * THE ROOT OF TRUST is possession of the deployment, exactly as for `provider:connectivity` and
 * `platform:migrate`: the LOCAL deployment by default, the PRODUCTION one only with G4's released
 * possession signal and a pinned, converged cluster. Accountability for the CONTENT is the
 * Director-gated commit the record lives in: the row stores `<path>@<sha>`, and that commit must be
 * reachable from origin/main before a single field is read from it.
 *
 * WHY THE TTY. The operator must SEE the exact revision and retype the account it binds. A pipe
 * cannot agree to that on a human's behalf, so a non-interactive stdin is refused before anything
 * else happens — no record read, no connection.
 */
import { createInterface } from "node:readline";
import path from "node:path";
import { Client } from "pg";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import { fingerprintDrift } from "./lib/production-migration";
import {
  ATTESTATION_VERBS,
  appendProcessorAttestation,
  gitRunnerAt,
  isAttestationVerb,
  measureNonMutation,
  parseAttestationRecord,
  parseReviewedRecordRef,
  planAttestationRevision,
  readLineageHead,
  resolveReviewedRecord,
} from "./lib/processor-attestation";

/** Every way this ceremony can end. Named so a report can never blur two of them together. */
type Outcome =
  | "NOT_INTERACTIVE"
  | "NOT_ARMED"
  | "USAGE"
  | "RECORD_UNBOUND"
  | "RECORD_REFUSED"
  | "TARGET_REFUSED"
  | "LINEAGE_REFUSED"
  | "CONFIRMATION_REFUSED"
  | "POST_VERIFY_FAILED";

function fail(outcome: Outcome, message: string): never {
  console.error(`\n  ✖ ${outcome}\n\n  ${message}\n`);
  process.exit(1);
}

/** Read one visible line from the TTY. Not a secret — the operator must SEE what they confirm. */
function promptVisible(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const DASHBOARD_ROOT = path.join(import.meta.dirname, "..");

async function main(): Promise<void> {
  /* 0 · A HUMAN AT A TERMINAL, before anything else is read or opened. */
  if (!process.stdin.isTTY) {
    fail(
      "NOT_INTERACTIVE",
      "this ceremony can only be confirmed interactively — run it in a terminal, never piped. " +
        "Nothing was read and nothing was written.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    fail("NOT_ARMED", "this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
  }

  const verb = process.argv[2]?.trim();
  const refArg = process.argv[3]?.trim();
  if (!isAttestationVerb(verb) || process.argv.length !== 4) {
    fail(
      "USAGE",
      "usage:\n" +
        "    npm run platform:processor-attestation -- <verb> <record-path>@<full-commit-sha>\n\n" +
        `  verbs: ${ATTESTATION_VERBS.join(", ")}\n` +
        "  Every field comes from the reviewed record at that commit. Nothing else is accepted.",
    );
  }

  /* 1 · THE REVIEWED RECORD — bound to origin/main and parsed before a connection is spent. */
  const ref = parseReviewedRecordRef(refArg);
  if (ref.status === "refused") fail("USAGE", ref.detail);
  const bound = resolveReviewedRecord(ref, gitRunnerAt(DASHBOARD_ROOT));
  if (bound.status === "refused") fail("RECORD_UNBOUND", `${bound.reason}: ${bound.detail}`);
  const parsed = parseAttestationRecord(bound.markdown);
  if (parsed.status === "refused") fail("RECORD_REFUSED", `${parsed.reason}: ${parsed.detail}`);
  const { record } = parsed;

  /* 2 · POSSESSION — the released posture, the released guards, the released target binding. */
  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail("NOT_ARMED", environment.detail);

  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();
  try {
    const ready = await preflight(client, environment.posture, { provenance: "none" });
    if (ready.status === "refused") fail("TARGET_REFUSED", ready.detail);

    /* 3 · THE LINEAGE AS IT STANDS, and the one revision this act would append to it. */
    const head = await readLineageHead(client, record.serviceScope, record.accountRef);
    const plan = planAttestationRevision(verb, head);
    if (plan.status === "refused") {
      fail("LINEAGE_REFUSED", `${verb} refused: ${plan.reason}. Nothing was written.`);
    }
    const before = await measureNonMutation(client);

    console.log("");
    console.log(`  PROCESSOR ATTESTATION CEREMONY — ${verb.toUpperCase()}`);
    console.log("");
    console.log(`  posture        : ${ready.banner}`);
    console.log(`  recorded as    : ${environment.posture.source}`);
    console.log(`  reviewed record: ${ref.reviewedRecordRef}`);
    console.log("");
    console.log(`  lineage        : ${record.serviceScope}  ·  ${record.accountRef}`);
    console.log(`  current head   : ${head ? `revision ${head.attestationRevision} (${head.state})` : "none — this starts the lineage"}`);
    console.log(`  will append    : revision ${plan.revision} (${plan.state})`);
    console.log("");
    console.log(`  identity       : ${record.identityStatus}`);
    console.log(`  contract       : ${record.contractSurface}`);
    console.log(`  training       : ${record.training}`);
    console.log(`  retention      : ${record.retentionClass}`);
    console.log(`  zdr            : ${record.zdr}`);
    console.log(`  model class    : ${record.modelTreatmentClass}  [${record.modelIds.join(", ")}]`);
    console.log(`  region         : ${record.region ?? "(none recorded)"}`);
    console.log(`  attested at    : ${record.attestedAt}`);
    console.log(`  evidence (${record.evidenceRefs.length})   :`);
    for (const evidence of record.evidenceRefs) console.log(`    - ${evidence}`);
    console.log("");
    console.log("  THIS RECORDS FACTS; IT ALLOWS NOTHING. The platform disclosure policy is reviewed");
    console.log("  code and is not changed here. No organization is authorized, no runtime path");
    console.log("  changes, and no credential is read. The revision is append-only and root-scoped.");
    console.log("");

    const typed = await promptVisible(`  Retype the account this revision binds (${record.accountRef}): `);
    if (typed !== record.accountRef) fail("CONFIRMATION_REFUSED", "the account did not match. Nothing was written.");

    /* 4 · APPEND — only onto the head that was shown. */
    const appended = await appendProcessorAttestation(client, {
      verb,
      record,
      reviewedRecordRef: ref.reviewedRecordRef,
      controlSource: environment.posture.source,
      expectedHead: head,
    });
    if (appended.status === "refused") {
      fail(
        "LINEAGE_REFUSED",
        appended.reason === "lineage-moved"
          ? "the lineage changed while you were confirming — another revision was appended first. Nothing was written; re-run to see the new head."
          : `${appended.reason}. Nothing was written.`,
      );
    }

    /* 5 · NOTHING ELSE MOVED — measured, not asserted. */
    const after = await measureNonMutation(client);
    const drift = fingerprintDrift(before.organizational, after.organizational);
    const moved =
      drift.length > 0 ||
      after.governanceSessions !== before.governanceSessions ||
      after.tenantAuthorizations !== before.tenantAuthorizations ||
      after.tenantAuthorizationScopes !== before.tenantAuthorizationScopes;

    console.log("");
    console.log(`  ✔ revision ${appended.revision} (${appended.state}) appended`);
    console.log(`    id               : ${appended.id}`);
    console.log(`    attestations     : ${before.processorAttestations} → ${after.processorAttestations}`);
    console.log(`    other authorities: ${moved ? "MOVED — investigate" : "UNCHANGED (organizational tables, Governance, tenant authorizations)"}`);
    console.log("");
    if (moved || after.processorAttestations !== before.processorAttestations + 1) {
      fail("POST_VERIFY_FAILED", "something other than exactly one attestation revision changed during this ceremony. Investigate before anything else.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail("POST_VERIFY_FAILED", error instanceof Error ? error.message : String(error));
});
