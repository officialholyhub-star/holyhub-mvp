import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { assertNoProductionDatabaseHint, expectedCrmDatabaseEnvironment, getCrmDatabaseUrl } from "@/lib/crm/env";
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
    "select value from crm_config.system_settings where key = 'system_environment' limit 1",
  );
  const actual = (result.rows[0] as { value?: string } | undefined)?.value;

  if (!actual) {
    throw new Error("CRM database is missing the required system_environment marker.");
  }
  if (actual !== expected) {
    throw new Error(`CRM environment mismatch: runtime expects ${expected}, database reports ${actual}.`);
  }

  verifiedEnvironment = actual;
  return expected;
}

export async function closeCrmPoolForTests(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
  db = null;
  verifiedEnvironment = null;
}
