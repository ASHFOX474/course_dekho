import type { Pool } from "pg";

/** The common query surface implemented by both pg.Pool and pg.PoolClient. */
export type DatabaseExecutor = Pick<Pool, "query">;
