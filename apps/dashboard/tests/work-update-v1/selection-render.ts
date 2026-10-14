/*
 * WORK-UPDATE V1 (Option A) — the work item a person brought to Heby, rendered for every state the
 * page can resolve. The affordance appears only for an in-service, domain-scoped item; every other
 * case says why, and an unresolved or unreadable key says nothing about any item.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HebyWorkStateSelection } from "../../src/components/layout/heby/heby-work-state-selection";
import type { WorkStateSelection } from "../../src/features/heby-action-inlet/work-state-proposal.server";

const id = "a0000000-0000-4000-8000-000000000001";
const render = (selection: WorkStateSelection) => renderToStaticMarkup(createElement(HebyWorkStateSelection, { selection }));
const ASK = "Ask Heby to propose a state change";

const ready = render({ status: "selected", workItemId: id, title: "Q4 launch", declaredState: "planned", inService: true, domainScoped: true });
assert.ok(ready.includes("Q4 launch") && ready.includes("currently planned"), "the person sees the item they chose");
assert.ok(ready.includes(ASK), "the affordance is offered for an in-service, domain-scoped item");
assert.ok(ready.includes("It is not shown the item or its title"), "and it says the model is not shown the item");
assert.ok(!ready.includes(id), "the id is not printed");

const unscoped = render({ status: "selected", workItemId: id, title: "Legacy", declaredState: "active", inService: true, domainScoped: false });
assert.ok(!unscoped.includes(ASK) && unscoped.includes("not recorded in a work domain"));

const retired = render({ status: "selected", workItemId: id, title: "Old", declaredState: "complete", inService: false, domainScoped: true });
assert.ok(!retired.includes(ASK) && retired.includes("retired"));

for (const status of ["unresolved", "unavailable"] as const) {
  const html = render({ status });
  assert.ok(!html.includes(ASK), `${status}: nothing is offered`);
  assert.ok(html.includes("Nothing was asked and nothing was changed"), `${status}: says nothing happened`);
}

console.log("work-update-v1/selection-render: OK");
