/*
 * Onboarding entry wording — every refusal the public surface can render, in the bearer's words.
 *
 * WHY IT IS A SEPARATE MODULE. The card is a client component and must not name the enrollment
 * authority's vocabulary; the page is a server component that may not reach the onboarding feature
 * directly. This module is where the two authorities' refusal unions become sentences, once,
 * type-checked — `Record<Union, string>` means a new refusal reason breaks the build here rather than
 * rendering as a blank line in front of a stranger.
 *
 * ── THE WORDING RULES, WHICH ARE SECURITY RULES ──────────────────────────────
 *
 * 1. NEVER NAME THE ORGANIZATION, THE INVITED ADDRESS OR THE ROLE. The reader of these sentences may
 *    be a thief holding a capability that was not meant for them. Every sentence below is safe to
 *    show to that person.
 *
 * 2. NEVER SPLIT WHAT THE RUNTIME DELIBERATELY MERGED. `not-acceptable` covers unknown email, no
 *    credential, wrong password, locked credential and "you are not the invited human" — one reason,
 *    with equal work spent on every branch, because any visible difference is an enumeration oracle.
 *    It gets ONE sentence here, and that sentence must not hint at which case occurred.
 *
 * 3. NEVER CLAIM A DELIVERY OR A VERIFICATION. Hebun sends nothing and verifies no address.
 *
 * Pure frozen values. No React, no I/O, no database, no authority.
 */

import {
  MIN_ENROLLMENT_PASSWORD_LENGTH,
  TWO_KEY_INVARIANT,
  type EnrollmentCompletionRefusal,
  type EnrollmentStartRefusal,
} from "@/features/identity-enrollment/contracts";
import {
  CONTINUATION_CUSTODY,
  ENROLLMENT_CONTINUATION_TTL_SECONDS,
} from "@/features/identity-enrollment/continuation-cookie";
import type { InvitationAcceptanceRefusal } from "@/features/human-onboarding/contracts";
import type { OnboardingEntryWording } from "./onboarding-entry-card";

/** The surface's own reason, for the one case no authority owns: this browser has no receipt. */
const NO_RECEIPT = "no-continuation-receipt" as const;

const START_REFUSALS: Record<EnrollmentStartRefusal, string> = {
  "capability-unrecognized":
    "That capability was not recognized. Check you copied all of it, exactly as it was given to you.",
  "capability-not-usable":
    "That capability is no longer usable. It may have passed its 72-hour window, been withdrawn, or already been used.",
  "already-enrolled":
    "There is already a Hebun account for the address this capability names.",
  "enrollment-already-started":
    "A submission for this capability is already waiting for approval. If it was not you, tell the person who gave you the capability.",
  "persistence-unavailable": "Hebun is unavailable right now. Nothing was changed.",
};

const COMPLETION_REFUSALS: Record<EnrollmentCompletionRefusal | typeof NO_RECEIPT, string> = {
  [NO_RECEIPT]:
    "This browser is not carrying a submission. Submit the capability for approval first — and use the same browser you started in.",
  "continuation-unrecognized":
    "This browser's submission does not match that capability. Submit the capability for approval again.",
  "enrollment-not-approved":
    "Not approved yet. A Governance authority in that organization still has to approve your submission — try again once they tell you they have.",
  "capability-not-usable":
    "That capability lapsed before your account could be created. Ask the person who gave it to you for a new one.",
  "password-unacceptable": `Choose a password of at least ${MIN_ENROLLMENT_PASSWORD_LENGTH} characters.`,
  "already-enrolled": "There is already a Hebun account for the address this capability names.",
  "persistence-unavailable": "Hebun is unavailable right now. Nothing was changed.",
};

const ACCEPTANCE_REFUSALS: Record<InvitationAcceptanceRefusal, string> = {
  /* ONE sentence for every authentication-shaped failure. Rule 2 above. */
  "not-acceptable": "Those details were not accepted.",
  "capability-unrecognized":
    "That capability was not recognized. Check you copied all of it, exactly as it was given to you.",
  "capability-not-usable":
    "That capability is no longer usable. It may have passed its 72-hour window, been withdrawn, or already been used.",
  "already-a-member": "You already belong to that organization. Sign in as usual.",
  "authorization-provenance-broken":
    "The authorization behind this capability is no longer in a state that allows joining. Tell the person who gave it to you.",
  "role-not-eligible":
    "The role this capability names may no longer be joined this way. Tell the person who gave it to you.",
  "persistence-unavailable": "Hebun is unavailable right now. Nothing was changed.",
};

const RECEIPT_HOURS = Math.round(ENROLLMENT_CONTINUATION_TTL_SECONDS / 3600);

/** Everything the public card needs to render, resolved once on the server. */
export const ONBOARDING_ENTRY_WORDING: OnboardingEntryWording = Object.freeze({
  startRefusals: Object.freeze({ ...START_REFUSALS }),
  completionRefusals: Object.freeze({ ...COMPLETION_REFUSALS }),
  acceptanceRefusals: Object.freeze({ ...ACCEPTANCE_REFUSALS }),
  minimumPasswordLength: MIN_ENROLLMENT_PASSWORD_LENGTH,
  /*
   * The honest limit, in the same shape the authority states it: holding the capability proves
   * holding it. Rendered so the bearer understands why a second human must still approve.
   */
  possessionLimitation:
    "Holding this capability proves only that you hold it. It does not prove " +
    `${TWO_KEY_INVARIANT.key1ProvesNot.join(", ")}. ` +
    "A Governance authority reviews every submission before an account is created.",
  receiptCustody:
    `Your submission is remembered by this browser for about ${RECEIPT_HOURS} hours, in a cookie the ` +
    `page's scripts cannot read. It ${CONTINUATION_CUSTODY.authorizes}.`,
  receiptIfLost:
    `If you lose it or move to another browser, ${CONTINUATION_CUSTODY.ifLost}.`,
});
