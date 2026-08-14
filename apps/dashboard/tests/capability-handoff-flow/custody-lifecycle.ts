/*
 * Onboarding capability human-handoff custody — source-invariant regression guard.
 *
 * ── THE INCIDENT THIS LOCKS OUT ──────────────────────────────────────────────
 *
 * Issuing a capability marks its authorization `consumed` in the same transaction. The card used to
 * mount the issuance component behind `!entry.consumed && entry.status === "authorized"` AND call
 * `router.refresh()` in the same transition that stored the returned plaintext. So a SUCCESSFUL
 * issuance destroyed its own output: the refreshed server tree flipped the mount condition, React
 * unmounted the component, and the one-time capability went with its state. It happened twice in
 * production, and the second time no human ever saw the secret.
 *
 * Durable execution was correct both times. The HUMAN HANDOFF failed.
 *
 * ── WHAT THIS FILE IS, AND WHAT IT IS NOT ────────────────────────────────────
 *
 * This is a SOURCE INVARIANT test, not a browser test. It reads the component and asserts the shape
 * that made the bug possible is gone. It does NOT render React, does not simulate a click, and does
 * not prove what a human sees — the repository has no browser-driven test layer, and pretending
 * otherwise is exactly the kind of claim that let this bug ship. The honest browser proof happens at
 * the next real issuance ceremony.
 *
 * What it CAN guarantee is that the specific defect cannot return silently: a future edit that puts
 * `router.refresh()` back into the success branch, or re-gates the mount on server status, fails
 * here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CARD = "src/components/governance-authority/membership-authorization-card.tsx";
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: these assertions are about CODE, never about prose. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The body of one top-level `function name(` declaration, brace-matched.
 *
 * The parameter list is skipped by paren-matching FIRST, because these signatures destructure and
 * annotate with object literals — naively taking the first `{` after the name returns the props
 * type, not the body.
 */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);

  /* Walk the parameter list to its closing paren. */
  let parens = 0;
  let cursor = source.indexOf("(", start);
  for (; cursor < source.length; cursor += 1) {
    if (source[cursor] === "(") parens += 1;
    else if (source[cursor] === ")") {
      parens -= 1;
      if (parens === 0) break;
    }
  }

  const open = source.indexOf("{", cursor);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`could not brace-match ${name}`);
}

