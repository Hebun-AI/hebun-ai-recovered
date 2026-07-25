import assert from "node:assert/strict";
import {
  PARTY_ROLE_TYPES,
  createParty,
  createPartyRole,
  validateParty,
  validatePartyRole,
  validatePartyRoleSet,
  type PartyRole,
} from "../../src/features/organizational-intelligence/canonical";
import { lifecycle, partyInput, partyRoleInput, period } from "../helpers/oi-canonical";

/* ── Party entity ──────────────────────────────────────────────── */
function partyContract(): void {
  const value = createParty(partyInput());
  assert.equal(validateParty(value).status, "valid");
  assert.equal(value.architectureVersion, "party/v1");
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.identity), true);
  assert.equal(Object.isFrozen(value.registrationIdentifiers), true);
  assert.equal(Object.isFrozen(value.metadata), true);

  // Optional descriptors may all be omitted (null / empty) and remain valid.
  assert.equal(validateParty(createParty(partyInput({
    partyType: null, website: null, country: null, industry: null,
    taxIdentifierReference: null, registrationIdentifiers: [],
  }))).status, "valid");

  const v = (o: Record<string, unknown>) => validateParty(createParty(partyInput(o)));
  assert.equal(v({ workspaceId: "" }).error?.code, "INVALID_WORKSPACE_SCOPE");
  assert.equal(v({ partyType: "" }).error?.code, "INVALID_PARTY_TYPE");
  assert.equal(v({ website: "" }).error?.code, "INVALID_WEBSITE");
  assert.equal(v({ country: "" }).error?.code, "INVALID_COUNTRY");
  assert.equal(v({ industry: "" }).error?.code, "INVALID_INDUSTRY");
  assert.equal(v({ taxIdentifierReference: "" }).error?.code, "INVALID_TAX_IDENTIFIER");
  assert.equal(v({ registrationIdentifiers: [""] }).error?.code, "INVALID_REGISTRATION_IDENTIFIER");
  assert.equal(v({ registrationIdentifiers: ["reg-1", "reg-1"] }).error?.code, "DUPLICATE_REGISTRATION_IDENTIFIER");
  assert.equal(v({ lifecycle: lifecycle({ status: "invalid" }) }).error?.code, "INVALID_LIFECYCLE");
  assert.equal(v({ metadata: [] }).error?.code, "INVALID_METADATA");

  // Party is not a role: no role/relationship axis leaks in.
  assert.equal("role" in value, false);
  assert.equal("roles" in value, false);
  assert.equal("relationshipType" in value, false);
}

/** A Party carrying an invalid embedded identity is rejected as INVALID_IDENTITY. */
function partyIdentityValidation(): void {
  const badIdentity = createParty(partyInput({
    identity: partyInput().identity,
  }));
  // Rebuild with a broken identity: empty displayName is caught by identity validation.
  const broken = Object.freeze({
    ...badIdentity,
    identity: Object.freeze({ ...badIdentity.identity, displayName: "" }),
  }) as typeof badIdentity;
  assert.equal(validateParty(broken).error?.code, "INVALID_IDENTITY");
}

/* ── PartyRole temporal relationship ───────────────────────────── */
function partyRoleContract(): void {
  const value = createPartyRole(partyRoleInput());
  assert.equal(validatePartyRole(value).status, "valid");
  assert.equal(value.architectureVersion, "party-role/v1");
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.effectivePeriod), true);

  // Every canonical role type validates with a null custom label.
  for (const roleType of PARTY_ROLE_TYPES) {
    const label = roleType === "CUSTOM" ? "Strategic Alliance" : null;
    assert.equal(validatePartyRole(createPartyRole(partyRoleInput({ roleType, customRoleLabel: label }))).status, "valid");
  }

  const v = (o: Record<string, unknown>) => validatePartyRole(createPartyRole(partyRoleInput(o)));
  assert.equal(v({ partyRoleId: "" }).error?.code, "INVALID_PARTY_ROLE_ID");
  assert.equal(v({ roleType: "OWNER" as never }).error?.code, "INVALID_ROLE_TYPE");
  assert.equal(v({ workspaceId: "" }).error?.code, "INVALID_WORKSPACE_SCOPE");
  assert.equal(v({ organizationId: "" }).error?.code, "INVALID_ORGANIZATION_REFERENCE");
  assert.equal(v({ partyId: "" }).error?.code, "INVALID_PARTY_REFERENCE");
  assert.equal(v({ effectivePeriod: period({ validTo: "2025-01-01T00:00:00Z" }) }).error?.code, "INVALID_EFFECTIVE_PERIOD");
  assert.equal(v({ lifecycle: lifecycle({ status: "invalid" }) }).error?.code, "INVALID_LIFECYCLE");
  assert.equal(v({ metadata: [] }).error?.code, "INVALID_METADATA");

  // CUSTOM validation: label required for CUSTOM, forbidden otherwise.
  assert.equal(v({ roleType: "CUSTOM", customRoleLabel: null }).error?.code, "INVALID_CUSTOM_ROLE");
  assert.equal(v({ roleType: "CUSTOM", customRoleLabel: "" }).error?.code, "INVALID_CUSTOM_ROLE");
  assert.equal(v({ roleType: "CUSTOMER", customRoleLabel: "Extra" }).error?.code, "INVALID_CUSTOM_ROLE");
  assert.equal(v({ roleType: "CUSTOM", customRoleLabel: "VIP Reseller" }).status, "valid");

  // A PartyRole is not an entity specialization: it holds no identity of its own.
  assert.equal("identity" in value, false);
}

