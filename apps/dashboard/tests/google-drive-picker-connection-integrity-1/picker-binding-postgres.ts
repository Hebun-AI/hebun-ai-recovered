/*
 * GOOGLE-DRIVE-PICKER-CONNECTION-INTEGRITY-1 — the file a human chose through one Google connection is
 * read through THAT connection, or not at all.
 *
 * Real (disposable) Postgres, the real Integration authority, real INT-2 credentials (sealed with a
 * fixture key), the released Google bind (`commitGoogleGrant`), the real availability view, the real
 * Picker ceremony, the real Drive read seams and the real supplied-image admission. Google is a fixture:
 * `userinfo` answers the account being bound, and Drive answers by BEARER TOKEN — each connection's token
 * can see only its own account's file — and counts every call per token. No real network.
 *
 * THE CLAIM:
 *
 *   "A tenant holds connection A (account 1, created first) and B (account 2), both with `drive.file`.
 *    The Picker session opens with A and returns a signed binding naming A and account 1. A read with
 *    that binding spends only A's token. A binding for B reads through B even though A is first — order
 *    decides nothing. A's file is never read through B and B's never through A: a miss is a failure,
 *    not a cue to try the other account. If A is disconnected, unhealthy, loses the per-file grant, or
 *    its bound account changes or disappears, the read is refused and B is never touched. A tampered,
 *    expired, other-session, other-human or other-tenant binding is refused before any credential is
 *    spent, and another tenant's connection is indistinguishable from none. Image and video obey the
 *    same rule. A single-connection tenant admits exactly as before. No token reaches the binding, the
 *    Media row or anything returned besides the Picker's own one access token."
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { createConnection } from "../../src/features/integration-authority/integration-repository.server";
import { GOOGLE_OAUTH_ENV_KEYS } from "../../src/features/provider-google/google-environment.server";
import { commitGoogleGrant } from "../../src/features/provider-google/bind-google-grant.server";
import { GOOGLE_PROVIDER_KEY } from "../../src/features/provider-google/contracts";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { authorizeMediaPickerSession } from "../../src/features/provider-content-admission/authorize-picker-session.server";
import {
  PICKER_BINDING_TTL_SECONDS,
  openPickerBinding,
  sealPickerBinding,
} from "../../src/features/provider-google/picker-connection-binding.server";
import { readDriveImage } from "../../src/features/provider-google/read-drive-image.server";
import { relayDriveVideo } from "../../src/features/provider-google/relay-drive-video.server";
import { admitSuppliedDriveImage } from "../../src/features/media-assets/admit-supplied-drive-image.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { seedTenant, type Tenant } from "../mv4-async-generation/scenarios";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const NOW = new Date("2026-09-29T12:00:00.000Z");
const ACCOUNT_1 = { sub: "111111111111111111111", email: "owner@acme.test" };
const ACCOUNT_2 = { sub: "222222222222222222222", email: "second@acme.test" };
const ACCOUNT_3 = { sub: "333333333333333333333", email: "owner@globex.test" };
/* An account no live connection holds — two live rows of one tenant can never share one (unique index). */
const ACCOUNT_9 = "999999999999999999999";
const TOKEN = { A: "gdpci-access-A", B: "gdpci-access-B", C: "gdpci-access-C" } as const;
const REFRESH = { A: "gdpci-refresh-A", B: "gdpci-refresh-B", C: "gdpci-refresh-C" } as const;
const FILE = { A: "1FileOfAccountOne0000000000", B: "1FileOfAccountTwo0000000000", C: "1FileOfAccountThree00000000" } as const;
const VIDEO = { A: "1VideoOfAccountOne000000000", B: "1VideoOfAccountTwo000000000" } as const;

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
  [GOOGLE_OAUTH_ENV_KEYS.clientId]: "gdpci-fixture.apps.googleusercontent.com",
  [GOOGLE_OAUTH_ENV_KEYS.clientSecret]: "gdpci-fixture-client-secret",
  [GOOGLE_OAUTH_ENV_KEYS.redirectUri]: "http://localhost:3000/api/integrations/google/callback",
  [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "gdpci-fixture-state-secret-0123456789abcdef",
};
const WORKSPACE_SCOPES = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
]);
const strip = (c: string): string => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("google-drive-picker-connection-integrity-1: exited before completing");
    process.exitCode = 1;
  }
});

