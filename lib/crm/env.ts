import "server-only";

export type CrmEnvironment = "local" | "sandbox" | "production";
export type CrmDatabaseEnvironment = "sandbox" | "production";

export function getCrmEnvironment(): CrmEnvironment {
  const value = process.env.CRM_ENVIRONMENT;
  if (value === "local" || value === "sandbox" || value === "production") return value;
  throw new Error("CRM_ENVIRONMENT must be one of: local, sandbox, production.");
}

export function expectedCrmDatabaseEnvironment(): CrmDatabaseEnvironment {
  return getCrmEnvironment() === "production" ? "production" : "sandbox";
}

export function getCrmDatabaseUrl(): string {
  const value = process.env.CRM_DATABASE_URL;
  if (!value) throw new Error("CRM_DATABASE_URL is not configured for this runtime.");
  return value;
}

export function getSandboxAdminAuthSubject(): string | null {
  if (expectedCrmDatabaseEnvironment() !== "sandbox") return null;
  return process.env.CRM_SANDBOX_ADMIN_AUTH_SUBJECT?.trim() || null;
}

export function assertNoProductionDatabaseHint(databaseUrl: string): void {
  if (expectedCrmDatabaseEnvironment() !== "sandbox") return;
  const lowered = databaseUrl.toLowerCase();
  if (lowered.includes("production") || lowered.includes("prod-")) {
    throw new Error("Sandbox/local CRM runtime refused a database URL that looks like Production.");
  }
}
