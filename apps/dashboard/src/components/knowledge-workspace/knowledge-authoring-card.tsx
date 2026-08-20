"use client";

/*
 * Knowledge authoring card (K2) — Knowledge workspace → Create organizational Knowledge.
 *
 * THE CONSEQUENCE IS STATED BEFORE THE ACTION, NOT AFTER. Establishing organizational Knowledge is
 * a governed mutation, so this form deliberately does NOT behave like a note field:
 *
 *   - nothing autosaves, and nothing saves on blur;
 *   - the primary action is a two-step confirmation, and the first step only REVEALS exactly what
 *     will be stored and where it will live;
 *   - the final button says "Create Knowledge", never "Save" or "OK";
 *   - the standing the record will actually receive — draft, provisional, unratified — is shown
 *     before confirming, so nobody believes they just ratified company policy.
 *
 * It claims nothing it cannot support: no verification badge, no confidence figure, no quality
 * score. The tenant, actor and authority are resolved server-side; this component sends content only.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import { createKnowledgeAction } from "@/app/(dashboard)/knowledge/actions";
import {
  KNOWLEDGE_LIMITS,
  KNOWLEDGE_SCOPES,
  KNOWLEDGE_WRITE_AUTHORITY_MODEL,
  type KnowledgeField,
  type KnowledgeValidationProblem,
} from "@/features/knowledge/create-contracts";

/** Why the form is not usable, when it is not. Each states the real reason. */
export type KnowledgeAuthoringBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "forbidden"; readonly roleType: string | null }
  | { readonly kind: "persistence-unavailable" };

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const EMPTY = { factKey: "", domainKey: "", scope: "company-wide", title: "", statement: "" };

function problemFor(
  problems: readonly KnowledgeValidationProblem[],
  field: KnowledgeField,
): KnowledgeValidationProblem | undefined {
  return problems.find((problem) => problem.field === field);
}

