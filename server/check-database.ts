// Run independently of the server: importing the server can trigger startup writes.
let pool: import("pg").Pool | undefined;
let client: import("pg").PoolClient | undefined;
try {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is missing. Set it in the project root .env, then run npm run db:check.");
    process.exitCode = 1;
  } else {
    ({ pool } = await import("./db"));
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SELECT 1");
    console.log("PostgreSQL connection succeeded (read-only transaction).");
    const tls = await client.query("SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()");
    const stream = (client as unknown as { connection: { stream: {
      encrypted?: boolean; authorized?: boolean; getProtocol?: () => string | null;
    } } }).connection.stream;
    console.log("Client-to-pooler TLS:", JSON.stringify({
      encrypted: stream.encrypted === true,
      certificateVerified: stream.authorized === true,
      protocol: stream.getProtocol?.(),
    }));
    console.log("Pooler-to-Postgres TLS (server report):", JSON.stringify(tls.rows));
    if (!stream.encrypted || !stream.authorized) {
      throw Object.assign(new Error("Verified client TLS is required for this inspection"), { code: "TLS_NOT_VERIFIED" });
    }
    const tables = await client.query(`
      SELECT n.nspname AS schema, c.relname AS name,
             c.reltuples::bigint AS estimated_rows,
             has_table_privilege(c.oid, 'SELECT') AS can_select
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
      ORDER BY n.nspname, c.relname
    `);
    console.log("Existing tables (row estimates may be stale):");
    console.table(tables.rows);
    for (const table of tables.rows.filter(t => t.schema === "public")) {
      if (!table.can_select) {
        console.log(`public.${table.name}: SELECT permission unavailable`);
        continue;
      }
      const quotedName = '"' + table.name.replace(/"/g, '""') + '"';
      const result = await client.query(`SELECT EXISTS (SELECT 1 FROM public.${quotedName} LIMIT 1) AS has_rows`);
      console.log(`public.${table.name}: has rows = ${result.rows[0].has_rows}`);
    }
    await client.query("ROLLBACK");
    console.log("Inspection complete. No migrations or data changes executed.");
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) : "configuration";
  console.error(`Database check failed (${code}). Check local DATABASE_URL, certificate trust and network settings. Credentials are not logged.`);
  process.exitCode = 1;
} finally {
  if (client) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
  await pool?.end();
}
