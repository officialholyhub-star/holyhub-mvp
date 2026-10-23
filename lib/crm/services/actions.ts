import "server-only";

import { and, eq } from "drizzle-orm";
import { assertCrmDatabaseEnvironment, getCrmDb } from "@/lib/crm/db/client";
import { actions, activity, fieldChangeAudit } from "@/lib/crm/db/schema";

export type CreateActionInput = {
  relationshipId: string;
  organisationId?: string | null;
  contactId?: string | null;
  actionType: string;
  title: string;
  dueAt?: Date | null;
  assignedToInternalUserId?: string | null;
  plannedChannel?: string | null;
  plannedSenderAccountId?: string | null;
  source?: string;
};

export async function createCrmAction(input: CreateActionInput, actorInternalUserId: string) {
  await assertCrmDatabaseEnvironment();
  const db = getCrmDb();

  return db.transaction(async (tx) => {
    const [action] = await tx
      .insert(actions)
      .values({
        relationshipId: input.relationshipId,
        organisationId: input.organisationId ?? null,
        contactId: input.contactId ?? null,
        actionType: input.actionType,
        title: input.title,
        dueAt: input.dueAt ?? null,
        assignedToInternalUserId: input.assignedToInternalUserId ?? actorInternalUserId,
        plannedChannel: input.plannedChannel ?? null,
        plannedSenderAccountId: input.plannedSenderAccountId ?? null,
        source: input.source ?? "manual",
      })
      .returning();

    await tx.insert(activity).values({
      relationshipId: input.relationshipId,
      organisationId: input.organisationId ?? null,
      contactId: input.contactId ?? null,
      actionId: action.id,
      activityType: "action_created",
      actorInternalUserId,
      sourceSystem: "holyhub_crm",
      summary: `Action created: ${input.title}`,
      payload: { actionType: input.actionType, dueAt: input.dueAt?.toISOString() ?? null },
    });

    return action;
  });
}

export async function completeCrmAction(actionId: string, actorInternalUserId: string) {
  await assertCrmDatabaseEnvironment();
  const db = getCrmDb();

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(actions).where(and(eq(actions.id, actionId), eq(actions.status, "open"))).limit(1);
    if (!existing) throw new Error("Open CRM action not found.");

    const completedAt = new Date();
    const [updated] = await tx
      .update(actions)
      .set({ status: "completed", completedAt, updatedAt: completedAt })
      .where(eq(actions.id, actionId))
      .returning();

    await tx.insert(fieldChangeAudit).values({
      entityType: "action",
      entityId: actionId,
      fieldName: "status",
      oldValue: "open",
      newValue: "completed",
      actorInternalUserId,
      source: "crm_api",
      reason: "Action completed",
    });

    await tx.insert(activity).values({
      relationshipId: existing.relationshipId,
      organisationId: existing.organisationId,
      contactId: existing.contactId,
      actionId,
      activityType: "action_completed",
      actorInternalUserId,
      sourceSystem: "holyhub_crm",
      summary: `Action completed: ${existing.title}`,
    });

    return updated;
  });
}
