/*
 * PRODUCT-INTEGRATION-1 — every customer-facing change is checked where a customer meets it.
 *
 * For each changed component this asserts the five things production verification found missing the
 * first time: (1) it is mounted by a reachable route, (2) the content is actually rendered, (3) the
 * route belongs to a workspace whose audience can reach it, (4) the content comes from the authority
 * that owns it, and (5) no UI or authority boundary moved. Static render only: no database, no
 * session, no provider.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "@/config/workspace-nav";
import {
  describeOrganizationReadiness,
  type OrganizationReadinessFacts,
} from "@/features/organization-readiness/organization-readiness";
import { getPlatformOverviewModel } from "@/features/platform-overview/model";
import { executionRefusalWording } from "@/components/decision-workspace/execution-refusal-wording";
import { CommandOverview } from "../../src/components/command-overview/command-overview";
import { GovernanceOverview } from "../../src/components/governance-overview/governance-overview";
import { OrganizationReadinessCard } from "../../src/components/governance-authority/organization-readiness-card";
import { PlatformOverview } from "../../src/components/platform-overview/platform-overview";
import { WorkforceWorkspace } from "../../src/components/workforce-workspace/workforce-workspace";
import { getWorkforceWorkspaceModel } from "@/features/workforce/workspace-model";
import { commandProps } from "../helpers/command-composition";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const page = (route: string) => read(path.join("src/app/(dashboard)", route, "page.tsx"));

/** (1) + (3): the route has a page that renders the component, and the route's workspace audience. */
function mounted(route: string, element: RegExp, audience: readonly string[]): void {
  assert.match(page(route), element, `${route} renders ${element}`);
  const ws = getWorkspace(resolveActiveWorkspace(`/${route}`));
  assert.deepEqual([...ws.roles].sort(), [...audience].sort(), `${route} is reached by ${audience.join(", ")}`);
}

const NOT_ARMED: OrganizationReadinessFacts = {
  governance: { status: "read", established: true, viewerIsAuthority: true },
  externalAi: { status: "active", purposes: ["assistance"] },
  modelDispatch: "permitted",
  capabilities: { status: "read", available: ["instagram.media.public.read"], unavailableCount: 0 },
  publishing: { status: "read", tenantArming: "never-armed", effectiveSend: "blocked" },
  workDomains: { status: "read", count: 1 },
};
const SHARED = /Arming is not granted per kind: one arming covers email sending, Instagram publication and YouTube publication together\./;

/** Command → Organization readiness (production-verified; preserved). */
function commandReadinessLink(): void {
  mounted("command", /<CommandOverview\b/, ["director", "operator", "specialist", "admin"]);
  const markup = renderToStaticMarkup(createElement(CommandOverview, commandProps()));
  assert.match(markup, /href="\/governance\/authority#organization-readiness"/);
  assert.match(markup, /Organization readiness · what this organization still needs/);
  // (5) Command may not reach the capability/provider readers readiness composes (I1 firewall).
  assert.doesNotMatch(page("command"), /organization-readiness/, "Command reads no readiness");
}

/** Governance Overview → Authority & readiness (production-verified; preserved). */
function governanceOverviewLink(): void {
  mounted("governance", /<GovernanceOverview\s*\/>/, ["director", "operator", "admin"]);
  const markup = renderToStaticMarkup(createElement(GovernanceOverview));
  assert.match(markup, /href="\/governance\/authority"/);
  assert.match(markup, /Authority &amp; readiness/);
  // (5) The Phase 23C Governance L2 and the seven workspaces are unchanged.
  assert.equal(WORKSPACES.length, 7);
  assert.deepEqual(getWorkspace("governance").destinations.map((d) => d.label), [
    "Overview", "Policies & Rules", "Compliance & Risk", "Audit & Explainability", "Security Center",
  ]);
}

