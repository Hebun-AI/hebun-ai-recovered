"use client";

/*
 * knowledge-public-use-control.tsx — PUBLIC FACTUAL USE of one exact Knowledge version (KT-3),
 * rendered inside the existing Governance review card, apart from truth.
 *
 * It shows the state Governance's ledger derives and offers only the transitions that state allows.
 * It decides nothing itself: the server action resolves the tenant and the human, re-reads the
 * current state under the version's row lock, and refuses anything else. A refusal is rendered as
 * the reason the server gave.
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { decideKnowledgePublicUseAction } from "@/app/(dashboard)/knowledge/actions";
import {
  PUBLIC_USE_NON_CLAIMS,
  PUBLIC_USE_STATE_LABELS,
  nextPublicUseState,
  type PublicUseAction,
  type PublicUseRefusal,
  type PublicUseState,
} from "@/features/knowledge-public-use/contracts";
import { JUSTIFICATION_LIMITS } from "@/features/governance-decision/contracts";

const REFUSAL_TEXT: Record<PublicUseRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-governance-authority": "This tenant has no Governance authority yet.",
  "not-the-governance-authority": "Only this tenant's Governance authority may decide public use.",
  "version-unresolvable": "That version could not be resolved in this tenant.",
  "not-the-current-version": "That version has been superseded. Only the current version can be decided.",
  "stale-review": "A newer version was created while you were reviewing. Reload and decide about the current one.",
  "truth-rejected": "Governance rejected this version as untrue, so it cannot be allowed for public use.",
  "invalid-transition": "That change is not allowed from the current public-use state. Reload to see it.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "persistence-unavailable": "The durable store is unavailable. Nothing was recorded.",
};

const ACTION_LABEL: Record<PublicUseAction, string> = {
  allow: "Allow public factual use",
  deny: "Deny public factual use",
  revoke: "Revoke public factual use",
};

export function KnowledgePublicUseControl({
  factId,
  knowledgeNodeId,
  knowledgeVersion,
  state,
  decidable,
}: {
  factId: string;
  knowledgeNodeId: string | null;
  knowledgeVersion: number;
  /** Derived by the server from Governance's ledger. `unavailable` when it could not be read. */
  state: PublicUseState | "unavailable";
  /** False when the reader may see the state but may not decide about it. */
  decidable: boolean;
}) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [intent, setIntent] = useState<PublicUseAction | null>(null);
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<PublicUseRefusal | null>(null);

  const actions: PublicUseAction[] =
    state === "unavailable" || knowledgeNodeId === null
      ? []
      : (["allow", "deny", "revoke"] as const).filter((action) => nextPublicUseState(state, action) !== null);
  const tooShort = justification.trim().length < JUSTIFICATION_LIMITS.minimumLength;

  function submit(action: PublicUseAction) {
    if (knowledgeNodeId === null) return;
    setRefusal(null);
    startTransition(async () => {
      const result = await decideKnowledgePublicUseAction({
        factId,
        knowledgeNodeId,
        observedKnowledgeVersion: knowledgeVersion,
        action,
        justification,
      });
      if (result.status === "refused") {
        setRefusal(result.reason);
        return;
      }
      setIntent(null);
      setJustification("");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
      <h3 id={`${ids}-title`} className="font-medium text-fg">
        Public factual use — a separate decision from truth
      </h3>
      <p className="text-fg">
        {state === "unavailable"
          ? "Governance's public-use record could not be read, so no state is shown."
          : `Version ${knowledgeVersion}: ${PUBLIC_USE_STATE_LABELS[state]}.`}
      </p>
      <ul className="list-disc pl-5 text-xs text-fg-muted">
        {PUBLIC_USE_NON_CLAIMS.map((claim) => (
          <li key={claim}>{claim}</li>
        ))}
      </ul>

      {decidable && actions.length > 0 ? (
        intent === null ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button key={action} variant="outline" onClick={() => setIntent(action)}>
                {ACTION_LABEL[action]}…
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${ids}-why`} className="text-xs font-medium text-fg">
              Why — recorded with the decision
            </label>
            <textarea
              id={`${ids}-why`}
              rows={3}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || tooShort} onClick={() => submit(intent)}>
                {pending ? "Recording…" : `Record: ${ACTION_LABEL[intent].toLowerCase()}`}
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setIntent(null);
                  setRefusal(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )
      ) : null}

      {refusal ? (
        <p role="alert" className="text-xs text-fg">
          {REFUSAL_TEXT[refusal]}
        </p>
      ) : null}
    </section>
  );
}