function userinfoAs(account: { sub: string; email: string }) {
  return async () =>
    new Response(JSON.stringify({ sub: account.sub, email: account.email, email_verified: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

async function main(): Promise<void> {
  const jpeg = new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 120, g: 60, b: 20 } } }).jpeg().toBuffer());
  const mp4 = new Uint8Array(4096).fill(7);

  /* Drive, answered by bearer token: each account sees only its own files. Every call is counted. */
  const calls: Record<string, number> = {};
  const owner: Record<string, string> = {
    [FILE.A]: TOKEN.A,
    [FILE.B]: TOKEN.B,
    [FILE.C]: TOKEN.C,
    [VIDEO.A]: TOKEN.A,
    [VIDEO.B]: TOKEN.B,
  };
  const driveFetch = (async (url: string, init?: RequestInit) => {
    const auth = ((init?.headers ?? {}) as Record<string, string>).Authorization ?? ((init?.headers ?? {}) as Record<string, string>).authorization ?? "";
    const token = auth.replace(/^Bearer /, "");
    calls[token] = (calls[token] ?? 0) + 1;
    const u = new URL(url);
    const id = decodeURIComponent(u.pathname.split("/").pop() ?? "");
    if (owner[id] !== token) return new Response(JSON.stringify({ error: { code: 404, message: "File not found" } }), { status: 404, headers: { "content-type": "application/json" } });
    const isVideo = id.startsWith("1Video");
    if (u.searchParams.get("alt") === "media") return new Response((isVideo ? mp4 : jpeg) as BodyInit, { status: 200 });
    return new Response(
      JSON.stringify({ id, name: isVideo ? "clip.mp4" : "photo.jpg", mimeType: isVideo ? "video/mp4" : "image/jpeg", size: String(isVideo ? mp4.byteLength : jpeg.byteLength) }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as never;
  const resetCalls = () => {
    for (const k of Object.keys(calls)) delete calls[k];
  };

  const harness = createDisposablePostgresHarness("hebun_gdpci1");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = (): ControlPlaneDatabase => handle.db;
  try {
    harness.migrateDatabase();
    await client.connect();
    const acme: Tenant = await seedTenant(client, getDb, "Acme");
    const globex: Tenant = await seedTenant(client, getDb, "Globex");

    const connect = async (t: Tenant, account: { sub: string; email: string }, access: string, refresh: string, at: Date) => {
      const created = await createConnection(t.ctx, { providerKey: GOOGLE_PROVIDER_KEY, name: `Google ${account.email}` }, { getDb, now: () => at });
      assert.ok(created.status === "created", JSON.stringify(created));
      const id = created.connection.integrationId;
      const bound = await commitGoogleGrant(
        t.ctx,
        id,
        { accessToken: access, refreshToken: refresh, expiresAt: null, grantedScopes: WORKSPACE_SCOPES },
        at,
        { getDb, env: ENV, fetchImpl: userinfoAs(account) as never },
      );
      assert.equal(bound, "connected");
      return id;
    };
    /* A is created FIRST, so it is what "first available" would pick. */
    const A = await connect(acme, ACCOUNT_1, TOKEN.A, REFRESH.A, new Date(NOW.getTime() - 60_000));
    const B = await connect(acme, ACCOUNT_2, TOKEN.B, REFRESH.B, NOW);
    const C = await connect(globex, ACCOUNT_3, TOKEN.C, REFRESH.C, NOW);

    const readDeps = { getDb, env: ENV, fetchImpl: driveFetch };
    const bindingFor = (t: TenantContext, integrationId: string, externalAccountId: string, nowSeconds?: () => number) =>
      sealPickerBinding(t, { integrationId, externalAccountId }, { env: ENV, ...(nowSeconds ? { nowSeconds } : {}) })!;
    const bA = bindingFor(acme.ctx, A, ACCOUNT_1.sub);
    const bB = bindingFor(acme.ctx, B, ACCOUNT_2.sub);
    const noOtherToken = (label: string, allowed: string | null) => {
      for (const t of Object.values(TOKEN)) if (t !== allowed) assert.equal(calls[t] ?? 0, 0, `${label}: ${t} was never spent`);
    };

    /* ══ 1. THE PICKER SESSION OPENS WITH A AND SAYS SO, SIGNED ══ */
    {
      const session = await authorizeMediaPickerSession(acme.ctx, {
        getDb,
        env: ENV,
        picker: () => ({ status: "configured", apiKey: "picker-key", appId: "1234567890" }),
      } as never);
      assert.equal(session.status, "authorized", JSON.stringify(session.status === "authorized" ? { ...session, accessToken: "…" } : session));
      if (session.status !== "authorized") return;
      assert.equal(session.accessToken, TOKEN.A, "the chooser runs as A, the first connection");
      const opened = openPickerBinding(session.binding, { env: ENV });
      assert.ok(opened.ok);
      if (!opened.ok) return;
      assert.deepEqual(
        { integrationId: opened.payload.integrationId, externalAccountId: opened.payload.externalAccountId, tenantId: opened.payload.tenantId, userId: opened.payload.userId, sessionContextId: opened.payload.sessionContextId },
        { integrationId: A, externalAccountId: ACCOUNT_1.sub, tenantId: acme.tenantId, userId: acme.ctx.userId, sessionContextId: acme.ctx.sessionContextId },
        "the binding names A, account 1, this human and this session",
      );
      /* SECRET SAFETY: the binding carries identifiers only. */
      const decoded = Buffer.from(session.binding.split(".")[0]!, "base64url").toString("utf8");
      for (const secret of [...Object.values(TOKEN), ...Object.values(REFRESH), ENV[GOOGLE_OAUTH_ENV_KEYS.stateSecret]!, ENV[GOOGLE_OAUTH_ENV_KEYS.clientSecret]!]) {
        assert.ok(!decoded.includes(secret) && !session.binding.includes(secret), "no token or secret in the binding");
      }
      assert.ok(!JSON.stringify({ ...session, accessToken: null }).includes("refresh"), "no refresh token in the session");

      /* ══ 2. A READ WITH THAT BINDING SPENDS ONLY A ══ */
      resetCalls();
      const read = await readDriveImage(acme.ctx, { fileId: FILE.A, binding: session.binding }, readDeps);
      assert.equal(read.status, "read", JSON.stringify(read));
      assert.equal(calls[TOKEN.A], 2, "metadata + bytes, both as A");
      noOtherToken("A-bound read", TOKEN.A);
    }

    /* ══ 3. ORDER DECIDES NOTHING: a B binding reads through B although A is first ══ */
    {
      resetCalls();
      const read = await readDriveImage(acme.ctx, { fileId: FILE.B, binding: bB }, readDeps);
      assert.equal(read.status, "read", JSON.stringify(read));
      assert.equal(calls[TOKEN.B], 2);
      noOtherToken("B-bound read", TOKEN.B);
    }

    /* ══ 4. NO FALLBACK: the other account's file is a failure, never a retry as the other account ══ */
    {
      resetCalls();
      const viaB = await readDriveImage(acme.ctx, { fileId: FILE.A, binding: bB }, readDeps);
      assert.equal(viaB.status, "provider-failed", "B cannot see A's file, and A is not tried");
      noOtherToken("A's file via B", TOKEN.B);
      resetCalls();
      const viaA = await readDriveImage(acme.ctx, { fileId: FILE.B, binding: bA }, readDeps);
      assert.equal(viaA.status, "provider-failed");
      noOtherToken("B's file via A", TOKEN.A);
    }

    /* ══ 5. THE BOUND CONNECTION'S TRUTH CHANGES → REFUSED, B NEVER TOUCHED ══ */
    const restoreA = async () =>
      client.query(`update integrations set connection_state='connected', health='healthy', external_account_id=$2, scopes=$3::jsonb where id=$1`, [A, ACCOUNT_1.sub, JSON.stringify(WORKSPACE_SCOPES)]);
    for (const [label, sql, args, reason] of [
      ["A disconnected", `update integrations set connection_state='disconnected' where id=$1`, [A], "bound-connection-unavailable"],
      ["A unreachable", `update integrations set health='unreachable' where id=$1`, [A], "bound-connection-unavailable"],
      ["A lost drive.file", `update integrations set scopes=$2::jsonb where id=$1`, [A, JSON.stringify(WORKSPACE_SCOPES.filter((s) => !s.endsWith("drive.file")))], "bound-connection-unavailable"],
      ["A now bound to another account", `update integrations set external_account_id=$2 where id=$1`, [A, ACCOUNT_9], "bound-account-mismatch"],
    ] as const) {
      await client.query(sql, [...args]);
      resetCalls();
      assert.deepEqual(await readDriveImage(acme.ctx, { fileId: FILE.A, binding: bA }, readDeps), { status: "refused", reason }, label);
      noOtherToken(label, null);
      await restoreA();
    }
    /* Missing account: `integrations_account_immutable`-style guards may forbid it; drop triggers for the fixture only. */
    {
      await client.query(`alter table integrations disable trigger user`);
      await client.query(`update integrations set external_account_id=null where id=$1`, [A]);
      await client.query(`alter table integrations enable trigger user`);
      resetCalls();
      assert.deepEqual(await readDriveImage(acme.ctx, { fileId: FILE.A, binding: bA }, readDeps), { status: "refused", reason: "bound-account-mismatch" }, "A with no account");
      noOtherToken("A with no account", null);
      await client.query(`alter table integrations disable trigger user`);
      await restoreA();
      await client.query(`alter table integrations enable trigger user`);
    }

    /* ══ 6. THE CLIENT CANNOT RE-POINT THE BINDING ══ */
    {
      const [body, sig] = bA.split(".") as [string, string];
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      const swapped = `${Buffer.from(JSON.stringify({ ...payload, integrationId: B, externalAccountId: ACCOUNT_2.sub }), "utf8").toString("base64url")}.${sig}`;
      const extended = `${Buffer.from(JSON.stringify({ ...payload, expiresAt: payload.expiresAt + 86_400 }), "utf8").toString("base64url")}.${sig}`;
      const foreignKey = sealPickerBinding(acme.ctx, { integrationId: B, externalAccountId: ACCOUNT_2.sub }, { env: { ...ENV, [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "another-deployment-secret-0123456789abcdef" } })!;
      resetCalls();
      for (const [label, binding, reason] of [
        ["claims B under A's signature", swapped, "binding-signature-invalid"],
        ["extends its own expiry", extended, "binding-signature-invalid"],
        ["signed by another secret", foreignKey, "binding-signature-invalid"],
        ["missing", "", "binding-missing"],
        ["garbage", "not-a-binding", "binding-malformed"],
        ["oversized", "x".repeat(5000), "binding-malformed"],
      ] as const) {
        assert.deepEqual(await readDriveImage(acme.ctx, { fileId: FILE.A, binding }, readDeps), { status: "refused", reason }, label);
      }
      /* An extra connection field on the input is not a parameter: the binding alone decides. */
      const extra = await readDriveImage(acme.ctx, { fileId: FILE.A, binding: bA, integrationId: B } as never, readDeps);
      assert.equal(extra.status, "read");
      assert.equal(calls[TOKEN.B] ?? 0, 0, "an injected integrationId is ignored");
    }

    /* ══ 7. SESSION, HUMAN AND TIME BOUNDS ══ */
    {
      resetCalls();
      const otherSession = { ...acme.ctx, sessionContextId: randomUUID() } as TenantContext;
      const otherHuman = { ...acme.ctx, userId: randomUUID() } as TenantContext;
      assert.deepEqual(await readDriveImage(otherSession, { fileId: FILE.A, binding: bA }, readDeps), { status: "refused", reason: "binding-context-mismatch" });
      assert.deepEqual(await readDriveImage(otherHuman, { fileId: FILE.A, binding: bA }, readDeps), { status: "refused", reason: "binding-context-mismatch" });
      const old = bindingFor(acme.ctx, A, ACCOUNT_1.sub, () => Math.floor(Date.now() / 1000) - PICKER_BINDING_TTL_SECONDS - 1);
      assert.deepEqual(await readDriveImage(acme.ctx, { fileId: FILE.A, binding: old }, readDeps), { status: "refused", reason: "binding-expired" });
      noOtherToken("bounds", null);
    }

    /* ══ 8. TENANT ISOLATION ══ */
    {
      resetCalls();
      const globexBinding = bindingFor(globex.ctx, C, ACCOUNT_3.sub);
      assert.deepEqual(await readDriveImage(acme.ctx, { fileId: FILE.C, binding: globexBinding }, readDeps), { status: "refused", reason: "binding-context-mismatch" }, "another tenant's binding");
      /* Even a server-signed binding naming another tenant's connection finds nothing in THIS tenant. */
      const pointsAtC = bindingFor(acme.ctx, C, ACCOUNT_3.sub);
      assert.deepEqual(await readDriveImage(acme.ctx, { fileId: FILE.C, binding: pointsAtC }, readDeps), { status: "refused", reason: "bound-connection-unavailable" }, "another tenant's connection is no connection");
      noOtherToken("tenant isolation", null);
    }

    /* ══ 9. VIDEO OBEYS THE SAME RULE ══ */
    {
      const consume = async (body: ReadableStream<Uint8Array>) => {
        let n = 0;
        for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) n += chunk.byteLength;
        return n;
      };
      resetCalls();
      const viaB = await relayDriveVideo(acme.ctx, { fileId: VIDEO.B, binding: bB }, consume, readDeps);
      assert.deepEqual(viaB.status === "relayed" && viaB.value, mp4.byteLength, JSON.stringify(viaB));
      noOtherToken("video via B", TOKEN.B);
      resetCalls();
      const cross = await relayDriveVideo(acme.ctx, { fileId: VIDEO.A, binding: bB }, consume, readDeps);
      assert.equal(cross.status, "provider-failed", "A's video is not read through B, and A is not tried");
      noOtherToken("video cross", TOKEN.B);
      await client.query(`update integrations set connection_state='disconnected' where id=$1`, [B]);
      resetCalls();
      assert.deepEqual(await relayDriveVideo(acme.ctx, { fileId: VIDEO.B, binding: bB }, consume, readDeps), { status: "refused", reason: "bound-connection-unavailable" });
      noOtherToken("video, B disconnected", null);
      await client.query(`update integrations set connection_state='connected' where id=$1`, [B]);
      assert.deepEqual(await relayDriveVideo(acme.ctx, { fileId: VIDEO.A } as never, consume, readDeps), { status: "refused", reason: "binding-missing" }, "no binding, no video read");
    }

    /* ══ 10. END TO END: the released admission, single-connection tenant and two-connection tenant ══ */
    {
      const memory = createMemoryMediaObjectStore();
      const admit = (t: Tenant, fileId: string, pickerBinding: string) =>
        admitSuppliedDriveImage(t.ctx, { artifactId: t.draft, revisionNo: 1, driveFileId: fileId, pickerBinding }, {
          getDb,
          now: () => NOW,
          resolveStorage: () => ({ status: "available", store: memory }),
          readImage: (tt, i) => readDriveImage(tt, i, readDeps),
        });
      const single = await admit(globex, FILE.C, bindingFor(globex.ctx, C, ACCOUNT_3.sub));
      assert.equal(single.status, "admitted", `single-connection tenant unchanged (${JSON.stringify(single)})`);
      const viaB = await admit(acme, FILE.B, bB);
      assert.equal(viaB.status, "admitted", "two-connection tenant admits through the bound connection");
      resetCalls();
      const crossed = await admit(acme, FILE.B, bA);
      assert.equal(crossed.status === "refused" && crossed.reason, "drive-read-failed", "chosen as B, bound as A → not read as B");
      assert.equal(calls[TOKEN.B] ?? 0, 0, "B was never tried");
      await client.query(`update integrations set external_account_id=$2 where id=$1`, [B, ACCOUNT_9]);
      assert.deepEqual(await admit(acme, FILE.B, bB), { status: "refused", reason: "drive-connection-not-bound", detail: "bound-account-mismatch" });
      await client.query(`update integrations set external_account_id=$2 where id=$1`, [B, ACCOUNT_2.sub]);
      assert.deepEqual(await admit(acme, FILE.B, ""), { status: "refused", reason: "drive-connection-not-bound", detail: "binding-missing" });
      /* No token in the Media row. */
      const rows = (await client.query(`select to_jsonb(m)::text j from media_assets m`)).rows.map((r) => r.j as string).join("\n");
      for (const t of [...Object.values(TOKEN), ...Object.values(REFRESH)]) assert.ok(!rows.includes(t), "no credential in media_assets");
      assert.ok(!rows.includes("pb1") && !rows.includes(bB), "the binding is not persisted in Media");
    }
  } finally {
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }

  /* ══ 11. STRUCTURE: no generic connection lookup survives on the Drive read path ══ */
  {
    const read = (f: string) => strip(readFileSync(path.join(process.cwd(), f), "utf8"));
    for (const f of ["src/features/provider-google/read-drive-image.server.ts", "src/features/provider-google/relay-drive-video.server.ts"]) {
      const c = read(f);
      assert.ok(!/sources\.find\(\s*\(?\s*s\s*\)?\s*=>\s*s\.readAvailable\s*\)/.test(c), `${f}: no "first available" source`);
      assert.ok(!/getCapabilityAvailability/.test(c), `${f}: no aggregate availability of its own`);
      assert.match(c, /resolveBoundDriveFileConnection\(/, `${f}: reads only through the bound connection`);
    }
    const binding = read("src/features/provider-google/picker-connection-binding.server.ts");
    /* `createHmac(...).update(` is hashing; the ban is on credentials and on any database handle. */
    assert.ok(!/withDecryptedSecret|credential-repository|withGoogleAccessToken|@\/db\/schema|\b(db|tx)\s*\.\s*(insert|update|delete)\(/.test(binding), "the binding module spends and writes nothing");
    assert.match(binding, /s\.integrationId === p\.integrationId/, "the exact bound connection, never the first");
    for (const f of ["src/features/media-assets/admit-supplied-drive-image.server.ts", "src/features/media-assets/admit-supplied-drive-video.server.ts"]) {
      const c = read(f);
      assert.ok(!/integration-authority|integration-credentials|withGoogleAccessToken|picker-connection-binding/.test(c), `${f}: Media never becomes connection or credential authority`);
    }
    const picker = read("src/features/provider-content-admission/authorize-picker-session.server.ts");
    assert.match(picker, /sealPickerBinding\(\s*tenant,\s*\{ integrationId: source\.integrationId/, "the binding names the connection whose token is handed out");
    assert.ok(picker.indexOf("sealPickerBinding(") < picker.indexOf("withGoogleAccessToken("), "the binding is sealed before any credential is spent");
    const actions = read("src/app/(dashboard)/operations/actions.ts");
    assert.ok(!/integrationId|connectionId|externalAccountId/.test(actions.slice(actions.indexOf("admitSuppliedDriveImageAction"), actions.indexOf("export async function", actions.indexOf("admitSuppliedDriveVideoAction") + 10))), "the doors accept no connection or account field");
  }

  finished = true;
  console.log("google-drive-picker-connection-integrity-1: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
