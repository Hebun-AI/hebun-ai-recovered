/*
 * heby-markdown.tsx — HEBY-TRUTH-UX-REPAIR-1: Heby's answer text, read as the Markdown it is.
 *
 * The model writes Markdown (headings, bold, lists). `HebyBubble` used to print it verbatim, so a
 * Director read `## Neden bu öneri?` and `**…**` as literal characters. This renders a SMALL,
 * CLOSED subset of Markdown into React elements and nothing else.
 *
 * ── WHY IT CANNOT INJECT ─────────────────────────────────────────────────────
 *
 * The answer is untrusted model output. This module never produces an HTML string: every piece of
 * text becomes a React text child, which React escapes. There is no `dangerouslySetInnerHTML`, no
 * HTML parser and no raw-HTML pass-through — `<script>` in an answer is shown as those characters.
 * A link is rendered only for an `http:` / `https:` URL or a same-site path starting with a single
 * `/`; any other scheme (`javascript:`, `data:`, `vbscript:` …) stays plain text. External links open
 * with `rel="noopener noreferrer"`.
 *
 * ── WHAT IT RENDERS ─────────────────────────────────────────────────────────
 *
 *   # … ######      heading (h3 / h4 / h5 — the answer sits inside a page that owns h1/h2)
 *   - * +  item     unordered list          1. / 1) item   ordered list
 *   ``` … ```       preformatted block      ---            rule
 *   **x** __x__     strong                  *x*            emphasis
 *   `x`             inline code             [t](url)       link (rules above)
 *
 * Anything else is a paragraph line. Nothing is dropped: an unrecognised construct is shown as the
 * text it was. Pure and deterministic, so `renderToStaticMarkup` proves it.
 */
import type { ReactNode } from "react";

/* ── Inline ─────────────────────────────────────────────────────────────── */

const SAFE_HREF = /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;

export function isSafeHebyHref(href: string): boolean {
  return SAFE_HREF.test(href.trim());
}

/* Earliest-match tokenizer. Order within one position: code, link, strong, emphasis. */
const INLINE = /(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\s][^*\n]*?\*)/;

export function renderHebyInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest.length > 0) {
    const m = INLINE.exec(rest);
    if (!m || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const token = m[0];
    const key = `${keyPrefix}-${n++}`;
    if (m[1]) {
      out.push(
        <code key={key} className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.85em] text-fg">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      const close = token.indexOf("](");
      const label = token.slice(1, close);
      const href = token.slice(close + 2, -1);
      if (isSafeHebyHref(href)) {
        const external = /^https?:/i.test(href);
        out.push(
          <a
            key={key}
            href={href}
            className="text-highlight underline underline-offset-2"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {renderHebyInline(label, key)}
          </a>,
        );
      } else {
        out.push(token);
      }
    } else if (m[3]) {
      out.push(
        <strong key={key} className="font-semibold text-fg">
          {renderHebyInline(token.slice(2, -2), key)}
        </strong>,
      );
    } else {
      out.push(<em key={key}>{renderHebyInline(token.slice(1, -1), key)}</em>);
    }
    rest = rest.slice(m.index + token.length);
  }
  return out;
}

/* ── Blocks ─────────────────────────────────────────────────────────────── */

type Block =
  | { readonly kind: "heading"; readonly level: number; readonly text: string }
  | { readonly kind: "ul" | "ol"; readonly items: string[] }
  | { readonly kind: "pre"; readonly lines: string[] }
  | { readonly kind: "rule" }
  | { readonly kind: "p"; readonly lines: string[] };

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const UL_ITEM = /^\s*[-*+]\s+(.*)$/;
const OL_ITEM = /^\s*\d{1,3}[.)]\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s*```/;

export function parseHebyMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (FENCE.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i]!)) body.push(lines[i++]!);
      i += 1; /* the closing fence, when present; an unclosed fence runs to the end */
      blocks.push({ kind: "pre", lines: body });
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]! });
      i += 1;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      i += 1;
      continue;
    }
    const listKind = UL_ITEM.test(line) ? "ul" : OL_ITEM.test(line) ? "ol" : null;
    if (listKind) {
      const pattern = listKind === "ul" ? UL_ITEM : OL_ITEM;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i]!)) items.push(pattern.exec(lines[i++]!)![1]!);
      blocks.push({ kind: listKind, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !HEADING.test(lines[i]!) &&
      !RULE.test(lines[i]!) &&
      !FENCE.test(lines[i]!) &&
      !UL_ITEM.test(lines[i]!) &&
      !OL_ITEM.test(lines[i]!)
    ) {
      para.push(lines[i++]!);
    }
    blocks.push({ kind: "p", lines: para });
  }
  return blocks;
}

const HEADING_CLASS = "mt-3 first:mt-0 font-semibold text-fg";

export function HebyMarkdown({ text }: { text: string }) {
  const blocks = parseHebyMarkdown(text);
  return (
    <div data-heby-markdown="" className="flex flex-col gap-2 break-words text-[0.95rem] leading-7 text-fg-secondary">
      {blocks.map((block, b) => {
        const key = `b${b}`;
        switch (block.kind) {
          case "heading": {
            const content = renderHebyInline(block.text, key);
            if (block.level <= 2) return <h3 key={key} className={`${HEADING_CLASS} text-[1.02rem]`}>{content}</h3>;
            if (block.level === 3) return <h4 key={key} className={`${HEADING_CLASS} text-[0.97rem]`}>{content}</h4>;
            return <h5 key={key} className={`${HEADING_CLASS} text-[0.95rem]`}>{content}</h5>;
          }
          case "ul":
          case "ol": {
            const List = block.kind;
            return (
              <List key={key} className={`flex flex-col gap-1 pl-5 ${block.kind === "ul" ? "list-disc" : "list-decimal"}`}>
                {block.items.map((item, n) => (
                  <li key={`${key}-${n}`}>{renderHebyInline(item, `${key}-${n}`)}</li>
                ))}
              </List>
            );
          }
          case "pre":
            return (
              <pre key={key} className="overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-[0.82rem] leading-6 text-fg">
                <code>{block.lines.join("\n")}</code>
              </pre>
            );
          case "rule":
            return <hr key={key} className="border-border" />;
          default:
            return (
              <p key={key}>
                {block.lines.flatMap((line, n) => [
                  ...(n > 0 ? [<br key={`${key}-br${n}`} />] : []),
                  ...renderHebyInline(line, `${key}-${n}`),
                ])}
              </p>
            );
        }
      })}
    </div>
  );
}
