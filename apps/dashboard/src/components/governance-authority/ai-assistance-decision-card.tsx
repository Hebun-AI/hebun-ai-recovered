"use client";

/*
 * ORGANIZATION-READINESS-2 — this organization's AI assistance data-use decision, in the app.
 *
 * It shows what the authority already holds (the server read it) and, to a Governance holder only,
 * one decision: authorize assistance or withdraw it. The client sends the attestation it showed, the
 * revision it showed and a reason — never a purpose, a scope, a tenant or a policy. The writer decides.
 *
 * THREE THINGS KEPT APART ON PURPOSE: this decision (may data cross), provider availability (is the
 * platform model switched on — Organization readiness) and a model call (decided per request by the
 * generator's gate). Authorizing is never shown as proof that anything is connected or working.
 *
 * ACCESSIBILITY: a real <label>, refusals in role="alert", success in role="status", state in words.
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  authorizeAssistanceDataUseAction,
  withdrawAssistanceDataUseAction,
} from "@/app/(dashboard)/governance/authority/actions";
import { JUSTIFICATION_LIMITS } from "@/features/governance-decision/contracts";
import type { AssistanceDataUseView } from "@/features/external-ai-data-use/assistance-data-use.server";
import type { TenantExternalAiDataUseWriteRefusal } from "@/features/external-ai-data-use/contracts";

type ReadView = Extract<AssistanceDataUseView, { status: "read" }>;

const CLASS_WORDING: Record<string, string> = {
  conversation: "Heby conversations — what people here ask Heby, and its replies",
  knowledge: "This organization’s Knowledge entries",
  "work-artifact": "Work records and their artifacts",
};

const CONTRACT_WORDING: Record<string, string> = {
  "anthropic-commercial-terms": "Anthropic commercial terms",
  "openai-services-agreement": "OpenAI services agreement",
  "higgsfield-terms-of-use": "Higgsfield terms of use",
  "higgsfield-enterprise-agreement": "Higgsfield enterprise agreement",
};
const TRAINING_WORDING: Record<string, string> = {
  none: "not used for training",
  "customer-opt-in": "used for training only if opted in",
  "provider-default": "the provider’s default training treatment",
};
const RETENTION_WORDING: Record<string, string> = {
  "zero-data-retention": "zero data retention",
  "bounded-30-days": "retained up to 30 days",
  extended: "retained longer than 30 days",
};

const REFUSAL_TEXT: Record<TenantExternalAiDataUseWriteRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "no-governance-authority": "This organization has no Governance authority yet.",
  "not-the-governance-authority": "Only a current Governance authority of this organization can decide this.",
  "invalid-scope": "That decision is not one the platform offers. Nothing was changed.",
  "attestation-unknown": "The processor review shown here no longer exists. Reload the page. Nothing was changed.",
  "attestation-not-current": "The processor review changed since this page loaded. Reload and review it again. Nothing was changed.",
  "platform-not-allowed": "The platform does not offer this today. Nothing was changed.",
  unchanged: "That is already the decision in force. Nothing was changed.",
  "no-active-authorization": "There is no assistance authorization in force to withdraw.",
  "stale-authorization-revision": "Someone decided this since the page loaded. Reload to see it. Nothing was changed.",
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

export function AssistanceDataUseCard({ view }: { readonly view: ReadView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<TenantExternalAiDataUseWriteRefusal | null>(null);
  const [written, setWritten] = useState<"authorized" | "withdrawn" | null>(null);
  const reasonId = useId();
  const errorId = useId();

  const canAuthorize = !view.assistanceAuthorized && view.attestation !== null;
  const canDecide = view.viewerIsGovernanceAuthority && (view.assistanceAuthorized || canAuthorize);

  function submit() {
    setRefusal(null);
    setWritten(null);
    startTransition(async () => {
      const result = view.assistanceAuthorized
        ? await withdrawAssistanceDataUseAction({ justification, observedRevision: view.revision })
        : await authorizeAssistanceDataUseAction({
            attestationId: view.attestation?.id ?? "",
            justification,
            observedRevision: view.revision,
          });
      if (result.status === "written") {
        setWritten(view.assistanceAuthorized ? "withdrawn" : "authorized");
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
          <Sparkles aria-hidden className="size-4" />
          AI assistance data use
        </CardTitle>
        <CardDescription>
          Whether this organization lets Hebun send the data below to the reviewed AI processor when
          someone asks Heby for help.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>
          <span className="font-medium">Decision: </span>
          {view.assistanceAuthorized
            ? `Authorized (revision ${view.revision}).`
            : view.revision === null
              ? "Not decided. Nothing is sent to the AI processor."
              : `Not authorized (revision ${view.revision}). Nothing is sent to the AI processor.`}
        </p>

        <div className="flex flex-col gap-1">
          <p className="font-medium">What may be sent if authorized</p>
          <ul className="list-disc space-y-1 pl-4 text-fg-muted">
            {view.dataClasses.map((dataClass) => (
              <li key={dataClass}>{CLASS_WORDING[dataClass] ?? dataClass}</li>
            ))}
          </ul>
          <p className="text-xs text-fg-muted">
            Everything else — people, connected providers’ data, Governance records, media — stays withheld
            from the processor.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-medium">The processor this decision is bound to</p>
          {view.attestation ? (
            <ul className="list-disc space-y-1 pl-4 text-fg-muted">
              <li>
                Anthropic Messages API, review revision {view.attestation.revision}, under{" "}
                {CONTRACT_WORDING[view.attestation.contractSurface] ?? view.attestation.contractSurface}.
              </li>
              <li>
                Data is {TRAINING_WORDING[view.attestation.training] ?? view.attestation.training},{" "}
                {RETENTION_WORDING[view.attestation.retentionClass] ?? view.attestation.retentionClass}
                {view.attestation.zdr === "enabled" ? ", with zero data retention enabled" : ""}.
              </li>
              <li>Models covered: {view.attestation.modelIds.join(", ")}.</li>
              <li>
                {view.attestation.identityStatus === "verified"
                  ? "The processor account was verified."
                  : "The processor account was attested by the platform operator, not independently verified."}
              </li>
            </ul>
          ) : (
            <p className="text-fg-muted">
              No reviewed processor is in force right now, so assistance cannot be authorized. A platform
              operator ceremony records that review.
            </p>
          )}
        </div>

        <div className="rounded-md border border-border bg-surface-subtle p-3 text-xs text-fg-muted">
          <p className="font-medium text-fg">What this decision is not</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>It does not connect or switch on a provider. Whether the platform model is available is shown in Organization readiness.</li>
            <li>It sends nothing by itself. Each Heby request is still checked at the moment it is made.</li>
            {view.otherPurposes.length > 0 ? (
              <li>Other AI uses already decided for this organization ({view.otherPurposes.join(", ")}) are not changed here.</li>
            ) : null}
          </ul>
        </div>

        {!view.governanceEstablished ? (
          <p className="text-fg-muted">This organization’s Governance authority must be established before this can be decided.</p>
        ) : !view.viewerIsGovernanceAuthority ? (
          <p className="text-fg-muted">Only this organization’s Governance authority can change this decision.</p>
        ) : canDecide ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="font-medium" htmlFor={reasonId}>
                Reason
              </label>
              <textarea
                id={reasonId}
                rows={3}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                aria-describedby={refusal ? errorId : undefined}
                aria-invalid={refusal === "justification-required"}
                disabled={pending}
              />
            </div>
            <div>
              <Button onClick={submit} disabled={pending} variant={view.assistanceAuthorized ? "outline" : "primary"}>
                {pending
                  ? "Recording…"
                  : view.assistanceAuthorized
                    ? "Withdraw assistance authorization"
                    : "Authorize AI assistance"}
              </Button>
            </div>
          </div>
        ) : null}

        {written ? (
          <p className="text-fg-muted" role="status">
            {written === "authorized"
              ? "Recorded as a Governance decision. This authorizes data use only; the readiness above shows whether the platform model is available."
              : "Withdrawal recorded as a Governance decision. Heby sends this organization’s data to no AI processor for assistance."}
          </p>
        ) : null}
        {refusal ? (
          <p className="text-fg-danger" id={errorId} role="alert">
            {REFUSAL_TEXT[refusal]}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
