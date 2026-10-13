/*
 * heby-commands/plan-intent.ts — NATURAL-LANGUAGE ACTION PLANNING: reaching `/plan` without the slash.
 *
 * PURE. No I/O, no model. Two deterministic decisions, made in two places:
 *
 *   recognizePlanIntent      on the client, BEFORE the conversation path: is this ordinary message
 *                            plainly a request for an organizational action plan?
 *   resolvePlanDepartment    on the server, inside the `/plan` read: which of THIS organization's
 *                            recorded departments does the message name? Answered by Organization
 *                            Authority's structure, never by guessing from the words.
 *
 * ── WHY NO MODEL ─────────────────────────────────────────────────────────────
 *
 * EAI-B2 withholds work records from the external model, so a model cannot plan over them. A
 * recognized message never reaches the model at all: it runs the released `/plan` read, the same
 * handler, the same two reads and the same composer. Recognition is routing, not authority — the
 * read re-resolves the tenant from the session and is refused without one.
 *
 * ── WHAT IS NOT A PLANNING REQUEST ───────────────────────────────────────────
 *
 * A planning phrase plus an organizational-work word ("departman", "işler", "work") is a planning
 * request. An explicit planning phrase alone ("aksiyon planı hazırla", "prepare an action plan") is
 * one only IF the message names one of this organization's departments: the server checks, and when
 * none is named the message goes to the conversation exactly as before — so "an action plan for my
 * Instagram campaign" is still answered as a conversation. A department name alone is never a
 * planning request. A message about a WORK DOMAIN is refused with the reason: `/plan` filters by
 * department only, and a domain is not a department.
 */
import type { OrganizationStructure } from "@/features/organization-authority/contracts";

/**
 * `ai-plan` — the same planning request with an EXPLICIT request for AI ("AI ile", "yapay zeka",
 * "with AI"). It never comes from a planning phrase alone, so `/plan` and every message that reached
 * it before are untouched. It goes to its own server action, never to the `/plan` read.
 */
export type PlanIntent = "none" | "plan" | "plan-if-department" | "work-domain" | "ai-plan";

/** The read's answer when an explicit planning phrase names no department: hand the message back to the conversation. */
export const PLAN_NO_DEPARTMENT_NAMED = "no-department-named";

/** Lowercase without the Turkish dotted-İ artefact ("İ".toLowerCase() is "i" + a combining dot). */
const fold = (text: string) => text.replace(/İ/g, "i").toLowerCase();
/** A phrase that starts at a word boundary. `\b` is ASCII-only, so Turkish letters need a lookbehind. */
const phrase = (source: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})`, "u");

/** Explicit planning phrases: enough on their own when the message also names a department. */
const EXPLICIT_PLANNING = [
  phrase("(?:aksiyon|eylem|çalışma|iş) ?plan"),
  phrase("plan\\p{L}*\\s+(?:hazırla|oluştur|çıkar|yap)"),
  phrase("öncelik\\p{L}*\\s+belirle"),
  phrase("action plan|work plan|plan (?:the |our )?work|prioriti[sz]e"),
];
/** Open questions: a planning request only beside an organizational-work word. */
const OPEN_PLANNING = [phrase("ne yapmalıyız|ne yapmamız gerek|what should we do")];
const ORGANIZATIONAL_WORK = [
  phrase("departman|department"),
  phrase("iş(?:ler|leri|lerini|lerin|lerinin|lerimiz)?(?![\\p{L}])"),
  phrase("çalışma ?plan"),
  phrase("work(?![\\p{L}])"),
];
const WORK_DOMAIN = phrase("work ?domain|iş alan|domain");
/** An explicit request that a model take part. "ai" alone is matched only as a whole word. */
const EXPLICIT_AI = phrase("ai(?![\\p{L}\\p{N}])(?:\\s+ile|\\s+destekli|-assisted|-powered)|yapay zek[aâ]\\p{L}*|(?:with|using|use) ai(?![\\p{L}\\p{N}])");

export function recognizePlanIntent(message: string): PlanIntent {
  const text = fold(message);
  const explicit = EXPLICIT_PLANNING.some((p) => p.test(text));
  const work = ORGANIZATIONAL_WORK.some((p) => p.test(text));
  if (!(explicit || (work && OPEN_PLANNING.some((p) => p.test(text))))) return "none";
  if (WORK_DOMAIN.test(text)) return "work-domain";
  if (EXPLICIT_AI.test(text)) return "ai-plan";
  return work ? "plan" : "plan-if-department";
}

export const PLAN_INTENT_TITLE = "Action plan · which department?";
export const PLAN_INTENT_PROVENANCE =
  "Your organization's departments, read now from Organization Authority. Rule-based; no model saw your message.";
export const PLAN_INTENT_WORK_DOMAIN_LINES: readonly string[] = [
  "This reads as an action-planning request about a work domain.",
  "An action plan is scoped by department only; a work domain is not a department, so Hebun did not treat it as one.",
  "Name a department instead, or type /plan for the whole organization. Nothing was read, sent or changed.",
];

export type PlanDepartmentResolution =
  | { readonly kind: "resolved"; readonly name: string }
  | { readonly kind: "ambiguous"; readonly names: readonly string[] }
  | { readonly kind: "unnamed"; readonly names: readonly string[] }
  | { readonly kind: "unavailable" };

/** Words of a text, with a Turkish suffix after an apostrophe dropped ("Engineering'deki" → "engineering"). */
const words = (text: string) => fold(text).replace(/['’]\p{L}*/gu, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const containsRun = (haystack: readonly string[], needle: readonly string[]) =>
  needle.length > 0 && haystack.some((_, i) => needle.every((word, j) => haystack[i + j] === word));

/**
 * The department the message names, from this organization's departments in service. A name counts
 * only when it appears whole, as consecutive words. Two departments named → ambiguous; none →
 * unnamed. Neither case is guessed past: the person is asked.
 */
export function resolvePlanDepartment(message: string, structure: OrganizationStructure): PlanDepartmentResolution {
  if (structure.status !== "available") return { kind: "unavailable" };
  const inService = structure.departments.filter((d) => d.inService);
  const said = words(message);
  const named = inService.filter((d) => containsRun(said, words(d.name)) || containsRun(said, words(d.slug)));
  if (named.length === 1) return { kind: "resolved", name: named[0]!.name };
  if (named.length > 1) return { kind: "ambiguous", names: named.map((d) => d.name) };
  return { kind: "unnamed", names: inService.map((d) => d.name) };
}

/** What Heby says when the department is not settled. Nothing is planned, read further or changed. */
export function planClarificationLines(resolution: Exclude<PlanDepartmentResolution, { kind: "resolved" }>): readonly string[] {
  if (resolution.kind === "unavailable") {
    return [
      "This reads as an action-planning request, but this organization's departments could not be read right now.",
      "Hebun does not guess a department, so no plan is shown. Nothing was changed.",
    ];
  }
  const list = (names: readonly string[]) => names.map((name) => `"${name}"`).join(", ");
  const head =
    resolution.kind === "ambiguous"
      ? `This reads as an action-planning request, and it names more than one department: ${list(resolution.names)}.`
      : "This reads as an action-planning request, but it names none of this organization's departments in service.";
  const known =
    resolution.kind === "unnamed"
      ? resolution.names.length > 0
        ? [`Departments in service: ${list(resolution.names)}.`]
        : ["This organization has recorded no department in service."]
      : [];
  return [head, ...known, "Say which department to plan for, or type /plan for the whole organization. Nothing was read further or changed."];
}
