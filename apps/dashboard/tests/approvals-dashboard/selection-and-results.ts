import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canDecide, decideVisibleItems, filterQueue, type QueueItem } from "../../src/features/approvals-dashboard/model";

// Test-only inputs exercise selection; no business fixture is rendered or persisted.
const request = (id: string, channel: string, createdAt: string): QueueItem => ({
  id, title: id, kind: "request", channel, createdAt, status: "pending", filters: ["Pending"], work: [],
  request: { requestId: id } as Extract<QueueItem, { kind: "request" }>["request"],
});
async function main() {
  const first = request("first", "youtube", "2026-01-01");
  const second = request("second", "instagram", "2026-01-02");
  const third = request("third", "youtube", "2026-01-03");
  const items = [first, second, third];
  assert.deepEqual(filterQueue(items, "Pending", "youtube", "", "oldest").map((i) => i.id), ["first", "third"]);
  assert.deepEqual(filterQueue(items, "All", "all", "SECOND", "newest").map((i) => i.id), ["second"]);
  assert.equal(filterQueue(items, "Published", "all", "", "newest").length, 0);
  assert.equal(canDecide(first, false, "approve"), false);
  assert.equal(canDecide(first, true, "changes"), false);
  const calls: string[] = [];
  const forbidden = await decideVisibleItems(items, false, "approve", async (item) => { calls.push(item.id); return { ok: true, detail: "" }; });
  assert.equal(calls.length, 0);
  assert.ok(forbidden.every((o) => o.status === "skipped"));
  const changes = await decideVisibleItems(items, true, "changes", async () => { throw new Error("must not call"); });
  assert.ok(changes.every((o) => o.status === "skipped"));
  const results = await decideVisibleItems([...items, first], true, "approve", async (item) => {
    calls.push(item.id);
    if (item.id === "second") return { ok: false, detail: "not-the-governance-authority" };
    if (item.id === "third") throw new Error("response lost after possible commit");
    return { ok: true, detail: "authorized" };
  });
  assert.deepEqual(calls, ["first", "second", "third"]);
  assert.deepEqual(results.map((o) => o.status), ["success", "refused", "unknown"]);
  assert.match(results[2].detail, /before trying again/);
  // Approve All works on the supplied filtered view, never a hidden/global population.
  calls.length = 0;
  await decideVisibleItems(filterQueue(items, "All", "instagram", "", "newest"), true, "approve", async (item) => { calls.push(item.id); return { ok: true, detail: "authorized" }; });
  assert.deepEqual(calls, ["second"]);
  const ui = readFileSync("src/components/approvals-dashboard/approvals-dashboard.tsx", "utf8");
  for (const seam of ["approveActionRequestAction", "rejectActionRequestAction", "acceptArtifactRevisionAction", "requestArtifactRevisionChangesAction"]) assert.ok(ui.includes(seam));
  for (const forbidden of ["fetch(", "tenantId:", "actorId:", "executeAuthorizedActionAction", "consumeActionPermit", "issuePermit"]) assert.ok(!ui.includes(forbidden), forbidden);
  const read = readFileSync("src/features/approvals-dashboard/read-dashboard.server.ts", "utf8");
  for (const forbidden of [".insert(", ".update(", ".delete(", "fetch(", "@/db/schema", "mock", "seed"]) assert.ok(!read.includes(forbidden), forbidden);
  console.log("PASS approvals dashboard filtering, authority eligibility, scoped bulk, deduplication, partial refusals and unknown response handling");
}
void main();
