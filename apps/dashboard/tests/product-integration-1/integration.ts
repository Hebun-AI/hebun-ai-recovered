/*
 * PRODUCT-INTEGRATION-1 — navigation truth, readiness discoverability, arming-scope wording and
 * execution-refusal wording. Static and pure: no database, no session, no provider.
 *
 * Each block pins one customer-visible promise and fails if a later change quietly breaks it.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WORKSPACES, getWorkspace } from "@/config/workspace-nav";
import {
  describeOrganizationReadiness,
  type OrganizationReadinessFacts,
} from "@/features/organization-readiness/organization-readiness";
import { getGovernanceOverviewModel } from "@/features/governance-overview";
import { executionRefusalWording } from "@/components/decision-workspace/execution-refusal-wording";
import { CommandOverview } from "../../src/components/command-overview/command-overview";
import { commandProps } from "../helpers/command-composition";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/** Every navigation destination is a real route: no link to a feature that does not exist. */
function navigationPointsAtRealRoutes(): void {
  for (const workspace of WORKSPACES) {
    for (const d of workspace.destinations) {
      if (!d.href) continue;
      const page = path.join(ROOT, "src/app/(dashboard)", d.href, "page.tsx");
      assert.ok(existsSync(page), `${workspace.label} → ${d.label} points at ${d.href}, which has a page`);
    }
  }
}

/** The surfaces that ARE live, tenant-scoped reads no longer describe themselves otherwise. */
function navigationDoesNotDenyRealState(): void {
  const all = WORKSPACES.flatMap((w) => w.destinations);
  for (const href of ["/integrations", "/director/provider-matrix", "/agents"]) {
    const d = all.find((x) => x.href === href);
    assert.ok(d?.purpose, `${href} has a purpose`);
    assert.doesNotMatch(d!.purpose!, /none connected|not connected|simulation|in-memory/i, `${href} no longer denies live state`);
  }
  // The pages really are tenant-scoped reads, which is what made the old wording false.
  assert.match(read("src/app/(dashboard)/integrations/page.tsx"), /listConnections/);
  assert.match(read("src/app/(dashboard)/agents/page.tsx"), /readDurableAgentIdentityState/);
  assert.match(read("src/app/(dashboard)/director/provider-matrix/page.tsx"), /readExternalSendOpsView/);
  // Navigation is shared by every tenant, so it still names no provider (SOC-UI1's rule).
  const purposes = all.map((d) => d.purpose ?? "").join(" ");
  assert.doesNotMatch(purposes, /\b(Google|Instagram|YouTube|GitHub|Drive)\b/, "no provider named in navigation");
}

/** Readiness is reachable from Governance and from Command without widening either. */
function readinessIsDiscoverable(): void {
  assert.equal(WORKSPACES.length, 7, "still seven workspaces");
  assert.deepEqual(
    getWorkspace("governance").destinations.map((d) => d.label),
    ["Overview", "Policies & Rules", "Compliance & Risk", "Audit & Explainability", "Security Center"],
    "the Phase 23C Governance L2 is unchanged",
  );
  const area = getGovernanceOverviewModel().availability.find((a) => a.href === "/governance/authority");
  assert.ok(area, "Governance Overview links to the authority and readiness page");
  assert.equal(area!.status, "authoritative-real");
  assert.equal(area!.canMutate, false, "the Overview entry mutates nothing");

  // Command links to the readiness card by its anchor, and the card carries that anchor.
  assert.match(read("src/components/command-overview/executive-hero.tsx"), /href="\/governance\/authority#organization-readiness"/);
  assert.match(read("src/components/governance-authority/organization-readiness-card.tsx"), /id="organization-readiness"/);
  // Command may not reach the capability/provider readers readiness composes (I1 firewall): link only.
  assert.doesNotMatch(read("src/app/(dashboard)/command/page.tsx"), /organization-readiness/, "Command reads no readiness");
  assert.doesNotMatch(
    read("src/components/command-overview/executive-hero.tsx"),
    /readOrganizationReadiness|describeOrganizationReadiness/,
    "the link claims no count or state",
  );
}

/** The link renders on the Command overview, in the organization context, without a claim. */
function commandRendersReadinessLink(): void {
  const markup = renderToStaticMarkup(createElement(CommandOverview, commandProps()));
  assert.match(markup, /href="\/governance\/authority#organization-readiness"/);
  assert.match(markup, /Organization readiness · what this organization still needs/);
}

const READY: OrganizationReadinessFacts = {
  governance: { status: "read", established: true, viewerIsAuthority: true },
  externalAi: { status: "active", purposes: ["conversation"] },
  modelDispatch: "permitted",
  capabilities: { status: "read", available: ["instagram.media.public.read"], unavailableCount: 0 },
  publishing: { status: "read", tenantArming: "armed", effectiveSend: "reachable" },
  workDomains: { status: "read", count: 2 },
};

/** An armed organization is told that the arming covers every external act kind together. */
function armingScopeIsStated(): void {
  const row = describeOrganizationReadiness(READY).find((r) => r.key === "publishing")!;
  assert.equal(row.state, "ready");
  for (const kind of [/email/i, /Instagram/, /YouTube/]) assert.match(row.facts, kind);
  assert.match(row.facts, /not granted per kind/);
  // Not-ready wording is the released one: proposals still filed, nothing executed.
  const withdrawn = describeOrganizationReadiness({
    ...READY,
    publishing: { status: "read", tenantArming: "withdrawn", effectiveSend: "blocked" },
  }).find((r) => r.key === "publishing")!;
  assert.equal(withdrawn.state, "not-ready");
  assert.match(withdrawn.facts, /nothing is executed/);
}

/** Refusals are worded, keep the server's code, and an unknown code is never guessed at. */
function refusalsAreWorded(): void {
  const armed = executionRefusalWording("tenant-not-armed");
  assert.match(armed, /not armed/);
  assert.match(armed, /Organization readiness/, "names where the next step lives");
  assert.ok(armed.endsWith("[tenant-not-armed]"), "the server's reason is kept");
  assert.match(executionRefusalWording("not-the-governance-authority"), /only this organization's Governance authority/);
  assert.equal(executionRefusalWording("some-future-reason"), "some-future-reason", "unknown reasons pass through verbatim");
  const contract = read("src/features/action-execution/contracts.ts");
  for (const reason of ["tenant-not-armed", "execution-disabled", "credential-unavailable", "capability-unavailable", "permit-not-executable", "publication-in-flight", "prior-publication-unacknowledged"]) {
    assert.ok(contract.includes(`"${reason}"`), `${reason} is a real executor refusal`);
  }
  // The client component holds no authority: it only words what the server returned.
  assert.match(read("src/components/decision-workspace/action-authorizations.tsx"), /return executionRefusalWording\(reason\);/);
}

navigationPointsAtRealRoutes();
navigationDoesNotDenyRealState();
readinessIsDiscoverable();
commandRendersReadinessLink();
armingScopeIsStated();
refusalsAreWorded();
console.log("PASS product-integration-1: navigation truth, readiness discoverability, arming scope, refusal wording");
