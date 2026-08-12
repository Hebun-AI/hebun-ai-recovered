"use client";

/*
 * Membership authorization card (I1) — the Governance ceremony that permits ONE future human.
 *
 * IT EXTENDS THE GOVERNANCE WORKSPACE. There is no separate "team management" product here: this
 * card sits under the existing Governance Authority page beside the genesis and roster cards, and
 * every action it takes writes a Governance decision through the same seam G2 built.
 *
 * THE LANGUAGE IS DELIBERATE. "Authorize New Member", "Authorized Onboardings", "Intended role".
 * Never Invite, Add user, Create account, Send, Save or Confirm — each of those describes something
 * this card does not do, and a generic verb would be the inflation.
 *
 * WHAT THIS DOES NOT DO is rendered from frozen values, so the wording cannot drift from the code.
 * A test asserts every entry appears.
 *
 * THE ROLE-BASELINE GAP IS SHOWN, NOT HIDDEN. When the tenant holds no onboarding-eligible role the
 * form is replaced by an explanation, because an empty dropdown reads as a bug and this is a real
 * product absence.
 *
 * ACCESSIBILITY: real <label>s, help and error wired through aria-describedby, `aria-invalid` on
 * refusal, refusals in role="alert", success in role="status", and status carried by words rather
 * than colour.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserRoundPlus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  authorizeMembershipAction,
  issueInvitationAction,
} from "@/app/(dashboard)/governance/authority/actions";
import { JUSTIFICATION_LIMITS } from "@/features/governance-decision/contracts";
import {
  DELIVERY_REALITY,
  type InvitationIssuanceRefusal,
} from "@/features/human-onboarding/contracts";
import {
  MEMBERSHIP_AUTHORIZATION_EFFECT,
  MEMBERSHIP_AUTHORIZATION_NON_EFFECTS,
  ONBOARDING_EXCLUDED_ROLE_TYPES,
  TENANT_ROLE_BASELINE_GAP,
  type MembershipAuthorizationRefusal,
} from "@/features/membership-authority/contracts";
import type {
  EligibleRole,
  MembershipAuthorizationView,
} from "@/features/membership-authority/read-membership-authorizations.server";

const REFUSAL_TEXT: Record<MembershipAuthorizationRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-governance-authority": "This tenant has no Governance authority yet.",
  "not-the-governance-authority":
    "Only a current Governance authority may authorize a new member. An organizational role does not grant it.",
  "invalid-target-email": "Enter the intended person's email address.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "role-unresolvable": "That role does not exist in this organization.",
  "role-not-eligible": `A new member may not be authorized directly into that role. Excluded: ${ONBOARDING_EXCLUDED_ROLE_TYPES.join(", ")}.`,
  "no-eligible-role-in-tenant": `This organization has no role a new member may hold. ${TENANT_ROLE_BASELINE_GAP.remedy}`,
  "already-authorized": "That person already has a live authorization awaiting onboarding.",
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

/** I2 refusals, in the operator's words. Every member of the union has an entry. */
const ISSUANCE_REFUSAL_TEXT: Record<InvitationIssuanceRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-governance-authority": "This tenant has no Governance authority yet.",
  "not-the-governance-authority":
    "Only a current Governance authority may issue an onboarding capability. An organizational role does not grant it.",
  "authorization-unresolvable": "That authorization does not exist in this organization.",
  "authorization-not-live":
    "This authorization has already produced a capability, or was withdrawn. Authorizing again is a new Governance decision.",
  "role-not-eligible": "The role this authorization names may no longer be onboarded into.",
  "invitation-already-pending": "That person already has a live capability awaiting onboarding.",
  "authorization-already-consumed":
    "Another issuance spent this authorization first. Only one capability may exist per authorization.",
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

export interface MembershipAuthorizationCardProps {
  readonly eligibleRoles: readonly EligibleRole[];
  readonly authorizations: readonly MembershipAuthorizationView[];
  readonly roleBaselineMissing: boolean;
}

