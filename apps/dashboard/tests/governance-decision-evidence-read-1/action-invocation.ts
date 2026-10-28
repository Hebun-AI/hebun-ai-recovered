/*
 * GOVERNANCE-DECISION-EVIDENCE-READ-1 — the server action itself, invoked directly.
 *
 * A test process has no authenticated request, so `resolveTenantContext()` resolves no tenant. That
 * is exactly the unauthenticated caller: the action must answer `not-authorized` and carry no
 * decision data, whatever the browser sends — including a forged tenant, actor or authority field.
 *
 * What this cannot reach: an AUTHENTICATED invocation needs a real session cookie inside a Next
 * request, which no harness here provides. Authority and tenant isolation for an authenticated
 * tenant are proved on the reader (`evidence-postgres.ts`), which the action calls with the
 * session's tenant and nothing else (`surface-and-firewall.ts`).
 */
import assert from "node:assert/strict";
import { readReviewEvidenceAction } from "../../src/app/(dashboard)/approvals/actions";

async function main(): Promise<void> {
  const artifactId = "311f1e25-4093-4d32-9cfd-d1bc2374e8f4";
  const cases: unknown[] = [
    { artifactId, revisionNo: 3 },
    { artifactId, revisionNo: 3, tenantId: "f625b683-3be5-40eb-93a4-53fc56ab38c9" },
    { artifactId, revisionNo: 3, actorId: "d5b496df-588c-49c5-9cc2-17672b82dd10", authorized: true },
    null,
    { artifactId: "not-a-uuid", revisionNo: -1 },
  ];
  for (const input of cases) {
    const result = await readReviewEvidenceAction(input as never);
    assert.deepEqual(result, { status: "not-authorized" }, `unauthenticated → not-authorized for ${JSON.stringify(input)}`);
    assert.deepEqual(Object.keys(result), ["status"], "and nothing else crosses back");
  }
  console.log("governance-decision-evidence-read-1/action-invocation: unauthenticated direct invocation is refused, forged fields carry nothing");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
