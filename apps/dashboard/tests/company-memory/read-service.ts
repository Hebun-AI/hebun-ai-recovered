import assert from "node:assert/strict";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import { createInMemoryMemoryPersistence } from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";
import { readCompanyMemoryFrom } from "../../src/features/company-memory/read-service";

/*
 * Company Memory read service (Hebun UI Phase 21B).
 *
 * Proves the surface reads the REAL Enterprise Memory authority (query boundary over
 * a Memory UnitOfWork), preserves tenant isolation, fails closed without an authorized
 * context, and fabricates nothing — with an honest empty state when nothing is admitted.
 */

function makeRequest(overrides: Partial<MemoryPersistenceRequest> = {}): MemoryPersistenceRequest {
  return {
    memoryId: "mem-1",
    namespace: "tenant-a",
    content: { statement: "Refund window is 30 days.", attributes: { owner: "ops", days: 30 } },
    classification: { category: "policy", sensitivity: "internal", tags: ["refund"] },
    provenance: { method: "human-authored", derivedFrom: [], recordedAt: "2026-01-02T00:00:00.000Z" },
    authority: {
      authorityType: "director",
      admittedBy: { type: "director", id: "dir-1" },
      grantReference: "grant-1",
      admittedAt: "2026-01-02T00:00:00.000Z",
    },
    confidence: { level: "high", score: 0.9, rationale: "verified with owner" },
    source: { kind: "human-input", reference: "meeting-notes-2026-01", originatedAt: "2026-01-01T00:00:00.000Z" },
    relationships: [],
    admissionReference: { grantReference: "grant-1", policySetId: "policy-set-1", decidedAt: "2026-01-02T00:00:00.000Z" },
    storedAt: "2026-01-02T00:05:00.000Z",
    concurrencyToken: "ct-1",
    ...overrides,
  };
}

async function store(request: MemoryPersistenceRequest) {
  const persistence = createInMemoryMemoryPersistence(createInProcessEventBus());
  await persistence.unitOfWork.execute(async ({ resources }) => resources.storeApprovedMemory(request));
  return persistence;
}

async function failsClosedWithoutTenant(): Promise<void> {
  const persistence = createInMemoryMemoryPersistence(createInProcessEventBus());
  const model = await readCompanyMemoryFrom(persistence.unitOfWork, null);
  assert.equal(model.connection, "authority-unavailable", "no tenant context → fail closed");
  assert.equal(model.records.length, 0, "fail closed returns no records");
  assert.equal(model.reason, "no-authorized-tenant-context");
}

async function connectedButEmpty(): Promise<void> {
  const persistence = createInMemoryMemoryPersistence(createInProcessEventBus());
  const model = await readCompanyMemoryFrom(persistence.unitOfWork, { tenantId: "tenant-empty" });
  assert.equal(model.connection, "connected-empty", "real authority, zero admitted → connected-empty");
  assert.equal(model.records.length, 0, "no memory is fabricated to fill the space");
}

async function connectedPopulatedMapsRealFields(): Promise<void> {
  const persistence = await store(makeRequest());
  const model = await readCompanyMemoryFrom(persistence.unitOfWork, { tenantId: "tenant-a" });
  assert.equal(model.connection, "connected-populated");
  assert.equal(model.records.length, 1);
  const record = model.records[0];
  assert.equal(record.statement, "Refund window is 30 days.");
  assert.equal(record.memoryId, "mem-1");
  assert.equal(record.version, 1);
  assert.equal(record.isCurrent, true);
  assert.equal(record.origin.kind, "human-input");
  assert.equal(record.authority.authorityType, "director");
  assert.equal(record.authority.admittedById, "dir-1");
  assert.equal(record.provenance.method, "human-authored");
  assert.equal(record.confidence.level, "high");
  assert.equal(record.confidence.score, 0.9);
  assert.equal(record.classification.sensitivity, "internal");
  assert.equal(record.lifecycle.state, "approved");
  assert.equal(record.contentWithheld, false);
  assert.deepEqual(
    record.attributes.map((a) => a.key).sort(),
    ["days", "owner"],
    "only real attributes surface",
  );
}

async function metadataDimensionsStayDistinct(): Promise<void> {
  // High confidence but delegated authority and internal sensitivity — none implies another.
  const persistence = await store(
    makeRequest({
      memoryId: "mem-dim",
      namespace: "tenant-dim",
      confidence: { level: "verified" },
      authority: {
        authorityType: "delegated",
        admittedBy: { type: "delegated", id: "agent-x" },
        grantReference: "grant-2",
        admittedAt: "2026-01-03T00:00:00.000Z",
      },
    }),
  );
  const model = await readCompanyMemoryFrom(persistence.unitOfWork, { tenantId: "tenant-dim" });
  const record = model.records[0];
  assert.equal(record.confidence.level, "verified");
  assert.equal(record.confidence.score, null, "absent score is null, never invented");
  assert.equal(record.authority.authorityType, "delegated", "confidence does not imply authority");
  assert.equal(record.classification.sensitivity, "internal");
}

async function restrictedContentWithheld(): Promise<void> {
  const persistence = await store(
    makeRequest({
      memoryId: "mem-r",
      namespace: "tenant-r",
      classification: { category: "secret", sensitivity: "restricted", tags: ["confidential"] },
    }),
  );
  const model = await readCompanyMemoryFrom(persistence.unitOfWork, { tenantId: "tenant-r" });
  const record = model.records[0];
  assert.equal(record.contentWithheld, true, "restricted content is withheld");
  assert.equal(record.statement, null, "restricted statement is not surfaced");
  assert.equal(record.attributes.length, 0, "restricted attributes are not surfaced");
  assert.equal(record.classification.sensitivity, "restricted", "the classification itself is still shown");
}

async function tenantIsolationPreserved(): Promise<void> {
  const persistence = await store(makeRequest({ namespace: "tenant-a" }));
  const other = await readCompanyMemoryFrom(persistence.unitOfWork, { tenantId: "tenant-b" });
  assert.equal(other.connection, "connected-empty", "another tenant sees no records");
  assert.equal(other.records.length, 0, "no cross-tenant leak; isolation is by namespace predicate");
}

async function main(): Promise<void> {
  await failsClosedWithoutTenant();
  await connectedButEmpty();
  await connectedPopulatedMapsRealFields();
  await metadataDimensionsStayDistinct();
  await restrictedContentWithheld();
  await tenantIsolationPreserved();
  console.log("company-memory read-service checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
