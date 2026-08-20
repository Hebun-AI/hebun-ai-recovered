"use client";

/*
 * Knowledge review card (K4) — Governance review of ONE exact Knowledge version.
 *
 * IT LIVES IN THE KNOWLEDGE WORKSPACE, NOT IN A SECOND GOVERNANCE WORKSPACE. Knowledge owns the
 * version and its ratification linkage; Governance owns the decision. This card references the
 * Governance authority it acts under and creates nothing of its own.
 *
 * THE VERSION SCOPE IS STATED BEFORE THE ACTION, because it is the thing a human is most likely to
 * get wrong: ratifying a record feels permanent, and it is not. `RATIFICATION_VERSION_SCOPE_NOTICE`
 * is rendered from a frozen value, and a test asserts it appears.
 *
 * RATIFIED IS NOT TRUE. The card says so where a reader will see it, because "the organization
 * approved this version" and "this statement is correct" are different claims and only the first
 * one is being made.
 *
 * ACCESSIBILITY: a real <label>, help and error wired through aria-describedby, `aria-invalid` on
 * refusal, refusals in role="alert", success in role="status", and the ratified state carried by
 * an icon and words rather than colour.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleSlash, ScrollText, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ratifyKnowledgeVersionAction,
  rejectKnowledgeVersionAction,
} from "@/app/(dashboard)/knowledge/actions";
import {
  RATIFICATION_EFFECT,
  RATIFICATION_NON_EFFECTS,
  RATIFICATION_VERSION_SCOPE_NOTICE,
  REJECTION_EFFECT,
  REJECTION_NON_EFFECTS,
  type RatificationRefusal,
} from "@/features/knowledge-ratification/contracts";
import { JUSTIFICATION_LIMITS } from "@/features/governance-decision/contracts";
import type { KnowledgeSourceRecord } from "@/features/knowledge/contracts";

/** Why review is unavailable, when it is. Each states the real reason. */
export type ReviewBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "no-governance-authority" }
  | { readonly kind: "not-the-governance-authority" };

