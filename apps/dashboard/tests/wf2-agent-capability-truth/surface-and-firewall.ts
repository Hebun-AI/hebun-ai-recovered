/*
 * WF-2 — the capability card's semantics and boundary. Pure rendering and source text; no database.
 *
 *   - every unavailable reason fails closed: no capability badge, no "can propose", and the sentence
 *     says Hebun could not confirm — never that the agent cannot;
 *   - "send" is never under "Can propose now", whatever the mandate says;
 *   - the agent is never described as able to approve, permit or execute;
 *   - the derivation imports no value at all (it decides nothing), the card reaches no reader or
 *     writer, and the page asks the WF-1 projection — the one origination availability authority —
 *     rather than computing a second one, and never imports the origination seam.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ORIGINATION_UNAVAILABLE_REASONS } from "../../src/features/origination-availability/contracts";
import {
  AGENT_HAS_NO_AUTHORITY_TO,
  deriveAgentCapabilityTruth,
} from "../../src/features/origination-availability/capability-truth";
import { AgentCapabilityTruthCard, UNAVAILABLE_SENTENCE } from "../../src/components/agents/agent-capability-truth";

const ROOT = path.resolve(__dirname, "../..");
const code = (f: string) =>
  readFileSync(path.join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const render = (availability: Parameters<typeof deriveAgentCapabilityTruth>[0]) =>
  renderToStaticMarkup(createElement(AgentCapabilityTruthCard, { truth: deriveAgentCapabilityTruth(availability) }));

/* ═══ 1. UNAVAILABLE FAILS CLOSED ═══ */
for (const reason of ORIGINATION_UNAVAILABLE_REASONS) {
  const html = render({ status: "unavailable", reason });
  assert.ok(html.includes(UNAVAILABLE_SENTENCE[reason]), `${reason} names its reason`);
  assert.ok(html.includes("No capability is shown until it can be confirmed"), `${reason} makes no capability claim`);
  for (const claim of ["Can propose now", "Mandate permits", "Work proposals", "Send proposals"]) {
    assert.equal(html.includes(claim), false, `${reason} renders no "${claim}"`);
  }
  assert.equal(/cannot propose|can't propose/i.test(html), false, `${reason} is never rendered as "cannot"`);
}

/* ═══ 2. SEND IS NEVER REACHABLE NOW ═══ */
for (const scope of [["send", "record-work"], ["record-work", "send"], ["record-work"]]) {
  const html = render({
    status: "available",
    agent: { name: "Heby" },
    mandate: { revision: 3, purpose: "p", proposalScope: scope },
    originable: "record-work",
  });
  const canNow = html.split("Can propose now")[1]!.split("Mandate permits")[0]!;
  assert.ok(canNow.includes("Work proposals"));
  assert.equal(canNow.includes("Send proposals"), false, `scope ${scope} never shows send as reachable`);
  assert.equal(html.includes("not offered by the current proposal path"), scope.includes("send"));
  assert.ok(html.includes("revision 3"));
}

/* ═══ 3. NO AGENT AUTHORITY, EVER ═══ */
const available = render({
  status: "available",
  agent: { name: "Heby" },
  mandate: { revision: 3, purpose: "p", proposalScope: ["send", "record-work"] },
  originable: "record-work",
});
for (const html of [available, render({ status: "unavailable", reason: "temporarily-unavailable" })]) {
  assert.ok(html.includes("The agent itself does not"));
  for (const item of AGENT_HAS_NO_AUTHORITY_TO) assert.ok(html.includes(item));
  assert.equal(/can (approve|issue permits|execute|send)/i.test(html), false, "never describes approve/permit/execute/send as possible");
  assert.equal(/Hebun cannot/i.test(html), false, "speaks of the agent's authority, not the product's");
}

/* ═══ 4. NO SECOND AUTHORITY, NO WRITER ═══ */
const DERIVATION = "src/features/origination-availability/capability-truth.ts";
const CARD = "src/components/agents/agent-capability-truth.tsx";
const PAGE = "src/app/(dashboard)/agents/page.tsx";
const valueImports = (f: string) =>
  [...code(f).matchAll(/^\s*import\s+(?!type\s)[\s\S]*?from\s*["']([^"']+)["']/gm)].map((m) => m[1]!);
assert.deepEqual(valueImports(DERIVATION), [], "the derivation imports no value — it reads and decides nothing");
for (const spec of valueImports(CARD)) {
  assert.ok(
    spec === "lucide-react" || spec.startsWith("@/components/ui/") || spec === "@/features/origination-availability/capability-truth",
    `the card imports only UI and the derivation, not ${spec}`,
  );
}
assert.equal(/"use client"/.test(code(CARD)), false, "the card is a server component with no client boundary");
const page = code(PAGE);
assert.ok(page.includes('from "@/features/origination-availability/read-origination-availability.server"'), "the page reuses the WF-1 projection");
assert.ok(/readOriginationAvailability\(\{ resolveTenant: async \(\) => tenant \}\)/.test(page), "only the session tenant is passed");
for (const forbidden of ["agent-origination/originate-action", "originateHebyActionProposalAction", "external-ai-disclosure-audit", "heby-model-generation", "authorizeExternalAiDisclosure"]) {
  assert.equal(page.includes(forbidden), false, `the page does not reach ${forbidden}`);
}

console.log("PASS wf2-agent-capability-truth surface-and-firewall");
