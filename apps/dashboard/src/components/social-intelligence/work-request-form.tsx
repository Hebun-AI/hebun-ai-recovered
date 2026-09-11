"use client";

/*
 * social-intelligence/work-request-form.tsx — SOC-ACT1's one affordance.
 *
 * ── WHAT THE CONTROL SAYS, AND WHY EVERY OTHER WORD WAS REJECTED ─────────────
 *
 * "File work request". Not "Execute", not "Fix", not "Publish", not "Apply recommendation", not
 * "Run agent" — the first two describe an act nobody authorized, the third describes a capability
 * Hebun does not have, and the last two describe an authority that does not exist. Filing a request
 * is precisely and only what pressing this does.
 *
 * ── IT SENDS AN IDENTITY AND A SENTENCE, AND NOTHING ELSE ────────────────────
 *
 * The observation reference is an opaque handle this page received; the title is what a person
 * typed. NO MEASUREMENT IS SENT. Not the follower count, not the change, not the instant. A browser
 * that altered any number on this page would change nothing about the resulting request, because the
 * server re-reads the observation and builds the citation from its own row.
 *
 * ── THE RECEIPT REFUSES TO OVERSTATE ─────────────────────────────────────────
 *
 * On success it says a REQUEST was filed and is waiting for a decision, and says in the same breath
 * that no work item exists and nothing reached a social platform. There is no progress bar, no
 * "authorizing…", no optimistic row and no implied continuation — because nothing continues on its
 * own. A human decides at the approvals surface, and only a separately-spent permit lets Hebun
 * record anything.
 *
 *     PROPOSED != AUTHORIZED != EXECUTED != SUCCESSFUL
 */
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { proposeWorkFromSocialObservationAction } from "@/app/(dashboard)/intelligence/social/actions";
import {
  SOCIAL_WORK_PROPOSAL_SENTENCES,
  type SocialWorkProposalResult,
} from "@/features/heby-action-inlet/contracts";

export interface WorkRequestFormProps {
  /**
   * The canonical reference of the observation this request would cite.
   *
   * `null` is a real state and is handled by the CALLER, not here: a surface with nothing to cite
   * renders no form at all rather than a disabled one, because a disabled control still implies the
   * action exists and is merely unavailable right now.
   */
  readonly observationRef: string;
  readonly platformLabel: string;
}

export function WorkRequestForm({ observationRef, platformLabel }: WorkRequestFormProps) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [result, setResult] = useState<SocialWorkProposalResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <details className="mt-4 rounded-lg border border-border bg-surface">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        File work request from this observation
      </summary>
      <form
        className="border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const outcome = await proposeWorkFromSocialObservationAction({
              observationRef,
              title,
            });
            setResult(outcome);
            if (outcome.status === "proposed") setTitle("");
          });
        }}
      >
        <p className="mb-2 text-xs text-fg-secondary">
          {SOCIAL_WORK_PROPOSAL_SENTENCES.evidenceMeaning}
        </p>
        <label className="block text-xs text-fg-secondary" htmlFor={titleId}>
          What is the work? ({platformLabel})
          <input
            id={titleId}
            className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-sm text-fg"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="In the organization's own words"
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <Button type="submit" disabled={pending || title.trim().length === 0}>
            {pending ? "Filing…" : "File work request"}
          </Button>
          <span className="text-xs text-fg-muted">
            Creates a request for a person to decide. It records no work.
          </span>
        </div>

        {result?.status === "proposed" ? (
          <div className="mt-3 rounded border border-border bg-bg p-2 text-xs text-fg-secondary">
            <p className="font-semibold text-fg">Work request filed — awaiting a decision.</p>
            <p className="mt-1">{SOCIAL_WORK_PROPOSAL_SENTENCES.proposed}</p>
            <p className="mt-1">{SOCIAL_WORK_PROPOSAL_SENTENCES.pendingMeaning}</p>
          </div>
        ) : null}

        {result?.status === "refused" ? (
          <p className="mt-3 rounded border border-border bg-bg p-2 text-xs text-fg-secondary">
            {result.detail}
          </p>
        ) : null}
      </form>
    </details>
  );
}