/** The readiness card states the shared arming scope in every state, without implying authorization. */
function readinessCommunicatesSharedArming(): void {
  mounted("governance/authority", /<OrganizationReadinessCard rows=\{readiness\.rows\}/, ["director", "operator", "admin"]);
  // (4) rows come from the released reader on that page, never from the card.
  assert.match(page("governance/authority"), /readOrganizationReadiness\(tenant\)/);

  const notArmed = renderToStaticMarkup(createElement(OrganizationReadinessCard, { rows: describeOrganizationReadiness(NOT_ARMED) }));
  assert.match(notArmed, /id="organization-readiness"/);
  assert.match(notArmed, /Not armed for this organization/);
  assert.match(notArmed, SHARED, "visible without the organization being armed");
  assert.match(notArmed, /Arming is a platform operator ceremony; it is not available in the app today\./);
  assert.doesNotMatch(notArmed, /is A platform/, "the capitalization defect is gone");
  assert.doesNotMatch(notArmed, /\b(email|Instagram|YouTube)[^.]*\b(is|are) (authorized|armed)\b/i, "no kind is said to be authorized");

  const armedRows = describeOrganizationReadiness({ ...NOT_ARMED, publishing: { status: "read", tenantArming: "armed", effectiveSend: "reachable" } });
  const armed = armedRows.find((r) => r.key === "publishing")!;
  assert.match(armed.facts, SHARED);
  assert.match(armed.facts, /Each send or post still needs its own approval\./);
  for (const tenantArming of ["withdrawn", "armed"] as const) {
    const row = describeOrganizationReadiness({ ...NOT_ARMED, publishing: { status: "read", tenantArming, effectiveSend: "blocked" } }).find((r) => r.key === "publishing")!;
    assert.match(row.facts, SHARED, `${tenantArming}/blocked also states the shared scope`);
  }
  const unreadable = describeOrganizationReadiness({ ...NOT_ARMED, publishing: { status: "unavailable" } }).find((r) => r.key === "publishing")!;
  assert.equal(unreadable.state, "unknown");
  assert.doesNotMatch(unreadable.facts, SHARED, "an unreadable row stays only 'unknown'");
}

/** Platform Overview no longer tells a customer that nothing is connected or that persistence is in-memory. */
function platformOverviewIsTruthful(): void {
  mounted("platform", /<PlatformOverview dependencies=\{dependencies\} \/>/, ["director", "admin"]);
  const markup = renderToStaticMarkup(createElement(PlatformOverview, { dependencies: [] }));
  for (const stale of [/nothing is connected/i, /No external integration is configured or connected/, /none is configured or connected/, /persistence is in-memory/i, /No live model invocation exists/]) {
    assert.doesNotMatch(markup, stale, `Platform Overview no longer renders ${stale}`);
  }
  assert.doesNotMatch(page("platform"), /what is actually connected — contract-only and offline/);
  assert.match(markup, /href="\/integrations"/, "live connections are linked, not stated");
  assert.match(markup, /href="\/director\/provider-matrix"/);
  // (4) static and global: it names no provider and claims no per-organization state.
  const model = getPlatformOverviewModel();
  const json = JSON.stringify(model);
  assert.doesNotMatch(json, /\b(Google|Instagram|YouTube|GitHub|Drive|Claude)\b/);
  for (const href of ["/integrations", "/director/provider-matrix"]) {
    assert.equal(model.availability.find((a) => a.href === href)?.state, "external-authority", `${href} is owned elsewhere`);
  }
  // (5) the substrate ladder and the contract-only provenance the released tests pin are intact.
  assert.equal(model.state.provenance, "contract-only");
  assert.ok(model.executionBoundary.filter((s) => s.stage !== "REGISTERED").every((s) => !s.reached));
}

