import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(directory: string) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(directory, name));
}

const providerFiles = sourceFiles("src/features/enterprise-projection-providers");
const serviceFiles = sourceFiles("src/features/enterprise-application-services");

for (const file of providerFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("/mock"), false, `${file} must not import mock adapters`);
  assert.equal(source.includes("enterprise-projections"), false, `${file} must consume contracts through application services`);
  assert.equal(source.includes("react"), false, `${file} must not depend on React`);
  assert.equal(source.includes("next/"), false, `${file} must not depend on Next.js`);
}

for (const file of serviceFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("react"), false, `${file} must not depend on React`);
  assert.equal(source.includes("next/"), false, `${file} must not depend on Next.js`);
  assert.equal(source.includes("@/components"), false, `${file} must not depend on presentation`);
  assert.equal(source.includes("/view-model"), false, `${file} must consume only mock adapters and contracts`);
  assert.equal(source.includes("@/features/runtime-"), false, `${file} must not depend on Runtime`);
  assert.equal(source.includes("@/features/persistence"), false, `${file} must not depend on persistence`);
}

console.log("enterprise application and provider boundary checks passed");
