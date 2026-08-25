import "server-only";

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const globalForPostgres = globalThis as typeof globalThis & {
  courseDekhoPool?: Pool;
};

export const pool =
  globalForPostgres.courseDekhoPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.courseDekhoPool = pool;
}

export default pool;
