import assert from "node:assert/strict";
import { persistenceSuccess } from "../../src/features/enterprise-persistence";
import type { EntityMetadata, PersistenceResult } from "../../src/features/enterprise-persistence";

const results: PersistenceResult<string>[] = [
  persistenceSuccess("loaded"),
  { status: "NotFound", message: "missing" },
  { status: "Conflict", message: "conflict" },
  { status: "ValidationFailure", issues: ["invalid"] },
  { status: "TemporaryFailure", message: "temporary" },
  { status: "PermanentFailure", message: "permanent" },
];

assert.deepEqual(results.map((result) => result.status), [
  "Success",
  "NotFound",
  "Conflict",
  "ValidationFailure",
  "TemporaryFailure",
  "PermanentFailure",
]);

const metadata: EntityMetadata = {
  entityId: "entity-1",
  createdAt: "2026-08-02T09:30:00+03:00",
  updatedAt: "2026-08-02T09:30:00+03:00",
  version: 1,
  concurrencyToken: "version-1",
};

assert.equal(metadata.entityId, "entity-1");
assert.equal(metadata.version, 1);

console.log("enterprise persistence contract checks passed");
