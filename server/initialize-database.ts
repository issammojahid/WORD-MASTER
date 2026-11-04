import { readFileSync } from "node:fs";
import { pool } from "./db";

let client: import("pg").PoolClient | undefined;
try {
  if (!process.argv.includes("--confirm-empty-database")) throw new Error("Explicit empty-database confirmation required");
  const sql = readFileSync(new URL("./migrations/supabase-initial/0000_clammy_thor.sql", import.meta.url), "utf8");
  const statementsOnly = sql.replace(/ON (DELETE|UPDATE) no action/gi, "");
  if (/\b(DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i.test(statementsOnly)) throw new Error("Unexpected data-changing statement in initial schema");
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '10s'");
  await client.query("SET LOCAL statement_timeout = '60s'");
  await client.query("SET LOCAL search_path = public");
  await client.query("SELECT pg_advisory_xact_lock(17042026)");
  const existing = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  if (existing.rowCount) throw new Error("Refusing initialization: public already contains tables");
  await client.query(sql);
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  for (const { tablename } of tables.rows) {
    const quoted = '"' + tablename.replace(/"/g, '""') + '"';
    await client.query("ALTER TABLE public." + quoted + " ENABLE ROW LEVEL SECURITY");
  }
  await client.query("COMMIT");
  console.log("Created " + tables.rowCount + " application tables with RLS enabled. Supabase internal schemas were not modified.");
} catch (error) {
  await client?.query("ROLLBACK").catch(() => {});
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "INITIALIZATION_REFUSED";
  console.error("Initialization failed: " + code);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
