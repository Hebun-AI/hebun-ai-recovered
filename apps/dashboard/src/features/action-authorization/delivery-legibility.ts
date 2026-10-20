/*
 * action-authorization/delivery-legibility.ts — CAN THE HUMAN WHO AUTHORIZED THIS SEE WHAT BECAME
 * OF IT? (Delivery Legibility)
 *
 * ── THE GAP THIS CLOSES, STATED AS THE SENTENCE THAT STOPPED BEING TRUE ─────
 *
 * The permit surface told an authorizing human: *"Authorized — not executed. Executing spends this
 * authorization permanently."* That was exactly true for as long as the ONLY way to spend a permit
 * was a second human click. It is no longer the whole truth: an agent-proposed `record-work` permit
 * may now be spent by the scheduled delivery scan with no further click, while the surface still
 * describes a world in which nothing happens unless the reader acts.
 *
 * ── IT DERIVES. IT PERSISTS NOTHING AND DECIDES NOTHING. ────────────────────
 *
 * There is no delivery ledger, no claim column, no queue row and no status field behind any value
 * here — and there must not be, because the delivery trigger itself deliberately persists nothing.
 * Every band below is computed from rows that already exist and are already read:
 *
 *   `action_permits.status` / `expires_at`   via `derivePermitState`, the released projector
 *   `heby_action_requests.action_kind`       already selected by the permit reader
 *   `heby_action_requests.proposed_by_actor_type`  one more column on a join that already exists
 *   tenant enrolment + root arming           via the released read-only reachability composition
 *
 * This module is PURE. It performs no I/O, opens no transaction, reads no database and calls no
 * executor. Being wrong here can change a sentence on a page and nothing else.
 *
 * ── `derivePermitState` IS THE AUTHORITY, AND THIS SITS DOWNSTREAM OF IT ────
 *
 * The permit state is taken as INPUT, never recomputed. A second place deciding what "expired"
 * means would be a second answer to a question the repository already answers in one place, and
 * the one thing worse than an illegible permit is two surfaces disagreeing about it.
 *
 * ── WHAT THIS MODULE REFUSES TO CLAIM ───────────────────────────────────────
 *
 *     SHAPED-FOR-DELIVERY != REACHABLE != DELIVERED != ATTEMPTED
 *
 * 1. IT NEVER SAYS WHICH DOOR SPENT A PERMIT. A consumed `record-work` permit may have been spent
 *    by a human clicking Execute or by the delivery scan. Nothing durable distinguishes them: the
 *    permit row records no consuming actor, and the consumption audit row records the AUTHORIZING
 *    human for both doors. So `delivered` means SPENT AND RECORDED, and the wording says so.
 *
 * 2. IT NEVER SAYS WHETHER DELIVERY WAS ATTEMPTED. A refused delivery writes nothing at all — no
 *    attempt row, no counter, no timestamp — by the trigger's own design. `expired-undelivered`
 *    therefore means the authorization lapsed UNSPENT, which the schema guarantees
 *    (`consumed_at IS NULL` ⇔ `handoff_id IS NULL`, a CHECK constraint). It does NOT mean nothing
 *    was tried, and the sentence must not let a reader infer a failure that may never have happened.
 *
 * 4. IT NEVER ASSERTS THAT AUTOMATIC DELIVERY IS CURRENTLY ARMED. Whether this deployment would
 *    hand a permit over right now is owned by the released reachability composition, and this
 *    surface DOES NOT READ IT.
 *
 *    That is a scope decision, not an accident. Reading it would mean giving a product surface a
 *    new import edge into the machine-execution authority and a sixth per-page read, to qualify a
 *    sentence that is already true without it. The capability the milestone asked for — can the
 *    authorizing human see whether this exact permit is awaiting delivery, delivered, or expired
 *    undelivered — is answerable from the permit and its proposal alone.
 *
 *    So `awaiting-delivery` says the permit is OF THE KIND a machine may be handed, and the
 *    sentence NAMES its own condition — "whenever automatic delivery is enabled for your
 *    organization" — rather than claiming a deployment state it did not read. Composing the live
 *    arming state onto this surface remains available and is recorded as deferred, not refused.
 *
 * 5. REVOKED IS NOT EXPIRED. A withdrawal is a human's deliberate act recorded under a Governance
 *    decision; a lapse is a clock. Collapsing them would report the most accountable thing on this
 *    surface as the least.
 *
 * Server-safe and client-safe: pure types and pure functions.
 */
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "@/features/governed-machine-execution/contracts";

/**
 * The permit states this derivation accepts, RESTATED rather than imported.
 *
 * `PermitDisplayState` is declared in the permit READ module, which imports drizzle and the schema
 * tables. This module is reached from a `"use client"` component, so naming that module -- even in
 * a type-only import, which the TYPE CHECKER erases but the BUNDLER still resolves -- would put it
 * in the client graph and drag the database layer into a client chunk. A presentation derivation
 * has no business reaching persistence, in either direction.
 *
 * So the union is written out here, and a firewall test -- which may import the read module freely
 * -- asserts the two are the same set in BOTH directions. Drift is paid for in a failing test
 * rather than in a client bundle that reaches the database layer.
 */
