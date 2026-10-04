/*
 * EXTERNAL-AI-DATA-USE-B1A — the processor attestation writer against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "The ceremony's writer appends exactly one processor_attestations revision per act, only on the
 *    lineage head the operator was shown (CAS), never edits or deletes a revision, loses a
 *    concurrent race instead of overwriting it, and changes nothing else: no tenant authorization,
 *    no Governance record, no provider control, no organizational row. An admitted attestation still
 *    yields `platform-unknown`, because the recorded platform policy allows nothing."
 *
 * Disposable local database, dropped on exit. Synthetic account only. No provider, no network.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  appendProcessorAttestation,
  measureNonMutation,
  readLineageHead,
  type ProcessorAttestationRecord,
} from "../../scripts/lib/processor-attestation";
import { readLatestProcessorAttestation } from "../../src/features/external-ai-data-use/read-processor-attestations.server";
import { composeExternalAiDisclosure } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";

const RECORD: ProcessorAttestationRecord = {
  serviceScope: "anthropic/messages",
  accountRef: "00000000-0000-4000-8000-000000000b1a",
  identityStatus: "attested",
  contractSurface: "anthropic-commercial-terms",
  training: "none",
  retentionClass: "bounded-30-days",
  zdr: "not-enabled",
  modelTreatmentClass: "anthropic-non-covered-model",
  modelIds: ["claude-haiku-4-5-20251001"],
  region: null,
  evidenceRefs: ["https://example.test/terms (2026-10-04)"],
  attestedAt: "2026-10-04",
};
const REF_1 = `docs/test/record.md@${"1".repeat(40)}`;
const REF_2 = `docs/test/record.md@${"2".repeat(40)}`;
const REF_3 = `docs/test/record.md@${"3".repeat(40)}`;
const SOURCE = "local-operator-ceremony" as const;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_external_ai_b1a");
  await harness.createDatabase();
  harness.migrateDatabase();
  const a = new Client({ connectionString: harness.dbUrl });
  const b = new Client({ connectionString: harness.dbUrl });
  await a.connect();
  await b.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };

  try {
    const before = await measureNonMutation(a);
    assert.equal(before.processorAttestations, 0);

    /* ═══ 1. ADMIT: one active revision 1, exactly the record's values ═══════════════════════════ */
    assert.equal(await readLineageHead(a, RECORD.serviceScope, RECORD.accountRef), null);
    const admitted = await appendProcessorAttestation(a, {
      verb: "admit",
      record: RECORD,
      reviewedRecordRef: REF_1,
      controlSource: SOURCE,
      expectedHead: null,
    });
    assert.equal(admitted.status, "appended");
    const rev1 = (await a.query(`select * from processor_attestations`)).rows;
    assert.equal(rev1.length, 1);
    const row1 = rev1[0]!;
    assert.equal(row1.service_scope, "anthropic/messages");
    assert.equal(row1.account_ref, RECORD.accountRef);
    assert.equal(row1.attestation_revision, 1);
    assert.equal(row1.state, "active");
    assert.equal(row1.identity_status, "attested");
    assert.equal(row1.contract_surface, "anthropic-commercial-terms");
    assert.equal(row1.training, "none");
    assert.equal(row1.retention_class, "bounded-30-days");
    assert.equal(row1.zdr, "not-enabled");
    assert.equal(row1.model_treatment_class, "anthropic-non-covered-model");
    assert.deepEqual(row1.model_ids, ["claude-haiku-4-5-20251001"]);
    assert.equal(row1.region, null);
    assert.deepEqual(row1.evidence_refs, RECORD.evidenceRefs);
    assert.equal(row1.reviewed_record_ref, REF_1);
    assert.equal(row1.control_source, SOURCE);
    assert.equal(row1.supersedes_attestation_id, null);
    assert.equal(new Date(row1.attested_at as Date).toISOString(), "2026-10-04T00:00:00.000Z");
    assert.equal(row1.created_by, null, "no actor is named: possession is a source, not an actor");
    assert.equal(row1.updated_by, null);

    /* ═══ 2. CAS: the head the operator was shown, or nothing ═══════════════════════════════════ */
    assert.deepEqual(
      await appendProcessorAttestation(a, { verb: "admit", record: RECORD, reviewedRecordRef: REF_2, controlSource: SOURCE, expectedHead: null }),
      { status: "refused", reason: "lineage-moved" },
      "admitting over an existing lineage is refused — the head moved since 'empty' was shown",
    );
    const head1 = await readLineageHead(a, RECORD.serviceScope, RECORD.accountRef);
    assert.deepEqual(head1, { id: row1.id, attestationRevision: 1, state: "active" });
    assert.deepEqual(
      await appendProcessorAttestation(a, { verb: "admit", record: RECORD, reviewedRecordRef: REF_2, controlSource: SOURCE, expectedHead: head1 }),
      { status: "refused", reason: "lineage-exists" },
    );
    assert.deepEqual(
      await appendProcessorAttestation(a, {
        verb: "supersede",
        record: RECORD,
        reviewedRecordRef: REF_2,
        controlSource: SOURCE,
        expectedHead: { id: "00000000-0000-4000-8000-000000000000", attestationRevision: 1, state: "active" },
      }),
      { status: "refused", reason: "lineage-moved" },
    );
    assert.deepEqual(
      await appendProcessorAttestation(a, {
        verb: "supersede",
        record: { ...RECORD, accountRef: "another-account" },
        reviewedRecordRef: REF_2,
        controlSource: SOURCE,
        expectedHead: head1,
      }),
      { status: "refused", reason: "lineage-moved" },
      "a record naming another lineage cannot ride on this lineage's head",
    );
    assert.equal(Number((await a.query(`select count(*) from processor_attestations`)).rows[0].count), 1, "every refusal wrote nothing");

    /* ═══ 3. SUPERSEDE: revision 2, revision 1 byte-identical ═══════════════════════════════════ */
    const superseded = await appendProcessorAttestation(a, {
      verb: "supersede",
      record: { ...RECORD, modelIds: ["claude-haiku-4-5-20251001", "claude-haiku-4-5"] },
      reviewedRecordRef: REF_2,
      controlSource: SOURCE,
      expectedHead: head1,
    });
    assert.equal(superseded.status, "appended");
    const rev1After = (await a.query(`select * from processor_attestations where attestation_revision = 1`)).rows[0];
    assert.deepEqual(rev1After, row1, "an earlier revision is never edited");
    const row2 = (await a.query(`select * from processor_attestations where attestation_revision = 2`)).rows[0]!;
    assert.equal(row2.state, "active");
    assert.equal(row2.supersedes_attestation_id, row1.id);
    assert.equal(row2.reviewed_record_ref, REF_2);

    /* ═══ 4. CONCURRENCY: two operators on the same head — exactly one wins ════════════════════ */
    const head2 = await readLineageHead(a, RECORD.serviceScope, RECORD.accountRef);
    assert.equal(head2?.attestationRevision, 2);
    const raced = await Promise.all([
      appendProcessorAttestation(a, { verb: "supersede", record: RECORD, reviewedRecordRef: REF_3, controlSource: SOURCE, expectedHead: head2 }),
      appendProcessorAttestation(b, { verb: "supersede", record: RECORD, reviewedRecordRef: REF_3, controlSource: SOURCE, expectedHead: head2 }),
    ]);
    assert.deepEqual(
      raced.map((r) => r.status).sort(),
      ["appended", "refused"],
      `exactly one concurrent supersede wins (${JSON.stringify(raced)})`,
    );
    const loser = raced.find((r) => r.status === "refused");
    assert.deepEqual(loser, { status: "refused", reason: "lineage-moved" });
    assert.equal(Number((await a.query(`select count(*) from processor_attestations`)).rows[0].count), 3);

    /* ═══ 5. WITHDRAW: a new withdrawn revision; nothing after it ════════════════════════════════ */
    const head3 = await readLineageHead(a, RECORD.serviceScope, RECORD.accountRef);
    const withdrawn = await appendProcessorAttestation(a, {
      verb: "withdraw",
      record: RECORD,
      reviewedRecordRef: REF_3,
      controlSource: SOURCE,
      expectedHead: head3,
    });
    assert.equal(withdrawn.status, "appended");
    const head4 = await readLineageHead(a, RECORD.serviceScope, RECORD.accountRef);
    assert.deepEqual({ revision: head4?.attestationRevision, state: head4?.state }, { revision: 4, state: "withdrawn" });
    for (const verb of ["supersede", "withdraw"] as const) {
      assert.deepEqual(
        await appendProcessorAttestation(a, { verb, record: RECORD, reviewedRecordRef: REF_3, controlSource: SOURCE, expectedHead: head4 }),
        { status: "refused", reason: "lineage-withdrawn" },
      );
    }

    /* ═══ 6. NOTHING ELSE MOVED ═════════════════════════════════════════════════════════════════ */
    const after = await measureNonMutation(a);
    assert.deepEqual(after.organizational, before.organizational, "organizational fingerprint unchanged (incl. R2E, decision_records)");
    assert.equal(after.tenantAuthorizations, before.tenantAuthorizations);
    assert.equal(after.tenantAuthorizationScopes, before.tenantAuthorizationScopes);
    assert.equal(after.governanceSessions, before.governanceSessions);
    assert.equal(after.processorAttestations, 4);

    /* ═══ 7. STILL INERT: an admitted attestation grants no disclosure ═══════════════════════════ */
    const other = { ...RECORD, accountRef: "00000000-0000-4000-8000-000000000b1b" };
    assert.equal(
      (await appendProcessorAttestation(a, { verb: "admit", record: other, reviewedRecordRef: REF_1, controlSource: SOURCE, expectedHead: null })).status,
      "appended",
    );
    const latest = await readLatestProcessorAttestation("anthropic/messages", other.accountRef, deps);
    assert.equal(latest.status, "read");
    const resolved = composeExternalAiDisclosure({
      request: { serviceScope: "anthropic/messages", purpose: "assistance", requiredDataClasses: ["conversation"] },
      policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
      accountRef: other.accountRef,
      attestation: latest,
      tenant: { status: "absent" },
      operatorEnabled: true,
      providerAvailable: true,
    });
    assert.equal(resolved.disposition, "platform-unknown", "B1A admits facts; it allows nothing");
  } finally {
    await a.end().catch(() => {});
    await b.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
  console.log("PASS external-ai-data-use-b1a ceremony-postgres");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