/* ── Concurrent roles and duplicate-active detection ───────────── */
function partyRoleSetContract(): void {
  const customer = createPartyRole(partyRoleInput({ partyRoleId: "pr-cust" }));
  const supplier = createPartyRole(partyRoleInput({ partyRoleId: "pr-supp", roleType: "SUPPLIER" }));
  const investor = createPartyRole(partyRoleInput({ partyRoleId: "pr-inv", roleType: "INVESTOR" }));

  // Multiple distinct active roles for one party are allowed.
  assert.equal(validatePartyRoleSet([customer, supplier, investor]).status, "valid");
  assert.equal(validatePartyRoleSet([]).status, "valid");

  // Two active roles of the same type collide.
  const customerDuplicate = createPartyRole(partyRoleInput({ partyRoleId: "pr-cust-2" }));
  assert.equal(validatePartyRoleSet([customer, customerDuplicate]).error?.code, "DUPLICATE_ACTIVE_ROLE");

  // A retired role of the same type does not collide with an active one.
  const retiredCustomer = createPartyRole(partyRoleInput({ partyRoleId: "pr-cust-old", lifecycle: lifecycle({ status: "retired" }) }));
  assert.equal(validatePartyRoleSet([customer, retiredCustomer]).status, "valid");

  // CUSTOM roles collide only when their labels match.
  const alpha = createPartyRole(partyRoleInput({ partyRoleId: "pr-a", roleType: "CUSTOM", customRoleLabel: "Alpha" }));
  const alphaTwo = createPartyRole(partyRoleInput({ partyRoleId: "pr-a2", roleType: "CUSTOM", customRoleLabel: "Alpha" }));
  const beta = createPartyRole(partyRoleInput({ partyRoleId: "pr-b", roleType: "CUSTOM", customRoleLabel: "Beta" }));
  assert.equal(validatePartyRoleSet([alpha, beta]).status, "valid");
  assert.equal(validatePartyRoleSet([alpha, alphaTwo]).error?.code, "DUPLICATE_ACTIVE_ROLE");

  // Workspace / organization / party consistency across the set.
  assert.equal(validatePartyRoleSet([customer, createPartyRole(partyRoleInput({ partyRoleId: "x", roleType: "SUPPLIER", workspaceId: "ws-2" }))]).error?.code, "WORKSPACE_MISMATCH");
  assert.equal(validatePartyRoleSet([customer, createPartyRole(partyRoleInput({ partyRoleId: "x", roleType: "SUPPLIER", organizationId: "org-2" }))]).error?.code, "ORGANIZATION_MISMATCH");
  assert.equal(validatePartyRoleSet([customer, createPartyRole(partyRoleInput({ partyRoleId: "x", roleType: "SUPPLIER", partyId: "party-2" }))]).error?.code, "PARTY_MISMATCH");

  // An invalid member fails the whole set.
  const brokenMember = Object.freeze({ ...customer, roleType: "OWNER" }) as unknown as PartyRole;
  assert.equal(validatePartyRoleSet([brokenMember]).error?.code, "INVALID_MEMBER");
}

/* ── Adversarial construction: no behaviour, no shared mutable state ─ */
function adversarialConstruction(): void {
  const cases: readonly (() => unknown)[] = [
    () => createParty(partyInput({ metadata: { callback: () => undefined } }) as never),
    () => createPartyRole(partyRoleInput({ metadata: { promise: Promise.resolve() } }) as never),
    () => createParty(partyInput({ metadata: { symbol: Symbol("x") } }) as never),
    () => createPartyRole(partyRoleInput({ metadata: new (class Example {})() }) as never),
    () => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      return createParty(partyInput({ metadata: cyclic }) as never);
    },
    () => {
      const shared = { value: "mutable" };
      return createPartyRole(partyRoleInput({ metadata: { first: shared, second: shared } }) as never);
    },
  ];
  for (const construct of cases) assert.throws(construct, TypeError);
}

/* ── Deep-copy isolation and frozen output ─────────────────────── */
function deepCopyIsolation(): void {
  const registrations = ["reg-1"];
  const value = createParty(partyInput({ registrationIdentifiers: registrations }));
  registrations.push("reg-2");
  assert.deepEqual(value.registrationIdentifiers, ["reg-1"]);
  const role = createPartyRole(partyRoleInput());
  assert.throws(() => { (role as unknown as { partyRoleId: string }).partyRoleId = "mutated"; });
}

function main(): void {
  partyContract();
  partyIdentityValidation();
  partyRoleContract();
  partyRoleSetContract();
  adversarialConstruction();
  deepCopyIsolation();
  console.log("organizational-intelligence party contract checks passed");
}

main();
