/*
 * security-center/boundary.ts — the security response boundary (UI Phase 19).
 *
 * States the authority separation plainly: the Security Center DETECTS, EXPLAINS, INVESTIGATES,
 * and PREPARES; Heby understands, explains, investigates, traces evidence, and prepares response
 * options — it never declares a breach without evidence, approves, executes, or controls a device;
 * the Director (or an authorized human) DECIDES; and an authorized runtime EXECUTES only through
 * the Phase 17 action pipeline and the (disconnected) Phase 18 Device Runtime. No action control
 * lives in the Security Center.
 */

export interface SecurityBoundaryRow {
  readonly actor: string;
  readonly role: string;
  readonly describes: string;
}

export function describeSecurityBoundary(): readonly SecurityBoundaryRow[] {
  return [
    {
      actor: "Security Center",
      role: "Detect · explain · investigate · prepare",
      describes: "Interprets real/structural security state and prepares options. It never decides or executes.",
    },
    {
      actor: "Heby",
      role: "Understand · explain · trace evidence · prepare",
      describes: "Advisory only. It never declares a breach without evidence, approves, executes, or controls a device.",
    },
    {
      actor: "Director / authorized human",
      role: "Decide",
      describes: "The human authority act. Any consequential response is decided here, in Decisions.",
    },
    {
      actor: "Authorized runtime",
      role: "Execute",
      describes: "Executes only through the Phase 17 action pipeline and the (disconnected) Phase 18 Device Runtime.",
    },
  ];
}
