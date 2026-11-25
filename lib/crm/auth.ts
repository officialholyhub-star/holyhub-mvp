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
  // CRM staff operations require a verified step-up MFA session in addition
  // to an active user and a separately bound CRM staff record. This applies
  // to viewers as well as writers because CRM pages expose contact information.
  const { user, supabase } = await requireUser();
  const { data: aal, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !aal || aal.currentLevel !== "aal2" || aal.nextLevel !== "aal2") {
    throw new CrmAuthorizationError("CRM staff access requires a verified MFA session.");
  }
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
