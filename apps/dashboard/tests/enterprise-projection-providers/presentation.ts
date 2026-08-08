import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Pages that present a mock-fed enterprise projection through the provider layer.
// The workspace-vocabulary landings (/command, /intelligence, and — since UI
// Phase 9 — /knowledge) are intentionally NOT listed: they render real, frozen
// contract vocabulary with honest empty states, consuming no projection provider
// and no mock. They must still never import a mock adapter, which is asserted
// separately below.
const presentationEntries = [
  "src/app/(dashboard)/director/page.tsx",
  "src/app/(dashboard)/director/organization/page.tsx",
  "src/app/(dashboard)/events/page.tsx",
  "src/app/(dashboard)/approvals/page.tsx",
];

// Workspace-vocabulary landings must consume no mock adapter, even though they no
// longer flow through a projection provider.
const noMockEntries = ["src/app/(dashboard)/knowledge/page.tsx"];

for (const file of noMockEntries) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("/mock"), false, `${file} must not import mock adapters`);
}

for (const file of presentationEntries) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("/mock"), false, `${file} must not import mock adapters`);
  assert.equal(source.includes("enterprise-projection-providers"), true, `${file} must consume a projection provider`);
}

console.log("enterprise presentation migration checks passed");
