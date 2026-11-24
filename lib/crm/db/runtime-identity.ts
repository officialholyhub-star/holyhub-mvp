/**
 * N18 runtime connection identity guard.
 *
 * Application-level protection only: an administrative Neon connector can
 * still bypass this API, so it is NOT a ChatGPT operator identity guarantee.
 */
export type CrmConnectionIdentity = {
  db_environment?: unknown;
  db_role?: unknown;
  login_role?: unknown;
} | null | undefined;

export function assertCrmRuntimeIdentity(
  session: CrmConnectionIdentity,
  expectedEnvironment: "sandbox" | "production",
): void {
  if (!session || session.db_environment !== expectedEnvironment) {
    throw new Error("CRM database environment marker missing or mismatched.");
  }

  // No approved production CRM runtime role is configured under A-224.
  if (expectedEnvironment !== "sandbox") {
    throw new Error("Production CRM database access is not activated.");
  }

  // The approved N18 sandbox URL must use this specific least-privilege SQL
  // principal, never a database owner, migrator, read-only or admin role.
  if (session.db_role !== "hh_crm_api_runtime" ||
      session.login_role !== "hh_crm_api_runtime") {
    throw new Error("CRM runtime refused an unexpected database login role.");
  }
}
