/*
 * tests/helpers/command-composition.ts — the CMD-V2 PRECONDITION, for suites that are not about the
 * whole composition.
 *
 * ── WHY THIS HELPER EXISTS ───────────────────────────────────────────────────
 *
 * Through CMD-FINAL, `CommandOverview` took two props and rendered three sections, and six suites
 * built it with `{ waiting, intent }`. CMD-V2 composes the WHOLE Command Center in that component —
 * hero, ledger, attention, work, intent, rail and limits — because a composition contract that
 * cannot see the page a Director meets is a contract over one third of it.
 *
 * So the component now needs six states. Suites that are about ONE of them (E2-4 is about elapsed
 * time in the attention region; CMD-B2 is about navigation) should not have to invent five more,
 * and MUST NOT each invent their own — five hand-rolled fixtures drift, and a suite that quietly
 * builds a different Live Map answer than its sibling is comparing two different pages.
 *
 * ── THESE FIXTURES ARE DELIBERATELY BORING, AND DELIBERATELY HONEST ──────────
 *
 * Every default below is a MEASURED answer, never an unread one: a named organization, a register
 * that answered with nothing, a connection register that answered with nothing, a ledger that
 * answered with nothing. That keeps the neutral page free of "could not be read" sentences that a
 * suite asserting something else would trip over — and it means a suite that wants an unread state
 * has to say so, which is exactly the property the product itself insists on.
 *
 * Nothing here is compiled-in PRODUCT data. It is test input, it never reaches `src/`, and the
 * mock-surface firewall walks `src/` rather than this directory.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommandOverview } from "../../src/components/command-overview/command-overview";
import {
  getExpressIntentSummary,
  type ConnectedCapabilityState,
  type ExpressIntentSummary,
  type WaitingOnYouState,
  type WorkInMotionState,
} from "../../src/features/command-overview/workspace-model";
import type { LiveMapAwareness } from "../../src/features/live-map/awareness";
import type { LiveMapProjection } from "../../src/features/live-map/contracts";
import type { SecurityAwareness } from "../../src/features/security-center/awareness";
import type { SecurityRecordedActObservation } from "../../src/features/security-center/contracts";

/** A Live Map answer that succeeded: the organization is named and the agent authority is empty. */
export const FIXTURE_ORGANIZATION: LiveMapAwareness = Object.freeze({
  organization: Object.freeze({ status: "named", name: "Fixture Organization" }),
  agents: Object.freeze({ status: "known-empty" }),
  intelligence: Object.freeze({ status: "available", unresolvedAgentProposals: 0 }),
  freshness: "Read when this page was requested. Not a stream, and not a subscription.",
}) as LiveMapAwareness;

/** A recorded-act ledger that answered, and holds nothing. A MEASURED zero, never an unread one. */
export const FIXTURE_SECURITY: SecurityAwareness = Object.freeze({
  state: Object.freeze({ status: "known-empty" }),
  authoritative: false,
  provenance: "a per-request view of the recorded-act ledger, which owns the record",
  limits:
    "A count of recorded acts is not a security posture, and says nothing about what was not recorded.",
}) as SecurityAwareness;

export const FIXTURE_LIVE_MAP: LiveMapProjection = Object.freeze({
  domains: Object.freeze([
    Object.freeze({
      domainId: "organization",
      label: "Organization",
      state: Object.freeze({
        status: "available",
        nodes: Object.freeze([
          Object.freeze({
            nodeId: "organization:fixture",
            kind: "organization",
            label: "Fixture Organization",
            truth: "authoritative",
            sourceAuthority: "Organization Authority",
            detail: Object.freeze(["Fixture organization." ]),
          }),
        ]),
      }),
    }),
  ]),
  edges: Object.freeze([]),
  freshness: "Read when this page was requested. Not a stream.",
}) as LiveMapProjection;

export const FIXTURE_RECORDED_ACTS: SecurityRecordedActObservation = Object.freeze({
  sourceClass: "audit",
  state: "known-empty",
  authoritative: false,
  provenance: "A bounded per-request view of the recorded-act ledger.",
  limits: "Recorded acts are not security events or posture.",
  generatedAt: "2026-08-21T09:00:00.000Z",
  acts: Object.freeze([]),
  totalRecordedActs: 0,
  truncated: false,
  unavailableReason: null,
}) as SecurityRecordedActObservation;

/** A work register that answered, and this organization has recorded none. */
export const FIXTURE_WORK: WorkInMotionState = Object.freeze({
  status: "empty",
  detail: "The register answered, and this organization has recorded no work.",
}) as WorkInMotionState;

/** A connection register that answered, and holds no row at all. */
export const FIXTURE_CAPABILITY: ConnectedCapabilityState = Object.freeze({
  status: "none-recorded",
}) as ConnectedCapabilityState;

export interface CommandCompositionOverrides {
  readonly waiting?: WaitingOnYouState;
  readonly intent?: ExpressIntentSummary;
  readonly work?: WorkInMotionState;
  readonly capability?: ConnectedCapabilityState;
  readonly organization?: LiveMapAwareness;
  readonly liveMap?: LiveMapProjection;
  readonly security?: SecurityAwareness;
  readonly recordedActs?: SecurityRecordedActObservation;
}

/** Every prop the composition needs, with the boring defaults above under anything a suite names. */
export function commandProps(overrides: CommandCompositionOverrides = {}) {
  return {
    waiting: overrides.waiting ?? ({ status: "none-waiting" } as WaitingOnYouState),
    intent: overrides.intent ?? getExpressIntentSummary(),
    work: overrides.work ?? FIXTURE_WORK,
    capability: overrides.capability ?? FIXTURE_CAPABILITY,
    organization: overrides.organization ?? FIXTURE_ORGANIZATION,
    liveMap: overrides.liveMap ?? FIXTURE_LIVE_MAP,
    security: overrides.security ?? FIXTURE_SECURITY,
    recordedActs: overrides.recordedActs ?? FIXTURE_RECORDED_ACTS,
  };
}

/** The rendered Command Center, as a reader meets it. */
export function renderCommand(overrides: CommandCompositionOverrides = {}): string {
  return renderToStaticMarkup(createElement(CommandOverview, commandProps(overrides)));
}
