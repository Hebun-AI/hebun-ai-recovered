/*
 * PRODUCT-INTEGRATION-1 — an execution refusal, said in words a person can act on. Pure.
 *
 * It reads ONLY the reason the server returned and infers nothing about the viewer, the permit or the
 * organization: the server stays the one place that answers whether an act may run. Each sentence
 * names what happened and, where one exists, where the next step lives. The raw reason is kept at the
 * end so a refusal can still be matched to the server's vocabulary.
 *
 * An unknown reason is returned verbatim rather than guessed at.
 */

const WORDING: Readonly<Record<string, string>> = {
  "not-the-governance-authority": "only this organization's Governance authority can execute an authorization",
  "no-governance-authority": "only this organization's Governance authority can execute an authorization",
  "tenant-not-armed":
    "this organization is not armed to execute sends and posts — see Organization readiness on the Governance authority page",
  "execution-disabled": "executing sends and posts is switched off for the platform right now",
  "adapter-unavailable": "the provider this act needs is not available right now — see Integrations",
  "credential-unavailable": "the provider connection this act needs is not available — see Integrations",
  "capability-unavailable": "the provider capability this act needs is not available — see Integrations",
  "permit-not-executable": "this authorization can no longer be executed: it expired, was revoked or was already used",
  "digest-mismatch": "the request no longer matches what was authorized",
  "action-not-executable": "this kind of act cannot be executed from here",
  "persistence-unavailable": "Hebun could not reach its records; try again",
  unauthenticated: "your session has ended; sign in again",
  "publication-in-flight": "another publication of this revision is already in progress",
  "prior-publication-unacknowledged": "this revision was already published; a new proposal must acknowledge that publication",
};

export function executionRefusalWording(reason: string): string {
  const words = WORDING[reason];
  return words ? `${words} [${reason}]` : reason;
}
