/*
 * heby-model/web-research-trace.ts — P6-3: read what a web-searching Anthropic response searched and
 * cited, out of its raw content blocks, into a narrow `WebResearchTrace`.
 *
 * A pure projection. It keeps strings only (bounded), drops everything it does not name — notably the
 * provider's `encrypted_content` / `encrypted_index` payloads, which are never stored — and invents
 * nothing: a field the provider did not return is absent. Every value it returns is third-party data.
 */
import type { WebResearchTrace } from "@/features/heby-runtime/contracts";

/** P6-3 — the most searches one research request may make; the live transport refuses more. */
export const WEB_SEARCH_MAX_USES_CEILING = 5;

const MAX_STRING = 2_000;
const MAX_ITEMS = 100;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, MAX_STRING) : undefined;
}

/** Only an absolute http(s) URL is a result location; anything else is dropped, never repaired. */
export function webUrl(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function parseWebResearchTrace(content: unknown, usage: unknown): WebResearchTrace {
  const blocks = Array.isArray(content) ? content.slice(0, 500) : [];
  const queries: string[] = [];
  const results: { url: string; title: string; pageAge?: string }[] = [];
  const seen = new Set<string>();
  const segments: { text: string; citations: { url: string; title: string; citedText: string }[] }[] = [];
  const searchErrors: string[] = [];

  for (const raw of blocks) {
    const block = (raw ?? {}) as Record<string, unknown>;
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const query = str((block.input as Record<string, unknown> | undefined)?.query);
      if (query && queries.length < MAX_ITEMS) queries.push(query);
    } else if (block.type === "web_search_tool_result") {
      const body = block.content;
      if (Array.isArray(body)) {
        for (const item of body) {
          const r = (item ?? {}) as Record<string, unknown>;
          const url = r.type === "web_search_result" ? webUrl(r.url) : undefined;
          if (!url || seen.has(url) || results.length >= MAX_ITEMS) continue;
          seen.add(url);
          const pageAge = str(r.page_age);
          results.push({ url, title: str(r.title) ?? url, ...(pageAge ? { pageAge } : {}) });
        }
      } else {
        const error = (body ?? {}) as Record<string, unknown>;
        const code = error.type === "web_search_tool_result_error" ? str(error.error_code) : undefined;
        searchErrors.push(code ?? "unknown");
      }
    } else if (block.type === "text" && typeof block.text === "string") {
      const citations = (Array.isArray(block.citations) ? block.citations : []).flatMap((c) => {
        const cite = (c ?? {}) as Record<string, unknown>;
        const url = cite.type === "web_search_result_location" ? webUrl(cite.url) : undefined;
        return url ? [{ url, title: str(cite.title) ?? url, citedText: str(cite.cited_text) ?? "" }] : [];
      });
      segments.push({ text: block.text, citations });
    }
  }

  const requests = ((usage ?? {}) as { server_tool_use?: { web_search_requests?: unknown } }).server_tool_use?.web_search_requests;
  return {
    queries,
    results,
    segments,
    ...(Number.isInteger(requests) && (requests as number) >= 0 ? { searchRequests: requests as number } : {}),
    searchErrors,
  };
}