const REFUSAL_TEXT: Record<RatificationRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-governance-authority":
    "This tenant has no Governance authority yet. Establish it before reviewing Knowledge.",
  "not-the-governance-authority":
    "Only this tenant's Governance authority may decide. Authoring Knowledge does not grant it.",
  "version-unresolvable": "That version could not be resolved in this tenant.",
  "not-the-current-version":
    "That version has been superseded. Only the current version can be reviewed.",
  "stale-review":
    "A newer version was created while you were reviewing. Reload and review the current version.",
  "already-ratified": "This version already carries a Governance decision.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function KnowledgeReviewCard({
  record,
  block,
}: {
  record: KnowledgeSourceRecord;
  block?: ReviewBlock;
}) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [intent, setIntent] = useState<"ratify" | "reject" | null>(null);
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<RatificationRefusal | null>(null);
  const [done, setDone] = useState<"ratified" | "rejected" | null>(null);

  const tooShort = justification.trim().length < JUSTIFICATION_LIMITS.minimumLength;
  const errorId = `${ids}-error`;
  const helpId = `${ids}-help`;
  const reviewable =
    block === undefined && !record.ratified && record.activeKnowledgeNodeId !== null;

  function submit(kind: "ratify" | "reject") {
    setRefusal(null);
    startTransition(async () => {
      const payload = {
        factId: record.factId,
        knowledgeNodeId: record.activeKnowledgeNodeId as string,
        observedKnowledgeVersion: record.knowledgeVersion,
        justification,
      };
      const result =
        kind === "ratify"
          ? await ratifyKnowledgeVersionAction(payload)
          : await rejectKnowledgeVersionAction(payload);
      if (result.status === "refused") {
        setRefusal(result.reason);
        return;
      }
      setDone(result.status);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader stacked>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="size-4" aria-hidden />
          Governance review — v{record.knowledgeVersion}
        </CardTitle>
        <CardDescription>
          {record.factKey} · {record.domainKey} · {record.scope}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {record.ratified ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm">
            <p className="flex items-start gap-2 text-fg">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Version {record.knowledgeVersion} is <strong>ratified</strong>
                {" — this organization's Governance authority approved this exact version. That is "}
                an organizational status, not a claim that the statement is true.
              </span>
            </p>
            <dl className="grid gap-1 text-xs text-fg-muted sm:grid-cols-2">
              <div>
                <dt className="uppercase tracking-wide">Decision</dt>
                <dd className="break-all">{record.ratificationDecisionId}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">Governance session</dt>
                <dd className="break-all">{record.governanceSessionId}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">Ratified at</dt>
                <dd>{record.ratifiedAt}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide">Ratified by</dt>
                <dd className="break-all">{record.ratifiedByActorId}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            Version {record.knowledgeVersion} carries no Governance decision. It is unratified.
          </p>
        )}

        {block !== undefined ? (
          <p className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg-muted">
            {block.kind === "unauthenticated"
              ? "Sign in to review this version."
              : block.kind === "no-governance-authority"
                ? "This tenant has no Governance authority yet. It must be established before any Knowledge can be ratified."
                : "Only this tenant's Governance authority may decide. Being able to author Knowledge does not grant it."}
          </p>
        ) : null}

        {done ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg"
          >
            {done === "ratified" ? (
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <CircleSlash className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>
              {done === "ratified"
                ? `Version ${record.knowledgeVersion} is now ratified. Future versions will require their own decision.`
                : `Recorded: Governance did not approve version ${record.knowledgeVersion}. The version is unchanged and still visible.`}
            </span>
          </p>
        ) : null}

        {reviewable && !done ? (
          <>
            <div className="rounded-lg border border-border bg-surface-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                {intent === "reject" ? `Rejecting ${REJECTION_EFFECT}` : `Ratifying ${RATIFICATION_EFFECT}`}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-fg-muted">
                {(intent === "reject" ? REJECTION_NON_EFFECTS : RATIFICATION_NON_EFFECTS).map(
                  (effect) => (
                    <li key={effect}>
                      {intent === "reject" ? "Rejecting" : "Ratifying"} {effect}.
                    </li>
                  ),
                )}
              </ul>
            </div>

            <p className="text-xs text-fg-muted">{RATIFICATION_VERSION_SCOPE_NOTICE}</p>

            {intent ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-justification`} className="text-sm font-medium text-fg">
                    {intent === "ratify"
                      ? `Why does Governance approve version ${record.knowledgeVersion}?`
                      : `Why does Governance not approve version ${record.knowledgeVersion}?`}
                  </label>
                  <textarea
                    id={`${ids}-justification`}
                    className={FIELD_STYLE}
                    rows={4}
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                    maxLength={JUSTIFICATION_LIMITS.maximumLength}
                    aria-describedby={refusal ? `${helpId} ${errorId}` : helpId}
                    aria-invalid={refusal === "justification-required" || undefined}
                    required
                  />
                  <p id={helpId} className="text-xs text-fg-muted">
                    Required, written by you, and stored permanently on the Governance decision. At
                    least {JUSTIFICATION_LIMITS.minimumLength} characters.
                  </p>
                </div>

                {refusal ? (
                  <p id={errorId} role="alert" className="text-sm text-fg">
                    {REFUSAL_TEXT[refusal]}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => submit(intent)} disabled={pending || tooShort}>
                    {pending
                      ? "Recording…"
                      : intent === "ratify"
                        ? "Ratify This Version"
                        : "Reject This Version"}
                  </Button>
                  <Button variant="ghost" onClick={() => setIntent(null)} disabled={pending}>
                    Not now
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setIntent("ratify")}>
                  Review to ratify
                </Button>
                <Button variant="outline" onClick={() => setIntent("reject")}>
                  Review to reject
                </Button>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
