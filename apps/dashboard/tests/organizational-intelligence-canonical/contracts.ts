import assert from "node:assert/strict";
import {
  createLegalEntity,
  createOrganization,
  createOrganizationalIdentity,
  createOrganizationalUnit,
  createWorkspaceScope,
  ORGANIZATIONAL_UNIT_KINDS,
  validateLegalEntity,
  validateOrganization,
  validateOrganizationalIdentity,
  validateOrganizationalUnit,
  validateWorkspaceScope,
  type LegalEntity,
  type Organization,
} from "../../src/features/organizational-intelligence/canonical";
import { externalIdentifier, identityInput, inert, lifecycle, period, provenance } from "../helpers/oi-canonical";

/* ── OrganizationalIdentity ────────────────────────────────────── */
function identity(): void {
  const id = createOrganizationalIdentity(identityInput());
  assert.equal(validateOrganizationalIdentity(id).status, "valid");
  assert.equal(id.architectureVersion, "organizational-identity/v1");
  assert.equal(Object.isFrozen(id), true);
  assert.equal(Object.isFrozen(id.aliases), true);
  assert.equal(Object.isFrozen(id.externalIdentifiers), true);

  const v = (o: Record<string, unknown>) => validateOrganizationalIdentity(createOrganizationalIdentity(identityInput(o)));
  assert.equal(v({ canonicalId: "" }).error?.code, "INVALID_CANONICAL_ID");
  assert.equal(v({ displayName: "  " }).error?.code, "INVALID_DISPLAY_NAME");
  assert.equal(v({ normalizedName: "" }).error?.code, "INVALID_NORMALIZED_NAME");
  assert.equal(v({ aliases: ["a", ""] }).error?.code, "INVALID_ALIAS");
  assert.equal(v({ aliases: ["a", "a"] }).error?.code, "DUPLICATE_ALIAS");
  assert.equal(v({ externalIdentifiers: [externalIdentifier({ system: "" })] }).error?.code, "INVALID_EXTERNAL_IDENTIFIER");
  assert.equal(v({ externalIdentifiers: [externalIdentifier(), externalIdentifier()] }).error?.code, "DUPLICATE_EXTERNAL_IDENTIFIER");
  // Distinct external ids are fine.
  assert.equal(v({ externalIdentifiers: [externalIdentifier(), externalIdentifier({ externalId: "002y" })] }).status, "valid");
  assert.equal(v({ lifecycle: lifecycle({ status: "meltdown" }) }).error?.code, "INVALID_LIFECYCLE");
  assert.equal(v({ lifecycle: lifecycle({ updatedAt: "2025-01-01T00:00:00Z" }) }).error?.code, "INVALID_LIFECYCLE"); // updated < created
  assert.equal(v({ provenance: provenance({ createdBy: "" }) }).error?.code, "INVALID_PROVENANCE");
  // aliases are immutable on the built identity.
  assert.throws(() => { (id.aliases as unknown as { push: (v: unknown) => void }).push("x"); });
}

/* ── WorkspaceScope ────────────────────────────────────────────── */
function workspace(): void {
  const base = { workspaceId: "ws-1", displayName: "Acme Cloud", isolationBoundary: "hard" as const, subscriptionTier: "enterprise", deploymentRegion: "eu", lifecycle: lifecycle(), provenance: provenance(), metadata: {}, ...inert };
  const ws = createWorkspaceScope(base);
  assert.equal(validateWorkspaceScope(ws).status, "valid");
  assert.equal(ws.isolationBoundary, "hard");

  const v = (o: Record<string, unknown>) => validateWorkspaceScope(createWorkspaceScope({ ...base, ...o }));
  assert.equal(v({ workspaceId: "" }).error?.code, "INVALID_WORKSPACE_ID");
  assert.equal(v({ subscriptionTier: null }).status, "valid");
  assert.equal(v({ deploymentRegion: null }).status, "valid");
  // Cannot reference another workspace as a parent (via metadata smuggling).
  assert.equal(v({ metadata: { parentWorkspaceId: "ws-0" } }).error?.code, "CROSS_WORKSPACE_REFERENCE");
  assert.equal(v({ metadata: { crossWorkspace: true } }).error?.code, "CROSS_WORKSPACE_REFERENCE");
  // The type itself has no parent field — structural guarantee.
  assert.equal("parentWorkspaceId" in ws, false);
}

/* ── Organization ──────────────────────────────────────────────── */
function organization(): void {
  const base = { workspaceId: "ws-1", identity: identityInput({ canonicalId: "org-1" }), organizationType: "holding", lifecycle: lifecycle(), provenance: provenance(), metadata: {}, ...inert };
  const org = createOrganization(base);
  assert.equal(validateOrganization(org).status, "valid");
  assert.equal(org.architectureVersion, "organization/v1");

  const v = (o: Record<string, unknown>) => validateOrganization(createOrganization({ ...base, ...o }));
  assert.equal(v({ workspaceId: "" }).error?.code, "INVALID_WORKSPACE_SCOPE");
  assert.equal(v({ organizationType: null }).status, "valid");
  assert.equal(v({ organizationType: "  " }).error?.code, "INVALID_ORGANIZATION_TYPE");
  // Distinct from LegalEntity / OrganizationalUnit — foreign-axis fields rejected.
  const smuggled = { ...createOrganization(base), legalForm: "GmbH" } as unknown as Organization;
  assert.equal(validateOrganization(smuggled).error?.code, "IMMUTABILITY_VIOLATION");
  const smuggled2 = { ...createOrganization(base), unitKind: "TEAM" } as unknown as Organization;
  assert.equal(validateOrganization(smuggled2).error?.code, "IMMUTABILITY_VIOLATION");
}

