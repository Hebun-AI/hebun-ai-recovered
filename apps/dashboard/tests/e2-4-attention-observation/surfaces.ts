/*
 * E2-4 — WHAT A HUMAN ACTUALLY SEES.
 *
 * The rendered proof that a duration reaches Command, Decisions and the Live Map inspector — and
 * that it arrives as metadata rather than as an alarm. The load-bearing one is §2: the OLDEST
 * figure must come from the unbounded aggregate, because the list beside it is newest-first and
 * capped, so a surface that derived "oldest" from what it is showing would be right on small
 * tenants and wrong on large ones.
 *
 *     AGE != IMPORTANCE     WAITING != LATE     NO THRESHOLD IS A POLICY
 *
 * Pure and rendered. No database, no network, no browser.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { CommandOverview } from "../../src/components/command-overview/command-overview";
import { toWaitingOnYou } from "../../src/features/command-overview/workspace-model";
import { getExpressIntentSummary } from "../../src/features/command-overview/workspace-model";
import { ActionAuthorizations } from "../../src/components/decision-workspace/action-authorizations";
import { LiveMapCanvas } from "../../src/components/live-map/live-map-canvas";
import { elapsedSince } from "../../src/features/attention-observation/contracts";
import type { PendingActionRequestView } from "../../src/features/action-authorization/read-action-authorizations.server";
import type { LiveMapProjection } from "../../src/features/live-map/contracts";

const AT = "2026-08-30T12:00:00.000Z";

const REQUEST = (id: string, proposedAt: string): PendingActionRequestView => ({
  requestId: id,
  actionKind: "send-external-communication",
  toolId: "heby.operations.send-communication",
  sideEffect: "CONSEQUENTIAL_MUTATION",
  reversibility: "irreversible",
  targetKind: "recipient",
  targetRef: "rec-1",
  targetLabel: "someone@example.test",
  expectedEffect: "Send one message to one recipient.",
  consequences: ["The recipient receives a message."],
  parameters: [],
  locks: [],
  evidence: { status: "attached", items: [] },
  proposedByActorType: "human",
  proposedByAgentName: null,
  proposedByAgentInService: null,
  payloadDigest: "d",
  proposedAt,
});

/** The words a duration may never turn into, matched on WORD BOUNDARIES. */
const ALARM = ["urgent", "overdue", "late", "critical", "stalled", "priority", "escalate", "sla"];

function assertNoAlarm(html: string, where: string): void {
  const text = html.replace(/<[^>]*>/g, " ").toLowerCase();
  for (const word of ALARM) {
    /*
     * "late" is exempted ONLY inside the milestone's own denial, which exists to say Hebun holds no
     * definition of it. Every other occurrence is a violation. Sixth+ recorded instance of a
     * prose-shaped guard failing on honest text; the remedy is the established one.
     */
    const stripped = text
      .replace(/waiting is not late[^.]*/g, " ")
      .replace(/no target or deadline[^.]*/g, " ")
      .replace(/no target, no threshold and no definition of late/g, " ");
    assert.ok(
      !new RegExp(`\\b${word}\\b`).test(stripped),
      `${where} must not render "${word}" — a duration is evidence, never a verdict`,
    );
  }
}

