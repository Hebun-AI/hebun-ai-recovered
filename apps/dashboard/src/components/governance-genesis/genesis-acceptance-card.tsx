"use client";

/*
 * Genesis acceptance card (G2.1) — the ONLY product surface in Hebun that touches pre-Governance
 * entitlement, and it can do exactly one thing: accept a nomination that already names you.
 *
 * THE CONSEQUENCE IS STATED BEFORE THE ACTION. This is a constitutional act, so the card refuses to
 * behave like a settings toggle:
 *
 *   - the effect and the NON-effects are rendered from frozen values in `contracts.ts`, so the
 *     wording cannot drift away from what the code actually does — a test asserts both lists appear;
 *   - the assurance limitation (aal1, single-factor) is shown, not buried;
 *   - the final button says "Accept Genesis Nomination" — never Save, Continue, or Confirm.
 *
 * There is NO nominate control here, and no component in the repository has one: nominating is the
 * local operator ceremony's job. This card sends NOTHING — the server action takes no arguments.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { acceptGenesisNominationAction } from "@/app/(dashboard)/governance/genesis/actions";
import {
  GENESIS_ACCEPTANCE_ASSURANCE,
  GENESIS_ACCEPTANCE_EFFECT,
  GENESIS_ACCEPTANCE_NON_EFFECTS,
  type GenesisAcceptanceRefusal,
  type GenesisNominationView,
} from "@/features/governance-genesis/contracts";

/** Why the ceremony is not available, when it is not. Each states the real reason. */
export type GenesisBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "persistence-unavailable" }
  | { readonly kind: "no-nomination" }
  | { readonly kind: "not-the-nominated-human" }
  | { readonly kind: "already-accepted"; readonly acceptedAt: string | null }
  | { readonly kind: "revoked" };

const REFUSAL_TEXT: Record<GenesisAcceptanceRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again to accept.",
  "no-nomination": "This tenant has no genesis nomination.",
  "not-the-nominated-human": "This nomination names a different human.",
  "already-accepted": "This nomination was already accepted. Acceptance happens once.",
  revoked: "This nomination was revoked and can no longer be accepted.",
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

function BlockNotice({ block }: { block: GenesisBlock }) {
  const text =
    block.kind === "unauthenticated"
      ? "Sign in to see whether this tenant has a genesis nomination."
      : block.kind === "persistence-unavailable"
        ? "The durable store backing genesis nominations is not configured."
        : block.kind === "no-nomination"
          ? "This tenant has no genesis nomination. One is created out-of-band by a local operator ceremony — never from this page, and never by a signed-in user."
          : block.kind === "not-the-nominated-human"
            ? "This tenant has a genesis nomination, and it names someone else. Only that human can accept it."
            : block.kind === "revoked"
              ? "This tenant's genesis nomination was revoked and can no longer be accepted."
              : "This tenant's genesis nomination has been accepted. Acceptance happens once.";
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg-muted">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="min-w-0">{text}</p>
    </div>
  );
}

export function GenesisAcceptanceCard({
  block,
  nomination,
}: {
  block?: GenesisBlock;
  nomination?: GenesisNominationView | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState(false);
  const [refusal, setRefusal] = useState<GenesisAcceptanceRefusal | null>(null);
  const [accepted, setAccepted] = useState(false);

  const acceptable = block === undefined && nomination?.status === "pending";

  function accept() {
    setRefusal(null);
    startTransition(async () => {
      const result = await acceptGenesisNominationAction();
      if (result.status === "accepted") {
        setAccepted(true);
        router.refresh();
        return;
      }
      setRefusal(result.reason);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="size-4" aria-hidden />
          Genesis Nomination
        </CardTitle>
        <CardDescription>
          The pre-Governance root of trust for this tenant. Not Governance authority.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {block !== undefined ? <BlockNotice block={block} /> : null}

        {accepted ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="min-w-0">
              Accepted. You are recorded as the human eligible to establish this tenant&apos;s first
              Governance authority. No Governance decision exists yet.
            </p>
          </div>
        ) : null}

        {acceptable && !accepted ? (
          <>
            <p className="text-sm text-fg">
              You were nominated as the human eligible to establish this tenant&apos;s first
              Governance authority.
            </p>

            <div className="rounded-lg border border-border bg-surface-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                Accepting {GENESIS_ACCEPTANCE_EFFECT}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-fg-muted">
                {GENESIS_ACCEPTANCE_NON_EFFECTS.map((effect) => (
                  <li key={effect}>Acceptance {effect}.</li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-fg-muted">{GENESIS_ACCEPTANCE_ASSURANCE.limitation}</p>

            {refusal ? (
              <p role="alert" className="text-sm text-fg">
                {REFUSAL_TEXT[refusal]}
              </p>
            ) : null}

            {revealed ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={accept} disabled={pending}>
                  {pending ? "Accepting…" : "Accept Genesis Nomination"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setRevealed(false)}
                  disabled={pending}
                >
                  Not now
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setRevealed(true)}>
                Review genesis nomination
              </Button>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
