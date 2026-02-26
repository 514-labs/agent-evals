import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { Pool, type QueryResult } from "pg";

export interface PgClient {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
}

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

  if (!postgresUrl) {
    throw new Error("POSTGRES_URL is required for assertion execution.");
  }
  if (!clickhouseUrl) {
    throw new Error("CLICKHOUSE_URL is required for assertion execution.");
  }

  const pgPool = new Pool({ connectionString: postgresUrl });
  const clickhouse = createClient({ url: clickhouseUrl });

  return {
    context: {
      pg: {
        query: (text: string, params?: unknown[]) => pgPool.query(text, params),
      },
      clickhouse,
      env: (key: string) => env[key],
    },
    close: async () => {
      await pgPool.end();
      await clickhouse.close();
    },
  };
}
