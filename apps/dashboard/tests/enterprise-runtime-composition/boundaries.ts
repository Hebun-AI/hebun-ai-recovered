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

const compositionFiles = sourceFiles("src/features/enterprise-runtime-composition");
const providerFiles = sourceFiles("src/features/enterprise-projection-providers");
const serviceFiles = sourceFiles("src/features/enterprise-application-services");
const persistenceFiles = sourceFiles("src/features/enterprise-persistence");
const presentationFiles = [
  "src/app/(dashboard)/director/page.tsx",
  "src/app/(dashboard)/director/organization/page.tsx",
  "src/app/(dashboard)/knowledge/page.tsx",
  "src/app/(dashboard)/events/page.tsx",
  "src/app/(dashboard)/approvals/page.tsx",
];

for (const file of compositionFiles) {
  const source = readFileSync(file, "utf8");
  for (const forbidden of ["react", "next/", "@/components", "process.env", "@/db", "drizzle", "prisma", "@/features/persistence"]) {
    assert.equal(source.includes(forbidden), false, `${file} must not import ${forbidden}`);
  }
}

for (const file of providerFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("/mock"), false, `${file} must not import mock adapters`);
  if (!file.endsWith("index.ts")) {
    assert.equal(source.includes("enterprise-runtime-composition"), true, `${file} must resolve through the composition root`);
  }
}

for (const file of serviceFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("enterprise-runtime-composition"), false, `${file} must not import the composition root`);
}

for (const file of persistenceFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("enterprise-runtime-composition"), false, `${file} must not import the composition root`);
}

for (const file of presentationFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("enterprise-runtime-composition"), false, `${file} must not import composition internals`);
  assert.equal(source.includes("process.env"), false, `${file} must not select provider modes`);
}

for (const file of sourceFiles("src/components")) {
  const source = readFileSync(file, "utf8");
  if (!source.startsWith('"use client"')) continue;
  assert.equal(source.includes("enterprise-runtime-composition"), false, `${file} must not import composition internals`);
}

console.log("enterprise Runtime composition boundary checks passed");
