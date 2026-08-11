/*
 * heby-commands/parser.ts — THE Heby slash parser (S1). One classifier, both surfaces.
 *
 * ITS WHOLE JOB IS TO KEEP COMMANDS OFF THE MODEL PATH. Anything the operator types that begins
 * with "/" is classified here and can NEVER be returned as a prompt — not an unknown command, not a
 * command with bad arguments, not a command that looks like shell. Only ordinary conversational
 * text becomes a `prompt`, and a `prompt` is the only thing the conversation seam is able to
 * dispatch. That is a structural guarantee, not a check that has to be remembered.
 *
 * THIS IS NOT A SHELL. Arguments are positional and whitespace-separated, and that is the entire
 * grammar: no pipes, no redirects, no command substitution, no globbing, no quoting semantics, no
 * chaining. Input carrying shell metacharacters is rejected as unsafe rather than sanitized —
 * sanitizing implies the grammar was meant to accept it.
 *
 * Pure: no React, no server, no I/O, no authority.
 */

import {
  HEBY_PALETTE_COMMANDS,
  findHebyCommandBySlash,
} from "./registry";
import type { HebyCommandDescriptor } from "./contracts";

/**
 * Characters that only mean something in a shell. Heby has no shell, so their presence means the
 * input was written for a different machine — it is refused, not cleaned up.
 */
const SHELL_METACHARACTERS = /[|;&`$><\\]|\$\(|\$\{/;

export type HebyInputParse =
  /** Nothing to do — the input is blank. */
  | { readonly kind: "empty" }
  /** A recognized command with validated arguments. It NEVER reaches the model as a prompt. */
  | {
      readonly kind: "command";
      readonly command: HebyCommandDescriptor;
      readonly args: readonly string[];
    }
  /** Begins with "/" but is not a command. Deliberately NOT a prompt. */
  | { readonly kind: "unknown-command"; readonly typed: string }
  /** A real command, used wrongly. Still not a prompt — it dispatches nothing. */
  | {
      readonly kind: "invalid-arguments";
      readonly command: HebyCommandDescriptor;
      readonly message: string;
    }
  /** Shell-shaped input. Refused outright; nothing is executed, sent, or interpreted. */
  | { readonly kind: "unsafe-input"; readonly typed: string; readonly message: string }
  /** Ordinary conversational input — the ONLY kind the conversation authority can dispatch. */
  | { readonly kind: "prompt"; readonly prompt: string };

/**
 * Classify raw composer input.
 *
 * Everything after the "/" branch is guaranteed not to be a prompt, so no path through this
 * function can turn a slash command — known, unknown, malformed, or hostile — into a provider
 * request.
 */
export function parseHebyInput(raw: string): HebyInputParse {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: "empty" };
  if (!trimmed.startsWith("/")) return { kind: "prompt", prompt: trimmed };

  // ── Below this line the input begins with "/" and can never be returned as a prompt. ──

  if (SHELL_METACHARACTERS.test(trimmed)) {
    return {
      kind: "unsafe-input",
      typed: trimmed,
      message: "That looks like shell input. Heby's command line is not a terminal, so nothing was run or sent.",
    };
  }

  const tokens = trimmed.split(/\s+/);
  const slash = tokens[0]!.toLowerCase();
  const command = findHebyCommandBySlash(slash);
  if (!command) return { kind: "unknown-command", typed: trimmed };

  const rest = tokens.slice(1);
  const spec = command.args;

  if (spec.length === 0) {
    if (rest.length > 0) {
      return {
        kind: "invalid-arguments",
        command,
        message: `${command.slash} takes no arguments.`,
      };
    }
    return { kind: "command", command, args: [] };
  }

  // One token per argument, except the LAST argument, which absorbs the remainder — so
  // `/explain the authentication summary` is one item, not three, without inventing quoting.
  const args: string[] = [];
  for (let i = 0; i < spec.length; i++) {
    if (i === spec.length - 1) {
      const remainder = rest.slice(i).join(" ").trim();
      if (remainder.length > 0) args.push(remainder);
    } else if (rest[i] !== undefined) {
      args.push(rest[i]!);
    }
  }

  const missing = spec.filter((argument, index) => argument.required && args[index] === undefined);
  if (missing.length > 0) {
    const usage = `${command.slash} ${spec.map((a) => `<${a.name}>`).join(" ")}`;
    return {
      kind: "invalid-arguments",
      command,
      message: `${command.slash} needs ${missing.map((a) => `<${a.name}>`).join(" and ")}. Usage: ${usage}`,
    };
  }

  return { kind: "command", command, args };
}

/**
 * True when the composer should offer command discovery: the input is exactly "/" or a "/"-prefixed
 * token still being typed. Once a space is typed the operator is writing an argument, so the
 * palette closes. Used only to open the list — it dispatches nothing.
 */
export function isCommandPaletteInput(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.startsWith("/") && !trimmed.includes(" ");
}

/**
 * Commands matching a partially typed "/…" token, for the discovery palette. Aliases are excluded
 * (they still parse), and a bare "/" returns everything. An empty list means the palette shows
 * nothing rather than inventing a suggestion.
 */
export function matchHebyCommands(raw: string): readonly HebyCommandDescriptor[] {
  if (!isCommandPaletteInput(raw)) return [];
  const typed = raw.trim().slice(1).toLowerCase();
  if (typed.length === 0) return HEBY_PALETTE_COMMANDS;
  return HEBY_PALETTE_COMMANDS.filter((command) => command.id.startsWith(typed));
}

/** The full usage string for a command, including its argument names. */
export function commandUsage(command: HebyCommandDescriptor): string {
  if (command.args.length === 0) return command.slash;
  return `${command.slash} ${command.args.map((a) => `<${a.name}>`).join(" ")}`;
}

/** The honest response to an unrecognized command. Presentation copy — it dispatches nothing. */
export function unknownCommandLines(typed: string): readonly string[] {
  return [
    `“${typed}” is not a Heby command, so nothing was sent.`,
    "Type / to see the commands Heby supports.",
  ];
}