/* ── LegalEntity ───────────────────────────────────────────────── */
function legalEntity(): void {
  const base = { workspaceId: "ws-1", identity: identityInput({ canonicalId: "le-1" }), legalName: "Acme GmbH", legalForm: "GmbH", jurisdiction: "DE", registrationIdentifiers: [{ authority: "Handelsregister", jurisdiction: "DE", registrationNumber: "HRB1", verified: true, metadata: {}, ...inert }], organizationReferences: ["org-1"], lifecycle: lifecycle(), provenance: provenance(), metadata: {}, ...inert };
  const le = createLegalEntity(base);
  assert.equal(validateLegalEntity(le).status, "valid");

  const v = (o: Record<string, unknown>) => validateLegalEntity(createLegalEntity({ ...base, ...o }));
  assert.equal(v({ legalName: "" }).error?.code, "INVALID_LEGAL_NAME");
  assert.equal(v({ legalForm: "  " }).error?.code, "INVALID_LEGAL_FORM");
  assert.equal(v({ jurisdiction: "" }).error?.code, "INVALID_JURISDICTION");
  assert.equal(v({ registrationIdentifiers: [{ authority: "", jurisdiction: "DE", registrationNumber: "x", verified: true, metadata: {}, ...inert }] }).error?.code, "INVALID_REGISTRATION_IDENTIFIER");
  const dupReg = () => ({ authority: "A", jurisdiction: "DE", registrationNumber: "1", verified: true, metadata: {}, ...inert });
  assert.equal(v({ registrationIdentifiers: [dupReg(), dupReg()] }).error?.code, "DUPLICATE_REGISTRATION_IDENTIFIER");
  assert.equal(v({ organizationReferences: ["a", "a"] }).error?.code, "INVALID_ORGANIZATION_REFERENCE");
  // LegalEntity is not an OrganizationalUnit.
  const asUnit = { ...createLegalEntity(base), unitKind: "DEPARTMENT" } as unknown as LegalEntity;
  assert.equal(validateLegalEntity(asUnit).error?.code, "NOT_AN_ORGANIZATIONAL_UNIT");
}

/* ── OrganizationalUnit ────────────────────────────────────────── */
function organizationalUnit(): void {
  const base = { workspaceId: "ws-1", organizationId: "org-1", identity: identityInput({ canonicalId: "ou-1" }), unitKind: "DEPARTMENT" as const, customKind: null, parentUnitId: "ou-0", lifecycle: lifecycle(), effectivePeriod: period(), provenance: provenance(), metadata: {}, ...inert };
  const unit = createOrganizationalUnit(base);
  assert.equal(validateOrganizationalUnit(unit).status, "valid");

  const v = (o: Record<string, unknown>) => validateOrganizationalUnit(createOrganizationalUnit({ ...base, ...o }));
  // Every kind constructs.
  for (const kind of ORGANIZATIONAL_UNIT_KINDS) {
    const customKind = kind === "CUSTOM" ? "Guild" : null;
    assert.equal(v({ unitKind: kind, customKind }).status, "valid", `${kind} must be valid`);
  }
  assert.equal(v({ unitKind: "SQUAD" }).error?.code, "INVALID_UNIT_KIND");
  // CUSTOM requires a label; non-CUSTOM must not carry one.
  assert.equal(v({ unitKind: "CUSTOM", customKind: null }).error?.code, "INVALID_CUSTOM_KIND");
  assert.equal(v({ unitKind: "TEAM", customKind: "Guild" }).error?.code, "INVALID_CUSTOM_KIND");
  // Self-parent rejected.
  assert.equal(v({ parentUnitId: "ou-1" }).error?.code, "SELF_PARENT");
  assert.equal(v({ parentUnitId: null }).status, "valid");
  // Effective period.
  assert.equal(v({ effectivePeriod: period({ validFrom: "", }) }).error?.code, "INVALID_EFFECTIVE_PERIOD");
  assert.equal(v({ effectivePeriod: period({ validTo: "2025-01-01T00:00:00Z" }) }).error?.code, "INVALID_EFFECTIVE_PERIOD"); // to < from
  assert.equal(v({ workspaceId: "" }).error?.code, "INVALID_WORKSPACE_SCOPE");
  assert.equal(v({ organizationId: "" }).error?.code, "INVALID_ORGANIZATION_REFERENCE");
}

/* ── Deep-copy isolation (shared across contracts) ─────────────── */
function deepCopyIsolation(): void {
  const srcLifecycle = lifecycle();
  const org = createOrganization({ workspaceId: "ws-1", identity: identityInput({ canonicalId: "org-x" }), organizationType: "holding", lifecycle: srcLifecycle, provenance: provenance(), metadata: {}, ...inert });
  (srcLifecycle as { status: string }).status = "retired";
  assert.equal(org.lifecycle.status, "active", "construction must deep-copy, not alias");
  assert.equal(Object.isFrozen(org.lifecycle), true);
}

function main(): void {
  identity();
  workspace();
  organization();
  legalEntity();
  organizationalUnit();
  deepCopyIsolation();
  console.log("organizational-intelligence canonical contract checks passed");
}

main();
