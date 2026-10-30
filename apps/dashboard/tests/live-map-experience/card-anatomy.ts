/*
 * LIVE MAP FAZ 2 — THE AGENT CARD.
 *
 * A closed card is a neutral field and a foot. Every word on it comes from the released projection,
 * and every word a sighted reader sees reaches a screen reader through the document's own text, in
 * the same order, because `summary` carries no `aria-label` to replace it.
 *
 *     FIELD != ACTIVITY        UNREAD != ZERO        CARD != A NEW DATA SOURCE
 *
 * NO AGENT IS DRESSED DIFFERENTLY. There is one field for every agent, so no image, no per-identity
 * mapping and no moving part can suggest that something is happening. The firewall proves the rest:
 * `<details>` stays the only interaction this surface has.
 *
 * Rendered with `renderToStaticMarkup` against the released projection. No database, no browser.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveMapCanvas } from "../../src/components/live-map/live-map-canvas";
import type { LiveMapAgentOutcomeRead } from "../../src/features/agent-outcome-observation/live-map-agent-outcome.server";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import type { DurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import type { OrganizationAuthorityRead } from "../../src/features/organization-authority/contracts";
import { ORGANIZATION_STRUCTURE_UNAVAILABLE } from "../../src/features/organization-authority/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const root = process.cwd();
const read = (p: string): string => readFileSync(path.join(root, p), "utf8");

const TENANT = { tenantId: "tenant-card", userId: "user-card" } as unknown as TenantContext;
const SERVING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RETIRED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SUSPENDED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const UNKNOWN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const HEBY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const ORGANIZATION: OrganizationAuthorityRead = {
  status: "available",
  organization: {
    organizationId: "tenant-card",
    name: "Acme Holdings",
    slug: "acme",
    lifecycleStatus: "active",
    tenantStatus: "active",
    provenance: "production-operator-ceremony",
    provenanceDetail: "Created by the production operator provisioning ceremony.",
    humanMemberCount: 3,
    structure: ORGANIZATION_STRUCTURE_UNAVAILABLE,
  },
};

const identity = (
  agentId: string,
  name: string,
  serviceStatus: "in-service" | "retired" | "suspended" | "indeterminate",
) => ({
  agentId,
  name,
  humanOwnerId: "human-1",
  humanOwnerType: "human",
  createdAt: "2026-06-01T00:00:00.000Z",
  retiredAt: serviceStatus === "retired" ? "2026-08-01T00:00:00.000Z" : null,
  inService: serviceStatus === "in-service",
  serviceStatus,
  suspendedAt: serviceStatus === "suspended" ? "2026-09-01T00:00:00.000Z" : null,
});

const IDENTITIES = {
  status: "known",
  genesisSpent: true,
  identities: [
    identity(SERVING, "Sourcing Analyst", "in-service"),
    identity(RETIRED, "Legacy Drafter", "retired"),
    identity(SUSPENDED, "Paused Reviewer", "suspended"),
    identity(UNKNOWN, "Undetermined Clerk", "indeterminate"),
    identity(HEBY, "Heby", "in-service"),
  ],
} as unknown as DurableAgentIdentityState;

const outcome = (agentId: string, filed: number, approved: number, unexecuted: number) => [
  agentId,
  {
    agentId,
    activity: { proposalsFiled: filed, pending: 0, withdrawn: 0 },
    governance: {
      approved,
      rejected: 0,
      permitsIssued: 0,
      permitsActive: 0,
      permitsExpired: 0,
      permitsConsumed: 0,
      permitsRevoked: 0,
      approvedWithoutExecution: unexecuted,
    },
    execution: { attempts: 0, pending: 0, accepted: 0, refused: 0, failed: 0, unknown: 0 },
  },
] as const;

const EVIDENCE = {
  status: "read",
  byAgentId: new Map([
    outcome(SERVING, 11, 5, 13),
    outcome(RETIRED, 0, 0, 0),
    outcome(SUSPENDED, 2, 1, 1),
    outcome(UNKNOWN, 1, 0, 0),
    outcome(HEBY, 11, 5, 13),
  ]),
  unresolvedAgentProposals: 0,
} as unknown as LiveMapAgentOutcomeRead;

const UNREAD = { status: "unavailable", reason: "read-failed" } as unknown as LiveMapAgentOutcomeRead;

const render = async (evidence: LiveMapAgentOutcomeRead): Promise<string> =>
  renderToStaticMarkup(
    React.createElement(LiveMapCanvas, {
      projection: await readLiveMapProjection(TENANT, {
        readOrganization: async () => ORGANIZATION,
        readAgentIdentity: async () => IDENTITIES,
        readAgentOutcome: async () => evidence,
      }),
    }),
  );

const summaries = (markup: string): string[] => markup.match(/<summary class="lm-node".*?<\/summary>/g) ?? [];

/* The document's own text with NOTHING added, so words that only tags kept apart run together. */
const naturalText = (html: string): string =>
  html
    .replace(/<[^>]+aria-hidden="true"[^>]*>.*?<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function main(): Promise<void> {
  const observed = await render(EVIDENCE);
  const unread = await render(UNREAD);
  const cards = summaries(observed);
  assert.equal(cards.length, 5, "one summary per durable identity, and no more");

  /* ── Screen reader: the document's text is the name ──────────────────────── */
  for (const card of cards) {
    assert.ok(!/<summary[^>]*aria-label/.test(card), "no aria-label replaces the card's own text");
  }
  assert.equal(
    naturalText(cards[0]),
    "Sourcing Analyst In service Durable Agent Identity 11 filed 5 approved 13 never executed",
    "the name, the lifecycle, the authority and all three counts read in order",
  );

  /* ── Valid HTML: `summary` holds phrasing content ───────────────────────── */
  for (const card of cards) {
    const tags = [...card.matchAll(/<([a-z][a-z0-9]*)[\s>]/g)].map((m) => m[1]);
    const invalid = tags.filter((tag) => !["summary", "span", "svg", "path", "rect", "circle"].includes(tag));
    assert.deepEqual(invalid, [], "summary holds spans and an icon, nothing block-level");
  }

  /* ── The three counts, and the difference between zero and unread ───────── */
  const retired = cards.find((card) => card.includes("Legacy Drafter")) ?? "";
  assert.ok(
    naturalText(retired).endsWith("0 filed 0 approved 0 never executed"),
    "a measured zero is printed as a zero",
  );
  for (const card of summaries(unread)) {
    assert.ok(naturalText(card).endsWith("Outcome observation unread"), "an unread observation says so");
    assert.ok(!/\d/.test(naturalText(card)), "and shows no number at all");
  }
  assert.ok(!unread.includes("lm-metric"), "no metric is drawn for an observation nobody read");

  /* ── Every lifecycle word survives on the card ──────────────────────────── */
  for (const [name, word, tone] of [
    ["Sourcing Analyst", "In service", "active"],
    ["Legacy Drafter", "Retired", "retired"],
    ["Paused Reviewer", "Suspended", "suspended"],
    ["Undetermined Clerk", "Status unknown", "indeterminate"],
  ]) {
    const card = cards.find((c) => c.includes(name)) ?? "";
    assert.ok(card.includes(`data-tone="${tone}">${word}<`), `${name} reads "${word}"`);
  }

  /* ── One neutral field: no image, no mapping, no sign of activity ───────── */
  const shape = (card: string): string => card.replace(/>[^<]*</g, "><");
  const [serving, , , , heby] = cards;
  assert.equal(shape(heby), shape(serving), "an agent called Heby is dressed like every other agent");
  assert.equal((observed.match(/class="lm-field"/g) ?? []).length, 5, "every agent has the one field");

  const canvas = read("src/components/live-map/live-map-canvas.tsx");
  for (const banned of ["<img", "next/image", "data-office", "backgroundImage", "agentOffice"]) {
    assert.ok(!canvas.includes(banned), `the card must not gain ${banned}`);
  }
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(canvas),
    "no agent identity is written into the surface",
  );
  for (const id of [SERVING, RETIRED, SUSPENDED, UNKNOWN, HEBY]) {
    assert.ok(!cards.join("").includes(id), "the card does not print an identity");
  }
  assert.ok(!existsSync(path.join(root, "public/agent-offices")), "no office image is published");

  const css = read("src/app/globals.css");
  const block = css.slice(css.indexOf("[data-live-map] {"), css.indexOf("}", css.lastIndexOf("[data-live-map]")));
  assert.ok(!block.includes("url("), "the field is drawn from tokens, not from a file");
  assert.ok(!/animation|@keyframes/.test(block), "and it never moves");

  /* ── The geometry the design accepted ───────────────────────────────────── */
  assert.ok(
    /\.lm-agent:not\(\[open\]\) \{[^}]*min-height: 223px;/.test(block),
    "a closed card is at least 223px and never a fixed height",
  );
  assert.ok(!/\.lm-agent[^{]*\{[^}]*[^-]height: 223px/.test(block), "text can grow the card");
  assert.ok(block.includes("container: lm-agents / inline-size"), "columns follow the content width");
  assert.ok(/\.lm-agents \{[^}]*grid-template-columns: minmax\(0, 1fr\);/.test(block), "one column");
  assert.ok(
    /@container lm-agents \(min-width: 30rem\) \{\s*\[data-live-map\] \.lm-agents \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/.test(css),
    "two columns",
  );
  assert.ok(
    /@container lm-agents \(min-width: 45rem\) \{\s*\[data-live-map\] \.lm-agents \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/.test(css),
    "three columns",
  );
  assert.ok(
    !/minmax\((?!0,|min\()[0-9.]+rem/.test(block),
    "no column minimum can outgrow a 320px screen",
  );
  assert.ok(
    /\.lm-node:focus-visible \{[^}]*outline: 2px solid var\(--color-primary-ring\);/.test(block),
    "keyboard focus draws a solid ring in the scope's own ring token",
  );
  assert.ok(
    /\.lm-node:focus-visible \{[^}]*outline-offset: -2px;/.test(block),
    "the card clips its overflow, so the focus ring sits inside it",
  );

  console.log("Live Map card anatomy: all checks passed.");
}

void main();
