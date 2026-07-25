import assert from "node:assert/strict";
import {
  createParty,
  createPartyRole,
  validateParty,
  validatePartyRole,
  validatePartyRoleSet,
  type Party,
  type PartyRole,
} from "../../src/features/organizational-intelligence/canonical";
import { partyInput, partyRoleInput } from "../helpers/oi-canonical";

const party = createParty(partyInput());
const customer = createPartyRole(partyRoleInput({ partyRoleId: "pr-1" }));
const customerDuplicate = createPartyRole(partyRoleInput({ partyRoleId: "pr-2" }));

function main(): void {
  const mutants = [
    // Party: workspace scope must be present.
    validateParty(Object.freeze({ ...party, workspaceId: "" }) as Party),
    // Party: registration identifiers must be unique.
    validateParty(Object.freeze({ ...party, registrationIdentifiers: Object.freeze(["reg-1", "reg-1"]) }) as Party),
    // Party: the entity/role boundary — a role axis must never appear on a Party.
    validateParty(Object.freeze({ ...party, role: "CUSTOMER" }) as unknown as Party),
    // PartyRole: only canonical role types are accepted.
    validatePartyRole(Object.freeze({ ...customer, roleType: "OWNER" }) as unknown as PartyRole),
    // PartyRole: CUSTOM requires a label.
    validatePartyRole(Object.freeze({ ...customer, roleType: "CUSTOM", customRoleLabel: null }) as unknown as PartyRole),
    // PartyRole: a canonical role must not carry a custom label.
    validatePartyRole(Object.freeze({ ...customer, customRoleLabel: "Smuggled" }) as PartyRole),
    // PartyRole: effective period must not end before it begins.
    validatePartyRole(Object.freeze({
      ...customer,
      effectivePeriod: Object.freeze({ ...customer.effectivePeriod, validTo: "2025-01-01T00:00:00Z" }),
    }) as PartyRole),
    // PartyRole set: a party may not hold the same active role twice.
    validatePartyRoleSet([customer, customerDuplicate]),
  ];
  assert.equal(mutants.length, 8);
  assert.equal(mutants.every((result) => result.status === "invalid"), true, "Every critical invariant mutant must be killed.");
  console.log("party canonical mutation checks passed: 8/8 mutants killed");
}

main();
