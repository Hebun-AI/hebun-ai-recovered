"use client";

/*
 * Governance authority card (G2) — the surface that establishes a tenant's first Governance
 * authority, and afterwards states truthfully what exists.
 *
 * THE CONSEQUENCE IS STATED BEFORE THE ACTION. Establishing Governance is the constitutional event
 * of a tenant, so this card refuses to behave like a settings form:
 *
 *   - the effect and the NON-effects render from frozen values in `contracts.ts`, so the wording
 *     cannot drift away from what the code does — a test asserts both lists appear;
 *   - the justification is mandatory, human-authored, and the button stays disabled without it;
 *   - the assurance limitation carried up from G2.1 (aal1) is shown, not buried;
 *   - the final action says "Establish Governance Authority" — never Enable, Approve, or Confirm.
 *
 * ACCESSIBILITY. The textarea has a real <label>, its help and error text are wired through
 * aria-describedby, `aria-invalid` flips on refusal, refusals land in a role="alert" region, and
 * the established state is distinguished by an icon and words rather than colour alone.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { establishGovernanceAuthorityAction } from "@/app/(dashboard)/governance/authority/actions";
import {
  BOOTSTRAP_EFFECT,
  BOOTSTRAP_NON_EFFECTS,
  JUSTIFICATION_LIMITS,
  POST_BOOTSTRAP_AUTHORITY_MODEL,
  type BootstrapRefusal,
  type GovernanceAuthorityView,
} from "@/features/governance-decision/contracts";

/** Why the ceremony is unavailable, when it is. Each states the real reason. */
export type GovernanceBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "persistence-unavailable" }
  | { readonly kind: "no-entitlement" }
  | { readonly kind: "entitlement-not-accepted" }
  | { readonly kind: "not-the-entitled-human" }
  | { readonly kind: "already-established"; readonly viewerIsAuthority: boolean };

const REFUSAL_TEXT: Record<BootstrapRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-entitlement": "This tenant has no genesis entitlement.",
  "entitlement-not-accepted": "The genesis nomination has not been accepted yet.",
  "entitlement-revoked": "The genesis nomination was revoked.",
  "not-the-entitled-human": "The genesis entitlement names a different human.",
  "entitlement-already-consumed": "This entitlement has already established Governance.",
  "already-bootstrapped": "Governance authority already exists for this tenant.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function blockText(block: GovernanceBlock): string {
  switch (block.kind) {
    case "unauthenticated":
      return "Sign in to see this tenant's Governance authority.";
    case "persistence-unavailable":
      return "The durable store backing Governance is not configured.";
    case "no-entitlement":
      return "This tenant has no genesis entitlement. Governance cannot be established until a local operator ceremony nominates a human and that human accepts.";
    case "entitlement-not-accepted":
      return "A genesis nomination exists but has not been accepted. The nominated human must accept it first.";
    case "not-the-entitled-human":
      return "This tenant's genesis entitlement names someone else. Only that human can establish Governance authority.";
    case "already-established":
      return block.viewerIsAuthority
        ? "Governance authority exists for this tenant, and it resides in you."
        : "Governance authority exists for this tenant, and it resides in another human.";
  }
}

export function GovernanceAuthorityCard({
  block,
  authority,
}: {
  block?: GovernanceBlock;
  authority?: GovernanceAuthorityView | null;
}) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState(false);
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<BootstrapRefusal | null>(null);
  const [established, setEstablished] = useState(false);

  const establishable = block === undefined;
  const tooShort = justification.trim().length < JUSTIFICATION_LIMITS.minimumLength;
  const errorId = `${ids}-error`;
  const helpId = `${ids}-help`;

  function establish() {
    setRefusal(null);
    startTransition(async () => {
      const result = await establishGovernanceAuthorityAction({ justification });
      if (result.status === "established") {
        setEstablished(true);
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
          <Landmark className="size-4" aria-hidden />
          Governance Authority
        </CardTitle>
        <CardDescription>
          The tenant&apos;s constitutional authority. Established once, by a human.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {block !== undefined ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg-muted">
            {block.kind === "already-established" ? (
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <p className="min-w-0">{blockText(block)}</p>
          </div>
        ) : null}

        {block?.kind === "already-established" && authority?.bootstrap ? (
          <dl className="grid gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-fg-muted">Established</dt>
              <dd className="text-fg">
                {new Date(authority.bootstrap.decidedAt).toISOString().replace("T", " ").slice(0, 19)} UTC
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-fg-muted">Decision</dt>
              <dd className="text-fg">
                {authority.bootstrap.decisionType} · genesis
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-fg-muted">Stated reason</dt>
              {/* Rendered as text, never as markup. It is inert. */}
              <dd className="whitespace-pre-wrap break-words text-fg">
                {authority.bootstrap.justification}
              </dd>
            </div>
          </dl>
        ) : null}

        {established ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg"
          >
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="min-w-0">
              Governance authority established. It resides in you. No Knowledge was ratified and no
              permission was created.
            </p>
          </div>
        ) : null}

        {establishable && !established ? (
          <>
            <p className="text-sm text-fg">
              You hold this tenant&apos;s accepted genesis entitlement. Establishing Governance
              authority is the constitutional event this entitlement exists for, and it happens once.
            </p>

            <div className="rounded-lg border border-border bg-surface-muted p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                Establishing {BOOTSTRAP_EFFECT}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-fg-muted">
                {BOOTSTRAP_NON_EFFECTS.map((effect) => (
                  <li key={effect}>Establishing {effect}.</li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-fg-muted">{POST_BOOTSTRAP_AUTHORITY_MODEL.limitation}</p>

            {revealed ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-justification`} className="text-sm font-medium text-fg">
                    Why are you establishing Governance authority?
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
                    Required, written by you, and stored permanently on the decision record. At
                    least {JUSTIFICATION_LIMITS.minimumLength} characters.
                  </p>
                </div>

                {refusal ? (
                  <p id={errorId} role="alert" className="text-sm text-fg">
                    {REFUSAL_TEXT[refusal]}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={establish} disabled={pending || tooShort}>
                    {pending ? "Establishing…" : "Establish Governance Authority"}
                  </Button>
                  <Button variant="ghost" onClick={() => setRevealed(false)} disabled={pending}>
                    Not now
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="outline" onClick={() => setRevealed(true)}>
                Review what this establishes
              </Button>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
