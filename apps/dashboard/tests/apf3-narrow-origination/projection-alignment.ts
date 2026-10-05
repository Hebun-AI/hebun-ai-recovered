/*
 * APF-3 — the declaration and the rendered payload cannot drift apart.
 *
 * Every class has a MARKER planted in its fixture data. For every combination of model-facing arms,
 * a marker appears in what the model reads exactly when its class is declared — so a line that
 * discloses a class without declaring it, or a class declared for nothing rendered, both fail.
 * And the default — the one production uses — shows the organization and nothing else.
 */
import assert from "node:assert/strict";
import {
  NARROW_ORIGINATION_ARMS,
  projectOriginationForModel,
  type ModelFacingOriginationArm,
} from "../../src/features/agent-origination/originate-action.server";
import type { OriginationCandidateSet } from "../../src/features/agent-origination/contracts";

const U = "0e2a4a3b-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const ALL: OriginationCandidateSet = {
  recipients: [{ ref: `external-recipient/${U}`, label: "MARK-RECIPIENT" }],
  drafts: [{ ref: `work-artifact/${U}@1`, label: "MARK-DRAFT" }],
  work: {
    organizationLevel: true,
    departments: [{ slug: "floor", label: "MARK-DEPARTMENT", departmentRef: `department/${U}` }],
    observations: [{ slug: "observation-1", label: "MARK-OBSERVATION observed now", observationRef: `provider-observation/${U}` }],
  },
};
const MARKERS = {
  "external-recipient": "MARK-RECIPIENT",
  "work-artifact": "MARK-DRAFT",
  organization: "MARK-DEPARTMENT",
  "provider-observation": "MARK-OBSERVATION",
} as const;
const ARMS: readonly ModelFacingOriginationArm[] = ["send", "record-work", "observation"];

function subsets<T>(items: readonly T[]): T[][] {
  return items.reduce<T[][]>((acc, item) => [...acc, ...acc.map((s) => [...s, item])], [[]]);
}

for (const arms of subsets(ARMS)) {
  for (const supplement of [undefined, "MARK-SUPPLEMENT"]) {
    const p = projectOriginationForModel(ALL, arms, supplement);
    const text = p.evidence.join("\n");
    assert.equal(p.dataClasses[0], "conversation", "the goal is always conversation");
    for (const [dataClass, marker] of Object.entries(MARKERS)) {
      assert.equal(
        p.dataClasses.includes(dataClass as never),
        text.includes(marker),
        `declaration and rendered payload aligned for ${dataClass} under [${arms}]`,
      );
    }
    if (text.includes("MARK-SUPPLEMENT")) {
      assert.ok(p.dataClasses.includes("provider-observation"), "a rendered supplement is declared");
    }
  }
}

/* The production default: the organization, and nothing else. */
const narrow = projectOriginationForModel(ALL, NARROW_ORIGINATION_ARMS, "MARK-SUPPLEMENT");
assert.deepEqual([...NARROW_ORIGINATION_ARMS], ["record-work"]);
assert.deepEqual(narrow.dataClasses, ["conversation", "organization"], "the narrow declaration");
assert.deepEqual(narrow.candidates.recipients, [], "no recipient offered");
assert.deepEqual(narrow.candidates.drafts, [], "no draft offered");
assert.deepEqual(narrow.candidates.work.observations, [], "no observation offered");
assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(narrow.evidence.join("\n")), false, "no uuid rendered");
for (const marker of ["MARK-RECIPIENT", "MARK-DRAFT", "MARK-OBSERVATION", "MARK-SUPPLEMENT", "recipientRef", "draftRef", "observationSlug"]) {
  assert.equal(narrow.evidence.join("\n").includes(marker), false, `narrow default shows no ${marker}`);
}
assert.ok(narrow.evidence.join("\n").includes("departmentSlug=floor name=MARK-DEPARTMENT"), "the department is offered");

console.log("PASS apf3-narrow-origination projection-alignment");
