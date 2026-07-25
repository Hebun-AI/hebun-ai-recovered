import type { Actor } from "../../src/features/organizational-intelligence/canonical";

export const inert = { executable: false as const, authoritative: false as const };

export function lifecycle(overrides: Record<string, unknown> = {}) {
  return { status: "active" as const, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", ...inert, ...overrides };
}
export function provenance(overrides: Record<string, unknown> = {}) {
  return { createdBy: "seed", createdAt: "2026-01-01T00:00:00Z", sourceSystem: "seed", ...inert, ...overrides };
}
export function period(overrides: Record<string, unknown> = {}) {
  return { validFrom: "2026-01-01T00:00:00Z", validTo: null, ...inert, ...overrides };
}
export function externalIdentifier(overrides: Record<string, unknown> = {}) {
  return { system: "Salesforce", namespace: "Account", externalId: "001x", tenantReference: null, verified: true, metadata: {}, ...inert, ...overrides };
}
export function identityInput(overrides: Record<string, unknown> = {}) {
  return {
    canonicalId: "id-1", displayName: "Acme Corp", normalizedName: "acme corp",
    aliases: ["Acme"], externalIdentifiers: [externalIdentifier()], lifecycle: lifecycle(),
    provenance: provenance(), metadata: {}, ...inert, ...overrides,
  };
}
export function actorInput(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "act-1", actorType: "PERSON" as const, workspaceId: "ws-1", organizationReferences: ["org-1"],
    identity: identityInput({ canonicalId: "p-1", displayName: "Jane Doe", normalizedName: "jane doe" }),
    capabilityReferences: ["cap.review"], lifecycle: lifecycle(), provenance: provenance(), metadata: {}, ...inert, ...overrides,
  } as Omit<Actor, "architectureVersion" | "identity"> & { identity: ReturnType<typeof identityInput> };
}
