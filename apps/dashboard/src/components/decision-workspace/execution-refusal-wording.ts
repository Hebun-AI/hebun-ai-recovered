/*
 * PRODUCT-INTEGRATION-1 — an execution refusal, said in words a person can act on. Pure.
 * ENTERPRISE-OPERATIONS-1 widened it to the internal acts and to approve / refuse / revoke, so no
 * refusal on /approvals is shown as a bare code.
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
  /* ENTERPRISE-OPERATIONS-1 — the governed internal acts (record-work, set-work-declared-state). */
  "permit-not-consumable": "this authorization can no longer be executed: it expired, was revoked or was already used",
  "agent-not-in-service": "the agent that proposed this is not in service now — see Agents",
  "agent-mandate-refused": "the proposing agent's current mandate or responsibility no longer covers this act — see Agents",
  "action-kind-mismatch": "this authorization is for a different kind of act",
  "payload-not-recordable": "the approved request does not describe a work item the work register accepts",
  "payload-not-changeable": "the approved request does not describe a state change the work register accepts",
  "work-authority-refused": "the work register refused this change",
  "execution-unavailable": "Hebun could not reach its records; try again",
  /* The work register's own reasons, carried through a work-authority refusal. */
  "work-unresolved": "the work item no longer exists in this organization",
  "work-retired": "the work item is retired and accepts no further change",
  "work-domain-unresolved": "the work domain is no longer in service in this organization",
  "department-unresolved": "the department is no longer active in this organization",
  "follow-up-source-ineligible": "the work item this follow-up belongs to is no longer in service",
  "authority-unavailable": "Hebun could not reach its records; try again",
  "no-authorized-tenant-context": "your session has ended; sign in again",
  "not-authorized": "only this organization's Governance authority can change the work register",
  "malformed-work-title": "the approved work title is not one the work register accepts",
  "malformed-declared-state": "the approved state is not one the work register accepts",
  "accountable-not-eligible-member": "the accountable person is no longer an eligible member of this organization",
  "referent-unresolved": "the referenced record no longer exists in this organization",
  "reference-unresolved": "that evidence declaration no longer exists",
  "reference-already-declared": "this work already declares that reference",
  /* Approve, refuse and revoke on /approvals use the same vocabulary. */
  "justification-required": "a written justification is required",
  "rejection-reason-required": "a reason is required to refuse",
  "revocation-reason-required": "a reason is required to revoke",
  "request-unresolvable": "this request no longer exists in this organization",
  "request-not-pending": "this request is no longer pending — it was already decided",
  "permit-unresolvable": "this authorization no longer exists in this organization",
  "permit-not-active": "this authorization was already spent or revoked",
  "proposing-agent-not-in-service": "the agent that proposed this is not in service, so it cannot be authorized; it can still be refused",
};

export function executionRefusalWording(reason: string): string {
  const words = WORDING[reason];
  return words ? `${words} [${reason}]` : reason;
}
