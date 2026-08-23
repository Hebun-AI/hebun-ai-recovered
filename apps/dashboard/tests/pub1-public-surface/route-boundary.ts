/*
 * PUB-1 — the PUBLIC surface boundary.
 *
 * The public site made four documents reachable without a session. Every assertion below is about
 * what did NOT happen as a result:
 *
 *   - the product did not become public: no dashboard route is reachable through either list, and
 *     `/` is matched by EQUALITY so no prefix rewrite can turn it into a blanket exemption
 *   - the public surface holds no server authority: its whole import closure contains no `.server`
 *     module, no database handle, no credential authority and no provider transport
 *   - the public surface did not reuse the authenticated shell
 *   - the public copy claims nothing the PUB-0 inventory withheld
 *   - the public site is indexable and the product is not
 *
 * Runtime auth behaviour is owned by the dashboard layout and is proved elsewhere. These are the
 * structural claims that make the runtime one possible.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PUBLIC_INDEXABLE_PATHS, PUBLIC_SITE_ORIGIN } from "../../src/config/public-site";

const ROOT = process.cwd();
const abs = (p: string) => path.join(ROOT, p);
const read = (p: string) => readFileSync(abs(p), "utf8");

/** Source with comments stripped: assertions are about CODE and COPY, not about prose ABOUT them. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const absolute = abs(dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return collect(rel, ext);
    return ext.test(entry.name) ? [rel] : [];
  });
}

/** Every import specifier in one module, in source order. */
function importsOf(source: string): string[] {
  const out: string[] = [];
  for (const [, spec] of source.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)) out.push(spec);
  return out;
}

/**
 * Resolve one specifier to a repository path, or null when it leaves the repository (a package).
 *
 * `@/x` is the repository's own alias for `src/x`. A relative specifier resolves against the
 * importing file. Both may need an extension or an `/index` added, exactly as the bundler does.
 */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.posix.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(abs(candidate)) && /\.tsx?$/.test(candidate)) return candidate;
  }
  return null;
}

/** Every repository module the given entrypoints can reach, transitively. */
function importClosure(entrypoints: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entrypoints];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of importsOf(read(file))) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

const MIDDLEWARE = "src/middleware.ts";
const PUBLIC_APP = "src/app/(public)";
const PUBLIC_COMPONENTS = "src/components/public";

function listOf(source: string, name: string): string[] {
  const match = new RegExp(`const ${name} = (?:Object\\.freeze\\()?\\[([^\\]]*)\\]`).exec(source);
  assert.ok(match, `${name} must be declared as an array literal so it can be pinned`);
  return match![1]!
    .split(",")
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter((entry) => entry.length > 0);
}