/** Workforce Overview no longer denies the members and durable agents other surfaces record. */
function workforceOverviewIsTruthful(): void {
  mounted("workforce", /<WorkforceWorkspace model=\{model\} \/>/, ["director", "operator", "specialist", "admin"]);
  // HebyWhy reads the pathname, as it does under the App Router; give it the route it is mounted on.
  const markup = renderToStaticMarkup(
    createElement(PathnameContext.Provider, { value: "/workforce" }, createElement(WorkforceWorkspace, { model: getWorkforceWorkspaceModel() })),
  );
  for (const stale of [/None connected/, /0 connected/i, /Identity model not connected/, /No human workforce identity is connected/, /No identities connected/, /None is mapped to a connected identity/, /seeded, in-memory agent definitions over a simulation runtime/]) {
    assert.doesNotMatch(markup, stale, `Workforce Overview no longer renders ${stale}`);
  }
  // (4) the records are linked to the surfaces that own them, and those surfaces really read them.
  assert.match(markup, /href="\/director\/organization"/);
  assert.match(markup, /href="\/agents"/);
  assert.match(page("director/organization"), /<PeopleRegisterPanel\b/);
  assert.match(page("agents"), /<DurableAgentIdentityCard\b/);
  assert.match(page("agents"), /<AgentCapabilityTruthCard\b/);
  // True limitations stay: no combined directory, no human capabilities, no capacity measure, no count.
  assert.match(markup, /This overview lists no workers/);
  assert.match(markup, /Human capabilities are not recorded/);
  assert.match(markup, /no\s+honest utilization measure is available/);
  assert.doesNotMatch(markup, /\b\d+ (humans?|agents?|workers?)\b/i, "no count is claimed");
  // (5) still static: the Overview page reads no tenant, session or record.
  assert.doesNotMatch(page("workforce"), /resolveTenantContext|\.server"|read[A-Z]\w*\(/);
}

/** Navigation destinations are real routes, and global navigation names no provider. */
function navigationIsHonest(): void {
  for (const workspace of WORKSPACES) {
    for (const d of workspace.destinations) {
      if (d.href) assert.ok(existsSync(path.join(ROOT, "src/app/(dashboard)", d.href, "page.tsx")), `${d.href} has a page`);
    }
  }
  const purposes = WORKSPACES.flatMap((w) => w.destinations).map((d) => d.purpose ?? "").join(" ");
  assert.doesNotMatch(purposes, /\b(Google|Instagram|YouTube|GitHub|Drive)\b/);
  assert.doesNotMatch(purposes, /none connected|not connected|runtime simulation, not a live workforce/);
}

/** Execution refusals on /approvals are worded; the server stays the only authority. */
function refusalsAreWorded(): void {
  // (1) mount chain: /approvals → ApprovalsDashboard → PermitRow, which owns the Execute message.
  assert.match(page("approvals"), /<ApprovalsDashboard\b/);
  assert.match(read("src/components/approvals-dashboard/approvals-dashboard.tsx"), /\bPermitRow\b/);
  const component = read("src/components/decision-workspace/action-authorizations.tsx");
  assert.match(component, /`Not executed \(\$\{executionRefusalText\(result\.reason\)\}\)\. The authorization is untouched\.`/);
  assert.match(component, /return executionRefusalWording\(reason\);/);

  const armed = executionRefusalWording("tenant-not-armed");
  assert.match(armed, /not armed/);
  assert.match(armed, /Organization readiness/);
  assert.ok(armed.endsWith("[tenant-not-armed]"), "the server's reason is kept");
  assert.equal(executionRefusalWording("some-future-reason"), "some-future-reason", "unknown reasons pass through verbatim");
  const contract = read("src/features/action-execution/contracts.ts");
  for (const reason of ["tenant-not-armed", "execution-disabled", "credential-unavailable", "capability-unavailable", "permit-not-executable", "publication-in-flight", "prior-publication-unacknowledged"]) {
    assert.ok(contract.includes(`"${reason}"`), `${reason} is a real executor refusal`);
  }
}

commandReadinessLink();
governanceOverviewLink();
readinessCommunicatesSharedArming();
platformOverviewIsTruthful();
workforceOverviewIsTruthful();
navigationIsHonest();
refusalsAreWorded();
console.log("PASS product-integration-1: mounted, rendered, reachable, authoritative, bounded");