export type DeliverablePermitState = "active" | "expired" | "consumed" | "revoked" | "none";

/**
 * What an authorizing human may be told about automatic delivery of ONE permit.
 *
 * Six bands, not three, because three would force two different facts into one word. The Director's
 * three questions — is it awaiting delivery, was it delivered, did it expire undelivered — are the
 * three middle bands; the other three exist so that answering them never requires a lie.
 */
export type PermitDeliveryBand =
  /**
   * This permit was never a delivery candidate, so delivery is not a question about it.
   *
   * An external send, or a `record-work` act a PERSON proposed. Saying "expired undelivered" about
   * one of these would imply automatic delivery had ever been on the table for it.
   */
  | { readonly band: "not-machine-deliverable" }
  /**
   * Active, unexpired, and of the kind a machine may be handed WITHOUT a further human click.
   *
   * IT DOES NOT ASSERT THAT DELIVERY IS ARMED — see `WHAT THIS MODULE REFUSES TO CLAIM` #4.
   */
  | { readonly band: "awaiting-delivery" }
  /** Spent, and the work exists. WHICH door spent it is not recorded anywhere — see the header. */
  | { readonly band: "delivered" }
  /** The clock ran out on an authorization nothing ever spent. */
  | { readonly band: "expired-undelivered" }
  /** A human withdrew the authorization before anything spent it. */
  | { readonly band: "revoked-undelivered" };

/** The shape facts a permit must have before automatic delivery is a question about it at all. */
export interface PermitDeliveryShape {
  readonly actionKind: string;
  /**
   * Whether this permit was issued under a standing envelope (RUNG 2) rather than by a human
   * reading this exact act and clicking Approve. `null` is the ordinary, per-act case.
   */
  readonly standingAuthorizationId?: string | null;
  /** `heby_action_requests.proposed_by_actor_type`, carried through the permit read. */
  readonly proposedByActorType: string;
  /** `derivePermitState`'s answer. Taken, never recomputed. */
  readonly state: DeliverablePermitState;
}

/**
 * Is automatic delivery even a question about this permit?
 *
 * Mirrors the runtime discovery predicate's two SHAPE clauses — the frozen machine-executable
 * action set and agent provenance — and deliberately not its clock clauses, which
 * `derivePermitState` already owns. The action set is IMPORTED, never restated, so this cannot
 * drift from what a machine may actually perform and cannot widen it.
 */
export function isMachineDeliverableShape(shape: PermitDeliveryShape): boolean {
  return (
    MACHINE_EXECUTABLE_ACTION_KINDS.has(shape.actionKind) && shape.proposedByActorType === "agent"
  );
}

/**
 * The band to show for one permit.
 *
 * SHAPE IS CHECKED FIRST, before any state. A permit that could never have been delivered gets no
 * delivery verdict at all, in any state — which is the difference between silence and a false
 * negative.
 */
export function derivePermitDeliveryBand(shape: PermitDeliveryShape): PermitDeliveryBand {
  if (!isMachineDeliverableShape(shape)) return { band: "not-machine-deliverable" };

  switch (shape.state) {
    case "consumed":
      return { band: "delivered" };
    case "expired":
      return { band: "expired-undelivered" };
    case "revoked":
      return { band: "revoked-undelivered" };
    case "active":
      return { band: "awaiting-delivery" };
    /* A status outside the three the projector names is not a delivery question either. */
    case "none":
      return { band: "not-machine-deliverable" };
  }
}

/**
 * The sentence a human reads, or `null` when there is nothing delivery-related to say.
 *
 * Every claim here is one the rows can carry. Read the header before changing a word: two of these
 * sentences exist specifically to DENY something the surface cannot know.
 */
/**
 * HOW THIS AUTHORIZATION CAME TO EXIST, when that is not what a reader would assume.
 *
 * `authorized_by_actor_id` names a human on EVERY permit, and for a standing-issued one that human
 * did not read this act and approve it — they authorized it in advance, inside a bounded envelope
 * they may withdraw. Saying nothing would let the ordinary reading stand, and the ordinary reading
 * would be wrong. `null` for an ordinary permit, where the ordinary reading is correct.
 */
export function permitAuthorizationProvenanceSentence(shape: PermitDeliveryShape): string | null {
  return shape.standingAuthorizationId
    ? "Authorized in advance under a standing authorization — not by a person reviewing this act. The human named on it signed the envelope this was issued from, and can withdraw it at any time."
    : null;
}

/**
 * HEBY-PRODUCT-UX-1 — whether automatic delivery is enabled for this organization, as the caller READ
 * it from the machine-execution authority. This module stays blind to that authority: `unknown`
 * (the default) keeps the conditional sentence, and nothing here is inferred from a permit.
 */
export type MachineDeliveryState = "enabled" | "not-enabled" | "unknown";

