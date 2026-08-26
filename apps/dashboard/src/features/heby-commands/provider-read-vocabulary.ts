/*
 * heby-commands/provider-read-vocabulary.ts — HOW A PROVIDER'S ANSWER IS PUT INTO WORDS.
 *
 * ── WHY THIS IS ITS OWN MODULE ───────────────────────────────────────────────
 *
 * INT-5B1 wrote these sentences inside the provider-read executor, which was right while exactly one
 * command read the GitHub seam. INT-5C added a second one, and a second wording of "GitHub rate
 * limited us" would have been a SECOND INTERPRETATION of one provider's answer — the two-interpreters
 * defect this repository has paid for before. So the wording moved here, unchanged, and both
 * commands import it.
 *
 * Nothing here decides anything. It is pure: no I/O, no database, no provider call, no authority,
 * no model. It turns an already-decided refusal or fault into the words an operator reads.
 *
 * ── THE SENTENCES ARE NOT INTERCHANGEABLE ────────────────────────────────────
 *
 * Each one sends a person somewhere different — to their GitHub installation settings, to their
 * Hebun connection, or nowhere at all because the fault was Hebun's. That is the whole reason they
 * are not one message, and it is why a caller may never substitute a generic line for a specific one.
 */
import { MAX_REPOSITORIES_PER_PAGE } from "@/features/provider-github/contracts";
import type { GitHubRepositoryDiscovery } from "@/features/provider-github/discover-installation-repositories.server";

/**
 * Why a provider read did not happen, in the operator's words.
 *
 * The seam's own refusal is carried across rather than re-derived: the capability authority already
 * distinguishes "nothing is connected", "the connection is not usable" and "what was granted does
 * not cover this", and a second interpretation here would be the two-interpreters defect one layer
 * down. Each sentence sends a person somewhere different, which is the whole reason they are not
 * one message.
 */
export const REFUSAL_LINES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "no-authorized-tenant-context": [
    "No organization is resolved for this request, so no connection could be consulted.",
  ],
  "connection-authority-unavailable": [
    "Hebun could not read your organization's connections, so it did not go on to contact GitHub.",
    "This says nothing about the state of your installation.",
  ],
  "capability-not-available": [
    "Reading repository activity is not available for your organization right now.",
    "That is one of three different situations: no GitHub installation is connected, the connection " +
      "is not currently usable, or what GitHub granted does not cover this read.",
    "The Integrations workspace shows which of the three applies, and offers the fix for it.",
  ],
  "no-github-connection": [
    "No GitHub connection was found for your organization, so there was nothing to read from.",
  ],
  "installation-identity-unavailable": [
    "The stored connection does not carry a usable GitHub installation identity, so no read was attempted.",
  ],
  "github-app-not-configured": [
    "This Hebun deployment is not configured with a GitHub App, so it cannot identify itself to GitHub.",
    "That is an operator configuration gap, not a problem with your organization's installation.",
  ],
});

/**
 * Why GitHub itself did not answer with a page.
 *
 * The classes are kept apart because they mean different things, and collapsing them is how a
 * provider outage gets reported to a tenant as a broken connection. NONE of these paths writes
 * anything: this module holds no connection writer, so a failure here leaves the stored lifecycle
 * exactly as it was.
 */
export const FAILURE_LINES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  auth: [
    "GitHub refused Hebun's own application credential, so no read happened.",
    "Nothing about your organization's installation is implicated by this.",
  ],
  installation: [
    "GitHub reports that the installation Hebun holds is gone, suspended, or not the one it expected.",
    "Only the Integrations workspace acts on that; this command changed nothing.",
  ],
  permission: [
    "The installation is live, and what it granted does not cover reading repositories.",
    "Re-consenting in the Integrations workspace is what widens it. Nothing was changed here.",
  ],
  identity: [
    "GitHub answered without an account identity Hebun could use, so nothing was read.",
  ],
  transport: [
    "GitHub did not answer: a rate limit, a server error, a timeout, or a network fault.",
    "NOTHING IS KNOWN about your installation from this — it may be perfectly fine.",
    "Nothing was retried, nothing was stored, and your connection was left untouched.",
  ],
  malformed: [
    "GitHub answered in a shape Hebun does not understand, so nothing was reported from it.",
    "Hebun would rather show you nothing than guess what a response meant.",
  ],
});

/**
 * State the page bound truthfully, every time, in both directions.
 *
 * A BOUND IS NOT A TOTAL. When GitHub reports more than one page holds, the line says so and says
 * how many; when it does not report a count at all, the line says THAT rather than implying the
 * list is complete. Silence would read as completeness, which is the one thing a bounded read may
 * never imply.
 */
export function boundaryLines(discovery: GitHubRepositoryDiscovery, shown: number): readonly string[] {
  const lines = [
    `Showing ${shown} repositor${shown === 1 ? "y" : "ies"} — one page, at most ` +
      `${MAX_REPOSITORIES_PER_PAGE}. This command never asks for a second page.`,
  ];
  if (discovery.truncated) {
    lines.push(
      `PARTIAL, NOT COMPLETE: GitHub reports ${discovery.totalReportedByProvider ?? "more"} in total, ` +
        "so this page is not all of them.",
    );
  } else if (discovery.totalReportedByProvider === null) {
    lines.push(
      "GitHub reported no total for this installation, so Hebun cannot tell you whether this page is all of them.",
    );
  } else {
    lines.push(
      `GitHub reports ${discovery.totalReportedByProvider} in total for this installation, which this page covers.`,
    );
  }
  return lines;
}
