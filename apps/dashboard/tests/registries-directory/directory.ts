import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REGISTRY_DIRECTORY } from "../../src/features/registry-directory";

/*
 * Registries directory contract (Hebun UI Phase 21C).
 *
 * The rebuilt Registries hub is a read-only reference directory of structural facts.
 * It must surface no fabricated metric, import no mock data, create no second goal or
 * policy authority, and expose no mutation controls.
 */

function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
}

const FORBIDDEN_METRIC_KEYS = [
  "totalRecords",
  "activeRecords",
  "archivedRecords",
  "dailyGrowth",
  "health",
  "synchronization",
  "consistency",
  "validation",
  "coverage",
  "freshness",
  "recentChanges",
  "status",
];

function noFabricatedMetricFields(): void {
  const keys = new Set(REGISTRY_DIRECTORY.flatMap((descriptor) => Object.keys(descriptor)));
  for (const forbidden of FORBIDDEN_METRIC_KEYS) {
    assert.ok(!keys.has(forbidden), `registry descriptors must not carry a fabricated "${forbidden}" field`);
  }
}

function structuralFactsOnly(): void {
  assert.ok(REGISTRY_DIRECTORY.length >= 15, "the directory lists the organizational registries");
  for (const descriptor of REGISTRY_DIRECTORY) {
    assert.ok(descriptor.id && descriptor.title && descriptor.entityType, `${descriptor.id} has structural identity`);
    assert.ok(descriptor.authoritativeOwner && descriptor.ownerSubsystem, `${descriptor.id} names its authority`);
    assert.equal(descriptor.persistence, "mock-static", `${descriptor.id} honestly declares mock-static persistence`);
    assert.equal(
      descriptor.connection,
      "reference-not-connected",
      `${descriptor.id} is honestly not connected to an authoritative feed`,
    );
    assert.equal(descriptor.provenance, "none", `${descriptor.id} claims no provenance it does not have`);
  }
}

function noDuplicateGoalOrPolicyAuthority(): void {
  const goals = REGISTRY_DIRECTORY.find((registry) => registry.id === "goals");
  assert.equal(goals?.authoritativeOwner, "Command", "Goal authority remains Command — no second goal product");
  assert.ok(/Strategic Goals/i.test(goals?.mutationOwner ?? ""), "goals mutation owner points at Command Strategic Goals");

  const policies = REGISTRY_DIRECTORY.find((registry) => registry.id === "policies");
  assert.equal(policies?.authoritativeOwner, "Governance", "Policy authority remains Governance");
  assert.equal(policies?.detailStatus, "no-detail", "policies has no fabricated detail surface");
}

function directoryImportsNoMock(): void {
  const files = [
    join(process.cwd(), "src", "features", "registry-directory", "directory.ts"),
    join(process.cwd(), "src", "components", "registries", "registries-directory.tsx"),
    join(process.cwd(), "src", "app", "(dashboard)", "director", "registries", "page.tsx"),
  ];
  for (const file of files) {
    for (const target of importsOf(readFileSync(file, "utf8"))) {
      assert.ok(
        target !== "@/features/registries" && !target.startsWith("@/features/registries/"),
        `${file} must not import the mock @/features/registries (got ${target})`,
      );
    }
  }
}

function hubHasNoMutationControls(): void {
  const component = readFileSync(
    join(process.cwd(), "src", "components", "registries", "registries-directory.tsx"),
    "utf8",
  );
  for (const token of ["New Registry", "onClick", "createRegistry", "deleteRegistry", "updateRegistry", "<button"]) {
    assert.ok(!component.includes(token), `Registries hub must not expose a mutation control (${token})`);
  }
}

function pageDroppedMockComponents(): void {
  const page = readFileSync(
    join(process.cwd(), "src", "app", "(dashboard)", "director", "registries", "page.tsx"),
    "utf8",
  );
  for (const target of importsOf(page)) {
    for (const fragment of ["registry-summary", "registry-manager", "registry-growth", "registry-intelligence", "registry-relationship", "registry-timeline"]) {
      assert.ok(!target.includes(fragment), `Registries hub page must not import the mock component ${target}`);
    }
  }
  assert.ok(
    importsOf(page).some((t) => t.includes("registries-directory")),
    "Registries hub renders the honest directory",
  );
}

function main(): void {
  noFabricatedMetricFields();
  structuralFactsOnly();
  noDuplicateGoalOrPolicyAuthority();
  directoryImportsNoMock();
  hubHasNoMutationControls();
  pageDroppedMockComponents();
  console.log("registries-directory contract checks passed");
}

main();
