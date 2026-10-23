import "server-only";

import { eq } from "drizzle-orm";
import { assertCrmDatabaseEnvironment, getCrmDb } from "@/lib/crm/db/client";
import { activity, fieldChangeAudit, pipelineStages, relationships, stageHistory } from "@/lib/crm/db/schema";

export async function transitionRelationshipStage(input: {
  relationshipId: string;
  newStageId: string;
  actorInternalUserId: string;
  reason?: string | null;
  source?: string;
}) {
  await assertCrmDatabaseEnvironment();
  const db = getCrmDb();

  return db.transaction(async (tx) => {
    const [relationship] = await tx.select().from(relationships).where(eq(relationships.id, input.relationshipId)).limit(1);
    if (!relationship) throw new Error("CRM relationship not found.");

    const [newStage] = await tx.select().from(pipelineStages).where(eq(pipelineStages.id, input.newStageId)).limit(1);
    if (!newStage || !newStage.active) throw new Error("Target pipeline stage is unavailable.");
    if (!relationship.pipelineId || relationship.pipelineId !== newStage.pipelineId) {
      throw new Error("Target stage does not belong to the relationship pipeline.");
    }
    if (relationship.currentStageId === input.newStageId) return relationship;

    const changedAt = new Date();
    const [updated] = await tx
      .update(relationships)
      .set({ currentStageId: input.newStageId, currentStageEnteredAt: changedAt, updatedAt: changedAt })
      .where(eq(relationships.id, input.relationshipId))
      .returning();

    await tx.insert(stageHistory).values({
      relationshipId: input.relationshipId,
      previousStageId: relationship.currentStageId,
      newStageId: input.newStageId,
      previousStageExitedAt: changedAt,
      newStageEnteredAt: changedAt,
      actorInternalUserId: input.actorInternalUserId,
      source: input.source ?? "crm_api",
      reason: input.reason ?? null,
      evidence: {},
    });

    await tx.insert(fieldChangeAudit).values({
      entityType: "relationship",
      entityId: input.relationshipId,
      fieldName: "current_stage_id",
      oldValue: relationship.currentStageId,
      newValue: input.newStageId,
      actorInternalUserId: input.actorInternalUserId,
      source: input.source ?? "crm_api",
      reason: input.reason ?? "Pipeline stage transition",
    });

    await tx.insert(activity).values({
      relationshipId: input.relationshipId,
      organisationId: relationship.organisationId,
      activityType: "stage_changed",
      actorInternalUserId: input.actorInternalUserId,
      sourceSystem: "holyhub_crm",
      summary: `Relationship stage changed to ${newStage.name}`,
      payload: { previousStageId: relationship.currentStageId, newStageId: input.newStageId },
    });

    return updated;
  });
}
