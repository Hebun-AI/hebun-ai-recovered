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
    /* G7 — the hero invitation, restated at G7. The invariant these assertions protect is unchanged — the hero carries an invitation, it is GONE once a conversation exists, and it never appears in the Quick Panel. Only the sentence moved: the Director replaced the "How can I help?" heading, which read as an assistant landing page, with a quieter line on the composer dock where the thing being invited actually is. */
    assert.ok(html.includes("The field below is ready when you are."), "welcome state carries an invitation");
    /*
     * THE EXAMPLE PROMPT CHIPS WERE REMOVED FROM THE FULL WORKSPACE BY DIRECTION, and nothing
     * replaced them. This assertion used to prove the chip rendered; it now proves the subtraction
     * was a subtraction — the caller's suggestions do not appear on this surface, and the composer
     * it used to fill is still here, unchanged. The Quick Panel still renders them; that surface is
     * unaffected and has its own proofs.
     */
    assert.ok(!html.includes("What should I pay attention to here?"), "the workspace shows no example prompt");
    assert.ok(html.includes('aria-label="Message Heby"'), "and the composer it would have filled is untouched");
    assert.ok(html.includes("Enter to send, Shift+Enter for a new line"), "with its keyboard semantics");
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

  modelDiagnosticIsVisibleWithoutExpanding();

  console.log("h1c render checks passed");
}

/*
 * ── THE MODEL DIAGNOSTIC IS VISIBLE, NOT FILED BEHIND AN EXPAND ──────────────
 *
 * When the runtime blocks or fails a model attempt it writes the reason into
 * `response.limitations`, and that text is the ONLY place the reason survives — nothing persists
 * it and the model stack logs nothing by design.
 *
 * It used to render inside the collapsed `<details>` below. Two controlled production provider
 * attempts were both classified from a badge reading "model not used" while the line naming the
 * actual state or typed code sat on screen, unopened, and was lost on navigation.
 *
 * These assertions pin the presentation only: the runtime string appears OUTSIDE the disclosure,
 * verbatim. They pin no runtime behaviour, no code vocabulary, and no provider claim — a future
 * phase may change what the runtime writes without failing this suite, because nothing here
 * asserts which codes exist.
 */
function modelDiagnosticIsVisibleWithoutExpanding(): void {
  const turn = (limitations: readonly string[]): HebyTurnView => ({
    key: "t1",
    role: "heby",
    content: "Derived from real read models.",
    provenance: { label: "Deterministic — model not used", tone: "muted" },
    durable: true,
    limitations,
  });

  /** Everything before the disclosure — what an operator sees without clicking. */
  const visiblePart = (html: string): string => {
    const at = html.indexOf("<details");
    return at === -1 ? html : html.slice(0, at);
  };

  /* The three runtime diagnostics that otherwise fall through to a generic badge. */
  const DIAGNOSTICS = [
    "Model generation is unavailable (CREDENTIAL_UNAVAILABLE); this answer is deterministic.",
    "Model generation failed (provider-unavailable); this answer is deterministic.",
    "A model answer was produced but failed validation and was withheld; this answer is deterministic.",
  ] as const;

  for (const line of DIAGNOSTICS) {
    const html = render({ turns: [turn([line])] });
    assert.ok(html.includes(line), `the runtime line is rendered verbatim: ${line}`);
    assert.ok(
      visiblePart(html).includes(line),
      `and is readable WITHOUT expanding a disclosure: ${line}`,
    );
    /* Shown once. A line in both surfaces would read as two separate findings. */
    assert.equal(
      html.split(line).length - 1,
      1,
      `the diagnostic appears exactly once: ${line}`,
    );
  }

  /*
   * ORDINARY LIMITATIONS KEEP THEIR COLLAPSED HOME, and a diagnostic does not drag them out with
   * it. Both kinds together: the diagnostic is visible, the ordinary line is not.
   */
  const ordinary = "Counts are derived from a non-authoritative read model.";
  const mixed = render({ turns: [turn([ordinary, DIAGNOSTICS[1]])] });
  assert.ok(mixed.includes(ordinary), "the ordinary limitation still renders");
  assert.ok(visiblePart(mixed).includes(DIAGNOSTICS[1]), "the diagnostic is visible");
  assert.ok(!visiblePart(mixed).includes(ordinary), "the ordinary limitation stays inside the disclosure");

  /* NOTHING IS INVENTED. No diagnostic in, no diagnostic surface out. */
  const clean = render({ turns: [turn([ordinary])] });
  assert.ok(!clean.includes("data-heby-diagnostic"), "no diagnostic surface without a diagnostic");
  const none = render({ turns: [turn([])] });
  assert.ok(!none.includes("data-heby-diagnostic"), "and none for an empty limitation set");

  /*
   * THE CODE IS NEVER RESTATED AS A PROVIDER CLAIM. `provider-unavailable` is a typed local
   * outcome; the surface must not turn it into an assertion that Anthropic was reached, refused
   * the request, or was unreachable.
   */
  const failed = render({ turns: [turn([DIAGNOSTICS[1]])] });
  for (const forbidden of ["Anthropic network", "unreachable", "rejected the request", "provider refused", "api.anthropic.com"]) {
    assert.ok(!failed.includes(forbidden), `the surface must not claim "${forbidden}"`);
  }
  /* And no secret-shaped material rides along. */
  assert.ok(!/sk-[a-z0-9-]{6,}/i.test(failed), "no key-shaped token in the rendered turn");
}

main();
