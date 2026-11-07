import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required by the Node.js backend. See .env.example.");
}

let isSupabaseDatabase = false;
try {
  const parsedUrl = new URL(databaseUrl);
  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres:// or postgresql:// scheme.");
  }
  isSupabaseDatabase = parsedUrl.hostname.endsWith(".supabase.co")
    || parsedUrl.hostname.endsWith(".pooler.supabase.com");
} catch {
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
}

// pg URL SSL options override the explicit ssl object. Keep certificate files,
// but require full certificate/hostname verification for Supabase endpoints.
const connectionUrl = new URL(databaseUrl);
if (isSupabaseDatabase) {
  connectionUrl.searchParams.set("sslmode", "verify-full");
  if (!connectionUrl.searchParams.has("sslrootcert")) {
    connectionUrl.searchParams.set("sslrootcert", "server/certs/supabase-ca.crt");
  }
  connectionUrl.searchParams.delete("ssl");
  connectionUrl.searchParams.delete("uselibpqcompat");
}

export const pool = new pg.Pool({
  connectionString: connectionUrl.toString(),
  ...(isSupabaseDatabase ? { ssl: { rejectUnauthorized: true } } : {}),
  max: 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
});

pool.on("error", (error: Error) => {
  const code = "code" in error ? String(error.code) : "unknown";
  console.error(`[db] idle connection error (${code})`);
});

export const db = drizzle(pool, { schema });
