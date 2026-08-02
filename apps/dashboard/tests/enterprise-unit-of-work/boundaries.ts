import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) ? [path] : [];
  });
}

for (const file of sourceFiles("src/features/enterprise-unit-of-work")) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("react"), false, `${file} must not depend on React`);
  assert.equal(source.includes("@/components"), false, `${file} must not depend on UI`);
}

for (const file of sourceFiles("src/features/enterprise-persistence")) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("enterprise-unit-of-work"), false, `${file} must not depend on UnitOfWork`);
}

for (const file of sourceFiles("src/features/enterprise-application-services")) {
  const source = readFileSync(file, "utf8").toLowerCase();
  for (const forbidden of ["from \"pg\"", "begin", "commit", "rollback", "poolclient", "postgresql.ts"]) {
    assert.equal(source.includes(forbidden), false, `${file} must not manage transactions or PostgreSQL`);
  }
}

for (const file of sourceFiles("src/app")) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("enterprise-unit-of-work"), false, `${file} must not import UnitOfWork`);
}

console.log("UnitOfWork dependency boundary checks passed");
