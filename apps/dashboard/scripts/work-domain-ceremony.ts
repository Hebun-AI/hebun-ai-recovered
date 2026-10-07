/*
 * Work domain ceremony — OPERATOR CLI (AP-4A).
 *
 *   npm run platform:work-domain -- --tenant=<slug>                                         # list (read-only)
 *   npm run platform:work-domain -- --tenant=<slug> --create --slug=<slug> --name="<name>"  # dry run
 *   npm run platform:work-domain -- --tenant=<slug> --rename --slug=<slug> --name="<name>"  # dry run
 *   npm run platform:work-domain -- --tenant=<slug> --retire --slug=<slug>                  # dry run
 *   ... add --confirm to write (an interactive confirmation phrase follows)
 *
 * Release A has no product surface for work domains; this is the only door, and it goes through the
 * released Work Domain Authority writer, which re-checks that the named human holds THIS tenant's
 * Governance authority. A slug is permanent: it is never changed and never reused, retired or not.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";

const KNOWN_FLAGS = ["tenant", "director", "create", "rename", "retire", "slug", "name", "confirm"];
const CONFIRMATION = "RECORD WORK DOMAIN";

function fail(message: string): never {
  throw new Error(message);
}
function arg(name: string): string | undefined {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3) : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

function promptVisible(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") fail("this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
  for (const a of process.argv.slice(2)) {
    const name = a.replace(/^--/, "").split("=")[0]!;
    if (!a.startsWith("--") || !KNOWN_FLAGS.includes(name)) fail(`unknown argument "${a}"`);
  }
  const tenantSlug = arg("tenant") ?? fail("--tenant=<slug> is required");
  const email = arg("director") ?? "senoltr@gmail.com";
  const verbs = (["create", "rename", "retire"] as const).filter(has);
  if (verbs.length > 1) fail("choose at most one of --create, --rename, --retire");
  const verb = verbs[0] ?? null;
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

  await import("../src/db/client.server");
  const { resolveOperatorTenantContext } = await import("./lib/operator-tenant-context");
  const { readWorkDomains } = await import("../src/features/work-domain/read-work-domains.server");
  const { recordWorkDomain, renameWorkDomain, retireWorkDomain } = await import("../src/features/work-domain/write-work-domain.server");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const who = await resolveOperatorTenantContext(client, { tenantSlug, email, requestId: "ap4a-work-domain-ceremony" });
    if (!who) fail(`no active membership for ${email} in organization "${tenantSlug}"`);
    const listed = await readWorkDomains(who.tenant);
    if (listed.status !== "read") fail(`work domains could not be read (${listed.reason}). Nothing was changed.`);

    console.log(`\n  WORK DOMAINS — ${who.company} (${tenantSlug})`);
    if (listed.workDomains.length === 0) console.log("    (none recorded)");
    for (const d of listed.workDomains) console.log(`    ${d.slug.padEnd(28)} ${d.inService ? "in service" : "RETIRED   "}  ${d.name}`);
    console.log("");
    if (!verb) return;

    const slug = arg("slug") ?? fail("--slug=<slug> is required");
    const name = arg("name");
    const existing = listed.workDomains.find((d) => d.slug === slug);
    if (verb === "create") {
      if (!name) fail("--name is required for --create");
      if (existing) fail(`the slug "${slug}" is already used in this organization (${existing.inService ? "in service" : "retired"}); slugs are never reused.`);
      console.log(`  requested : CREATE ${slug} — "${name}"`);
    } else {
      if (!existing) fail(`no work domain "${slug}" in this organization`);
      if (verb === "rename") {
        if (!name) fail("--name is required for --rename");
        console.log(`  requested : RENAME ${slug} — "${existing.name}" -> "${name}" (the slug does not change)`);
      } else {
        console.log(`  requested : RETIRE ${slug} — permanent; the slug stays reserved; work and responsibilities keep their history`);
      }
    }
    console.log("  It grants no responsibility and changes no department, mandate or work item.\n");
    if (!has("confirm")) {
      console.log("  DRY RUN — nothing was written. Re-run with --confirm to proceed.\n");
      return;
    }
    if (!process.stdin.isTTY) fail("--confirm requires an interactive terminal. Nothing was written.");
    if ((await promptVisible(`  Type ${CONFIRMATION} to proceed: `)) !== CONFIRMATION) fail("not confirmed — nothing was written.");

    const written =
      verb === "create"
        ? await recordWorkDomain(who.tenant, { slug, name: name! })
        : verb === "rename"
          ? await renameWorkDomain(who.tenant, { workDomainId: existing!.workDomainId, name: name! })
          : await retireWorkDomain(who.tenant, { workDomainId: existing!.workDomainId });
    if (written.status !== "recorded") fail(`refused: ${written.reason}. Nothing was changed.`);
    console.log(`\n  ✔ ${written.workDomain.slug} · ${written.workDomain.workDomainId} · ${written.workDomain.inService ? "in service" : "retired"} · "${written.workDomain.name}"\n`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n  ✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
