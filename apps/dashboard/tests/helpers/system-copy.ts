/*
 * EAI-SYSTEM-COPY-INTO-CONVERSATION-1 — the one rule, as a pure function both the contract and its
 * bite-proofs call.
 *
 * An instruction field is the human's words, and it leaves for the provider as `conversation`. So the
 * only values its setter may receive are what the human typed and the empty string. Anything else —
 * a Governance justification, a work title, a server read — is system-owned data relabelled as
 * conversation, whichever handler, effect or initial state put it there.
 */
import { codeOf } from "./durable-write-detector";

const TYPED = /^(?:e|ev|event)\.target\.value$/;

export function systemCopyViolations(source: string): string[] {
  const code = codeOf(source);
  const violations: string[] = [];
  for (const match of code.matchAll(/\bsetInstruction\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    const arg = match[1].trim();
    if (arg !== '""' && arg !== "''" && !TYPED.test(arg)) violations.push(`setInstruction(${arg})`);
  }
  for (const match of code.matchAll(/\[\s*instruction\s*,\s*setInstruction\s*\]\s*=\s*useState(?:<[^>]*>)?\(([^)]*)\)/g)) {
    if (match[1].trim() !== '""') violations.push(`useState(${match[1].trim()})`);
  }
  /* A justification read may be RENDERED; it may never appear inside a value the form submits. */
  if (/\bprompt\s*:[^\n]*justification/.test(code)) violations.push("prompt built from a justification");
  return violations;
}
