/*
 * INT-5B1 — THE DURABLE-WRITE DETECTOR, PROVED IN BOTH DIRECTIONS.
 *
 * ── WHY A GUARD NEEDS ITS OWN TEST ───────────────────────────────────────────
 *
 * `performsDurableWrite` is what makes "no provider read may persist anything" a fact rather than a
 * promise. A guard nobody tests can fail in two ways, and only one of them is loud:
 *
 *   TOO LOOSE   it stops catching a real write. The firewall goes green while something persists.
 *   TOO TIGHT   it catches things that are not writes. The firewall cries wolf, and the first
 *               person blocked by a false accusation relaxes it.
 *
 * INT-5A shipped the second failure: the bare `.insert(|.update(|.delete(` pattern read
 * `createSign("RSA-SHA256").update(signingInput)` as a database UPDATE. This suite pins the repair
 * so it cannot drift back in either direction.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

/** The pattern this replaced. Kept here — and ONLY here — so the repair can be shown to be real. */
const SUPERSEDED_PATTERN = /\.insert\(|\.update\(|\.delete\(/;

const JWT_MINTER = "src/features/provider-github/github-app-jwt.server.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

function main(): void {
  /* ── 1. IT STILL BITES ON EVERY REAL WRITE SHAPE ─────────────────────────── */
  {
    const realWrites = [
      // The drizzle chain as this repository actually spells it, across line breaks.
      "const rows = await tx\n    .insert(governanceSessions)\n    .values({ id })\n    .returning();",
      "await tx\n  .update(genesisNominations)\n  .set({ consumedAt: now })\n  .where(eq(genesisNominations.id, id));",
      "await database\n  .delete(integrationCredentials)\n  .where(eq(integrationCredentials.id, id));",
      // Single line, same chain.
      "await db.insert(users).values(row);",
      "await db.update(companies).set({ name }).where(eq(companies.id, id));",
      // A handle write with nothing chained after it — the HANDLE half of the rule.
      "await db.delete(sessions);",
      "await tx.insert(auditLog);",
      "await connection.update(policies);",
    ];
    for (const sample of realWrites) {
      assert.ok(
        performsDurableWrite(sample),
        `the detector must still catch a real write:\n${sample}`,
      );
    }
  }

  /* ── 2. IT NO LONGER BITES ON WHAT IS NOT A WRITE ────────────────────────── */
  {
    const notWrites = [
      // THE ONE THAT CAUSED THE REPAIR — a crypto signature, in released source.
      'const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey, "base64url");',
      'const digest = createHash("sha256").update(payload).digest("hex");',
      "cipher.update(plaintext, \"utf8\");",
      // Collections.
      "seen.delete(file);",
      "listeners.delete(listener);",
      "inFlight.delete(key);",
      "cookies.delete(name);",
      // An in-memory repository abstraction that imports no database at all.
      "await repository.insert(record);",
      "return repository.update(id, patch);",
      "adapter.delete(id, context);",
    ];
    for (const sample of notWrites) {
      assert.ok(
        !performsDurableWrite(sample),
        `the detector must NOT call this a durable write:\n${sample}`,
      );
    }
  }

  /* ── 3. THE REPAIR IS REAL, NOT COSMETIC ─────────────────────────────────── */
  {
    const jwt = read(JWT_MINTER);
    assert.match(jwt, /createSign\(/, "the JWT minter really does sign, or this proof is about nothing");
    assert.ok(
      SUPERSEDED_PATTERN.test(jwt),
      "the superseded pattern DID flag the JWT minter — that is the false accusation being removed",
    );
    assert.ok(
      !performsDurableWrite(jwt),
      "and the repaired detector does not: minting a signature is not writing a database",
    );
  }

  /* ── 4. IT IS NOT A NO-OP ────────────────────────────────────────────────── */
  {
    /*
     * The danger in narrowing a guard is narrowing it to nothing. Measured against the whole tree:
     * the repaired rule must still find a substantial population of real writers, and must find a
     * NAMED one whose writes everybody agrees about.
     */
    const files = walk("src").filter((f) => !f.startsWith(path.join("src", "db", "schema")));
    const flagged = files.filter((f) => performsDurableWrite(read(f)));
    assert.ok(
      flagged.length >= 25,
      `the detector must still find the repository's real writers, found ${flagged.length}`,
    );

    const knownWriters = [
      "src/features/governance-decision/decision-authority.server.ts",
      "src/features/integration-credentials/credential-repository.server.ts",
      "src/features/integration-authority/integration-repository.server.ts",
    ];
    for (const writer of knownWriters) {
      assert.ok(statSync(path.join(ROOT, writer)).isFile(), `${writer} exists`);
      assert.ok(performsDurableWrite(read(writer)), `${writer} must still be recognised as a writer`);
    }

    /*
     * AND IT NARROWS ONLY. Every file the repaired rule flags was already flagged by the superseded
     * one, so this repair removes false accusations and adds no new claim about anything.
     */
    const newlyAccused = flagged.filter((f) => !SUPERSEDED_PATTERN.test(read(f)));
    assert.deepEqual(newlyAccused, [], "the repair must accuse nothing the old pattern did not");
  }

  /* ── 5. IT READS CODE, NOT PROSE ─────────────────────────────────────────── */
  {
    assert.ok(
      !performsDurableWrite('/* This module never calls db.insert(users).values(row) at all. */'),
      "a comment explaining a write must not be read as one",
    );
    assert.ok(
      !performsDurableWrite('// await db.insert(users).values(row);'),
      "and neither must a commented-out line",
    );
  }

  console.log("int5b1-flow/write-detector: OK");
}

main();
