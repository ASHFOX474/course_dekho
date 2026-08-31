import type { PoolClient } from "pg";

export type TransactionIsolationLevel =
  | "read committed"
  | "repeatable read"
  | "serializable";

export interface TransactionOptions {
  isolationLevel?: TransactionIsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
}

export interface TransactionPool {
  connect(): Promise<PoolClient>;
}

function beginStatement(options: TransactionOptions): string {
  const isolationLevel = options.isolationLevel ?? "read committed";
  const readOnly = options.readOnly ?? false;
  const deferrable = options.deferrable ?? false;

  if (deferrable && (isolationLevel !== "serializable" || !readOnly)) {
    throw new Error("DEFERRABLE requires SERIALIZABLE and READ ONLY.");
  }

  if (isolationLevel === "read committed" && !readOnly && !deferrable) return "BEGIN";

  const clauses = ["BEGIN TRANSACTION", `ISOLATION LEVEL ${isolationLevel.toUpperCase()}`];
  if (readOnly) clauses.push("READ ONLY");
  if (deferrable) clauses.push("DEFERRABLE");
  return clauses.join(" ");
}

export async function withTransaction<T>(
  pool: TransactionPool,
  operation: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const begin = beginStatement(options);
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query(begin);
    transactionStarted = true;
    const result = await operation(client);
    await client.query("COMMIT");
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "Transaction failed and PostgreSQL rollback also failed."
        );
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
