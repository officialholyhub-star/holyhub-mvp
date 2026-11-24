import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { assertNoProductionDatabaseHint, expectedCrmDatabaseEnvironment, getCrmDatabaseUrl } from "@/lib/crm/env";
import { assertCrmRuntimeIdentity } from "@/lib/crm/db/runtime-identity";
import * as schema from "@/lib/crm/db/schema";

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let verifiedEnvironment: string | null = null;

export function getCrmPool(): Pool {
  if (pool) return pool;
  const databaseUrl = getCrmDatabaseUrl();
  assertNoProductionDatabaseHint(databaseUrl);
  pool = new Pool({ connectionString: databaseUrl });
  return pool;
}

export function getCrmDb() {
  if (db) return db;
  db = drizzle(getCrmPool(), { schema });
  return db;
}

export async function assertCrmDatabaseEnvironment(): Promise<"sandbox" | "production"> {
  const expected = expectedCrmDatabaseEnvironment();
  if (verifiedEnvironment === expected) return expected;

  const result = await getCrmPool().query(
    `SELECT
       (SELECT value FROM crm_config.system_settings WHERE key='system_environment' LIMIT 1) AS db_environment,
       current_user::text AS db_role,
       session_user::text AS login_role`,
  );
  // Check the database environment and login principal on the same connection.
  // This prevents an accidentally configured owner/admin connection from being
  // treated as a safe CRM application principal.
  assertCrmRuntimeIdentity(result.rows[0], expected);
  verifiedEnvironment = expected;
  return expected;
}

export async function closeCrmPoolForTests(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
  db = null;
  verifiedEnvironment = null;
}