function main(): void {
  /* ── 1. COMMAND RENDERS A DURATION PER ITEM ──────────────────────────────── */
  {
    const waiting = toWaitingOnYou(
      { status: "read", items: [REQUEST("req-1", "2026-08-27T08:00:00.000Z")] },
      { evaluatedAt: AT, aggregate: { status: "read", value: { awaiting: 1, oldestFiledAt: "2026-08-27T08:00:00.000Z" } } },
    );
    const html = renderToStaticMarkup(
      React.createElement(CommandOverview, { waiting, intent: getExpressIntentSummary() }),
    );
    assert.match(html, /Awaiting decision · 3d 4h/, "the per-item duration reaches the page");
    assert.match(html, /Oldest awaiting decision: 3d 4h/);
    assert.match(html, /· 1 awaiting/);
    assertNoAlarm(html, "Command");
  }

  /* ── 2. THE OLDEST COMES FROM THE AGGREGATE, NOT FROM THE LIST ───────────── */
  {
    /*
     * THE BITE. The bounded list holds ONE proposal filed 2 hours ago. The unbounded aggregate says
     * the oldest was filed three days ago — which is exactly what a newest-first `limit 50` read
     * looks like on a busy tenant. A surface that derived "oldest" from `items` would print 2h.
     */
    const waiting = toWaitingOnYou(
      { status: "read", items: [REQUEST("req-new", "2026-08-30T10:00:00.000Z")] },
      { evaluatedAt: AT, aggregate: { status: "read", value: { awaiting: 137, oldestFiledAt: "2026-08-27T08:00:00.000Z" } } },
    );
    if (waiting.status !== "waiting") throw new Error("unreachable");
    assert.equal(waiting.items[0]!.waitingFor?.label, "2h", "the item shows its OWN age");
    assert.equal(waiting.oldestWaiting?.label, "3d 4h", "the oldest is the aggregate's, never the list's");
    assert.equal(waiting.awaitingCount, 137, "the total is unbounded, never `items.length`");

    const html = renderToStaticMarkup(
      React.createElement(CommandOverview, { waiting, intent: getExpressIntentSummary() }),
    );
    assert.match(html, /Oldest awaiting decision: 3d 4h/);
    assert.ok(!/Oldest awaiting decision: 2h/.test(html));
  }

  /* ── 3. NO AGGREGATE MEANS NO CLAIM — NEVER A SUBSTITUTED ONE ────────────── */
  {
    const waiting = toWaitingOnYou(
      { status: "read", items: [REQUEST("req-1", "2026-08-27T08:00:00.000Z")] },
      { evaluatedAt: AT, aggregate: { status: "unavailable", reason: "read-failed" } },
    );
    if (waiting.status !== "waiting") throw new Error("unreachable");
    assert.equal(waiting.oldestWaiting, null);
    assert.equal(waiting.awaitingCount, null, "a capped list length may never stand in for a total");
    const html = renderToStaticMarkup(
      React.createElement(CommandOverview, { waiting, intent: getExpressIntentSummary() }),
    );
    assert.ok(!/Oldest awaiting decision/.test(html), "no aggregate, no oldest line");
    assert.match(html, /Awaiting decision · 3d 4h/, "the per-item duration is unaffected");
  }

  /* ── 4. THE RELEASED BEHAVIOUR SURVIVES WITH NO ELAPSED INPUT ────────────── */
  {
    const waiting = toWaitingOnYou({ status: "read", items: [REQUEST("req-1", "2026-08-27T08:00:00.000Z")] });
    if (waiting.status !== "waiting") throw new Error("unreachable");
    assert.equal(waiting.items[0]!.waitingFor, null, "no instant, no duration — never a zero");
    assert.equal(waiting.oldestWaiting, null);
    const html = renderToStaticMarkup(
      React.createElement(CommandOverview, { waiting, intent: getExpressIntentSummary() }),
    );
    assert.ok(!/Awaiting decision ·/.test(html));
  }

  /* ── 5. A RESOLVED QUEUE IS NEVER RENDERED AS SOMETHING WAITING ──────────── */
  {
    const none = toWaitingOnYou(
      { status: "read", items: [] },
      { evaluatedAt: AT, aggregate: { status: "read", value: { awaiting: 0, oldestFiledAt: null } } },
    );
    assert.equal(none.status, "none-waiting", "an empty queue is its own state, not a zero duration");
    const html = renderToStaticMarkup(
      React.createElement(CommandOverview, { waiting: none, intent: getExpressIntentSummary() }),
    );
    assert.ok(!/Awaiting decision ·/.test(html));
    assert.ok(!/Oldest awaiting decision/.test(html));

    /* And an UNAVAILABLE read still says so, rather than becoming a queue with no age. */
    const down = toWaitingOnYou(
      { status: "unavailable", reason: "persistence-not-configured" },
      { evaluatedAt: AT, aggregate: { status: "read", value: { awaiting: 4, oldestFiledAt: "2026-08-01T00:00:00.000Z" } } },
    );
    assert.equal(down.status, "unavailable", "an unread queue is never rescued by an aggregate");
  }

  /* ── 6. DECISIONS RENDERS THE SAME DURATION, AS METADATA ─────────────────── */
  {
    const html = renderToStaticMarkup(
      React.createElement(ActionAuthorizations, {
        requests: [REQUEST("req-1", "2026-08-27T08:00:00.000Z")],
        permits: [],
        connected: true,
        evaluatedAt: AT,
        awaitingCount: 1,
        oldestWaiting: elapsedSince("2026-08-27T08:00:00.000Z", AT, "action-request.created_at"),
      }),
    );
    assert.match(html, /Awaiting decision · 3d 4h/);
    assert.match(html, /Oldest awaiting decision: 3d 4h/);
    assertNoAlarm(html, "Decisions");
    /*
     * VISUALLY SUBORDINATE. `irreversible` legitimately carries danger styling because
     * reversibility is a property of the ACT. A duration must not borrow it.
     */
    const badge = /class="[^"]*"[^>]*>\s*Awaiting decision/.exec(html.replace(/\n/g, " "));
    assert.ok(badge, "the duration badge is rendered");
    assert.ok(!/danger[^"]*"[^>]*>\s*Awaiting decision/.test(html), "no danger styling on a duration");

    /* With no instant, the released rendering is byte-identical to before this milestone. */
    const released = renderToStaticMarkup(
      React.createElement(ActionAuthorizations, {
        requests: [REQUEST("req-1", "2026-08-27T08:00:00.000Z")],
        permits: [],
        connected: true,
      }),
    );
    assert.ok(!/Awaiting decision ·/.test(released));
  }

  /* ── 7. THE LIVE MAP ANNOTATION, UNDER ITS OWN AUTHORITY ─────────────────── */
  {
    const projection: LiveMapProjection = {
      domains: [
        {
          domainId: "agents",
          label: "Agents",
          state: {
            status: "available",
            nodes: [
              {
                nodeId: "agent:a1",
                kind: "agent",
                label: "Heby",
                truth: "authoritative",
                sourceAuthority: "Durable Agent Identity",
                detail: ["In service."],
                status: { label: "In service", tone: "active" },
                attention: {
                  truthClass: "derived",
                  sourceAuthority: "Organizational Attention Observation",
                  basis: "Every duration here is measured from a timestamp an authoritative subsystem already wrote.",
                  measures: [
                    {
                      label: "Oldest proposal awaiting a decision",
                      value: "3d 4h",
                      basis: "action-request.created_at",
                    },
                  ],
                  nonClaims: ["age is not importance"],
                },
              },
            ],
          },
        },
      ],
      edges: [],
      freshness: "Read at request time.",
    } as unknown as LiveMapProjection;

    const html = renderToStaticMarkup(React.createElement(LiveMapCanvas, { projection }));
    assert.match(html, /Organizational Attention Observation/, "the annotation names its own authority");
    assert.match(html, /Oldest proposal awaiting a decision/);
    assert.match(html, /3d 4h/);
    assert.match(html, /action-request\.created_at/, "the column it was measured from is shown");
    assert.ok(
      !/Attention required|Needs attention|Attention state/i.test(html),
      "an ANNOTATION, never a classification — no policy owner for one exists",
    );
    assertNoAlarm(html, "Live Map");

    /* A node with no annotation renders none — absence, never a zero. */
    const bare = JSON.parse(JSON.stringify(projection)) as LiveMapProjection;
    delete (bare.domains[0]!.state as unknown as { nodes: { attention?: unknown }[] }).nodes[0]!.attention;
    const bareHtml = renderToStaticMarkup(React.createElement(LiveMapCanvas, { projection: bare }));
    assert.ok(!/Organizational Attention Observation/.test(bareHtml));
    assert.ok(!/0d 0h|under a minute/.test(bareHtml), "no annotation is not a duration of zero");
  }

  console.log("E2-4 surfaces: OK");
}

main();
