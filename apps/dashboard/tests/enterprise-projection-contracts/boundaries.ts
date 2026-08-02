import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const contractDirectory = "src/features/enterprise-projections";
const contractFiles = readdirSync(contractDirectory)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => join(contractDirectory, name));

assert.equal(contractFiles.length >= 7, true);

for (const file of contractFiles) {
  const source = readFileSync(file, "utf8");
  for (const forbidden of [
    "@/components",
    "@/app",
    "/mock",
    "react",
    "next/",
    "@/db",
    "drizzle-orm",
    "@/features/persistence",
    "@/features/runtime-",
  ]) {
    assert.equal(source.includes(forbidden), false, `${file} must not import ${forbidden}`);
  }
}

console.log("enterprise projection contract boundary checks passed");
