import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Client } from "pg";

const migrationDirectory = resolve(process.cwd(), "supabase/migrations");
const migrationLock = "g-squad:supabase:migrations";

async function applyMigrations() {
  const connectionString = process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is required for the Heroku release migration phase.");
  }

  const client = new Client({ connectionString, application_name: "g-squad-migrations" });
  await client.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [migrationLock]);
    lockAcquired = true;
    await client.query("CREATE SCHEMA IF NOT EXISTS app_private");
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_private.schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query("REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated");
    await client.query("REVOKE ALL ON app_private.schema_migrations FROM PUBLIC, anon, authenticated");

    const files = (await readdir(migrationDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = await readFile(join(migrationDirectory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");

      await client.query("BEGIN");
      try {
        const { rows } = await client.query<{ checksum: string }>(
          "SELECT checksum FROM app_private.schema_migrations WHERE version = $1",
          [file],
        );
        if (rows[0]) {
          if (rows[0].checksum !== checksum) {
            throw new Error(`Applied migration ${file} was modified. Add a new migration instead.`);
          }
          await client.query("COMMIT");
          console.log(`Already applied: ${file}`);
          continue;
        }

        await client.query(sql);
        await client.query(
          "INSERT INTO app_private.schema_migrations (version, checksum) VALUES ($1, $2)",
          [file, checksum],
        );
        await client.query("COMMIT");
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    if (lockAcquired) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [migrationLock]);
    await client.end();
  }
}

applyMigrations().catch((error: unknown) => {
  console.error("Supabase migrations failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
