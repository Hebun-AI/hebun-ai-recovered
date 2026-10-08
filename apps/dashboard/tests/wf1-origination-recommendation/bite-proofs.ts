/*
 * WF-1 bite-proofs — each load-bearing guard is mutated in source, the suite that owns it is run,
 * and it must fail FOR THE STATED REASON. Sources are restored byte-identically. Sequential.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string) => path.join(ROOT, f);
const read = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const PROJECTION = "src/features/origination-availability/read-origination-availability.server.ts";
const ACTION = "src/app/(dashboard)/heby/origination-availability-actions.ts";
const AFFORDANCE = "src/components/layout/heby/heby-origination-affordance.tsx";
const FIREWALL = "tests/wf1-origination-recommendation/firewall-and-surface.ts";
const PG = "tests/wf1-origination-recommendation/availability-postgres.ts";

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "W1 origination is called during render",
    file: AFFORDANCE,
    suite: FIREWALL,
    find: 'const [state, setState] = useState<State>({ kind: "closed" });',
    replace: 'const [state, setState] = useState<State>({ kind: "closed" });\n  void originateHebyActionProposalAction({ goal });',
    because: "origination is called from exactly one place",
  },
  {
    label: "W2 the human goal is rewritten",
    file: AFFORDANCE,
    suite: FIREWALL,
    /* AP-1 re-anchored: the goal now travels through the one `input` the confirmation builds. */
    find: "const input = chosenAgentId ? { goal, agentId: chosenAgentId, workScope: scope } : { goal, workScope: scope };",
    replace: "const input = chosenAgentId ? { goal: goal.trim(), agentId: chosenAgentId, workScope: scope } : { goal: goal.trim(), workScope: scope };",
    because: "with the human's message exactly as written",
  },
  {
    label: "W3 availability is read on render",
    file: AFFORDANCE,
    suite: FIREWALL,
    find: "const [, startTransition] = useTransition();",
    replace: "const [, startTransition] = useTransition();\n  void readAgentOriginationAvailabilityAction();",
    because: "availability is read from one place",
  },
  {
    label: "W4 the client may claim availability",
    file: ACTION,
    suite: FIREWALL,
    /* AP-1 re-anchored: the one optional lookup key may not grow a claimed availability beside it. */
    find: "  input?: { readonly agentId?: string },\n): Promise",
    replace: "  input?: { readonly agentId?: string },\n  claimed?: AgentOriginationAvailability,\n): Promise",
    because: "the read action takes only an optional agent lookup key",
  },
  {
    label: "W5 the projection reaches the disclosure audit writer",
    file: PROJECTION,
    suite: FIREWALL,
    find: 'import type { AgentOriginationAvailability, OriginationUnavailableReason, WorkScopeOption } from "./contracts";',
    replace:
      'import type { AgentOriginationAvailability, OriginationUnavailableReason, WorkScopeOption } from "./contracts";\nimport { recordExternalAiDisclosureDecision } from "@/features/governance-audit/external-ai-disclosure-audit.server";\nvoid recordExternalAiDisclosureDecision;',
    because: "must not reach src/features/governance-audit/external-ai-disclosure-audit.server.ts",
  },
  {
    label: "W6 the projection reaches the request writer",
    file: PROJECTION,
    suite: FIREWALL,
    find: 'import type { AgentOriginationAvailability, OriginationUnavailableReason, WorkScopeOption } from "./contracts";',
    replace:
      'import type { AgentOriginationAvailability, OriginationUnavailableReason, WorkScopeOption } from "./contracts";\nimport { recordAgentOriginatedActionRequest } from "@/features/action-authorization/record-action-request.server";\nvoid recordAgentOriginatedActionRequest;',
    because: "must not reach src/features/action-authorization/record-action-request.server.ts",
  },
  {
    label: "W7 the affordance bypasses the released origination action",
    file: AFFORDANCE,
    suite: FIREWALL,
    find: 'import Link from "next/link";',
    replace: 'import Link from "next/link";\nimport { recordAgentOriginatedActionRequest } from "@/features/action-authorization/record-action-request.server";\nvoid recordAgentOriginatedActionRequest;',
    because: "the affordance imports no writer or runtime",
  },
  {
    label: "W8 the mandate ceiling is skipped",
    file: PROJECTION,
    suite: PG,
    find: 'if (ceiling) return unavailable("proposal-scope-unavailable");',
    replace: 'if (false as boolean) return unavailable("proposal-scope-unavailable");',
    because: "a mandate without record-work is not offered",
  },
  {
    label: "W9 the External AI Data-Use decision is ignored",
    file: PROJECTION,
    suite: PG,
    find: 'if (decision.disposition !== "authorized") {',
    replace: "if (false as boolean) {",
    because: "no attestation, no tenant authorization",
  },
];

function proveOne(m: Mutation): { label: string; bit: boolean; detail: string } {
  const before = read(m.file);
  const digest = sha(before);
  const n = before.split(m.find).length - 1;
  if (n !== 1) return { label: m.label, bit: false, detail: `anchor found ${n} times in ${m.file}` };
  let output = "";
  let ok = false;
  try {
    writeFileSync(abs(m.file), before.replace(m.find, m.replace), "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", m.suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
    output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    ok = r.status === 0;
  } finally {
    writeFileSync(abs(m.file), before, "utf8");
  }
  assert.equal(sha(read(m.file)), digest, `${m.label}: source restored byte-identically`);
  if (ok) return { label: m.label, bit: false, detail: "the suite PASSED against mutated source" };
  if (!output.includes(m.because)) return { label: m.label, bit: false, detail: `failed, but not for: ${m.because}` };
  return { label: m.label, bit: true, detail: `bit on: ${m.because}` };
}

const verdicts = MUTATIONS.map(proveOne);
for (const v of verdicts) console.log(`${v.bit ? "BIT " : "MISS"}  ${v.label} — ${v.detail}`);
const missed = verdicts.filter((v) => !v.bit);
assert.equal(missed.length, 0, `every guard must bite; missed: ${missed.map((v) => v.label).join(", ")}`);
console.log(`PASS wf1-origination-recommendation bite proofs (${verdicts.length}/${verdicts.length} bit)`);
