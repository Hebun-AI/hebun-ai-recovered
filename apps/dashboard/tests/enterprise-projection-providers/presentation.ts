import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const presentationEntries = [
  "src/app/(dashboard)/director/page.tsx",
  "src/app/(dashboard)/director/organization/page.tsx",
  "src/app/(dashboard)/knowledge/page.tsx",
  "src/app/(dashboard)/events/page.tsx",
  "src/app/(dashboard)/approvals/page.tsx",
];

for (const file of presentationEntries) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("/mock"), false, `${file} must not import mock adapters`);
  assert.equal(source.includes("enterprise-projection-providers"), true, `${file} must consume a projection provider`);
}

console.log("enterprise presentation migration checks passed");
