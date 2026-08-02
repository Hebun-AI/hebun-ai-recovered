import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

const persistenceFiles = sourceFiles("src/features/enterprise-persistence");
const portFiles = persistenceFiles.filter((file) => ["contracts.ts", "metadata.ts", "ports.ts"].some((name) => file.endsWith(name)));
const serviceFiles = sourceFiles("src/features/enterprise-application-services");

for (const file of portFiles) {
  const source = readFileSync(file, "utf8").toLowerCase();
  for (const forbidden of ["react", "next/", "@/components", "@/db", "postgres", "supabase", "prisma", "drizzle", "selectrows", "runquery", "executesql"]) {
    assert.equal(source.includes(forbidden), false, `${file} must remain technology-neutral`);
  }
}

for (const file of persistenceFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("enterprise-runtime-composition"), false, `${file} must not depend on Runtime composition`);
  assert.equal(source.includes("@/components"), false, `${file} must not depend on presentation`);
}

for (const file of serviceFiles) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.includes("/mock"), false, `${file} must not import mock adapters`);
  assert.equal(source.includes("enterprise-persistence/in-memory"), false, `${file} must not import the in-memory implementation`);
}

for (const file of persistenceFiles.filter((file) => !file.endsWith("postgresql.ts") && !file.endsWith("index.ts"))) {
  const source = readFileSync(file, "utf8").toLowerCase();
  assert.equal(source.includes('from "pg"'), false, `${file} must not import the PostgreSQL driver`);
}

console.log("enterprise persistence boundary checks passed");
