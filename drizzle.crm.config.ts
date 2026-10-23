import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.CRM_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("CRM_DATABASE_URL is required for CRM migration commands.");
}

export default defineConfig({
  schema: "./lib/crm/db/schema.ts",
  out: "./db/crm/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
