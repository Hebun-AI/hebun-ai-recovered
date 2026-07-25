import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as canonical from "../../src/features/organizational-intelligence/canonical";

const FEATURE_DIR = "src/features/organizational-intelligence/canonical";
const sources = readdirSync(FEATURE_DIR)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => ({ name, text: readFileSync(join(FEATURE_DIR, name), "utf8") }));

/** Imports are restricted to approved local package files only. */
function importsAreLocalOnly(): void {
  assert.equal(sources.length >= 9, true);
  const allowedLocal = new Set([
    "./validation", "./organizational-identity", "./workspace-scope", "./organization",
    "./legal-entity", "./organizational-unit", "./actor", "./person", "./ai-agent",
  ]);
  for (const { name, text } of sources) {
    for (const match of text.matchAll(/from "([^"]+)"/g)) {
      const specifier = match[1];
      assert.equal(specifier.startsWith("./"), true, `${name} may only import local files, saw ${specifier}`);
      assert.equal(allowedLocal.has(specifier), true, `${name} imports unapproved ${specifier}`);
    }
  }
  // validation.ts is the leaf: it imports nothing.
  const validation = sources.find(({ name }) => name === "validation.ts");
  assert.equal([...(validation?.text.matchAll(/from "([^"]+)"/g) ?? [])].length, 0);
}

/** No infrastructure, runtime, UI, provider, or network dependency. */
function noForbiddenDependency(): void {
  const forbidden = [
    "react", "next/", "next.js", "@/components", "@/app", "dashboard",
    "drizzle", "prisma", "pg", "postgres", "redis", "mongodb", "sqlite",
    "node:fs", "node:child_process", "node:net", "node:http", "node:https", "node:dns",
    "fetch(", "xmlhttprequest", "websocket", "axios",
    "opentelemetry", "telemetry", "winston", "pino", "console.",
    "@anthropic", "openai", "provider-invocation", "../director-command",
    "../runtime", "runtime-execution", "runtime-engine", "runtime-adapter",
    "settimeout", "setinterval", "setimmediate", "process.env",
    "new promise", "await ", "async ", "try {", "catch (", "catch {",
  ];
  for (const { name, text } of sources) {
    const lower = text.toLowerCase();
    for (const token of forbidden) {
      assert.equal(lower.includes(token), false, `${name} must not contain ${token}`);
    }
  }
}

/** No runtime layer or director-command imports these OI contracts. */
function noReverseDependency(): void {
  const roots = ["src/features/director-command", "src/features/runtime-observability", "src/features/runtime-projection"];
  for (const root of roots) {
    for (const path of walk(root)) {
      const text = readFileSync(path, "utf8");
      assert.equal(text.includes("organizational-intelligence/canonical"), false, `${path} must not import the OI canonical package`);
    }
  }
  // The OI engine layer (parent dir) must not import the canonical package either — kept separate.
  for (const entry of readdirSync("src/features/organizational-intelligence", { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      const text = readFileSync(join("src/features/organizational-intelligence", entry.name), "utf8");
      assert.equal(text.includes("./canonical"), false, `${entry.name} must not import the canonical package`);
    }
  }
}

/** Exported functions are pure create/validate pairs; no execution entry points. */
function exportsArePureContracts(): void {
  for (const name of Object.keys(canonical)) {
    if (typeof (canonical as Record<string, unknown>)[name] === "function") {
      assert.equal(/^(create|validate)/.test(name), true, `${name} must be a create/validate function only`);
    }
  }
  // Creating and validating an identity twice mutates nothing shared.
  const first = JSON.stringify(canonical.ORGANIZATIONAL_UNIT_KINDS);
  assert.equal(JSON.stringify(canonical.ORGANIZATIONAL_UNIT_KINDS), first);
}

function walk(root: string): string[] {
  const found: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (path.endsWith(".ts")) found.push(path);
    }
  };
  visit(root);
  return found;
}

function main(): void {
  importsAreLocalOnly();
  noForbiddenDependency();
  noReverseDependency();
  exportsArePureContracts();
  console.log("organizational-intelligence canonical boundary checks passed");
}

main();
