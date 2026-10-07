/*
 * Agent mandate responsibility ceremony — OPERATOR CLI (AP-4A).
 *
 *   npm run platform:mandate-responsibility -- --tenant=<slug> --agent=<agentId>                         # show
 *   npm run platform:mandate-responsibility -- --tenant=<slug> --agent=<agentId> --domain=<slug> [...]   # dry run
 *   npm run platform:mandate-responsibility -- --tenant=<slug> --agent=<agentId> --organization          # dry run
 *   ... add --confirm to write (an interactive confirmation phrase follows)
 *
 * Writes ONE new mandate revision through the Agent Mandate Authority's responsibility-aware contract.
 * The new revision RE-STATES the effective revision's purpose and scope exactly — this ceremony takes
 * neither as input, so it cannot drop `send` or `record-work` — and adds the stated responsibility.
 * Organization-level responsibility is granted only by `--organization`; it covers no work domain.
 * The writer re-checks Governance authority, the domains (this tenant, in service) and the scope rule.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";

const KNOWN_FLAGS = ["tenant", "director", "agent", "domain", "organization", "justification", "confirm"];
const CONFIRMATION = "GRANT RESPONSIBILITY";

function fail(message: string): never {
  throw new Error(message);
}
function arg(name: string): string | undefined {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3) : undefined;
}
const args = (name: string) => process.argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
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
    if (!a.startsWith("--") || !KNOWN_FLAGS.includes(name)) fail(`unknown argument "${a}" — purpose and scope are re-stated, never options`);
  }
  const tenantSlug = arg("tenant") ?? fail("--tenant=<slug> is required");
  const agentId = arg("agent") ?? fail("--agent=<agentId> is required");
  const email = arg("director") ?? "senoltr@gmail.com";
  const domainSlugs = args("domain");
  const organization = has("organization");
  const granting = organization || domainSlugs.length > 0;
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

  await import("../src/db/client.server");
  const { resolveOperatorTenantContext } = await import("./lib/operator-tenant-context");
  const { readWorkDomains } = await import("../src/features/work-domain/read-work-domains.server");
  const { readEffectiveMandateResponsibility } = await import("../src/features/agent-mandate/read-agent-mandate-responsibility.server");
  const { establishAgentMandateWithResponsibility } = await import("../src/features/agent-mandate/establish-agent-mandate.server");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const who = await resolveOperatorTenantContext(client, { tenantSlug, email, requestId: "ap4a-mandate-responsibility-ceremony" });
    if (!who) fail(`no active membership for ${email} in organization "${tenantSlug}"`);
    const current = await readEffectiveMandateResponsibility(who.tenant, agentId);
    if (current.status !== "read") fail(`the mandate could not be read (${current.reason}). Nothing was changed.`);
    if (!current.mandate) fail("this agent has no mandate in this organization. Nothing was changed.");
    const m = current.mandate;

    console.log(`\n  AGENT MANDATE RESPONSIBILITY — ${who.company} (${tenantSlug})`);
    console.log(`  agent        : ${agentId}`);
    console.log(`  effective    : revision ${m.mandateRevision} · scope [${m.proposalScope.join(", ")}]`);
    console.log(
      `  responsibility: ${current.responsibility.length === 0 ? "UNDECLARED" : current.responsibility.map((r) => (r.kind === "organization" ? "organization-level" : `${r.slug}${r.inService ? "" : " (RETIRED)"}`)).join(", ")}`,
    );
    if (!granting) {
      console.log("");
      return;
    }

    const listed = await readWorkDomains(who.tenant);
    if (listed.status !== "read") fail(`work domains could not be read (${listed.reason}). Nothing was changed.`);
    const responsibility = [
      ...(organization ? [{ kind: "organization" as const }] : []),
      ...domainSlugs.map((slug) => {
        const d = listed.workDomains.find((x) => x.slug === slug) ?? fail(`no work domain "${slug}" in this organization`);
        if (!d.inService) fail(`work domain "${slug}" is retired and cannot be granted`);
        return { kind: "domain" as const, workDomainId: d.workDomainId };
      }),
    ];
    const justification =
      arg("justification") ??
      "Governance states which kinds of work this agent is responsible for recording, without changing what it may propose.";

    console.log(`  requested    : revision ${m.mandateRevision + 1} · scope [${m.proposalScope.join(", ")}] (re-stated, unchanged)`);
    console.log(`                 responsibility ${[...(organization ? ["organization-level"] : []), ...domainSlugs].join(", ")}`);
    console.log("  It changes no department, placement, work item or Release A runtime behaviour.\n");
    if (!has("confirm")) {
      console.log("  DRY RUN — nothing was written. Re-run with --confirm to proceed.\n");
      return;
    }
    if (!process.stdin.isTTY) fail("--confirm requires an interactive terminal. Nothing was written.");
    if ((await promptVisible(`  Type ${CONFIRMATION} to proceed: `)) !== CONFIRMATION) fail("not confirmed — nothing was written.");

    const written = await establishAgentMandateWithResponsibility(who.tenant, {
      agentId,
      purpose: m.purpose,
      proposalScope: m.proposalScope,
      justification,
      observedMandateRevision: m.mandateRevision,
      responsibility,
    });
    if (written.status !== "established") fail(`refused: ${written.reason}. Nothing was changed.`);
    if (JSON.stringify([...written.mandate.proposalScope].sort()) !== JSON.stringify([...m.proposalScope].sort())) {
      fail("the written scope differs from the effective scope — investigate before continuing.");
    }
    console.log(`\n  ✔ revision ${written.mandate.mandateRevision} · mandate ${written.mandate.mandateId}`);
    console.log(`    decision : ${written.mandate.governanceDecisionId}`);
    console.log(`    scope    : [${written.mandate.proposalScope.join(", ")}] · responsibility ${written.responsibility.length} grant(s)\n`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n  ✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
