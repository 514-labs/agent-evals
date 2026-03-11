import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { Pool, type QueryResult } from "pg";

export interface PgClient {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
}

const NOOP_PG: PgClient = {
  query: async () => {
    throw new Error("Postgres is not available in this scenario");
  },
};

export interface AssertionContext {
  pg: PgClient;
  clickhouse: ClickHouseClient;
  env: (key: string) => string | undefined;
}

export interface AssertionContextHandle {
  context: AssertionContext;
  close: () => Promise<void>;
}

export function createAssertionContext(
  env: NodeJS.ProcessEnv = process.env,
): AssertionContextHandle {
  const postgresUrl = env.POSTGRES_URL;
  const clickhouseUrl = env.CLICKHOUSE_URL;

  const pgPool = postgresUrl ? new Pool({ connectionString: postgresUrl }) : null;

  const clickhouse = clickhouseUrl
    ? createClient({ url: clickhouseUrl })
    : createClient({ url: "http://localhost:8123" });

  return {
    context: {
      pg: pgPool
        ? { query: (text: string, params?: unknown[]) => pgPool.query(text, params) }
        : NOOP_PG,
      clickhouse,
      env: (key: string) => env[key],
    },
    close: async () => {
      if (pgPool) await pgPool.end();
      await clickhouse.close();
    },
  };
}
