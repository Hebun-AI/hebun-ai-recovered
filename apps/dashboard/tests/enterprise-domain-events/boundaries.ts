import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const featureRoot = join(process.cwd(), "src", "features");
const eventRoot = join(featureRoot, "enterprise-domain-events");

for (const file of readdirSync(eventRoot).filter((name) => name.endsWith(".ts"))) {
  const source = readFileSync(join(eventRoot, file), "utf8");
  assert.equal(source.includes("react"), false, `${file} must remain technology-neutral`);
  assert.equal(source.includes("enterprise-persistence"), false, `${file} must not depend on persistence`);
  assert.equal(source.includes("publish("), false, `${file} must not publish events`);
  assert.equal(source.includes("subscribe("), false, `${file} must not subscribe to events`);
}

const applicationRoot = join(featureRoot, "enterprise-application-services");
for (const file of readdirSync(applicationRoot).filter((name) => name.endsWith(".ts"))) {
  const source = readFileSync(join(applicationRoot, file), "utf8");
  assert.equal(source.includes("platform-core/events"), false, `${file} must not import the legacy event envelope`);
}

console.log("Domain Event dependency boundary checks passed");
