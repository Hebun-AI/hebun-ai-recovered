/*
 * H1C — conversational surface rendering (renderToStaticMarkup, no browser).
 *
 * Proves chronological threading, user/Heby role distinction, provenance + evidence UX, empty and
 * loading states, notices, the New Conversation control, and that no database id or secret is
 * rendered.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HebyWorkspace, type HebyWorkspaceProps } from "../../src/components/layout/heby/heby-workspace";
import type { HebyTurnView } from "../../src/components/layout/heby/heby-turns";

const NOOP = () => {};

function render(overrides: Partial<HebyWorkspaceProps>): string {
  const props: HebyWorkspaceProps = {
    contextLabel: "Operations",
    authorityLabel: "Advisory only",
    turns: [],
    pending: null,
    asking: false,
    busy: false,
    presence: "idle",
    notice: null,
    commandOutput: null,
    facts: {},
    composerValue: "",
    suggestions: [],
    paletteItems: [],
    paletteIndex: 0,
    onComposerChange: NOOP,
    onSubmit: NOOP,
    returnLabel: "Command",
    onClose: NOOP,
    onNewConversation: NOOP,
    onSuggestion: NOOP,
    onPaletteMove: NOOP,
    onPaletteSelect: NOOP,
    onPaletteClose: NOOP,
    onDismissCommandOutput: NOOP,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HebyWorkspace, props));
}

function main(): void {
  // 1. Chronological thread, role distinction, provenance + evidence, no db id rendered.
  {
    const turns: HebyTurnView[] = [
      { key: "msg-DBID-SECRET-123", role: "user", content: "USER_MSG_ONE", durable: true },
      {
        key: "msg-DBID-SECRET-456",
        role: "heby",
        content: "HEBY_MSG_ONE",
        durable: true,
        provenance: { label: "Model-assisted · test transport (simulated)", tone: "warn" },
        evidence: [{ sourceClass: "operations", recordRef: "op-42" }],
        limitations: ["This is model-generated advisory text."],
      },
    ];
    const html = render({ turns });
    assert.ok(html.includes("USER_MSG_ONE") && html.includes("HEBY_MSG_ONE"), "both turns rendered");
    assert.ok(html.indexOf("USER_MSG_ONE") < html.indexOf("HEBY_MSG_ONE"), "chronological order preserved");
    assert.ok(html.includes('data-heby-role="user"') && html.includes('data-heby-role="heby"'), "user vs Heby structurally distinct");
    assert.ok(html.includes("Model-assisted · test transport (simulated)"), "provenance shown");
    assert.ok(html.includes("Evidence (1)") && html.includes("operations · op-42"), "evidence affordance + server ref");
    assert.ok(html.includes("<details"), "evidence/limitations use a collapsible");
    assert.ok(html.includes("Operations") && html.includes("Advisory only"), "workspace context + authority shown");
    assert.ok(html.includes("New conversation"), "New Conversation control present");
    assert.ok(/aria-label="Message Heby"/.test(html), "composer is labelled");
    assert.ok(html.includes('aria-label="Send"'), "Send action present");
    // No database id and no secret leaks into the markup.
    assert.ok(!html.includes("msg-DBID-SECRET"), "database ids are keys only, never rendered");
    assert.ok(!/sk-[a-z0-9-]{6,}/i.test(html) && !html.includes("tenantId"), "no key-shaped token / no tenant id in markup");
  }

  // 2. Empty/welcome state with honest suggestions; no fabricated activity.
  {
    const html = render({ turns: [], suggestions: ["What should I pay attention to here?", "Summarize the current picture."] });
    assert.ok(html.includes("How can I help?"), "welcome state");
    assert.ok(html.includes("What should I pay attention to here?"), "suggestion rendered");
    assert.ok(!html.includes("Heby is responding"), "no fabricated activity in empty state");
    assert.ok(!/Analyzing|Checking \d+ systems|agents? working/i.test(html), "no fake reasoning/agent activity");
  }

  // 3. Loading: pending user bubble + subtle responding indicator.
  {
    const html = render({ turns: [{ key: "u", role: "user", content: "prior", durable: true }], pending: "typed question", asking: true, presence: "responding" });
    assert.ok(html.includes("typed question"), "optimistic user bubble shown");
    assert.ok(html.includes("Heby is responding…"), "subtle responding indicator");
  }

  // 4. Provider-disabled + deterministic provenance are truthfully labelled (never "connected").
  {
    const disabled = render({ turns: [{ key: "h", role: "heby", content: "det answer", durable: true, provenance: { label: "Provider disabled by Director — answered deterministically", tone: "muted" } }] });
    assert.ok(disabled.includes("Provider disabled by Director"), "provider-disabled state shown");
    const det = render({ turns: [{ key: "h", role: "heby", content: "det", durable: true, provenance: { label: "Deterministic", tone: "muted" } }] });
    assert.ok(det.includes("Deterministic"), "deterministic state shown");
    assert.ok(!/Claude connected|is connected|healthy|online/i.test(disabled + det), "never claims connected/healthy/online");
  }

  // 5. Notice (sign-in / rejected) renders truthfully near the composer.
  {
    const html = render({ notice: { tone: "warn", text: "Sign in to ask Heby a question." } });
    assert.ok(html.includes("Sign in to ask Heby a question."), "notice shown");
  }

  console.log("h1c render checks passed");
}

main();
