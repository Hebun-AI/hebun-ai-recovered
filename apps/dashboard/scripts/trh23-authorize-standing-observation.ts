/*
 * TRH-23 — the standing observation authorization CEREMONY (operator terminal only).
 *
 *   npm run platform:authorize-observation -- --tenant=turkish-rug-house            # dry run
 *   npm run platform:authorize-observation -- --tenant=turkish-rug-house --confirm
 *   npm run platform:authorize-observation -- --tenant=turkish-rug-house --withdraw --confirm
 *
 * ── WHY A CEREMONY AND NOT A GOVERNANCE UI ───────────────────────────────────
 *
 * The Director's instruction: prove the authority, its provenance, its lifecycle and its firewall in
 * production BEFORE building a product surface around it. A surface built first would have to be
 * designed against an authority nobody had yet exercised.
 *
 * ── IT IS NOT A SECOND WRITER, AND THAT IS THE WHOLE CONSTRAINT ──────────────
 *
 * This file resolves ids and prints. Every consequential effect goes through
 * `authorizeStandingObservation` / `withdrawStandingObservation` — the SAME released functions any
 * future UI would call, with the same Governance resolution, the same validation, the same single
 * transaction and the same refusals. There is no INSERT, no UPDATE and no DELETE here; the SQL below
 * is read-only and exists so that no production identifier has to be typed by a human or committed
 * to source.
 *
 * ── EVERYTHING IS RESOLVED FROM PRODUCTION TRUTH ─────────────────────────────
 *
 * No tenant uuid, no connection uuid and no channel id appears in this file. The tenant comes from a
 * slug, the connection from the tenant's own verified YouTube integration, and the SUBJECT from the
 * canonical reference TRH-21 already stored — the id YouTube itself returned. Typing a channel id
 * would be exactly the mistake the schema's `subject_ref` comment forbids.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 *
 * It contacts no provider, decrypts no credential, mints no principal, creates no schedule and
 * records no observation. Authorizing observation is not observing.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";

const CONFIRMATION = "AUTHORIZE STANDING OBSERVATION";
const WITHDRAWAL_CONFIRMATION = "WITHDRAW STANDING OBSERVATION";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

function arg(name: string): string | null {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3).trim() : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** Read one visible line from the TTY. Not a secret — the operator must SEE what they confirm. */
function promptVisible(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("this ceremony requires an interactive terminal"));
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const tenantSlug = arg("tenant");
  if (!tenantSlug) fail("--tenant=<slug> is required");
  const directorEmail = arg("director") ?? "senoltr@gmail.com";
  const withdraw = has("withdraw");
  const confirmed = has("confirm");
  const intervalMinutes = Number(arg("interval") ?? "1440");

  const justification =
    arg("justification") ??
    (withdraw
      ? "We are withdrawing standing observation of this channel while we review what we do with the numbers."
      : "I am authorizing this organization's own public channel to be observed on a bounded cadence, and I accept responsibility for that.");

  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

  /* The released modules are imported lazily so a misconfigured environment fails before any of them loads. */
  await import("../src/db/client.server");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const {
    authorizeStandingObservation,
    withdrawStandingObservation,
  } = await import(
    "../src/features/standing-observation-authority/authorize-standing-observation.server"
  );
  const { readEffectiveStandingObservation, readStandingObservationHistory } = await import(
    "../src/features/standing-observation-authority/read-standing-observations.server"
  );
  const { mintObservationPrincipal } = await import(
    "../src/features/standing-observation-authority/observation-principal.server"
  );
  const { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, YOUTUBE_PROVIDER_KEY } = await import(
    "../src/features/provider-youtube/contracts"
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    /* ── WHO. The Director's real, active membership, resolved server-side. ──────────────────── */
    const who = await client.query<{
      user_id: string;
      tenant_id: string;
      membership_id: string;
      role_id: string;
      ai: string;
      provider: string;
      company: string;
    }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai,
              ai.provider, c.name as company
         from users u
         join memberships m on m.user_id = u.id and m.status = 'active'
         join companies c on c.id = m.tenant_id
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 and c.slug = $2
        order by ai.is_primary desc
        limit 1`,
      [directorEmail, tenantSlug],
    );
    const w = who.rows[0];
    if (!w) fail(`no active membership for ${directorEmail} in organization "${tenantSlug}"`);

    /* ── THROUGH WHICH CONNECTION. The tenant's own YouTube integration. ─────────────────────── */
    const conn = await client.query<{ id: string; status: string; connection_state: string | null }>(
      `select id, status, connection_state
         from integrations
        where tenant_id = $1 and provider_key = $2 and deleted_at is null
        order by created_at
        limit 2`,
      [w.tenant_id, YOUTUBE_PROVIDER_KEY],
    );
    if (conn.rows.length === 0) fail(`"${tenantSlug}" has no ${YOUTUBE_PROVIDER_KEY} connection`);
    if (conn.rows.length > 1) {
      fail(
        `"${tenantSlug}" has more than one ${YOUTUBE_PROVIDER_KEY} connection — this ceremony will ` +
          `not choose between them`,
      );
    }
    const connection = conn.rows[0]!;

    /* ── WHAT. The canonical subject the PROVIDER already confirmed, from TRH-21's history. ──── */
    const subject = await client.query<{ subject_kind: string; subject_ref: string; observed_at: Date }>(
      `select subject_kind, subject_ref, observed_at
         from provider_observations
        where tenant_id = $1 and provider_key = $2 and capability_key = $3
        order by observed_at desc
        limit 1`,
      [w.tenant_id, YOUTUBE_PROVIDER_KEY, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY],
    );
    const observed = subject.rows[0];
    if (!observed) {
      fail(
        `"${tenantSlug}" has no stored provider observation to take a canonical subject from. ` +
          `Authorize nothing until the provider has confirmed which channel this is.`,
      );
    }

    const tenant = asHumanTenantContext({
      tenantId: w.tenant_id,
      userId: w.user_id,
      authIdentityId: w.ai,
      membershipId: w.membership_id,
      membershipVersion: 1,
      roleId: w.role_id,
      sessionContextId: "00000000-0000-4000-8000-000000000005",
      provider: w.provider as never,
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: "trh23-standing-observation-ceremony",
      authenticatedAt: new Date().toISOString(),
    });

    const scope = {
      providerKey: YOUTUBE_PROVIDER_KEY,
      capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
      subjectKind: observed.subject_kind,
      subjectRef: observed.subject_ref,
    } as const;

    /* ── WHERE THE LINEAGE STANDS, through the released reader. ──────────────────────────────── */
    const effective = await readEffectiveStandingObservation(tenant, scope);
    if (effective.status !== "read") fail(`the authority is unavailable: ${effective.reason}`);
    const current = effective.effective;

    console.log("");
    console.log(`  organization        "${w.company}" (${tenantSlug})`);
    console.log(`  acting human        ${directorEmail}`);
    console.log(`  provider            ${scope.providerKey}`);
    console.log(`  capability          ${scope.capabilityKey}`);
    console.log(`  subject             ${scope.subjectKind} ${scope.subjectRef}`);
    console.log(`                      (the id the provider returned on ${observed.observed_at.toISOString()})`);
    console.log(`  connection          ${connection.id} · ${connection.status} · ${connection.connection_state ?? "no state"}`);
    console.log(
      `  effective revision  ${current ? `${current.authorizationRevision} (${current.state}), every ${current.intervalMinutes} min` : "none — this scope has never been authorized"}`,
    );
    console.log("");
    console.log(withdraw ? "  ACT                 WITHDRAW" : `  ACT                 AUTHORIZE, at most once every ${intervalMinutes} minutes`);
    console.log("");
    console.log("  This ceremony authorizes LOOKING. It contacts no provider, decrypts no credential,");
    console.log("  creates no schedule and records no observation. Nothing will run as a result.");
    console.log("");

    if (!confirmed) {
      console.log("  DRY RUN — nothing was written. Re-run with --confirm to proceed.\n");
      return;
    }

    const phrase = withdraw ? WITHDRAWAL_CONFIRMATION : CONFIRMATION;
    const typed = await promptVisible(`  Type ${phrase} to proceed: `);
    if (typed !== phrase) fail("not confirmed — nothing was written");

    const result = withdraw
      ? await withdrawStandingObservation(tenant, {
          ...scope,
          justification,
          observedAuthorizationRevision: current?.authorizationRevision ?? null,
        })
      : await authorizeStandingObservation(tenant, {
          ...scope,
          integrationId: connection.id,
          intervalMinutes,
          justification,
          observedAuthorizationRevision: current?.authorizationRevision ?? null,
        });

    if (result.status !== "authorized") {
      fail(`refused: ${result.reason}`);
    }

    const written = result.authorization;
    console.log("");
    console.log(`  ✔ revision ${written.authorizationRevision} (${written.state})`);
    console.log(`    authorization   ${written.authorizationId}`);
    console.log(`    decision        ${written.governanceDecisionId}`);
    console.log(`    session         ${written.governanceSessionId}`);
    console.log(`    supersedes      ${written.supersedesAuthorizationId ?? "nothing — this is revision 1"}`);
    console.log("");

    /* ── THE READ-ONLY ACCEPTANCE PROOF. A principal is minted and then simply discarded. ────── */
    const history = await readStandingObservationHistory(tenant, scope);
    if (history.status === "read") {
      console.log("  lineage, newest first:");
      for (const revision of history.revisions) {
        console.log(
          `    ${revision.authorizationRevision}  ${revision.state.padEnd(9)} every ${String(revision.intervalMinutes).padStart(5)} min  decision ${revision.governanceDecisionId}`,
        );
      }
      console.log("");
    }

    const minted = await mintObservationPrincipal(written.authorizationId);
    if (minted.status === "minted") {
      const p = minted.principal;
      console.log("  ephemeral principal minted from the effective authorization:");
      console.log(`    tenant        ${p.tenantId}`);
      console.log(`    authorization ${p.authorizationId} (revision ${p.authorizationRevision})`);
      console.log(`    provider      ${p.providerKey}`);
      console.log(`    capability    ${p.capabilityKey}`);
      console.log(`    subject       ${p.subjectRef}`);
      console.log(`    connection    ${p.integrationId}`);
      console.log(`    invocation    ${p.invocationId}`);
      console.log("");
      console.log("  It was NOT used. There is no provider transport caller in this repository, and");
      console.log("  the principal is not persisted anywhere — it ends with this process.");
    } else {
      console.log(`  no principal could be minted: ${minted.reason}`);
    }
    console.log("");
  } finally {
    await client.end().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
