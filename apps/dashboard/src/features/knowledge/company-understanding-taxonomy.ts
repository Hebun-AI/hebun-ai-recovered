/*
 * knowledge/company-understanding-taxonomy.ts — the declared areas Hebun asks a company about (R6B).
 *
 * ── THIS IS PRODUCT VOCABULARY, NOT TENANT DATA ──────────────────────────────
 *
 * CATEGORY DEFINITION and TENANT FACT are different things, and this file holds only the first.
 * "offerings" is a question Hebun asks every organization; "Turkish hand-knotted rugs" is one
 * tenant's answer and lives in `knowledge_facts` where it can be authored, ingested, superseded,
 * ratified and audited. Nothing here is tenant-specific, so nothing here belongs in a database:
 * a table would hold one identical row set for every tenant, need a writer and a migration to
 * express a constant, and — being root-scoped — would land behind a deployment ceremony with no
 * in-app authority (the R5.1 boundary). It follows the shape `capability-map.ts` and
 * `workspace-model.ts` already established for frozen product descriptors.
 *
 * ── HOW A CATEGORY MEETS A REAL `domain_key` ─────────────────────────────────
 *
 * `domain_key` is free text. Its only write-time validation is a 64 code-point bound and a control
 * character check; `normalizeSingleLine` TRIMS and nothing else, so case is preserved exactly as
 * typed. Canonical holds `Security` (capitalised) while fixtures hold `security`, `goals`, `ops`
 * and Turkish words. Exact matching would therefore miss real records, so each category carries a
 * closed set of ACCEPTED KEYS compared after the fold below.
 *
 * The matching lives here and only here. No `domain_key` is rewritten, ingestion normalization is
 * untouched, and no canonical row is migrated — a projection may read the world differently from
 * how it was written, but it may not rewrite it.
 *
 * ── THE LIMITATION, STATED RATHER THAN HIDDEN ────────────────────────────────
 *
 * This vocabulary is ENGLISH. A tenant that files knowledge under Turkish domain keys will see
 * those records under `uncategorized` and its declared categories reported as missing. That is the
 * honest outcome: Hebun did not understand where the knowledge belongs, and saying so is better
 * than guessing a mapping it cannot justify. The records are never hidden — a taxonomy may
 * CLASSIFY what Hebun knows and may never ERASE it.
 *
 * Pure. No React, no I/O, no database, no tenant, no clock, no authority.
 */

import { foldTurkish } from "@/features/knowledge-retrieval";

/** The declared areas, in reporting order. A key outside this union does not exist. */
export type CompanyUnderstandingCategoryKey =
  | "identity"
  | "offerings"
  | "customers"
  | "markets"
  | "organization"
  | "operations"
  | "policies"
  | "goals"
  | "systems"
  | "partners";

export interface CompanyUnderstandingCategory {
  readonly key: CompanyUnderstandingCategoryKey;
  /** Operator-facing name. */
  readonly label: string;
  /** One sentence naming what a fact in this area actually says. Shown verbatim. */
  readonly describes: string;
  /**
   * The `domain_key` values that land here, ALREADY FOLDED. Stored folded so the comparison is a
   * set membership test rather than a fold on both sides at every call.
   */
  readonly acceptedDomainKeys: readonly string[];
}

/**
 * Fold one `domain_key` for comparison.
 *
 * Reuses `foldTurkish` — the SAME fold KR3 retrieval already applies, so a domain key is
 * interpreted identically wherever Hebun compares one. It maps `ÇĞİIÖŞÜçğıöşü` onto
 * `CGIIOSUcgiosu`, which is what makes the dotted and dotless Turkish capitals converge; the
 * `toLowerCase()` afterwards is what makes `Security` meet `security`.
 *
 * Order matters: fold first, then lowercase. `İ`.toLowerCase() in JavaScript produces `i` followed
 * by a COMBINING DOT ABOVE, which would never equal a plain `i`. Folding first turns `İ` into `I`,
 * and only then does lowercasing produce a plain `i`.
 */
export function foldDomainKey(value: string): string {
  return foldTurkish(value.trim()).toLowerCase();
}

