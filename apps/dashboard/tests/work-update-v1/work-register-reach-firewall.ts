/*
 * WORK-UPDATE V1 (Option A) — THE WORK REGISTER IS NOT AN AI ORIGINATION SURFACE, PROVED BY REACH.
 *
 * WORK-1's own firewall bans a literal import specifier in each Work module. That is necessary and not
 * sufficient: a component one hop away can carry a model call into the Work route while every literal
 * check still passes (it happened, and this file is the guard). Here the VALUE-import graph is walked
 * transitively — static imports, re-exports and dynamic `import()` — from every Work module, and no
 * path may reach:
 *
 *   - agent origination (every module but its pure vocabulary, `contracts.ts`)
 *   - model generation and provider transport (`heby-model`, `heby-model-live`)
 *   - EAI disclosure authorization and its audit
 *   - any Heby server-action module (the Heby route's boundaries)
 *
 * WHAT STAYS ALLOWED, and is asserted to stay reachable so the walk is not vacuous: the deterministic
 * GIA-1 action inlet and the one writer behind it (which read the mandate), and the Work Authority's
 * own read seams. A positive control proves the walker finds the real chain from Heby's origination
 * boundary to the model, so a broken resolver cannot pass this file by finding nothing.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

function valueEdges(file: string): string[] {
  const code = strip(read(file));
  const statics = [...code.matchAll(/^\s*(?:import|export)\s+(?!type\s)[\s\S]*?from\s*["']([^"']+)["']/gm)].map((m) => m[1]!);
  const bare = [...code.matchAll(/^\s*import\s+["']([^"']+)["']/gm)].map((m) => m[1]!);
  const dynamic = [...code.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]!);
  return [...statics, ...bare, ...dynamic];
}

function resolveSpecifier(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.join(path.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    const p = path.join(ROOT, c);
    if (existsSync(p) && statSync(p).isFile()) return c;
  }
  /* An unresolvable app-local specifier would make the walk silently incomplete. */
  throw new Error(`unresolved import ${spec} in ${from}`);
}

/** Every reachable module, each with the module that first reached it (for a readable chain). */
function reach(entry: string): Map<string, string | null> {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const f = queue.shift()!;
    for (const spec of valueEdges(f)) {
      const r = resolveSpecifier(f, spec);
      if (r && !parent.has(r)) {
        parent.set(r, f);
        queue.push(r);
      }
    }
  }
  return parent;
}
const chain = (graph: Map<string, string | null>, f: string) => {
  const out: string[] = [];
  for (let c: string | null | undefined = f; c; c = graph.get(c)) out.unshift(c);
  return out.join(" → ");
};

const FORBIDDEN: readonly { readonly label: string; readonly test: (f: string) => boolean }[] = [
  {
    label: "agent origination",
    test: (f) => f.startsWith("src/features/agent-origination/") && f !== "src/features/agent-origination/contracts.ts",
  },
  { label: "model generation", test: (f) => f.startsWith("src/features/heby-model/") },
  { label: "provider transport", test: (f) => f.startsWith("src/features/heby-model-live/") },
  {
    label: "EAI disclosure authorization",
    test: (f) =>
      [
        "src/features/external-ai-data-use/authorize-external-ai-disclosure.server.ts",
        "src/features/external-ai-data-use/compose-external-ai-disclosure.ts",
        "src/features/governance-audit/external-ai-disclosure-audit.server.ts",
      ].includes(f),
  },
  { label: "a Heby server action", test: (f) => f.startsWith("src/app/(dashboard)/heby/") },
];

const PANEL = "src/components/organizational-work/work-register.tsx";
const ACTIONS = "src/app/(dashboard)/director/work/actions.ts";
const PAGE = "src/app/(dashboard)/director/work/page.tsx";
const WORK_ENTRIES = [PANEL, ACTIONS, PAGE, ...walk("src/features/organizational-work")];