export function MembershipAuthorizationCard({
  eligibleRoles,
  authorizations,
  roleBaselineMissing,
}: MembershipAuthorizationCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(eligibleRoles[0]?.roleId ?? "");
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<MembershipAuthorizationRefusal | null>(null);
  const [authorizedId, setAuthorizedId] = useState<string | null>(null);

  const emailId = useId();
  const roleFieldId = useId();
  const reasonId = useId();
  const helpId = useId();
  const errorId = useId();

  function submit() {
    setRefusal(null);
    setAuthorizedId(null);
    startTransition(async () => {
      const result = await authorizeMembershipAction({
        targetEmail: email,
        intendedRoleId: roleId,
        justification,
      });
      if (result.status === "authorized") {
        setAuthorizedId(result.authorizationId);
        setEmail("");
        setJustification("");
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
          <UserRoundPlus aria-hidden className="size-4" />
          Authorize New Member
        </CardTitle>
        <CardDescription>
          This authorizes one future onboarding for the specified person and role.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* The consequence text is required and must never be softened. */}
        <div className="rounded-md border border-border bg-surface-subtle p-3 text-xs text-fg-muted">
          <p className="font-medium text-fg">This {MEMBERSHIP_AUTHORIZATION_EFFECT}.</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {MEMBERSHIP_AUTHORIZATION_NON_EFFECTS.map((entry) => (
              <li key={entry}>It {entry}.</li>
            ))}
          </ul>
        </div>

        {roleBaselineMissing ? (
          /*
           * NOT a missing capability — an unexercised ceremony. This organization has no role a new
           * member may hold YET, and the control that provisions one sits directly above. Saying
           * only the first half would understate what Hebun can do, which is as dishonest as
           * overstating it.
           */
          <p className="text-sm text-fg-muted" role="status">
            This organization has no role a new member may hold, so no onboarding can be authorized
            yet. {TENANT_ROLE_BASELINE_GAP.remedy}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor={emailId}>
                Intended person&rsquo;s email
              </label>
              <input
                id={emailId}
                type="email"
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={refusal ? `${helpId} ${errorId}` : helpId}
                aria-invalid={refusal === "invalid-target-email" || refusal === "already-authorized"}
                disabled={pending}
              />
              <p className="text-xs text-fg-muted" id={helpId}>
                This identifies who is intended. It is not yet a verified person, an account, or a
                member.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor={roleFieldId}>
                Intended role
              </label>
              <select
                id={roleFieldId}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                aria-invalid={refusal === "role-unresolvable" || refusal === "role-not-eligible"}
                disabled={pending}
              >
                {eligibleRoles.map((role) => (
                  <option key={role.roleId} value={role.roleId}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor={reasonId}>
                Reason
              </label>
              <textarea
                id={reasonId}
                rows={3}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                aria-invalid={refusal === "justification-required"}
                disabled={pending}
              />
            </div>

            <div>
              <Button onClick={submit} disabled={pending || !roleId}>
                {pending ? "Authorizing…" : "Authorize New Member"}
              </Button>
            </div>
          </div>
        )}

        {refusal ? (
          <p className="text-sm text-fg-danger" id={errorId} role="alert">
            {REFUSAL_TEXT[refusal]}
          </p>
        ) : null}

        {authorizedId ? (
          <p className="flex items-start gap-2 text-sm text-fg-muted" role="status">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Authorized. Onboarding this person is now permitted and awaits it being carried out.
              No account, invitation, or credential has been created.
            </span>
          </p>
        ) : null}

        {authorizations.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Authorized onboardings</h3>
            <ul className="flex flex-col gap-2">
              {authorizations.map((entry) => (
                <li
                  key={entry.authorizationId}
                  className="rounded-md border border-border p-3 text-sm"
                >
                  <p className="font-medium">{entry.normalizedEmail}</p>
                  <p className="text-xs text-fg-muted">
                    {entry.intendedRoleName ?? "role removed"} ·{" "}
                    {entry.consumed ? "onboarding carried out" : "awaiting onboarding"} ·{" "}
                    {entry.status}
                  </p>
                  {/*
                    I2 — the ONLY new control on this card. It appears solely for an authorization
                    that is still live, because a spent one has nothing left to spend.
                  */}
                  {!entry.consumed && entry.status === "authorized" ? (
                    <InvitationIssuance authorizationId={entry.authorizationId} />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/*
 * ── I2: issuing the onboarding capability ───────────────────────────────────────────────────────
 *
 * THE WORDING IS THE POINT. "Issue onboarding capability", never "Invite", "Send invite" or "Email".
 * Hebun has no mail runtime: it mints the capability and hands it back to the human who asked. The
 * card says so, states that it is shown once, and states that whoever holds it can attempt to join —
 * because an operator who does not know that will paste it into the wrong channel.
 *
 * "Issued" and "delivered" are rendered as different sentences, from frozen values, so the wording
 * cannot drift from the code. A test asserts both appear and that no wording claims an email.
 *
 * ACCESSIBILITY: the capability lands in a labelled readonly field rather than a bare code block, so
 * it is reachable and copyable by keyboard; refusals are role="alert"; the success announcement is
 * role="status"; state is carried by words, never by colour alone.
 */
function InvitationIssuance({ authorizationId }: { readonly authorizationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [capability, setCapability] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<InvitationIssuanceRefusal | null>(null);
  const capabilityId = useId();
  const noticeId = useId();

  function issue() {
    setRefusal(null);
    startTransition(async () => {
      const result = await issueInvitationAction({ membershipAuthorizationId: authorizationId });
      if (result.status === "issued") {
        setCapability(result.capability);
        setExpiresAt(result.expiresAt);
        router.refresh();
        return;
      }
      setRefusal(result.reason);
    });
  }

  if (capability) {
    return (
      <div className="mt-3 space-y-2 rounded-md border border-border bg-surface-2 p-3">
        <p className="text-sm font-medium" role="status">
          Onboarding capability issued. {DELIVERY_REALITY.issued}
        </p>
        <label className="block text-xs font-medium" htmlFor={capabilityId}>
          Capability (shown once)
        </label>
        <input
          id={capabilityId}
          readOnly
          value={capability}
          aria-describedby={noticeId}
          className="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-xs"
        />
        <p className="text-xs text-fg-muted" id={noticeId}>
          {DELIVERY_REALITY.operatorObligation} Not delivered by Hebun —{" "}
          {DELIVERY_REALITY.deliveryOwner}. Usable until {expiresAt}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Button type="button" size="sm" variant="outline" onClick={issue} disabled={pending}>
        {pending ? "Issuing…" : "Issue onboarding capability"}
      </Button>
      <p className="mt-1 text-xs text-fg-muted">
        Creates the capability and shows it to you once. Hebun sends nothing.
      </p>
      {refusal ? (
        <p className="mt-1 text-sm text-fg-danger" role="alert">
          {ISSUANCE_REFUSAL_TEXT[refusal]}
        </p>
      ) : null}
    </div>
  );
}
