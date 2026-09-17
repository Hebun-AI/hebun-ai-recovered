/*
 * Documents — a foundation-baseline table with NO writer and NO reader anywhere in the repository.
 *
 * `storage_path` does not mean any storage exists. No Supabase Storage client, bucket, SDK or
 * credential has ever been adopted: knowledge uploads (R4C1/R4C2) keep no bytes, and generated image
 * bytes are owned by the Media Asset authority (MEDIA-1, `media-asset.ts`) behind its own storage
 * port, which is itself not yet connected. Measured at MEDIA-1 against `983c7948`.
 */
import { pgTable, text } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";

export const documents = pgTable("documents", {
  ...tenantColumns,
  title: text("title").notNull(),
  category: text("category"),
  storagePath: text("storage_path"),
});
