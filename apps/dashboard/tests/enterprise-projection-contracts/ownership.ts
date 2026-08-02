import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const integration = readFileSync("src/features/enterprise-intelligence/mock.ts", "utf8");
for (const domain of ["organization-domain", "knowledge-domain", "timeline-domain", "decision-domain"]) {
  assert.equal(integration.includes(`@/features/${domain}/mock`), true, `integration must consume ${domain}`);
}

for (const domain of ["organization-domain", "knowledge-domain", "timeline-domain", "decision-domain"]) {
  const source = readFileSync(`src/features/${domain}/mock.ts`, "utf8");
  assert.equal(source.includes("@/features/enterprise-intelligence"), false, `${domain} must not depend on integration`);
  assert.equal(source.includes("@/features/enterprise-projections"), true, `${domain} must satisfy canonical contracts`);
}

for (const component of [
  "src/components/organization-domain/organization-overview.tsx",
  "src/components/knowledge-domain/knowledge-overview.tsx",
  "src/components/timeline-domain/timeline-overview.tsx",
  "src/components/decision-domain/decision-overview.tsx",
  "src/components/director-workspace/enterprise-intelligence-integration.tsx",
  "src/components/director-workspace/heby-assistant-panel.tsx",
]) {
  const source = readFileSync(component, "utf8");
  assert.equal(/from "@\/features\/.+\/mock"/.test(source), false, `${component} must not import mock-owned types`);
}

console.log("enterprise projection ownership checks passed");