export function permitDeliverySentence(band: PermitDeliveryBand, machineDelivery: MachineDeliveryState = "unknown"): string | null {
  switch (band.band) {
    case "not-machine-deliverable":
      return null;
    case "awaiting-delivery":
      if (machineDelivery === "not-enabled")
        return "Authorized and not yet executed. Automatic delivery is not enabled for your organization, so nothing runs on its own: it takes effect only if a person executes it before it expires.";
      if (machineDelivery === "enabled")
        return "Awaiting automatic delivery. Automatic delivery is enabled for your organization, so Hebun may perform this under your authorization without a further click, at any time before it expires — or you may execute it now yourself.";
      return "Awaiting automatic delivery. Whenever automatic delivery is enabled for your organization, Hebun may perform this under your authorization without a further click, at any time before it expires — or you may execute it now yourself.";
    case "delivered":
      return "Delivered. This authorization was spent and the work was recorded. Whether a person executed it or the scheduled delivery did is not recorded anywhere, so this surface does not say.";
    case "expired-undelivered":
      return "Expired without being delivered. Nothing was spent and no work was recorded under this authorization. Whether delivery was ever attempted is not recorded — a refused delivery writes nothing.";
    case "revoked-undelivered":
      return "Revoked before delivery. A person withdrew this authorization; it was not spent and no work was recorded under it.";
  }
}

/*
 * OPERATIONAL-OBSERVABILITY-V1 — HAS THIS PERMIT WAITED LONGER THAN SCHEDULED DELIVERY SHOULD TAKE?
 *
 * The scheduled delivery scan runs hourly (`vercel.json`, `0 * * * *`); a test pins the interval
 * below to that schedule. A permit issued at any moment has had at least TWO scheduled chances once
 * it is older than two intervals, so that is the attention window. It is an attention threshold,
 * not a deadline: the host may skip or delay a run, the scan may refuse for reasons it records
 * nowhere, and a refusal leaves the permit active — so nothing here says a delivery failed, was
 * attempted, or that a scan ran. The age is measured from the page's own read instant
 * (`evaluatedAt`), never from a client clock, and expiry stays `derivePermitState`'s answer.
 */
export const MACHINE_DELIVERY_SCAN_INTERVAL_MINUTES = 60;
export const MACHINE_DELIVERY_ATTENTION_WINDOW_MS = 2 * MACHINE_DELIVERY_SCAN_INTERVAL_MINUTES * 60_000;

export type MachineDeliveryAttention =
  /** Enabled, and younger than the window: the next scheduled scan may still pick it up. */
  | "awaiting-scheduled-delivery"
  /** Enabled, and unspent past the window. A reason to look — not evidence of a failed delivery. */
  | "attention-required"
  /** Automatic delivery is not enabled (disarmed, or this organization is not enrolled). */
  | "delivery-not-enabled"
  /** The enabled state or a usable read instant is missing, so lateness cannot be judged. */
  | "insufficient-evidence";

/** Pure. `null` for every permit that is not active and machine-deliverable. */
export function deriveMachineDeliveryAttention(
  band: PermitDeliveryBand,
  machineDelivery: MachineDeliveryState,
  issuedAt: string,
  evaluatedAt: string | null,
): MachineDeliveryAttention | null {
  if (band.band !== "awaiting-delivery") return null;
  if (machineDelivery === "not-enabled") return "delivery-not-enabled";
  const ageMs = evaluatedAt === null ? Number.NaN : Date.parse(evaluatedAt) - Date.parse(issuedAt);
  if (machineDelivery !== "enabled" || !Number.isFinite(ageMs) || ageMs < 0) {
    return "insufficient-evidence";
  }
  return ageMs > MACHINE_DELIVERY_ATTENTION_WINDOW_MS
    ? "attention-required"
    : "awaiting-scheduled-delivery";
}

/** What the surface says for each state. Statements, never instructions to a machine. */
export const MACHINE_DELIVERY_ATTENTION_WORDING: Readonly<
  Record<MachineDeliveryAttention, { readonly label: string; readonly sentence: string }>
> = Object.freeze({
  "awaiting-scheduled-delivery": {
    label: "Awaiting scheduled delivery",
    sentence:
      "Issued less than two hourly scheduled scans ago. The next scheduled scan may still deliver it.",
  },
  "attention-required": {
    label: "Attention required",
    sentence:
      "Still unspent after at least two hourly scheduled scans. This is not evidence that a delivery was attempted or that one failed — a refused delivery records nothing. Check whether automatic delivery is still enabled, or decide whether to execute or revoke it before it expires.",
  },
  "delivery-not-enabled": {
    label: "Automatic delivery not enabled",
    sentence: "No scheduled delivery is expected while automatic delivery is not enabled for your organization.",
  },
  "insufficient-evidence": {
    label: "Delivery timing unknown",
    sentence:
      "Whether this authorization is overdue for scheduled delivery cannot be said: the automatic delivery state or the read time was not available.",
  },
});