/* ═══ 1. NO WORK MODULE REACHES ORIGINATION, MODEL, TRANSPORT OR DISCLOSURE ═══ */
for (const entry of WORK_ENTRIES) {
  const graph = reach(entry);
  for (const f of graph.keys()) {
    for (const rule of FORBIDDEN) {
      assert.ok(!rule.test(f), `R1: ${entry} must not reach ${rule.label}: ${chain(graph, f)}`);
    }
  }
}

/* The vocabulary the writer shares is pure: the one allowed agent-origination module reaches none of the above. */
{
  const vocabulary = reach("src/features/agent-origination/contracts.ts");
  for (const f of vocabulary.keys()) {
    for (const rule of FORBIDDEN) assert.ok(!rule.test(f), `R1: the shared vocabulary must not reach ${rule.label}: ${chain(vocabulary, f)}`);
  }
}

/* ═══ 2. THE LEGITIMATE DETERMINISTIC SEAMS ARE STILL THERE (the walk is not vacuous) ═══ */
{
  const panel = reach(PANEL);
  for (const allowed of [
    ACTIONS,
    "src/features/heby-action-inlet/record-work-proposal.server.ts",
    "src/features/action-authorization/record-action-request.server.ts",
  ]) {
    assert.ok(panel.has(allowed), `R2: the Work register still reaches its deterministic seam ${allowed}`);
  }
  /* The link is the whole integration: a path, an encoded key, no component and no action. */
  const code = strip(read(PANEL));
  assert.match(code, /href=\{`\/heby\?workItem=\$\{encodeURIComponent\(item\.workItemId\)\}`\}/, "R2: the Work register offers a plain link to Heby");
  assert.ok(!code.includes("heby-work-state-affordance") && !code.includes("HebyWorkStateAffordance"), "R2: the Heby component is not rendered in Work");
  assert.ok(!/@\/components\/layout\/heby/.test(code), "R2: the Work register imports no Heby component");
}

/* ═══ 3. POSITIVE CONTROL: the same walker finds the real chain where it legitimately exists ═══ */
{
  const heby = reach("src/app/(dashboard)/heby/work-state-origination-actions.ts");
  for (const must of [
    "src/features/agent-origination/originate-work-state.server.ts",
    "src/features/heby-model/index.ts",
    "src/features/external-ai-data-use/authorize-external-ai-disclosure.server.ts",
  ]) {
    assert.ok(heby.has(must), `R3: the walker reaches ${must} from Heby's origination boundary`);
  }
  /* The affordance lives on the Heby route: /heby reaches it through the selection card. */
  const page = reach("src/app/(dashboard)/heby/page.tsx");
  assert.ok(page.has("src/components/layout/heby/heby-work-state-affordance.tsx"), "R3: /heby renders the affordance");
  assert.ok(page.has("src/app/(dashboard)/heby/work-state-origination-actions.ts"), "R3: and its boundary");
  /* Exactly one product file renders it: the Heby selection card. */
  const renderers = walk("src").filter((f) => /<HebyWorkStateAffordance\b/.test(strip(read(f))));
  assert.deepEqual(renderers, ["src/components/layout/heby/heby-work-state-selection.tsx"], "R3: the affordance is rendered only inside Heby");
}

/* ═══ 4. THE SELECTION IS A KEY, RESOLVED FOR THE SESSION ═══ */
{
  const page = strip(read("src/app/(dashboard)/heby/page.tsx"));
  assert.match(page, /readWorkStateSelection\(await resolveTenantContext\(\), rawWorkItem\)/, "R4: the item is resolved for the session's tenant");
  const inlet = strip(read("src/features/heby-action-inlet/work-state-proposal.server.ts"));
  const fn = inlet.slice(inlet.indexOf("export async function readWorkStateSelection("));
  assert.match(fn, /readWorkStateTarget\(tenant, workItemId,/, "R4: through the Work Authority's tenant-scoped read");
  assert.ok(!/\.(insert|update|delete)\(|generate|deps\.preflight/.test(fn), "R4: the selection read writes nothing and asks no model");
}

console.log("work-update-v1/work-register-reach-firewall: OK");