function main(): void {
  const middleware = read(MIDDLEWARE);
  const prefixes = listOf(middleware, "PUBLIC_PREFIXES");
  const exact = listOf(middleware, "PUBLIC_EXACT_PATHS");

  /* ── 1–4. THE FOUR PUBLIC DOCUMENTS EXIST AND ARE LET THROUGH ──────────── */
  {
    assert.ok(existsSync(abs(`${PUBLIC_APP}/page.tsx`)), "/ must be served by the public route group");
    assert.ok(
      !existsSync(abs("src/app/page.tsx")),
      "the old root redirect must be gone — two files cannot both serve /",
    );
    assert.ok(exact.includes("/"), "/ must be public at the edge gate");

    for (const route of ["contact", "privacy", "terms"]) {
      assert.ok(
        existsSync(abs(`${PUBLIC_APP}/${route}/page.tsx`)),
        `/${route} must be served by the public route group`,
      );
      assert.ok(prefixes.includes(`/${route}`), `/${route} must be public at the edge gate`);
    }

    /* The legal documents kept their URLs; only their location in the tree changed. */
    assert.ok(!existsSync(abs("src/app/privacy")), "/privacy must no longer be served outside the public group");
    assert.ok(!existsSync(abs("src/app/terms")), "/terms must no longer be served outside the public group");
  }

  /* ── 5–7. THE PRODUCT DID NOT BECOME PUBLIC ────────────────────────────── */
  {
    for (const route of ["command", "integrations", "dashboard", "governance", "knowledge", "heby"]) {
      assert.ok(
        existsSync(abs(`src/app/(dashboard)/${route}/page.tsx`)),
        `/${route} must still be a dashboard route for this assertion to mean anything`,
      );
      assert.ok(
        !prefixes.includes(`/${route}`) && !exact.includes(`/${route}`),
        `/${route} must not be public`,
      );
    }

    /* Not one entry of either list names a surface under the authenticated group. */
    for (const entry of prefixes) {
      assert.ok(entry.length > 1, `"${entry}" is too short to be a safe prefix`);
      assert.ok(
        !existsSync(abs(`src/app/(dashboard)${entry}`)),
        `${entry} must not be a dashboard route — the dashboard did not become public`,
      );
    }
    assert.deepEqual(exact, ["/"], "the exact-match public list is closed at the public homepage");
    assert.ok(
      !existsSync(abs("src/app/(dashboard)/page.tsx")),
      "the dashboard group must not claim / — that is the public homepage",
    );

    /* `/` is matched by EQUALITY. A prefix entry of "/" would exempt everything under a rewrite. */
    assert.ok(
      !prefixes.includes("/"),
      "/ must never be a PREFIX — as a prefix it becomes a blanket exemption",
    );
    assert.match(
      codeOf(middleware),
      /PUBLIC_EXACT_PATHS\.includes\(pathname\)/,
      "the exact list must be consumed by equality, never by startsWith",
    );
  }

  /* ── 8 + 9. THE PUBLIC IMPORT CLOSURE HOLDS NO AUTHORITY ───────────────── */
  {
    const entrypoints = [...collect(PUBLIC_APP), ...collect(PUBLIC_COMPONENTS)];
    assert.ok(entrypoints.length >= 6, "the public surface must actually have files to walk");
    const closure = importClosure(entrypoints);

    for (const file of closure) {
      assert.ok(
        !file.startsWith("src/components/layout/"),
        `the public surface reaches the authenticated shell through ${file}`,
      );
      assert.ok(
        !/\.server\.tsx?$/.test(file),
        `the public surface reaches a server authority: ${file}`,
      );
      assert.ok(!file.startsWith("src/db/"), `the public surface reaches the database through ${file}`);
      for (const forbidden of [
        "src/features/integration-credentials/",
        "src/features/secret-encryption/",
        "src/features/provider-google/",
        "src/features/integration-authority/",
        "src/features/auth-runtime/",
        "src/features/auth/",
      ]) {
        assert.ok(
          !file.startsWith(forbidden),
          `the public surface reaches ${forbidden} through ${file}`,
        );
      }
    }

    /* Stated as a property too, so an empty closure could never pass this section vacuously. */
    assert.ok(
      closure.has("src/features/public-claims/capability-claims.ts"),
      "the public surface must render its claims from the public claim contract",
    );
  }

  /* ── 10. NO PUBLIC LAYOUT MAY BE A SECOND DOCUMENT ROOT ────────────────── */
  {
    const layout = codeOf(read(`${PUBLIC_APP}/layout.tsx`));
    assert.ok(!/<html\b/.test(layout), "the public layout must not open a second <html>");
    assert.ok(!/<body\b/.test(layout), "the public layout must not open a second <body>");
    const root = read("src/app/layout.tsx");
    assert.match(root, /<html\b/, "the root layout remains the sole document authority");

    /* One <main> in the document: the layout's. No public page may open its own. */
    assert.match(layout, /<main\b/, "the public layout owns the main landmark");
    for (const page of collect(PUBLIC_APP).filter((f) => f.endsWith("page.tsx"))) {
      assert.ok(!/<main\b/.test(codeOf(read(page))), `${page} must not open a second <main>`);
      assert.ok(
        !/<header\b/.test(codeOf(read(page))),
        `${page} must not open a second banner beside the site header`,
      );
    }
  }

  /* ── 11. THE SEO FOUNDATION IS HONEST, AND THE PRODUCT STAYS UNINDEXED ─── */
  {
    assert.ok(existsSync(abs("src/app/robots.ts")), "robots.ts must exist");
    assert.ok(existsSync(abs("src/app/sitemap.ts")), "sitemap.ts must exist");

    const robots = codeOf(read("src/app/robots.ts"));
    assert.match(robots, /disallow:\s*"\/"/, "robots must disallow everything by default");
    assert.match(robots, /path === "\/" \? "\/\$" : path/, "the root allow rule must be anchored with $");
    /* The lookbehind matters: without it this pattern matches the tail of `disallow: "/"`. */
    assert.ok(
      !/(?<![A-Za-z])allow:\s*"\/"/.test(robots),
      "a bare Allow: / is a prefix rule that re-opens the whole product",
    );

    assert.deepEqual(
      [...PUBLIC_INDEXABLE_PATHS],
      ["/", "/contact", "/privacy", "/terms"],
      "the indexable set is closed at the four public documents",
    );
    assert.ok(
      !PUBLIC_INDEXABLE_PATHS.includes("/login"),
      "the sign-in form is not a document to arrive at from a search result",
    );
    for (const p of PUBLIC_INDEXABLE_PATHS) {
      assert.ok(
        p === "/" ? exact.includes("/") : prefixes.includes(p),
        `${p} is advertised as indexable but is not public at the edge gate`,
      );
    }

    /*
     * The origin names the organization, not the deployment. `hebun-ai-recovered.vercel.app` still
     * serves this same build, so it is reachable — but it is a Vercel project address that would
     * outlive its own truth the moment the project is renamed, and a canonical URL is an identity
     * claim, not a routing hint. The apex is excluded for the opposite reason: it answers 308 to
     * the `www` host, so naming it here would advertise a URL that is never the final one.
     */
    assert.equal(
      PUBLIC_SITE_ORIGIN,
      "https://www.hebuntech.com",
      "the public origin is the canonical organizational host",
    );
    assert.ok(
      !PUBLIC_SITE_ORIGIN.includes("vercel.app"),
      "a deployment address may not be published as organizational identity",
    );
    assert.match(PUBLIC_SITE_ORIGIN, /^https:\/\//, "the public origin must be absolute and https");

    const layout = read(`${PUBLIC_APP}/layout.tsx`);
    assert.match(layout, /metadataBase:\s*new URL\(PUBLIC_SITE_ORIGIN\)/, "metadataBase must be declared");
    /* No social image exists that would not be either real tenant data or an invention. */
    const publicSource = [...collect(PUBLIC_APP), ...collect(PUBLIC_COMPONENTS)].map(read).join("\n");
    assert.ok(!/openGraph[\s\S]{0,400}?images:/.test(publicSource), "no Open Graph image may be declared");
    assert.ok(!/<img\b/.test(codeOf(publicSource)), "the public site renders no raster imagery");
    assert.ok(!/next\/image/.test(codeOf(publicSource)), "the public site renders no raster imagery");
  }

  /* ── 12. NO FABRICATED PROOF, AND NO WITHHELD CLAIM ────────────────────── */
  {
    const copy = codeOf(
      [...collect(PUBLIC_APP), ...collect(PUBLIC_COMPONENTS), "src/features/public-claims/capability-claims.ts"]
        .map(read)
        .join("\n"),
    );

    /*
     * PHRASES, not words. A word ban fails on the product's own honest denial — the page says
     * "no semantic matching" and "no Drive write", and a ban on "semantic" or "write" would flag
     * exactly the sentences that make the page truthful. Each entry below is a CLAIM that could
     * only be made, never denied, in these words.
     */
    const FORBIDDEN: readonly (readonly [RegExp, string])[] = [
      [/\bAI agents?\b/i, "agents are seeded fixtures, not a capability"],
      [/\bdigital (?:worker|employee)/i, "there is no workforce runtime"],
      [/\borchestrat/i, "orchestration runs on deterministic fixtures"],
      [/computer use/i, "the Computer Use adapter is simulation only"],
      [/browser automation/i, "the Browser adapter is simulation only"],
      [/knowledge graph/i, "knowledge_edges has no writer and no reader"],
      [/semantic search/i, "no semantic retrieval exists"],
      [/\bvector (?:store|search|database)/i, "no vector store exists"],
      [/organizational intelligence/i, "the modules are descriptor-only"],
      [/\bautonomous(?:ly)?\b/i, "nothing acts on its own initiative"],
      [/\bcopilot\b/i, "not a claim this product can make"],
      [/enterprise-grade/i, "an adjective, not a mechanism"],
      [/military-grade/i, "an adjective, not a mechanism"],
      [/bank-level/i, "an adjective, not a mechanism"],
      [/zero.trust/i, "an adjective, not a mechanism"],
      [/end-to-end encrypt/i, "credentials are encrypted at rest, not end to end"],
      [/\bSOC ?2\b/i, "no certification is held"],
      [/ISO ?27001/i, "no certification is held"],
      [/\bHIPAA\b|\bPCI DSS\b/i, "no certification is held"],
      [/\bGDPR[- ]compliant/i, "no certification is held"],
      [/penetration test/i, "no such assessment is published"],
      [/trusted by/i, "no customer may be named"],
      [/\btestimonial/i, "no testimonial exists"],
      [/customer logos?/i, "no customer may be named"],
      [/free trial|start free|sign up free/i, "there is no self-serve sign-up"],
      [/book a demo|schedule a demo/i, "no scheduling exists"],
      [/\bpricing\b/i, "no pricing exists"],
      [/powered by (?:claude|anthropic|gpt|openai)/i, "the live model path is not armed in production"],
      [/\bratif/i, "ratification is withheld until production reachability is re-proven"],
    ];
    for (const [pattern, why] of FORBIDDEN) {
      const hit = pattern.exec(copy);
      assert.equal(hit, null, `public copy claims ${JSON.stringify(hit?.[0])}: ${why}`);
    }

    /* No fabricated number. A percentage or an inflated count is a metric nobody measured. */
    const metric = /\b\d[\d,.]*\s*%|\b\d[\d,]{2,}\+/.exec(copy);
    assert.equal(metric, null, `public copy carries a fabricated metric: ${JSON.stringify(metric?.[0])}`);

    /* The count PUB-1 removed on purpose: a published tally needs marketing maintenance. */
    assert.ok(
      !/\bten (?:classes|kinds)\b/i.test(copy),
      "a published count of audit act classes is brittle — say that governed acts write durable records",
    );
    assert.match(
      copy,
      /Governed acts write durable audit records/,
      "the durable wording must be the one that ships",
    );
  }

  /* ── 13. THE ONE CALL TO ACTION LEADS TO A PAGE, NOT TO A PIPELINE ─────── */
  {
    const contact = codeOf(read(`${PUBLIC_APP}/contact/page.tsx`));
    assert.match(contact, /mailto:\$\{CONTACT_EMAIL\}/, "the contact page must expose the address");
    assert.match(contact, /hebuntech@gmail\.com/, "the address is the one the Director named");
    for (const forbidden of [/<form\b/, /<input\b/, /<textarea\b/, /"use server"/, /useState/]) {
      assert.ok(!forbidden.test(contact), `the contact page must hold no form: ${forbidden}`);
    }
    const cta = codeOf(read("src/components/public/request-access-link.tsx"));
    assert.match(cta, /href="\/contact"/, "Request access must lead to /contact");

    const home = codeOf(read(`${PUBLIC_APP}/page.tsx`));
    assert.ok(!/redirect\(/.test(home), "/ must not redirect — it is the public homepage");
    assert.ok(
      !/(getAuthEnvironment|resolveRequestAuthentication|resolveTenantContext|cookies\(\))/.test(home),
      "/ must not look at the reader — a signed-in visitor sees the same page",
    );
  }

  console.log("PUB-1 public surface boundary: ok");
}

main();
