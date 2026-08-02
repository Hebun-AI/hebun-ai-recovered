import assert from "node:assert/strict";
import { createInMemoryEnterpriseRepositories } from "../../src/features/enterprise-persistence";
import { createInMemoryUnitOfWork } from "../../src/features/enterprise-unit-of-work";

async function main(): Promise<void> {
const repositories = createInMemoryEnterpriseRepositories();
const unitOfWork = createInMemoryUnitOfWork(repositories);

assert.equal(Object.isFrozen(unitOfWork), true);
assert.equal(await unitOfWork.execute(async (context) => context), repositories);
assert.equal(
  await unitOfWork.execute(async ({ organization }) => (await organization.loadOrganization()).status),
  "Success",
);
await assert.rejects(
  unitOfWork.execute(async () => {
    throw new Error("business failure");
  }),
  /business failure/,
);

console.log("in-memory UnitOfWork compatibility checks passed");
}

void main();