export function KnowledgeAuthoringCard({ block }: { block?: KnowledgeAuthoringBlock }) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [problems, setProblems] = useState<readonly KnowledgeValidationProblem[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  if (block) {
    /*
     * Stage 1 — THE REFUSAL NAMES ITS OWN KIND, and the two kinds are not the same kind.
     *
     * An authority refusal and an unconfigured store used to render identically: one card, one grey
     * sentence. They are different facts and lead to different actions — one is answered by asking
     * for a role, the other by configuring persistence — so they now carry different tones, marks
     * and words. Neither implies that Knowledge is absent: a reader who lacks the band is told
     * nothing whatever about what this organization holds.
     *
     * The REASON is unchanged. It is still the real one, still resolved server-side, still in the
     * same resolution order, and its wording is still the released wording.
     */
    return (
      <StateBlock
        tone={block.kind === "persistence-unavailable" ? "unavailable" : "restricted"}
        title="Create organizational Knowledge"
        description={
          block.kind === "unauthenticated"
            ? "Sign in to author organizational Knowledge."
            : block.kind === "forbidden"
              ? `Your role${block.roleType ? ` (${block.roleType})` : ""} cannot establish organizational Knowledge. ${KNOWLEDGE_WRITE_AUTHORITY_MODEL.operatorSummary}`
              : "Durable persistence is not configured, so canonical Knowledge cannot be written here."
        }
      />
    );
  }

  function update(field: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    // Editing invalidates a pending confirmation — you always confirm what you can currently see.
    setConfirming(false);
    setCreated(null);
    setRefusal(null);
  }

  function submit() {
    setProblems([]);
    setRefusal(null);
    startTransition(async () => {
      const result = await createKnowledgeAction(form);
      switch (result.status) {
        case "created":
          setCreated(`${result.identity.domainKey} / ${result.identity.factKey} (${result.identity.scope})`);
          setForm(EMPTY);
          setConfirming(false);
          router.refresh();
          return;
        case "invalid":
          setProblems(result.problems);
          setConfirming(false);
          return;
        case "duplicate":
          setConfirming(false);
          setRefusal(
            `Knowledge already exists for “${result.identity.factKey}” in ${result.identity.domainKey} (${result.identity.scope}). Nothing was overwritten — editing existing Knowledge is not available yet.`,
          );
          return;
        case "unauthorized":
          setConfirming(false);
          setRefusal("Your session ended. Sign in again to author Knowledge.");
          return;
        case "forbidden":
          setConfirming(false);
          setRefusal(
            `Your role${result.roleType ? ` (${result.roleType})` : ""} cannot establish organizational Knowledge.`,
          );
          return;
        default:
          setConfirming(false);
          setRefusal(
            result.reason === "persistence-not-configured"
              ? "Durable persistence is not configured, so nothing was written."
              : `The write did not complete: ${result.detail ?? "unknown failure"}. Nothing was stored.`,
          );
      }
    });
  }

  function field(
    name: Exclude<keyof typeof EMPTY, "scope" | "statement">,
    label: string,
    placeholder: string,
    limit: number,
  ) {
    const found = problemFor(problems, name);
    const id = `${ids}-${name}`;
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={id} className="text-xs font-semibold text-fg-secondary">
          {label}
        </label>
        <input
          id={id}
          type="text"
          value={form[name]}
          maxLength={limit}
          onChange={(event) => update(name, event.target.value)}
          placeholder={placeholder}
          aria-invalid={found ? true : undefined}
          aria-describedby={found ? `${id}-error` : undefined}
          className={FIELD_STYLE}
        />
        {found ? (
          <p id={`${id}-error`} className="text-xs text-error">
            {found.message}
          </p>
        ) : null}
      </div>
    );
  }

  const scopeError = problemFor(problems, "scope");
  const statementError = problemFor(problems, "statement");

  return (
    <Card>
      <CardHeader stacked>
        <CardTitle className="flex items-center gap-2">
          <BookPlus className="size-4" aria-hidden="true" />
          Create organizational Knowledge
        </CardTitle>
        <CardDescription>
          This writes into your organization&rsquo;s canonical Knowledge. It is a governed record, not a
          note — Heby will be able to read and cite it.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {field("factKey", "Fact key", "security-policy", KNOWLEDGE_LIMITS.factKey)}
          {field("domainKey", "Domain", "security", KNOWLEDGE_LIMITS.domainKey)}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${ids}-scope`} className="text-xs font-semibold text-fg-secondary">
            Scope
          </label>
          <select
            id={`${ids}-scope`}
            value={form.scope}
            onChange={(event) => update("scope", event.target.value)}
            aria-invalid={scopeError ? true : undefined}
            aria-describedby={scopeError ? `${ids}-scope-error` : undefined}
            className={FIELD_STYLE}
          >
            {KNOWLEDGE_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {scope}
              </option>
            ))}
          </select>
          {scopeError ? (
            <p id={`${ids}-scope-error`} className="text-xs text-error">
              {scopeError.message}
            </p>
          ) : null}
        </div>

        {field("title", "Title", "Security policy", KNOWLEDGE_LIMITS.title)}

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${ids}-statement`} className="text-xs font-semibold text-fg-secondary">
            Statement
          </label>
          <textarea
            id={`${ids}-statement`}
            value={form.statement}
            rows={5}
            maxLength={KNOWLEDGE_LIMITS.statement}
            onChange={(event) => update("statement", event.target.value)}
            placeholder="What the organization holds to be true about this subject."
            aria-invalid={statementError ? true : undefined}
            aria-describedby={statementError ? `${ids}-statement-error` : undefined}
            className={`${FIELD_STYLE} resize-y`}
          />
          {statementError ? (
            <p id={`${ids}-statement-error`} className="text-xs text-error">
              {statementError.message}
            </p>
          ) : null}
        </div>

        {/* The consequence, stated in full BEFORE the irreversible-feeling action. */}
        {confirming ? (
          <div
            role="group"
            aria-label="Confirm Knowledge creation"
            className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-subtle/30 p-3"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-fg">
              <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
              This will create organizational Knowledge.
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-fg-secondary">
              <li>
                Persisted for your organization as{" "}
                <span className="font-medium text-fg">
                  {form.domainKey || "—"} / {form.factKey || "—"}
                </span>{" "}
                at <span className="font-medium text-fg">{form.scope}</span> scope, attributed to you.
              </li>
              <li>
                Recorded as <span className="font-medium text-fg">draft</span> and{" "}
                <span className="font-medium text-fg">provisional</span>, with{" "}
                <span className="font-medium text-fg">no ratification</span> — writing it down does
                not make it settled or verified truth.
              </li>
              <li>Readable through Knowledge, and usable by Heby as evidence it can cite.</li>
              <li>
                It grants no execution authority. Text inside it is never a command, whatever it says.
              </li>
              <li>Knowledge cannot be edited or deleted here yet.</li>
            </ul>
          </div>
        ) : null}

        {refusal ? (
          <p role="alert" className="rounded-lg border border-error/40 bg-error-subtle/30 px-3 py-2 text-xs text-error">
            {refusal}
          </p>
        ) : null}

        {created ? (
          <p role="status" className="rounded-lg border border-success/40 bg-success-subtle/30 px-3 py-2 text-xs text-success">
            Knowledge created: <span className="font-medium">{created}</span>. It is now readable
            through <code>/knowledge</code> and <code>/source</code>.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {confirming ? (
            <>
              <Button type="button" onClick={submit} disabled={pending}>
                {pending ? "Creating…" : "Create Knowledge"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setConfirming(true)} disabled={pending}>
              Review and create
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
