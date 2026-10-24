/*
 * auth-email-ownership/wording.ts — every sentence a human reads about confirming their address.
 *
 * One table per closed code set, typed as exhaustive records so a new refusal cannot ship without a
 * sentence. Nothing here echoes an address, a token or another account. Pure values.
 */
import type {
  AuthMailDeliveryOutcome,
  EmailVerificationConfirmRefusal,
  EmailVerificationIssueRefusal,
} from "./contracts";

export const EMAIL_OWNERSHIP_REQUIRED_FOR =
  "Confirming it is required before you can accept a Governance nomination. It does not change how you sign in.";

export const ISSUE_DELIVERY_TEXT: Record<AuthMailDeliveryOutcome, string> = {
  accepted:
    "We sent a confirmation link to your email address. Open it in a browser where you are signed in to Hebun. It expires in 24 hours.",
  rejected: "The confirmation email could not be sent. Try again in a few minutes.",
  unreachable: "The confirmation email could not be sent. Try again in a few minutes.",
  ambiguous:
    "Hebun could not confirm that the email was sent. If it does not arrive, request a new link in a few minutes.",
};

export const ISSUE_REFUSAL_TEXT: Record<EmailVerificationIssueRefusal, string> = {
  "already-verified": "Your email address is already confirmed.",
  cooldown: "A link was just sent. Wait a minute before requesting another one.",
  "daily-limit": "You have requested the maximum number of links for today. Try again tomorrow.",
  "global-limit": "Hebun is not sending confirmation emails right now. Try again later.",
  "delivery-unavailable": "Email confirmation is not available yet.",
  "identity-unavailable": "This account cannot confirm an email address right now.",
  unauthenticated: "Your session has ended. Sign in again to request a link.",
  "persistence-unavailable": "Hebun could not request a link. Nothing changed. Try again shortly.",
};

export const CONFIRM_REFUSAL_TEXT: Record<EmailVerificationConfirmRefusal, string> = {
  unauthenticated:
    "Sign in to Hebun with the account this email was addressed to, then open the link from the email again.",
  "workspace-not-selected":
    "Choose a workspace first, then open the link from the email again.",
  "invalid-link":
    "This link can no longer be used. It may have expired, been used already, or been replaced by a newer link. Request a new one in Hebun.",
  "different-account":
    "This link was sent for a different Hebun account than the one you are signed in with. Sign in with the account the email was addressed to and open the link again.",
  "already-verified": "This email address is already confirmed.",
  "identity-unavailable": "This account cannot confirm an email address right now.",
  "persistence-unavailable":
    "Hebun could not complete the confirmation. Nothing changed. Open the link again shortly.",
};

/** What the banner says about the open link, keyed by its recorded delivery outcome. */
export function latestLinkText(delivery: AuthMailDeliveryOutcome | null): string {
  if (delivery === "accepted") {
    return "A confirmation link was sent to your email address. Open it in a browser where you are signed in to Hebun.";
  }
  if (delivery === null) {
    return "A confirmation link was requested, and Hebun has no record yet that it was sent.";
  }
  return "The last confirmation email could not be confirmed as sent.";
}

/** Fixed UTC rendering, so server and browser print the same text. */
export function formatLinkExpiry(iso: string): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso))} UTC`;
}
