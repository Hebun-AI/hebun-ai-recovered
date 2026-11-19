/*
 * agent-work/sourced-research-report.ts — P6-3: turn a web-searching research answer into the text of
 * one SOURCED research report.
 *
 * A pure composition over what the provider returned (`WebResearchTrace`) and what the answer flow
 * validated. It decides which statements carry a source by the provider's own citation structure, not
 * by the model's word: a passage is "supported" only when its text block carries a citation to a URL
 * the search tool actually returned in this call. Everything else is listed as unverified.
 *
 * Every title, URL and cited passage is third-party, untrusted text. It is written into the report as
 * data and read by nothing that could act on it.
 */
import type { WebResearchTrace } from "@/features/heby-runtime/contracts";

export const RESEARCH_REPORT_SOURCED = "SOURCED WEB RESEARCH DRAFT" as const;

/** The sections the model is told to write, by these exact headings. */
export const SOURCED_REPORT_SECTIONS = [
  "Executive summary",
  "Findings",
  "Unverified claims and assumptions",
  "Missing information",
] as const;

/* A web address written by the model itself. Sources are listed from the search results, never typed. */
const LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.[a-z]/i;

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

export type SourcedReportComposition =
  | { readonly status: "composed"; readonly content: string; readonly sourceCount: number; readonly searchCount: number }
  | {
      readonly status: "refused";
      /**
       * `link-in-output` — the model wrote a web address itself. `answer-mismatch` — the cited text
       * blocks are not the answer the flow validated, so the citations cannot be placed on it.
       * `no-sources` — no statement cites a search result, so the draft is not sourced (P6, 2026-11-19).
       */
      readonly reason: "link-in-output" | "answer-mismatch" | "no-sources";
    };

export function composeSourcedResearchReport(input: {
  readonly question: string;
  readonly researchedAt: Date;
  /** The answer text exactly as the answer flow validated and served it. */
  readonly validatedText: string;
  readonly trace: WebResearchTrace;
}): SourcedReportComposition {
  const { trace } = input;
  const modelText = trace.segments.map((segment) => segment.text).join("");
  if (oneLine(modelText) !== oneLine(input.validatedText)) return { status: "refused", reason: "answer-mismatch" };
  if (LINK.test(modelText)) return { status: "refused", reason: "link-in-output" };

  /* Only a URL this call's search returned can be a source; numbered in first-cited order. */
  const returned = new Map(trace.results.map((result) => [result.url, result]));
  const numbers = new Map<string, number>();
  const excerpts = new Map<string, string[]>();
  let uncited = 0;
  const body = trace.segments
    .map((segment) => {
      const cited = segment.citations.filter((citation) => returned.has(citation.url));
      if (cited.length === 0) {
        /* Headings and connective scraps ("Based on the results, ") are not statements. */
        const prose = segment.text
          .split("\n")
          .filter((line) => !/^\s*#/.test(line) && !SOURCED_REPORT_SECTIONS.some((h) => oneLine(line).replace(/[*:]/g, "").toLowerCase() === h.toLowerCase()))
          .join(" ");
        if (oneLine(prose).length >= 40) uncited += 1;
        return segment.text;
      }
      const marks = [...new Set(cited.map((citation) => {
        if (!numbers.has(citation.url)) numbers.set(citation.url, numbers.size + 1);
        const quoted = oneLine(citation.citedText);
        if (quoted) excerpts.set(citation.url, [...(excerpts.get(citation.url) ?? []), quoted].slice(0, 3));
        return numbers.get(citation.url)!;
      }))];
      return `${segment.text}${marks.map((n) => ` [${n}]`).join("")}`;
    })
    .join("")
    .trim();

  /* A section the model did not write is named as missing, never written for it. */
  const missingSections = SOURCED_REPORT_SECTIONS.filter(
    (heading) => !new RegExp(`(^|\\n)\\s*#*\\s*\\**${heading}\\**\\s*:?\\s*(\\n|$)`, "i").test(modelText),
  );

  const date = input.researchedAt.toISOString().slice(0, 10);
  const sources = [...numbers.entries()].map(([url, n]) => {
    const result = returned.get(url)!;
    const lines = [`[${n}] ${oneLine(result.title)} — ${url}${result.pageAge ? ` (page age: ${oneLine(result.pageAge)})` : ""}`];
    for (const excerpt of excerpts.get(url) ?? []) lines.push(`    cited: "${excerpt}"`);
    return lines.join("\n");
  });
  if (numbers.size === 0) return { status: "refused", reason: "no-sources" };
  const uncitedResults = trace.results.filter((result) => !numbers.has(result.url));
  const searchCount = trace.searchRequests ?? trace.queries.length;

  const parts: string[] = [
    `RESEARCH TOPIC: ${oneLine(input.question)}`,
    `RESEARCH DATE: ${date} (UTC)`,
    `SOURCING: ${RESEARCH_REPORT_SOURCED}. Sources are third-party web pages returned by web search; Hebun has not verified them. ` +
      "A statement marked [n] is cited by the model to source n; a statement without a mark has no source and is unverified.",
    "",
    body,
  ];
  for (const heading of missingSections) parts.push("", heading, "Not provided in this draft.");
  parts.push("", "SOURCES", ...sources);
  parts.push(
    "",
    "UNVERIFIED STATEMENTS",
    `${uncited} passage(s) of this draft carry no citation. Treat them, and the "Unverified claims and assumptions" section, as unverified.`,
  );
  parts.push("", `SEARCH QUERIES (${searchCount} search${searchCount === 1 ? "" : "es"})`, ...(trace.queries.length > 0 ? trace.queries.map((q) => `- ${oneLine(q)}`) : ["- none"]));
  if (uncitedResults.length > 0) {
    parts.push("", "SEARCH RESULTS NOT CITED", ...uncitedResults.map((result) => `- ${oneLine(result.title)} — ${result.url}`));
  }
  if (trace.searchErrors.length > 0) parts.push("", `SEARCH ERRORS: ${trace.searchErrors.join(", ")}`);

  return { status: "composed", content: parts.join("\n"), sourceCount: numbers.size, searchCount };
}
