/*
 * TRH-24 — ONE machine-sourced observation, manually initiated (operator terminal only).
 *
 *   npm run platform:observe-once -- --tenant=turkish-rug-house                            # dry run
 *   npm run platform:observe-once -- --tenant=turkish-rug-house --confirm
 *   npm run platform:observe-once -- --tenant=turkish-rug-house --provider=instagram --confirm
 *   npm run platform:observe-once -- --tenant=turkish-rug-house --authorization=<uuid> --confirm
 *
 * `--provider=` and `--authorization=` NARROW; they never widen. A tenant with one active
 * authorization needs neither. A tenant with several must name one — see the selection below,
 * which still refuses to choose and now offers a way to say which was meant.
 *
 * ── WHAT THIS CEREMONY DECIDES, AND WHAT IT DOES NOT ────────────────────────
 *
 * It decides WHEN one attempt begins. That is all.
 *
 * WHETHER it is allowed is decided by the standing authorization and re-decided, authoritatively,
 * immediately before transport. This file cannot widen a scope, choose a connection, name a
 * credential, pick a tenant for the read, or proceed past a refusal — every one of those is read off
 * the authorization row inside released code that takes no such parameter.
 *
 * ── IT IS NOT A SCHEDULER, AND CONTAINS NOTHING THAT COULD BECOME ONE ───────
 *
 * One process, at most one provider transport, then exit. No loop, no timer, no retry, no backoff,
 * no next-run computation and no state written about when to run again. Running it twice in a row
 * is refused by the cadence ceiling the authorization itself carries.
 *
 * ── DRY RUN IS THE DEFAULT ──────────────────────────────────────────────────
 *
 * The repository's operator-ceremony doctrine, and the shape TRH-23's own ceremony uses. A dry run
 * contacts no provider, decrypts no credential and writes nothing — it resolves the authorization,
 * reports the bindings and says whether the cadence currently permits an observation.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";

const CONFIRMATION = "OBSERVE ONCE";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

function arg(name: string): string | null {
  const flag = process.argv.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.slice(name.length + 3).trim() : null;
}

const has = (name: string): boolean => process.argv.includes(`--${name}`);

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
  /* NARROWING ONLY. Neither may name a scope the authority has not already made active. */
  const wantedProvider = arg("provider");
  const wantedAuthorization = arg("authorization");
  if (!tenantSlug) fail("--tenant=<slug> is required");
  const confirmed = has("confirm");
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set");

  await import("../src/db/client.server");
  const { listEffectiveStandingObservations } = await import(
    "../src/features/standing-observation-authority/read-standing-observations.server"
  );
  const { readLatestAuthorizedObservationAt } = await import(
    "../src/features/provider-observation-history/read-provider-observations.server"
  );
  const { observeOnceUnderAuthorization } = await import(
    "../src/features/provider-observation-history/observe-once-under-authorization.server"
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    /* ── THE TENANT. An operator-safe selector; the uuid is never typed. ──────────────────────── */
    const org = await client.query<{ tenant_id: string; company: string }>(
      `select id as tenant_id, name as company from companies where slug = $1 limit 1`,
      [tenantSlug],
    );
    const tenant = org.rows[0];
    if (!tenant) fail(`no organization with slug "${tenantSlug}"`);
    const scopeTenant = { tenantId: tenant.tenant_id };

    /* ── THE AUTHORIZATION, through the released reader. ──────────────────────────────────────── */
    const listed = await listEffectiveStandingObservations(scopeTenant);
    if (listed.status !== "read") fail(`the standing observation authority is unavailable: ${listed.reason}`);

    const active = listed.revisions.filter((r) => r.state === "active");
    if (active.length === 0) {
      fail(`"${tenantSlug}" has no ACTIVE standing observation authorization. Nothing may be observed.`);
    }

    /*
     * ── SELECTION NARROWS. IT NEVER WIDENS, AND IT NEVER GUESSES. ───────────────────────────
     *
     * This ceremony refused outright when a tenant held more than one authorization, which was the
     * right refusal and the wrong end state: a second observable provider made it unreachable. The
     * refusal is UNCHANGED — what is added is a way for an operator to say which scope they meant.
     *
     * Both filters are applied to the list the AUTHORITY returned for THIS tenant, so naming an
     * authorization that belongs to another tenant, or a provider this tenant has not authorized,
     * finds nothing and fails closed. There is no first-match fallback anywhere below.
     */
    let candidates = active;
    if (wantedProvider) {
      candidates = candidates.filter((r) => r.providerKey === wantedProvider);
      if (candidates.length === 0) {
        fail(
          `"${tenantSlug}" has no ACTIVE standing authorization for provider "${wantedProvider}". ` +
            `Active providers: ${[...new Set(active.map((r) => r.providerKey))].sort().join(", ")}`,
        );
      }
    }
    if (wantedAuthorization) {
      candidates = candidates.filter((r) => r.authorizationId === wantedAuthorization);
      if (candidates.length === 0) {
        fail(
          `no ACTIVE standing authorization "${wantedAuthorization}" for "${tenantSlug}"` +
            (wantedProvider ? ` under provider "${wantedProvider}"` : "") +
            ". Nothing was observed.",
        );
      }
    }
    if (candidates.length > 1) {
      fail(
        `"${tenantSlug}" has ${candidates.length} active standing authorizations. This ceremony ` +
          `observes ONE scope and will not choose between them. Name one with --provider= or ` +
          `--authorization=:\n` +
          candidates
            .map((r) => `    --authorization=${r.authorizationId}  ${r.providerKey}  ${r.subjectRef}`)
            .join("\n"),
      );
    }
    const authorization = candidates[0]!;

    /* ── THE CADENCE, reported honestly before anything is decided. ───────────────────────────── */
    const last = await readLatestAuthorizedObservationAt(scopeTenant, {
      providerKey: authorization.providerKey,
      capabilityKey: authorization.capabilityKey,
      subjectRef: authorization.subjectRef,
    });
    const lastAt = last.status === "read" ? last.observedAt : null;
    const elapsedMinutes =
      lastAt === null ? null : Math.floor((Date.now() - Date.parse(lastAt)) / 60_000);
    const cadenceAllows =
      last.status !== "read"
        ? null
        : lastAt === null || (elapsedMinutes ?? 0) >= authorization.intervalMinutes;

    console.log("");
    console.log(`  organization        "${tenant.company}" (${tenantSlug})`);
    console.log(`  provider            ${authorization.providerKey}`);
    console.log(`  capability          ${authorization.capabilityKey}`);
    console.log(`  subject             ${authorization.subjectKind} ${authorization.subjectRef}`);
    console.log(`  connection          ${authorization.integrationId}`);
    console.log(`  authorization       revision ${authorization.authorizationRevision} (${authorization.state})`);
    console.log(`  decision            ${authorization.governanceDecisionId}`);
    console.log(`  interval ceiling    every ${authorization.intervalMinutes} minutes`);
    console.log(
      `  last machine read   ${lastAt ?? "never — this scope has never been observed under this authorization"}`,
    );
    console.log(
      `  cadence allows now  ${
        cadenceAllows === null
          ? "UNKNOWN — the observation history could not be read"
          : cadenceAllows
            ? "YES"
            : `NO — ${elapsedMinutes} of ${authorization.intervalMinutes} minutes elapsed`
      }`,
    );
    console.log("");
    console.log("  This ceremony performs ONE provider READ. It writes nothing else: no Governance");
    console.log("  decision, no authorization, no permit, no execution, and no schedule. Running it");
    console.log("  again is refused until the interval has elapsed.");
    console.log("");

    if (!confirmed) {
      console.log("  DRY RUN — no provider was contacted, no credential was opened, nothing was written.");
      console.log("  Re-run with --confirm to perform one observation.\n");
      return;
    }

    const typed = await promptVisible(`  Type ${CONFIRMATION} to perform exactly one observation: `);
    if (typed !== CONFIRMATION) fail("not confirmed — no provider was contacted and nothing was written");

    /*
     * THE ONE ATTEMPT. Everything below this line is released code: the mint, the authoritative
     * revalidation, the credential frame, the provider read and the write. This file supplies an
     * authorization id and nothing else.
     */
    const outcome = await observeOnceUnderAuthorization(authorization.authorizationId);

    console.log("");
    switch (outcome.status) {
      case "not-authorized":
        fail(`no principal could be minted: ${outcome.reason}. No provider was contacted.`);
        break;
      case "refused":
        fail(`the authoritative check refused: ${outcome.reason}. No provider was contacted.`);
        break;
      case "unsupported-subject":
        fail("the authorized subject is not readable by this provider path. No provider was contacted.");
        break;
      case "provider-failed":
        console.log(`  ✖ the provider did not answer usefully: ${outcome.failure.failure} · ${outcome.failure.reason}`);
        console.log(`    invocation ${outcome.invocationId}`);
        console.log("    NOTHING was recorded. The interval ceiling was not spent, so a retry is permitted.\n");
        process.exit(1);
        break;
      case "observed": {
        const o = outcome.observation;
        console.log(`  ✔ the provider answered`);
        /*
         * PRINTED FROM THE FACTS THE DISPATCH PRODUCED, not from a provider-shaped object. This
         * ceremony was written when YouTube was the only provider and read `observation.channel`
         * directly; a second provider made that shape wrong for half the authorizations it can now
         * run. `null` is printed as "not reported" and never as 0.
         */
        for (const [key, value] of Object.entries(o.facts)) {
          if (Array.isArray(value)) {
            console.log(`    ${key.padEnd(14)} ${value.length} item(s)`);
            continue;
          }
          console.log(`    ${key.padEnd(14)} ${value === null ? "not reported" : String(value)}`);
        }
        console.log(`    observed at    ${o.observedAt}`);
        console.log("");
        console.log(`    authorization  ${outcome.authorizationId}`);
        console.log(`    invocation     ${outcome.invocationId}`);
        console.log(`    record         ${outcome.record.status}${
          outcome.record.status === "recorded"
            ? ` · observation ${outcome.record.observationId}`
            : outcome.record.status === "refused"
              ? ` · ${outcome.record.reason}`
              : ""
        }`);
        if (outcome.record.status === "refused") {
          console.log("");
          console.log("    THE PROVIDER WAS READ AND HEBUN DID NOT REMEMBER IT. Those are different");
          console.log("    states and this ceremony reports them separately rather than claiming success.");
          process.exit(1);
        }
        console.log("");
        console.log("    No human actor is recorded, because no human performed this read. The row");
        console.log("    carries the authorization and the invocation, and that is the whole truth of it.");
        console.log("");
        break;
      }
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
