/*
 * tests/helpers/google-workspace-connection-row.ts — one CONNECTED `google-workspace` integrations row,
 * inserted directly (SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1).
 *
 * TEST-ONLY. Suites that exercise supplied admission with a FAKED Drive reader still write a real
 * `media_assets.supplied_source_integration_id`, and the composite FK requires that it name a real
 * connection of the same tenant. This is that row — nothing else about the Integration authority is
 * exercised, and no credential exists for it.
 */
import { randomUUID } from "node:crypto";
import type { Client } from "pg";

export async function insertGoogleWorkspaceConnectionRow(
  client: Pick<Client, "query">,
  tenantId: string,
  externalAccountId = `1${randomUUID().replace(/\D/g, "").padEnd(20, "0").slice(0, 20)}`,
): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into integrations (tenant_id, name, provider_key, connection_state, health, external_account_id, scopes)
     values ($1, 'Google Workspace (fixture)', 'google-workspace', 'connected', 'healthy', $2,
             '["openid","https://www.googleapis.com/auth/userinfo.email","https://www.googleapis.com/auth/userinfo.profile","https://www.googleapis.com/auth/drive.file"]'::jsonb)
     returning id`,
    [tenantId, externalAccountId],
  );
  return row.rows[0]!.id;
}
