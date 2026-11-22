import "server-only";

import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/require-user";
import { assertCrmDatabaseEnvironment, getCrmDb } from "@/lib/crm/db/client";
import { internalUsers } from "@/lib/crm/db/schema";

export type CrmRole = "crm_admin" | "crm_operator" | "crm_viewer";

export class CrmAuthorizationError extends Error {
  constructor(message = "CRM access is not authorised for this account.") {
    super(message);
    this.name = "CrmAuthorizationError";
  }
}

export async function requireCrmUser(allowedRoles: CrmRole[] = ["crm_admin", "crm_operator", "crm_viewer"]) {
  const { user } = await requireUser();
  await assertCrmDatabaseEnvironment();
  const db = getCrmDb();

  const [crmUser] = await db
    .select()
    .from(internalUsers)
    .where(and(eq(internalUsers.authProvider, "supabase"), eq(internalUsers.authSubject, user.id)))
    .limit(1);

  if (!crmUser || !crmUser.active) throw new CrmAuthorizationError();
  if (!allowedRoles.includes(crmUser.crmRole as CrmRole)) {
    throw new CrmAuthorizationError("Your CRM role does not permit this operation.");
  }

  return { user, crmUser };
}