function main(): void {
  const card = read(CARD);
  const code = codeOf(card);

  /* ── 1. THE SUCCESS BRANCH MUST NOT REFRESH ─────────────────────────────── */
  {
    /*
     * THE CORE INVARIANT. The branch that receives and stores the plaintext may not, in the same
     * breath, re-render the server tree that decides whether this component exists.
     */
    const issue = functionBody(codeOf(card), "issue");
    assert.match(issue, /setCapability\(result\.capability\)/, "issue() stores the capability");
    assert.ok(
      !/router\.refresh\(\)/.test(issue),
      "issue() must NOT call router.refresh() — that is the bug that destroyed two capabilities",
    );
    assert.ok(
      !/revalidate|window\.location|location\.reload/.test(issue),
      "nor any other way of re-rendering or reloading while holding the secret",
    );
  }

  /* ── 2. REFRESH EXISTS ONLY BEHIND EXPLICIT ACKNOWLEDGEMENT ─────────────── */
  {
    const acknowledge = functionBody(codeOf(card), "acknowledge");
    assert.match(acknowledge, /setCapability\(null\)/, "acknowledgement drops the local copy");
    assert.match(acknowledge, /router\.refresh\(\)/, "and only then refreshes");
    /* Order matters: the secret is dropped BEFORE the tree is allowed to change. */
    assert.ok(
      acknowledge.indexOf("setCapability(null)") < acknowledge.indexOf("router.refresh()"),
      "the local copy is cleared before the refresh, never after",
    );
    /* It must issue nothing. */
    assert.ok(
      !/issueInvitationAction/.test(acknowledge),
      "acknowledgement must never issue a second capability",
    );
    assert.ok(
      !/InvitationAction|revokeInvitation/.test(acknowledge),
      "acknowledgement calls no server action at all — it is local state disposal plus a refresh",
    );
    /* And the human has a control that reaches it. */
    assert.match(card, /I have saved this capability/, "the acknowledgement control is rendered");
    assert.match(card, /onClick=\{acknowledge\}/, "and it is wired to acknowledge()");
  }

  /* ── 3. THE COMPONENT IS NOT MOUNT-GATED ON SERVER STATUS ───────────────── */
  {
    /*
     * The parent must render the component unconditionally. If its existence depends on
     * `entry.consumed` again, a successful issuance will unmount it again.
     */
    assert.ok(
      !/\{!entry\.consumed && entry\.status === "authorized" \? \(\s*<InvitationIssuance/.test(code),
      "InvitationIssuance must not be conditionally mounted on the authorization's server status",
    );
    assert.match(
      code,
      /<InvitationIssuance\s+authorizationId=\{entry\.authorizationId\}\s+issuable=\{!entry\.consumed && entry\.status === "authorized"\}\s*\/>/,
      "the old predicate now arrives as a prop, gating the button rather than the mount",
    );
  }

  /* ── 4. THE CAPABILITY BRANCH IS CHECKED FIRST ──────────────────────────── */
  {
    const component = functionBody(codeOf(card), "InvitationIssuance");
    const capabilityBranch = component.indexOf("if (capability)");
    const issuableBranch = component.indexOf("if (!issuable)");
    assert.notEqual(capabilityBranch, -1, "the capability panel has its own branch");
    assert.notEqual(issuableBranch, -1, "and so does the spent-authorization case");
    assert.ok(
      capabilityBranch < issuableBranch,
      "a held capability outranks every other render path, including a spent authorization",
    );
  }

  /* ── 5. THE SECRET STILL HAS NO CUSTODY BEYOND COMPONENT STATE ──────────── */
  {
    /*
     * The fix must not have bought visibility with persistence. This is the line the incident
     * report drew and it has to hold: the capability stays unrecoverable.
     */
    for (const forbidden of [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "searchParams",
      "location.href",
      "location.hash",
      "navigator.clipboard",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `the capability must not gain ${forbidden} custody in exchange for being visible`,
      );
    }
    assert.ok(
      !/console\.(log|info|warn|error|debug)/.test(code),
      "and it must never be logged",
    );
    assert.match(
      code,
      /useState<string \| null>\(null\)/,
      "component-local state remains the only place it lives",
    );
  }

  /* ── 6. FAILURE STATES ARE HONEST ───────────────────────────────────────── */
  {
    const issue = functionBody(codeOf(card), "issue");
    /* A refused issuance shows a refusal, never a capability. */
    assert.match(issue, /setRefusal\(result\.reason\)/);
    assert.ok(
      !/setCapability\((?!result\.capability|null)/.test(issue),
      "nothing but the server's own capability is ever placed in that state",
    );
    /* A thrown action must not be reported as a decided refusal. */
    assert.match(issue, /catch\s*\{/, "a transport failure is caught");
    /*
     * The catch block ITSELF, not a proximity match — `setRefusal` legitimately appears later in
     * `issue()` on the path the catch returns out of, and a naive nearby-text check flags it.
     */
    const catchBlock = issue.slice(issue.indexOf("catch {"), issue.indexOf("}", issue.indexOf("catch {")) + 1);
    assert.match(catchBlock, /setUnknownOutcome\(true\)/, "an unknown outcome is reported");
    assert.match(catchBlock, /return;/, "and the handler returns immediately");
    assert.ok(
      !/setRefusal/.test(catchBlock),
      "an unknown outcome must not also claim a decided refusal",
    );
    assert.ok(
      !/setCapability/.test(catchBlock),
      "and must never invent a capability",
    );
    const unknownCopy = card.slice(card.indexOf("unknownOutcome) {"));
    assert.ok(
      !/nothing was changed/i.test(unknownCopy.slice(0, 600)),
      "an unknown outcome must never claim nothing happened — it may well have committed",
    );
    /* Double-click protection on the only control that spends an authorization. */
    assert.match(code, /disabled=\{pending\}/, "the issue button is disabled while in flight");
  }

  /* ── 7. THE PANEL STATES WHAT THE HUMAN MUST DO ─────────────────────────── */
  {
    /*
     * Whitespace-tolerant: JSX wraps these sentences across source lines, so a literal match is
     * brittle in a way that says nothing about what renders.
     */
    const prose = card.replace(/\s+/g, " ");
    assert.match(prose, /Capability \(shown once\)/);
    assert.match(prose, /Copy or save it now/i, "it tells the human to save it before continuing");
    assert.match(
      prose,
      /cannot show it again and cannot recover it/i,
      "and that it is unrecoverable",
    );
    assert.match(prose, /Do not close or reload this page/i, "and not to navigate away first");
    assert.match(card, /DELIVERY_REALITY\.operatorObligation/, "and who may use it if it leaks");
    assert.match(card, /Usable until \{expiresAt\}/, "and when it stops working");
  }

  console.log("PASS capability handoff custody lifecycle");
}

main();
