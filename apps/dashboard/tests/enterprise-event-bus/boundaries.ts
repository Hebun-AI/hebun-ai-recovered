import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const eventBusRoot = join(process.cwd(), "src", "features", "enterprise-event-bus");
for (const file of readdirSync(eventBusRoot).filter((name) => name.endsWith(".ts"))) {
  const source = readFileSync(join(eventBusRoot, file), "utf8");
  for (const forbidden of [
    "react", "next/", "pg", "postgres", "sql", "kafka", "rabbit", "redis", "nats",
    "webhook", "outbox", "inbox", "retry", "dead-letter", "@/db", "enterprise-persistence",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden), false, `${file} must not contain ${forbidden}`);
  }
}

for (const root of ["src/app", "src/components", "src/features/enterprise-persistence"]) {
  const files = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(source.includes("enterprise-event-bus"), false, `${join(root, file)} must not import Event Bus`);
  }
}

console.log("Event Bus dependency boundary checks passed");
