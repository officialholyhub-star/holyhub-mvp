import "server-only";

import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/require-user";
import { assertCrmDatabaseEnvironment, getCrmDb } from "@/lib/crm/db/client";
import { internalUsers } from "@/lib/crm/db/schema";
import { expectedCrmDatabaseEnvironment, getSandboxAdminAuthSubject } from "@/lib/crm/env";

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

  let [crmUser] = await db
    .select()
    .from(internalUsers)
    .where(and(eq(internalUsers.authProvider, "supabase"), eq(internalUsers.authSubject, user.id)))
    .limit(1);

  const sandboxBootstrapSubject = getSandboxAdminAuthSubject();
  if (!crmUser && expectedCrmDatabaseEnvironment() === "sandbox" && sandboxBootstrapSubject === user.id) {
    const [seededAnais] = await db
      .select()
      .from(internalUsers)
      .where(and(eq(internalUsers.displayName, "Anais Daniel"), eq(internalUsers.active, true)))
      .limit(1);

    if (seededAnais && !seededAnais.authSubject) {
      [crmUser] = await db
        .update(internalUsers)
        .set({ authSubject: user.id })
        .where(eq(internalUsers.id, seededAnais.id))
        .returning();
    }
  }

  if (!crmUser || !crmUser.active) throw new CrmAuthorizationError();
  if (!allowedRoles.includes(crmUser.crmRole as CrmRole)) {
    throw new CrmAuthorizationError("Your CRM role does not permit this operation.");
  }

  return { user, crmUser };
}