const CATEGORIES: readonly CompanyUnderstandingCategory[] = Object.freeze([
  Object.freeze({
    key: "identity" as const,
    label: "Identity",
    describes: "What the organization is, what it exists to do, and how it describes itself.",
    acceptedDomainKeys: Object.freeze([
      "identity", "company", "about", "overview", "mission", "vision", "brand", "positioning",
    ]),
  }),
  Object.freeze({
    key: "offerings" as const,
    label: "Offerings",
    /*
     * Products and services are ONE category on purpose. Splitting them forces every organization
     * through a distinction many do not make, and would report a services-only company as half
     * covered on a difference that does not apply to it.
     */
    describes: "The products and services the organization sells or delivers.",
    acceptedDomainKeys: Object.freeze([
      "offerings", "offering", "product", "products", "service", "services",
      "catalog", "catalogue", "commerce", "pricing",
    ]),
  }),
  Object.freeze({
    key: "customers" as const,
    label: "Customers",
    describes: "Who the organization serves, and how it segments them.",
    acceptedDomainKeys: Object.freeze([
      "customers", "customer", "clients", "client", "segments", "segment", "icp", "audience",
    ]),
  }),
  Object.freeze({
    key: "markets" as const,
    label: "Markets",
    describes: "The geographies, industries and competitive landscape the organization operates in.",
    acceptedDomainKeys: Object.freeze([
      "markets", "market", "geography", "geographies", "region", "regions",
      "industry", "industries", "competition", "competitors",
    ]),
  }),
  Object.freeze({
    key: "organization" as const,
    label: "Organization",
    describes: "Teams, departments, roles and how the organization is structured.",
    acceptedDomainKeys: Object.freeze([
      "organization", "organisation", "org", "team", "teams",
      "department", "departments", "people", "roles", "hr", "workforce",
    ]),
  }),
  Object.freeze({
    key: "operations" as const,
    label: "Operations",
    /*
     * FACTS about how work is done — never a judgement about how well. Diagnosis, bottlenecks and
     * process optimization are Organizational Intelligence and are deliberately not this.
     */
    describes: "How work actually gets done: processes, delivery, procurement and support.",
    acceptedDomainKeys: Object.freeze([
      "operations", "operation", "ops", "process", "processes",
      "workflow", "workflows", "delivery", "logistics", "procurement", "support",
    ]),
  }),
  Object.freeze({
    key: "policies" as const,
    label: "Policies",
    describes: "The rules, standards and constraints the organization holds itself to.",
    acceptedDomainKeys: Object.freeze([
      "policies", "policy", "security", "compliance", "legal",
      "governance", "authority", "rules", "standards", "privacy",
    ]),
  }),
  Object.freeze({
    key: "goals" as const,
    label: "Goals",
    /* What the organization SAYS it is aiming at. Never what Hebun infers it should aim at. */
    describes: "The priorities and objectives the organization states for itself.",
    acceptedDomainKeys: Object.freeze([
      "goals", "goal", "objectives", "objective", "okr", "okrs",
      "priorities", "strategy", "roadmap",
    ]),
  }),
  Object.freeze({
    key: "systems" as const,
    label: "Systems",
    describes: "The tools, platforms and infrastructure the organization runs on.",
    acceptedDomainKeys: Object.freeze([
      "systems", "system", "tools", "tooling", "platform", "platforms",
      "stack", "integrations", "infrastructure",
    ]),
  }),
  Object.freeze({
    key: "partners" as const,
    label: "Partners",
    describes: "Suppliers, vendors, channels and the relationships the organization depends on.",
    acceptedDomainKeys: Object.freeze([
      "partners", "partner", "suppliers", "supplier",
      "vendors", "vendor", "channel", "channels", "alliances",
    ]),
  }),
]);

/** The declared taxonomy, in reporting order. */
export function listCompanyUnderstandingCategories(): readonly CompanyUnderstandingCategory[] {
  return CATEGORIES;
}

/**
 * The category one `domain_key` belongs to, or `null` when none claims it.
 *
 * `null` is a real answer, not a failure: the caller must surface the key as uncategorized rather
 * than discard it.
 */
export function categoryForDomainKey(
  domainKey: string,
): CompanyUnderstandingCategory | null {
  const folded = foldDomainKey(domainKey);
  if (folded.length === 0) return null;
  return CATEGORIES.find((category) => category.acceptedDomainKeys.includes(folded)) ?? null;
}

/**
 * One sentence an operator can be shown verbatim. It claims exactly what coverage is, and — more
 * importantly — what it is not.
 */
export const COMPANY_UNDERSTANDING_SUMMARY =
  "These are the areas Hebun asks every organization about. An area is covered when this " +
  "organization holds at least one Knowledge record in force there. Coverage is not correctness, " +
  "not ratification, and not understanding — it says evidence exists, never that it is right.";
